// Typed boundary between the Results/Audio screens and whatever produces nights.
//
// The SAMPLE night comes from the shared overnight core (`buildSampleNightView` in src/night), which is synthetic and
// labelled as such (isSample: true, "Sample" badge, dashed purple border). A sample never feeds the overview headline
// (the overview calls listRealNights() only, and nightRulesInput ignores synthetic nights for the conclusion).
// Real nights come from the on-device night store (manifest + epoch log per night, no audio), summarized by the core's
// summarizeNight. A night left open by a crash is closed with recoverUnfinishedNight when it is first listed.
//
// Conclusions are never computed here or in the UI. Evidence comes from nightRulesInput() via state/evidence.ts.
import { useCallback, useEffect, useState } from 'react';
import { NIGHT_REASON_TOO_SHORT } from '@core/content/claims';
import { buildSampleNightView, summarizeNight, type EpochRecord, type NightView } from '@core/night';
import { computeCoverage, type Coverage } from '@core/mobileLogic/coverage';
import { newDiagnostics, addGap, pushEvent, startRun, stopRun, type NightDiagnostics } from '@core/mobileLogic/diagnostics';
import { viewForStored } from '@core/mobileLogic/nightSession';
import { captureController } from '../capture/controller';
import { devStressNightCount } from '../dev/devParams';
import { getNightStore } from './nightStoreInstance';

export type NightAudioState = 'snore-like-observed' | 'few-observations' | 'not-assessed' | 'model-not-applicable' | 'no-model' | 'not-recorded';
export type EpochState = 'asleep' | 'uncertain' | 'awake';

export interface NightListItem {
  id: string;
  /** ISO date of the night's start. */
  dateISO: string;
  isSample: boolean;
  recordedMinutes: number;
  state: NightAudioState;
  /** Strings from the core (notAssessedReasons). Non-empty only for not-assessed. */
  notAssessedReasons: string[];
  /** Equal-length display bins across the estimated window. Empty when there is no estimate. */
  epochs: EpochState[];
  epochMinutes: number;
  estimatedWindow: { startMin: number; endMin: number } | null;
  signals: { used: string[]; unavailable: string[]; total: number };
  sensitivity: { likelyAsleep: number; includingUncertain: number } | null;
  snoreWindows: { snoreLike: number; assessable: number; tooQuiet: number } | null;
  /** Recording coverage of the scheduled hours (recorded / assessable / too quiet / not recorded / outside). Audio only; not a sleep estimate. */
  coverage: Coverage;
  /** Of the snore-like windows in the totals, how many fall in time the (unvalidated) estimate labels likely-awake. Context only: they are already counted. */
  snoreLikeInAwakeGuess: number | null;
  /** Technical record of the capture. null for sample nights and for nights recorded before it existed. */
  diagnostics: NightDiagnostics | null;
  /** The core's night view. Evidence is derived from it by nightRulesInput(); the UI never interprets it. */
  view: NightView;
}

export type NightStatus = 'loading' | 'ready' | 'error';

export interface NightSource {
  listRealNights(): Promise<NightListItem[]>;
  getSampleNight(variant?: NightAudioState): NightListItem;
  getNight(id: string): Promise<NightListItem | null>;
  deleteNight(id: string): Promise<void>;
}

export const SAMPLE_NIGHT_ID = 'sample';
const BIN_EPOCHS = 30; // 30 s epochs -> 15 minute display bins
const EPOCH_SEC = 30;

function binStates(view: NightView): EpochState[] {
  const w = view.summary.estimatedWindow;
  if (!w) return [];
  const inWin = view.estimates.map((e, i) => ({ e, t: view.epochs[i]?.t ?? 0 })).filter((x) => x.t >= w.start && x.t < w.end);
  const out: EpochState[] = [];
  for (let i = 0; i < inWin.length; i += BIN_EPOCHS) {
    const chunk = inWin.slice(i, i + BIN_EPOCHS);
    const count = (st: string) => chunk.filter((x) => x.e.state === st).length;
    const asleep = count('likely-asleep');
    const awake = count('likely-awake');
    out.push(asleep >= chunk.length * 0.6 ? 'asleep' : awake >= chunk.length * 0.6 ? 'awake' : 'uncertain');
  }
  return out;
}

function minuteOfDay(ms: number, utc: boolean): number {
  const d = new Date(ms);
  return utc ? d.getUTCHours() * 60 + d.getUTCMinutes() : d.getHours() * 60 + d.getMinutes();
}

/** The label date of a night. Real nights use the LOCAL calendar date of the evening they started (before noon counts as the night before). Samples use UTC. */
function nightDateISO(view: NightView): string {
  const start = new Date(view.record.captureStart);
  if (view.summary.isSynthetic) return start.toISOString();
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() - (start.getHours() < 12 ? 1 : 0));
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString();
}

export function toNightListItem(view: NightView, diagnostics: NightDiagnostics | null = null): NightListItem {
  const s = view.summary;
  const utc = s.isSynthetic;
  const assessed = s.nightState !== 'not-assessed' && s.nightState !== 'not-recorded';
  const asleepLine = s.sensitivity.asleepOnly;
  const withUncertain = s.sensitivity.withUncertain;
  return {
    id: s.isSynthetic ? SAMPLE_NIGHT_ID : s.nightId,
    dateISO: nightDateISO(view),
    isSample: s.isSynthetic,
    recordedMinutes: Math.round(s.recordedSec / 60),
    state: s.nightState,
    notAssessedReasons: s.nightState === 'not-assessed' ? s.notAssessedReasons : [],
    epochs: binStates(view),
    epochMinutes: (BIN_EPOCHS * EPOCH_SEC) / 60,
    estimatedWindow: s.estimatedWindow ? { startMin: minuteOfDay(s.estimatedWindow.start, utc), endMin: minuteOfDay(s.estimatedWindow.end, utc) } : null,
    signals: {
      used: s.signalsUsed.filter((x) => x.usable).map((x) => x.name),
      unavailable: s.signalsUsed.filter((x) => !x.usable).map((x) => x.name),
      total: s.signalsUsed.length,
    },
    sensitivity: assessed ? { likelyAsleep: asleepLine.snoreLikeWindows, includingUncertain: withUncertain.snoreLikeWindows } : null,
    snoreWindows:
      assessed && s.nightState !== 'no-model' && s.nightState !== 'model-not-applicable'
        ? { snoreLike: s.snoreLikeWindows, assessable: s.assessableWindows, tooQuiet: s.unscoredWindows.tooQuiet }
        : null,
    coverage: computeCoverage(view.epochs, view.schedule),
    snoreLikeInAwakeGuess: assessed ? s.sensitivity.inLikelyAwake.snoreLikeWindows : null,
    diagnostics: s.isSynthetic && !diagnostics?.devPreview ? null : diagnostics,
    view,
  };
}

/**
 * Sample for any display state. The two states the core can build (snore-like-observed, few-observations) use its sample
 * views directly. The remaining states are gallery previews: the same synthetic view with only its state label changed,
 * so every state card can be reviewed. They are always isSample.
 */
function buildSample(variant: NightAudioState): NightListItem {
  const base = buildSampleNightView(variant === 'snore-like-observed' ? 'snore-episodes' : 'quiet');
  if (variant === 'snore-like-observed' || variant === 'few-observations') return toNightListItem(base);
  const view: NightView = {
    ...base,
    summary: {
      ...base.summary,
      nightState: variant,
      notAssessedReasons: variant === 'not-assessed' ? [NIGHT_REASON_TOO_SHORT] : [],
    },
  };
  const item = toNightListItem(view);
  return variant === 'not-assessed' || variant === 'not-recorded' ? { ...item, epochs: [], estimatedWindow: null, sensitivity: null, snoreWindows: null } : item;
}

/** Dev-only (web preview, `?nights=N`): N clones of the sample view with distinct ids and dates, to stress long lists. */
function stressNights(n: number): NightListItem[] {
  const base = buildSample('snore-like-observed');
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i - 1);
    const item = { ...base, id: `stress-${i}`, isSample: false, dateISO: new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString() };
    // Night 0 is a generated layout preview with a recording gap, a quiet stretch and an early stop, so every
    // coverage kind and the diagnostics section can be reviewed. It is labelled in diagnostics (devPreview).
    return i === 0 ? previewWithGaps(item) : item;
  });
}

/** Dev-only. Removes a stretch of epochs (a gap), marks another stretch too quiet to score, and cuts the end. */
function previewWithGaps(item: NightListItem): NightListItem {
  const v = item.view;
  const epochs: EpochRecord[] = [];
  v.epochs.forEach((e, k) => {
    if (k >= 360 && k < 390) return; // 15 min gap
    if (k >= 900) return; // stopped 30 min early
    if (k >= 560 && k < 680) {
      epochs.push({ ...e, win: { ...e.win, scored: 0, snoreLike: 0, tooQuiet: e.win.total, belowGate: 0 }, scoredMask: undefined, snoreBits: undefined, scoreQ: undefined });
      return;
    }
    epochs.push(e);
  });
  const view = summarizeNight(v.record, epochs, v.schedule);
  const sched = v.schedule;
  let d = newDiagnostics({ nightId: v.record.id, device: { model: 'Preview (not a device)', os: 'n/a', app: 'dev' }, scheduledStartMs: sched?.startMs ?? null, scheduledEndMs: sched?.endMs ?? null });
  const gapStart = (epochs[0]?.t ?? 0) + 360 * 30_000;
  d = startRun(d, epochs[0]?.t ?? 0, { atMs: epochs[0]?.t ?? 0, pct: 82, charging: false, lowPowerMode: false });
  d = pushEvent(d, { atMs: gapStart, kind: 'interruption-began', detail: 'shouldResume=true' });
  d = pushEvent(d, { atMs: gapStart + 840_000, kind: 'interruption-ended', detail: 'shouldResume=true' });
  d = pushEvent(d, { atMs: gapStart + 850_000, kind: 'resume-attempt', detail: 'interruption-ended #1' });
  d = pushEvent(d, { atMs: gapStart + 900_000, kind: 'resume-ok', detail: 'interruption-ended' });
  d = addGap(d, { startMs: gapStart, endMs: gapStart + 900_000, cause: 'interruption' });
  d = stopRun(d, (epochs[epochs.length - 1]?.t ?? 0) + 30_000, 'user-stop', { atMs: (epochs[epochs.length - 1]?.t ?? 0) + 30_000, pct: 69, charging: false, lowPowerMode: false });
  d = { ...d, devPreview: true };
  return { ...toNightListItem(view, d), id: item.id, isSample: false, dateISO: item.dateISO };
}

async function loadStored(): Promise<NightListItem[]> {
  const stress = devStressNightCount();
  if (stress !== null) return stressNights(stress);
  await captureController.finalizePaused();
  const stored = await getNightStore().list(captureController.activeNightId() ? [captureController.activeNightId() as string] : []);
  const items: NightListItem[] = [];
  for (const n of stored) {
    try {
      items.push(toNightListItem(viewForStored(n), n.diagnostics));
    } catch {
      // A night that cannot be summarized is left out rather than shown wrong.
    }
  }
  return items;
}

export const nightSource: NightSource = {
  /** Real, on-device nights only. The sample night is never in this list. */
  async listRealNights() {
    return loadStored();
  },
  getSampleNight(variant = 'snore-like-observed') {
    return buildSample(variant);
  },
  async getNight(id) {
    if (id === SAMPLE_NIGHT_ID) return buildSample('snore-like-observed');
    return (await loadStored()).find((n) => n.id === id) ?? null;
  },
  async deleteNight(id) {
    getNightStore().remove(id);
  },
};

export function useRealNights(): { status: NightStatus; nights: NightListItem[]; reload: () => void } {
  const [state, setState] = useState<{ status: NightStatus; nights: NightListItem[] }>({ status: 'loading', nights: [] });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async load: show the loading state before awaiting
    setState((s) => ({ ...s, status: 'loading' }));
    nightSource
      .listRealNights()
      .then((nights) => live && setState({ status: 'ready', nights }))
      .catch(() => live && setState({ status: 'error', nights: [] }));
    return () => {
      live = false;
    };
  }, [tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
