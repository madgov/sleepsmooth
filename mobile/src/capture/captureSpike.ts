// M1 capture spike. Streams PCM from react-native-audio-api, keeps ONLY counters and a plain-text log in RAM.
// It never writes audio anywhere: no file output is enabled on the recorder, buffers are dropped after the
// RMS is computed, and the only thing optionally saved is the text log (no audio).
import { AppState, type AppStateStatus } from 'react-native';
import type { IOSCategory, IOSMode } from 'react-native-audio-api';
import { audioApi } from '../native/audioApi';

// Resolved lazily through the wrapper so Expo Go (no native audio module) never evaluates the real package.
const { AudioManager, AudioRecorder } = audioApi;
type AudioRecorderInstance = InstanceType<typeof AudioRecorder>;

export const GAP_THRESHOLD_MS = 2000;
const HEARTBEAT_MS = 60_000;
const MAX_LOG_LINES = 20_000;
export const REQUESTED_SAMPLE_RATE = 16_000;
const BUFFER_LENGTH = 16_000; // ~1 s of audio per callback at the requested rate

export interface SessionConfig {
  iosCategory: IOSCategory;
  iosMode: IOSMode;
}

export interface CaptureStats {
  phase: 'idle' | 'starting' | 'recording' | 'stopping' | 'stopped' | 'error';
  chunks: number;
  reportedSampleRate: number | null;
  lastFrames: number | null;
  audioSeconds: number;
  wallSeconds: number;
  backgroundSeconds: number;
  lastRmsDb: number | null;
  arrivalGaps: number;
  audioGaps: number;
  maxArrivalGapMs: number;
  maxAudioGapMs: number;
  interruptions: number;
  digitalSilenceChunks: number;
  appState: AppStateStatus;
  error: string | null;
}

const initialStats = (): CaptureStats => ({
  phase: 'idle',
  chunks: 0,
  reportedSampleRate: null,
  lastFrames: null,
  audioSeconds: 0,
  wallSeconds: 0,
  backgroundSeconds: 0,
  lastRmsDb: null,
  arrivalGaps: 0,
  audioGaps: 0,
  maxArrivalGapMs: 0,
  maxAudioGapMs: 0,
  interruptions: 0,
  digitalSilenceChunks: 0,
  appState: AppState.currentState,
  error: null,
});

const mono = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const iso = (ms: number) => new Date(ms).toISOString();

/** Receives each PCM buffer after the spike's own bookkeeping. gapSec > 0 when the audio timeline jumped (samples missing). */
export type PcmSink = (samples: Float32Array, sampleRate: number, gapSec: number, interruptions: number) => void;

export class CaptureSpike {
  private pcmSink: PcmSink | null = null;
  /** Additive hook for the app controller. The lab never sets it, so the lab behaves exactly as before. */
  setPcmSink(sink: PcmSink | null) {
    this.pcmSink = sink;
  }
  private stats: CaptureStats = initialStats();
  private lines: string[] = [];
  private listeners = new Set<() => void>();
  private recorder: AudioRecorderInstance | null = null;
  private subs: { remove(): void }[] = [];
  private startMono = 0;
  private startWall = 0;
  private lastArrivalMono = 0;
  private lastArrivalWall = 0;
  private expectedWhen: number | null = null;
  private lastHeartbeatMono = 0;
  private bgSince: number | null = null;
  private bgAccumMs = 0;
  private minRms = 0;
  private maxRms = 0;
  private lastZero = false;

  // ---- observable state -------------------------------------------------------------------------
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getStats = () => this.stats;
  getLog = () => this.lines.join('\n');
  getLineCount = () => this.lines.length;
  private emit() {
    for (const l of this.listeners) l();
  }
  private patch(p: Partial<CaptureStats>) {
    this.stats = { ...this.stats, ...p };
    this.emit();
  }
  private log(tag: string, msg: string) {
    if (this.lines.length >= MAX_LOG_LINES) return;
    this.lines.push(`${iso(Date.now())} +${this.startMono ? ((mono() - this.startMono) / 1000).toFixed(1) : '0.0'}s [${tag}] ${msg}`);
    if (this.lines.length === MAX_LOG_LINES) this.lines.push('--- log cap reached; later lines dropped ---');
  }
  note(tag: string, msg: string) {
    this.log(tag, msg);
    this.emit();
  }

  // ---- lifecycle ---------------------------------------------------------------------------------
  async start(cfg: SessionConfig): Promise<void> {
    if (this.stats.phase === 'starting' || this.stats.phase === 'recording') return;
    this.lines = [];
    this.stats = { ...initialStats(), phase: 'starting' };
    this.startMono = mono();
    this.startWall = Date.now();
    this.lastArrivalMono = this.startMono;
    this.lastArrivalWall = this.startWall;
    this.lastHeartbeatMono = this.startMono;
    this.expectedWhen = null;
    this.bgSince = AppState.currentState === 'active' ? null : this.startMono;
    this.bgAccumMs = 0;
    this.minRms = Infinity;
    this.maxRms = -Infinity;
    this.lastZero = false;
    this.emit();
    this.log('START', `requested rate ${REQUESTED_SAMPLE_RATE} Hz, buffer ${BUFFER_LENGTH} frames, mono; category=${cfg.iosCategory} mode=${cfg.iosMode}; appState=${AppState.currentState}`);
    if (AppState.currentState !== 'active') this.log('WARN', 'Start was not requested while the app was active. iOS only allows starting capture in the foreground.');

    try {
      const perm = await AudioManager.requestRecordingPermissions();
      this.log('PERM', `microphone permission: ${perm}`);
      if (perm !== 'Granted') throw new Error(`Microphone permission ${perm}`);

      AudioManager.setAudioSessionOptions({ iosCategory: cfg.iosCategory, iosMode: cfg.iosMode, iosOptions: [] });
      this.log('SESSION', `setAudioSessionOptions category=${cfg.iosCategory} mode=${cfg.iosMode} options=[]`);
      this.log('SESSION', `device preferred sample rate: ${AudioManager.getDevicePreferredSampleRate()} Hz`);
      AudioManager.observeAudioInterruptions(true);

      this.subs.push(
        AudioManager.addSystemEventListener('interruption', (e) => {
          this.stats = { ...this.stats, interruptions: this.stats.interruptions + (e.type === 'began' ? 1 : 0) };
          this.log('INTERRUPTION', `type=${e.type} shouldResume=${e.shouldResume} recorderIsRecording=${this.recorder?.isRecording() ?? 'n/a'}`);
          this.emit();
        }) ?? { remove() {} },
        AudioManager.addSystemEventListener('routeChange', (e) => {
          this.log('ROUTE', `reason=${e.reason}`);
          this.emit();
        }) ?? { remove() {} },
        AppState.addEventListener('change', (s) => this.onAppState(s)),
      );

      const rec = new AudioRecorder();
      this.recorder = rec;
      rec.onError((e) => {
        this.log('RECORDER_ERROR', e.message);
        this.patch({ error: e.message });
      });
      const cb = rec.onAudioReady({ sampleRate: REQUESTED_SAMPLE_RATE, bufferLength: BUFFER_LENGTH, channelCount: 1 }, (ev) => this.onChunk(ev));
      if (cb.status === 'error') throw new Error(`onAudioReady: ${cb.message}`);
      const started = await rec.start();
      if (started.status === 'error') throw new Error(`start: ${started.message}`);
      this.log('RECORDING', 'recorder started. No file output is enabled; audio is not written anywhere.');
      this.patch({ phase: 'recording' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log('ERROR', msg);
      this.teardown();
      this.patch({ phase: 'error', error: msg });
    }
  }

  async stop(): Promise<void> {
    if (this.stats.phase !== 'recording' && this.stats.phase !== 'starting') return;
    this.patch({ phase: 'stopping' });
    try {
      await this.recorder?.stop();
    } catch (e) {
      this.log('ERROR', `stop: ${e instanceof Error ? e.message : String(e)}`);
    }
    this.finish();
  }

  private finish() {
    this.closeBackground();
    this.teardown();
    const s = this.stats;
    const wall = (Date.now() - this.startWall) / 1000;
    const bg = this.bgAccumMs / 1000;
    this.log('SUMMARY', `wall=${wall.toFixed(1)}s audio=${s.audioSeconds.toFixed(1)}s chunks=${s.chunks} reportedRate=${s.reportedSampleRate ?? 'none'} Hz`);
    this.log('SUMMARY', `background/inactive time=${bg.toFixed(1)}s interruptions=${s.interruptions} digitalSilenceChunks=${s.digitalSilenceChunks}`);
    this.log('SUMMARY', `gaps>${GAP_THRESHOLD_MS}ms: arrival=${s.arrivalGaps} (max ${s.maxArrivalGapMs.toFixed(0)}ms), audio-time=${s.audioGaps} (max ${s.maxAudioGapMs.toFixed(0)}ms)`);
    this.log('SUMMARY', `rms dBFS min/max over chunks: ${Number.isFinite(this.minRms) ? this.minRms.toFixed(1) : 'n/a'} / ${Number.isFinite(this.maxRms) ? this.maxRms.toFixed(1) : 'n/a'}`);
    const gateMet = bg >= 1800 && s.audioGaps === 0 && s.arrivalGaps === 0;
    this.log(
      'GATE',
      bg < 1800
        ? `NOT EVALUATED: only ${bg.toFixed(0)}s of background/locked time (need 1800s). Re-run with the phone locked for 30 min.`
        : gateMet
          ? 'M1 locked-screen criterion met in this run: no gap over 2 s across >= 30 min in background.'
          : 'M1 locked-screen criterion NOT met: see GAP lines.',
    );
    this.patch({ phase: 'stopped', wallSeconds: wall, backgroundSeconds: bg });
  }

  private teardown() {
    try {
      this.recorder?.clearOnAudioReady();
      this.recorder?.clearOnError();
    } catch {
      /* already torn down */
    }
    this.recorder = null;
    for (const s of this.subs) s.remove();
    this.subs = [];
    try {
      AudioManager.observeAudioInterruptions(false);
    } catch {
      /* ignore */
    }
  }

  // ---- callbacks ---------------------------------------------------------------------------------
  private onAppState(s: AppStateStatus) {
    const t = mono();
    if (s !== 'active' && this.bgSince === null) this.bgSince = t;
    if (s === 'active') this.closeBackground();
    this.log('APPSTATE', s);
    this.patch({ appState: s });
  }
  private closeBackground() {
    if (this.bgSince !== null) {
      this.bgAccumMs += mono() - this.bgSince;
      this.bgSince = null;
    }
  }

  private onChunk(ev: { buffer: { sampleRate: number; getChannelData(c: number): Float32Array }; numFrames: number; when: number }) {
    const t = mono();
    const wall = Date.now();
    const arrivalDelta = t - this.lastArrivalMono;
    const sr = ev.buffer.sampleRate;
    const first = this.stats.chunks === 0;
    let gapSec = 0;

    if (!first && arrivalDelta > GAP_THRESHOLD_MS) {
      this.log('GAP_ARRIVAL', `no buffer for ${arrivalDelta.toFixed(0)} ms, from ${iso(this.lastArrivalWall)} to ${iso(wall)} (appState=${AppState.currentState}). Arrival gap alone can be JS delay with no audio lost; see GAP_AUDIO.`);
      this.stats = { ...this.stats, arrivalGaps: this.stats.arrivalGaps + 1, maxArrivalGapMs: Math.max(this.stats.maxArrivalGapMs, arrivalDelta) };
    }
    if (this.expectedWhen !== null) {
      const jumpMs = (ev.when - this.expectedWhen) * 1000;
      if (jumpMs > GAP_THRESHOLD_MS) {
        gapSec = jumpMs / 1000;
        this.log('GAP_AUDIO', `audio timeline jumped ${jumpMs.toFixed(0)} ms (samples missing) at ${iso(wall)}`);
        this.stats = { ...this.stats, audioGaps: this.stats.audioGaps + 1, maxAudioGapMs: Math.max(this.stats.maxAudioGapMs, jumpMs) };
      } else if (Math.abs(jumpMs) > 250) {
        this.log('TIMELINE', `audio timeline discontinuity ${jumpMs.toFixed(0)} ms (below gap threshold) at ${iso(wall)}`);
      }
    }
    this.expectedWhen = ev.when + ev.numFrames / sr;
    this.lastArrivalMono = t;
    this.lastArrivalWall = wall;

    // RMS from the in-memory buffer, then the buffer is dropped. Nothing is retained or written.
    const data = ev.buffer.getChannelData(0);
    let ss = 0;
    for (let i = 0; i < data.length; i++) ss += (data[i] as number) * (data[i] as number);
    const rms = Math.sqrt(ss / Math.max(1, data.length));
    const db = rms > 0 ? Math.max(-120, 20 * Math.log10(rms)) : -120;
    this.minRms = Math.min(this.minRms, db);
    this.maxRms = Math.max(this.maxRms, db);
    const zero = rms === 0;
    if (zero && !this.lastZero) this.log('DIGITAL_SILENCE', 'buffer of exact zeros began (mic muted or route lost?)');
    if (!zero && this.lastZero) this.log('DIGITAL_SILENCE', 'ended');
    this.lastZero = zero;

    if (first) this.log('FIRST_CHUNK', `reported sampleRate=${sr} Hz (requested ${REQUESTED_SAMPLE_RATE}), numFrames=${ev.numFrames}, channels=1`);
    if (!first && sr !== this.stats.reportedSampleRate) this.log('RATE_CHANGE', `sampleRate ${this.stats.reportedSampleRate} -> ${sr}`);

    const chunks = this.stats.chunks + 1;
    const audioSeconds = this.stats.audioSeconds + ev.numFrames / sr;
    if (t - this.lastHeartbeatMono >= HEARTBEAT_MS) {
      this.lastHeartbeatMono = t;
      this.log('HEARTBEAT', `chunks=${chunks} audio=${audioSeconds.toFixed(1)}s wall=${((t - this.startMono) / 1000).toFixed(1)}s rms=${db.toFixed(1)}dBFS appState=${AppState.currentState}`);
    }
    // Hand the buffer to the sink synchronously (it only queues; nothing is retained here or written).
    if (this.pcmSink) {
      try {
        this.pcmSink(data, sr, gapSec, this.stats.interruptions);
      } catch (e) {
        this.log('SINK_ERROR', e instanceof Error ? e.message : String(e));
      }
    }
    this.patch({
      chunks,
      reportedSampleRate: sr,
      lastFrames: ev.numFrames,
      audioSeconds,
      wallSeconds: (t - this.startMono) / 1000,
      lastRmsDb: db,
      digitalSilenceChunks: this.stats.digitalSilenceChunks + (zero ? 1 : 0),
    });
  }
}
