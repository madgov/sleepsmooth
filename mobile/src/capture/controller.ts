// App-level capture controller. Wraps the M1 CaptureSpike (the only audio code path that has been written against the
// library) and connects it to the overnight pipeline (src/night) and the on-device night store.
//
// Hot path: each PCM buffer is resampled and queued synchronously (NightSession.enqueue). Window processing runs in small
// slices on setTimeout(0), so a backlog never blocks the audio callback. By default audio is never written: the pipeline
// keeps it in RAM only, and the store persists one JSON line per 30 s epoch plus a manifest. ONLY when the user has turned
// on clip saving (Settings, off by default) a ClipRecorder also keeps a 20 s RAM ring and writes at most 5 short clips.
import { AppState } from 'react-native';
import { classifyLiveness, planStart, scheduledEndMs, type CaptureEndReason, type Liveness, type SessionRecord } from '@core/mobileLogic/capture';
import { dbToMeter } from '@core/mobileLogic/index';
import * as Battery from 'expo-battery';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { ModelJson } from '@core/audio/model/schema';
import modelJson from '@core/audio/model/model.json';
import { NightSession, PUMP_SLICE_WINDOWS, viewForStored, type SessionEnv } from '@core/mobileLogic/nightSession';
import { ClipRecorder } from '@core/mobileLogic/clips';
import { clearClipTemp, clipTempSink, finalizeClips } from '../clips/clipFiles';
import { getNightStore } from '../data/nightStoreInstance';
import { getSettings, updateSettings } from '../state/settings';
import { hardStopMs, detectWakeSignal, onRecordingStarted, recordMorning, shouldAutoStop, type RecentEpoch } from '@core/mobileLogic/morningLearning';
import { resolveScheduleWindow, type EpochRecord } from '@core/night';
import { MotionSensor } from './motion';
import { CaptureSpike } from './captureSpike';

const MODEL = modelJson as unknown as ModelJson;
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const ENV: SessionEnv = {
  deviceModel: 'iPhone',
  osVersion: String(Platform.Version),
  appVersion: Constants.expoConfig?.version ?? 'unknown',
  tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  utcOffsetMinutes: (at) => -new Date(at).getTimezoneOffset(),
};
/** Reasons after which the same night may continue when the user starts again (see planStart). */
const PAUSE_REASONS: readonly CaptureEndReason[] = ['interrupted-call-or-alarm', 'mic-lost'];

export type CaptureStatus = 'idle' | 'starting' | 'recording' | 'stopping' | 'stopped' | 'error';

export interface CaptureSnapshot {
  status: CaptureStatus;
  liveness: Liveness;
  startedAtMs: number | null;
  endAtMs: number | null;
  endReason: CaptureEndReason | null;
  /** True when this run continued an earlier interrupted session. */
  appended: boolean;
  gapCount: number;
  error: string | null;
  /** What happened to the night after the last stop. 'none' until a night ends. */
  summary: 'none' | 'summarizing' | 'ready' | 'failed';
  /** Id of the last finished night in the store. */
  nightId: string | null;
  /**
   * Morning stop. 'prompt': the morning signal fired and the user is being asked. 'kept': the user chose Keep recording
   * (no more prompts or automatic stop tonight). 'auto-stopped': recording ended by itself (learned automatic mode).
   */
  morning: 'none' | 'prompt' | 'kept' | 'auto-stopped';
  /** When the morning signal fired (ms). A heuristic from the unvalidated sleep-state estimate, movement and pickups. */
  wakeSignalAtMs: number | null;
  autoStoppedAtMs: number | null;
}

const idle: CaptureSnapshot = { status: 'idle', liveness: 'receiving', startedAtMs: null, endAtMs: null, endReason: null, appended: false, gapCount: 0, error: null, summary: 'none', nightId: null, morning: 'none', wakeSignalAtMs: null, autoStoppedAtMs: null };

class CaptureController {
  private spike = new CaptureSpike();
  private snap: CaptureSnapshot = idle;
  private listeners = new Set<() => void>();
  private levelListeners = new Set<(level01: number, tickMs: number) => void>();
  private session: SessionRecord | null = null;
  private lastChunkMs = 0;
  private lastChunkCount = 0;
  private interruptionsAtLastChunk = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private night: NightSession | null = null;
  private pumpTimer: ReturnType<typeof setTimeout> | null = null;
  private ctxSubs: { remove(): void }[] = [];
  /** Opt-in clip picker. null unless the user turned clip saving on before this night started. */
  private clips: ClipRecorder | null = null;
  /** Accelerometer seconds of motion per second (docs in ./motion.ts). */
  private motion = new MotionSensor();
  /** Recent epochs for the morning signal, newest last. In memory only. */
  private recent: RecentEpoch[] = [];
  private windowStartMs = 0;

  constructor() {
    this.spike.subscribe(() => this.onSpike());
    this.spike.setPcmSink((x, rate, gapSec, interruptions) => this.onPcm(x, rate, gapSec, interruptions));
  }

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };
  getSnapshot = () => this.snap;
  subscribeLevel = (cb: (level01: number, tickMs: number) => void) => {
    this.levelListeners.add(cb);
    return () => {
      this.levelListeners.delete(cb);
    };
  };
  /** The recorded session bookkeeping (start, gaps, end reason) for a future night store. Contains no audio. */
  getSession = () => this.session;
  /** Plain-text spike log (no audio). Dev lab only. */
  getLog = () => this.spike.getLog();

  private set(p: Partial<CaptureSnapshot>) {
    const next = { ...this.snap, ...p };
    const changed = (Object.keys(next) as (keyof CaptureSnapshot)[]).some((k) => next[k] !== this.snap[k]);
    if (!changed) return;
    this.snap = next;
    this.listeners.forEach((l) => l());
  }

  async start(wakeMin: number): Promise<void> {
    if (this.snap.status === 'starting' || this.snap.status === 'recording') return;
    const now = Date.now();
    const plan = planStart(this.session, now);
    const appended = plan.kind === 'append' && this.session !== null;
    if (plan.kind === 'append' && this.session) {
      this.session = { ...this.session, gaps: [...this.session.gaps, plan.gap], endReason: null, lastActivityMs: now };
    } else {
      this.session = { startedAtMs: now, lastActivityMs: now, gaps: [], endReason: null };
    }
    this.lastChunkMs = now;
    this.lastChunkCount = 0;
    this.interruptionsAtLastChunk = 0;
    // A restart soon after an automatic stop means the user did not want it to stop: learning starts over.
    updateSettings((p) => ({ ...p, morning: onRecordingStarted(p.morning, now) }));
    await this.openNight(plan, now);
    this.set({
      status: 'starting',
      summary: 'none',
      nightId: null,
      liveness: 'receiving',
      startedAtMs: this.session.startedAtMs,
      endAtMs: scheduledEndMs(now, wakeMin),
      endReason: null,
      appended,
      gapCount: this.session.gaps.length,
      error: null,
      morning: 'none',
      wakeSignalAtMs: null,
      autoStoppedAtMs: null,
    });
    await this.spike.start({ iosCategory: 'playAndRecord', iosMode: 'measurement' });
    this.timer ??= setInterval(() => this.tick(), 1000);
  }

  async stop(reason: CaptureEndReason = 'user-stop', auto = false): Promise<void> {
    if (this.snap.status !== 'recording' && this.snap.status !== 'starting') return;
    this.noteMorningOutcome(reason, auto);
    this.set({ status: 'stopping' });
    await this.spike.stop();
    this.finish(reason);
    await this.endNight(reason);
  }

  /**
   * Morning learning input. A manual stop while the morning prompt is showing is the user's confirmation. The hard stop and
   * every other route break the run of confirmed mornings. The automatic stop is recorded by autoStop().
   */
  private noteMorningOutcome(reason: CaptureEndReason, auto = false) {
    if (this.snap.status !== 'recording') return;
    if (auto) return;
    const now = Date.now();
    const outcome =
      reason === 'user-stop' && this.snap.morning === 'prompt'
        ? ({ kind: 'confirmed-stop', stopAtMs: now, wakeSignalAtMs: this.snap.wakeSignalAtMs } as const)
        : reason === 'scheduled-end'
          ? ({ kind: 'hard-stop' } as const)
          : ({ kind: 'stopped-other' } as const);
    // Only stops at or after the scheduled wake time say anything about the morning.
    if (outcome.kind === 'stopped-other' && (this.snap.endAtMs === null || now < this.snap.endAtMs - 3_600_000)) return;
    updateSettings((p) => ({ ...p, morning: recordMorning(p.morning, outcome) }));
  }

  /** The user tapped Keep recording on the morning prompt: nothing stops tonight, and morning learning starts over. */
  keepRecording(): void {
    if (this.snap.status !== 'recording' || this.snap.morning !== 'prompt') return;
    updateSettings((p) => ({ ...p, morning: recordMorning(p.morning, { kind: 'keep-recording' }) }));
    this.set({ morning: 'kept' });
  }

  private autoStop() {
    const now = Date.now();
    updateSettings((p) => ({ ...p, morning: recordMorning(p.morning, { kind: 'auto-stopped', stopAtMs: now }) }));
    this.set({ morning: 'auto-stopped', autoStoppedAtMs: now });
    void this.stop('scheduled-end', true);
  }

  private finish(reason: CaptureEndReason) {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.session) this.session = { ...this.session, endReason: reason, lastActivityMs: Date.now() };
    this.set({ status: this.snap.status === 'error' ? 'error' : 'stopped', endReason: reason });
  }

  // ---- night lifecycle --------------------------------------------------------------------------------------------

  private async openNight(plan: ReturnType<typeof planStart>, now: number) {
    const open = this.night && !this.night.isDone ? this.night : null;
    if (plan.kind === 'append' && open) {
      // Same night continues. The time with no audio is recorded as a gap (a night's epochs stay on one timeline).
      const gapSec = Math.max(0, (plan.gap.toMs - plan.gap.fromMs) / 1000);
      open.markGap(gapSec, 'interrupted-call-or-alarm');
      this.clips?.markGap(gapSec);
      this.attachContext(open);
      return;
    }
    if (open) await this.endNight(this.session?.endReason ?? 'os-killed-or-crash-recovered', true);
    const settings = getSettings();
    // Clip saving is opt-in and off by default. With it off, no recorder exists and no audio is ever written.
    this.clips = settings.clips.enabled ? new ClipRecorder(now, clipTempSink) : null;
    const clips = this.clips;
    this.night = NightSession.open({
      store: getNightStore(),
      model: MODEL,
      env: ENV,
      nowMs: now,
      bedtimeLocal: hhmm(settings.sleep.bedMin),
      wakeLocal: hhmm(settings.sleep.wakeMin),
      remindEnabled: settings.sleep.reminder,
      initialContext: { appActive: AppState.currentState === 'active', motionAvailable: false },
      onEpochs: (eps) => this.onEpochs(eps),
      ...(clips ? { onWindow: (w) => clips.onWindow(w) } : {}),
    });
    this.recent = [];
    this.windowStartMs = resolveScheduleWindow(now, { bedtimeLocal: hhmm(settings.sleep.bedMin), wakeLocal: hhmm(settings.sleep.wakeMin) }, ENV.utcOffsetMinutes(now)).startMs;
    this.attachContext(this.night);
  }

  private onEpochs(eps: readonly EpochRecord[]) {
    for (const e of eps) this.recent.push({ t: e.t, state: e.state, motionSec: e.motionSec, appActive: e.appActive });
    if (this.recent.length > 60) this.recent.splice(0, this.recent.length - 60);
  }

  /** AppState and battery feed the epoch context (they decide the provisional awake/asleep labels, nothing else). */
  private attachContext(n: NightSession) {
    this.detachContext();
    this.ctxSubs.push(AppState.addEventListener('change', (st) => n.setContext({ appActive: st === 'active' })));
    const apply = async () => {
      try {
        const [st, lvl] = await Promise.all([Battery.getBatteryStateAsync(), Battery.getBatteryLevelAsync()]);
        n.setContext({
          charging: st === Battery.BatteryState.CHARGING || st === Battery.BatteryState.FULL ? true : st === Battery.BatteryState.UNPLUGGED ? false : null,
          battery: lvl >= 0 ? Math.round(lvl * 100) : null,
        });
      } catch {
        n.setContext({ charging: null, battery: null });
      }
    };
    void apply();
    void this.motion.start().then((ok) => {
      if (ok) n.setContext({ motionAvailable: true });
    });
    this.ctxSubs.push(Battery.addBatteryStateListener(() => void apply()), Battery.addBatteryLevelListener(() => void apply()));
  }
  private detachContext() {
    this.motion.stop();
    for (const s of this.ctxSubs) s.remove();
    this.ctxSubs = [];
  }

  /**
   * End of a run. Interruption-type endings keep the night open so a restart can append to it. Every other ending closes
   * it: drain the queue, write the last epochs and the closed manifest, then read the night back through the store and
   * summarize it (the same path Results uses), so 'ready' means the summary really exists.
   */
  private async endNight(reason: CaptureEndReason, silent = false) {
    const n = this.night;
    if (!n || n.isDone) return;
    this.cancelPump();
    if (PAUSE_REASONS.includes(reason) && !silent) {
      this.detachContext();
      return;
    }
    this.detachContext();
    if (!silent) this.set({ summary: 'summarizing' });
    await new Promise<void>((r) => setTimeout(r, 0)); // let the "Summarizing" state paint first
    try {
      const record = n.finish(reason);
      await this.finishClips(record.id);
      const stored = await getNightStore().get(record.id);
      if (!stored || n.hasStorageError) throw new Error('night not stored');
      viewForStored(stored); // throws if the stored night cannot be summarized
      if (!silent) this.set({ summary: 'ready', nightId: record.id });
    } catch {
      if (!silent) this.set({ summary: 'failed', nightId: null });
    }
  }

  /** Move the picked clips into the night's folder. A failure only costs the clips, never the night. */
  private async finishClips(nightId: string) {
    const rec = this.clips;
    this.clips = null;
    if (!rec) return;
    try {
      await finalizeClips(nightId, rec.finish(), Date.now());
    } catch {
      rec.discard();
      clearClipTemp();
    }
  }

  /** Close a night that was left open by an interruption and never restarted. Results calls this before listing. */
  async finalizePaused(): Promise<void> {
    if (this.snap.status === 'recording' || this.snap.status === 'starting' || this.snap.status === 'stopping') return;
    if (this.night && !this.night.isDone) await this.endNight(this.session?.endReason ?? 'os-killed-or-crash-recovered', true);
  }

  /** Id of the night being recorded (or paused), so a listing does not touch its open files. */
  activeNightId = (): string | null => (this.night && !this.night.isDone ? this.night.id : null);

  /** Stop and forget everything in memory. Used by "Delete my data"; the caller deletes the files. */
  async discardAll(): Promise<void> {
    await this.stop('user-stop').catch(() => undefined);
    this.cancelPump();
    this.detachContext();
    this.clips?.discard();
    this.clips = null;
    clearClipTemp();
    this.night = null;
    this.session = null;
    this.set({ ...idle });
  }

  // ---- audio path -------------------------------------------------------------------------------------------------

  private onPcm(x: Float32Array, rate: number, gapSec: number, interruptions: number) {
    const n = this.night;
    if (!n || n.isDone) return;
    if (gapSec > 0) {
      n.markGap(gapSec, interruptions > this.interruptionsAtLastChunk ? 'interrupted-call-or-alarm' : 'late-buffers');
      this.clips?.markGap(gapSec);
    }
    n.enqueue(x, rate);
    this.clips?.pushAudio(x, rate);
    this.schedulePump();
  }

  private schedulePump() {
    if (this.pumpTimer) return;
    this.pumpTimer = setTimeout(() => {
      this.pumpTimer = null;
      const n = this.night;
      if (!n || n.isDone) return;
      n.pump(PUMP_SLICE_WINDOWS);
      if (n.hasStorageError) {
        void this.stop('storage-error');
        return;
      }
      if (n.backlogSec() >= 1) this.schedulePump();
    }, 0);
  }
  private cancelPump() {
    if (this.pumpTimer) clearTimeout(this.pumpTimer);
    this.pumpTimer = null;
  }

  private onSpike() {
    const s = this.spike.getStats();
    if (s.phase === 'recording' && this.snap.status !== 'recording' && this.snap.status !== 'stopping') this.set({ status: 'recording' });
    if (s.phase === 'error') {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      const denied = (s.error ?? '').toLowerCase().includes('permission');
      this.set({ status: 'error', error: s.error ?? 'error', endReason: denied ? null : 'mic-lost' });
      if (this.session) this.session = { ...this.session, endReason: denied ? null : 'mic-lost', lastActivityMs: Date.now() };
      this.abandonEmptyNight();
      return;
    }
    if (s.chunks !== this.lastChunkCount) {
      this.lastChunkCount = s.chunks;
      this.lastChunkMs = Date.now();
      this.interruptionsAtLastChunk = s.interruptions;
      if (this.session) this.session = { ...this.session, lastActivityMs: this.lastChunkMs };
      const lvl = dbToMeter(s.lastRmsDb);
      this.levelListeners.forEach((cb) => cb(lvl, this.lastChunkMs));
    }
  }

  /** A start that never received audio (permission denied, session error) leaves no night behind. */
  private abandonEmptyNight() {
    const n = this.night;
    if (!n || n.isDone || n.epochsWritten > 0 || this.lastChunkCount > 0) return;
    this.cancelPump();
    this.detachContext();
    try {
      getNightStore().remove(n.id);
    } catch {
      /* nothing to remove */
    }
    this.clips?.discard();
    this.clips = null;
    this.night = null;
  }

  private tickMorning(now: number) {
    const endAt = this.snap.endAtMs;
    if (endAt === null || this.snap.morning === 'kept' || this.snap.morning === 'auto-stopped') return;
    let signalAt = this.snap.wakeSignalAtMs;
    if (signalAt === null) {
      const sig = detectWakeSignal({ nowMs: now, windowStartMs: this.windowStartMs, windowEndMs: endAt, epochs: this.recent });
      if (!sig) return;
      signalAt = sig.atMs;
      this.set({ morning: 'prompt', wakeSignalAtMs: signalAt });
    }
    if (shouldAutoStop(getSettings().morning, now, signalAt)) this.autoStop();
  }

  private tick() {
    if (this.snap.status !== 'recording') return;
    const now = Date.now();
    // Hard stop: the window end plus the estimator's grace period. It always applies, whatever the morning mode is.
    if (this.snap.endAtMs !== null && now >= hardStopMs(this.snap.endAtMs)) {
      void this.stop('scheduled-end');
      return;
    }
    if (this.night && !this.night.isDone && this.motion.isRunning) this.night.addMotionSeconds(this.motion.drain());
    this.tickMorning(now);
    const s = this.spike.getStats();
    const liveness = classifyLiveness({ nowMs: now, lastChunkMs: this.lastChunkMs, interruptions: s.interruptions, interruptionsAtLastChunk: this.interruptionsAtLastChunk });
    if (liveness === 'ended-by-interruption' && AppState.currentState === 'active') {
      void this.stop('interrupted-call-or-alarm');
      return;
    }
    this.set({ liveness });
  }
}

export const captureController = new CaptureController();
