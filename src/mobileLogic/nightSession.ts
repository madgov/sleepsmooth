// One recorded night: wraps the shared pipeline (src/night) and the store. Pure TypeScript (no React Native), so the
// controller stays thin and this is unit-tested. Audio only ever lives in the pipeline's RAM buffer.
import { createNightPipeline, resolveScheduleWindow, EPOCH_SCHEMA_VERSION, NIGHT_HEURISTICS_VERSION, RETENTION_DEFAULT, summarizeNight } from '../night';
import type { CaptureEndReason, CaptureGap, EpochContext, EpochRecord, NightPipeline, NightRecord, NightView } from '../night';
import type { WindowDebug } from '../night/pipeline';
import type { ModelJson } from '../audio/model/schema';
import type { WindowScorer } from '../audio/yamnet/scorer';
import type { NightStore, StoredNight } from './nightStore';

export interface SessionEnv {
  deviceModel: string;
  osVersion: string;
  appVersion: string;
  tz: string;
  /** Minutes east of UTC at `atMs`. */
  utcOffsetMinutes: (atMs: number) => number;
}

export interface OpenSessionOptions {
  store: NightStore;
  /** The v1 model. Used for scoring only when `scorer` is null (Expo Go, web, or a YAMNet load failure). */
  model: ModelJson | null;
  /** YAMNet v3 scorer (on-device TFLite), or null for the v1 fallback. Its version is what the night records. */
  scorer?: WindowScorer | null;
  env: SessionEnv;
  nowMs: number;
  bedtimeLocal: string;
  wakeLocal: string;
  remindEnabled: boolean;
  initialContext: Partial<EpochContext>;
  /** Read-only per-window observation (used by the opt-in clip picker). Never changes the analysis. */
  onWindow?: (w: WindowDebug) => void;
  /** Read-only: called with each batch of epochs just written (used for the morning wake signal). Never changes the analysis. */
  onEpochs?: (epochs: readonly EpochRecord[]) => void;
}

/** Windows processed per pump slice. Small, so a slice stays well under a frame budget on a phone. */
export const PUMP_SLICE_WINDOWS = 4;

export class NightSession {
  readonly id: string;
  private readonly pipe: NightPipeline;
  private record: NightRecord;
  private done = false;
  private storageFailed = false;
  private epochCount = 0;

  private onEpochs: ((epochs: readonly EpochRecord[]) => void) | null = null;

  private constructor(private readonly store: NightStore, pipe: NightPipeline, record: NightRecord) {
    this.id = record.id;
    this.pipe = pipe;
    this.record = record;
  }

  static open(o: OpenSessionOptions): NightSession {
    const schedule = resolveScheduleWindow(o.nowMs, { bedtimeLocal: o.bedtimeLocal, wakeLocal: o.wakeLocal }, o.env.utcOffsetMinutes(o.nowMs));
    const record: NightRecord = {
      id: `n${o.nowMs}`,
      deviceModel: o.env.deviceModel,
      osVersion: o.env.osVersion,
      appVersion: o.env.appVersion,
      modelVersion: o.scorer ? o.scorer.version : o.model ? o.model.version : null,
      nightHeuristicsVersion: NIGHT_HEURISTICS_VERSION,
      epochSchemaVersion: EPOCH_SCHEMA_VERSION,
      settings: { bedtimeLocal: o.bedtimeLocal, wakeLocal: o.wakeLocal, tz: o.env.tz, remindEnabled: o.remindEnabled, promptLeadMin: 0 },
      captureStart: o.nowMs,
      captureEnd: null,
      endReason: null,
      gaps: [],
      sampleRateReported: 0,
      isSynthetic: false,
      source: 'device-recording',
      retention: RETENTION_DEFAULT,
    };
    const pipe = createNightPipeline({ model: o.model, scorer: o.scorer ?? null, captureStartMs: o.nowMs, schedule, ...(o.onWindow ? { onWindow: o.onWindow } : {}) });
    // No accelerometer in this build: epochs report motionSec null.
    pipe.setContext({ motionAvailable: false, ...o.initialContext });
    const s = new NightSession(o.store, pipe, record);
    s.onEpochs = o.onEpochs ?? null;
    try {
      o.store.begin(record);
    } catch {
      s.storageFailed = true;
    }
    return s;
  }

  get isDone(): boolean {
    return this.done;
  }
  /** True once a write to the store failed. The controller then ends the night with storage-error. */
  get hasStorageError(): boolean {
    return this.storageFailed;
  }
  get epochsWritten(): number {
    return this.epochCount;
  }
  get captureStartMs(): number {
    return this.record.captureStart;
  }

  setContext(c: Partial<EpochContext>): void {
    if (!this.done) this.pipe.setContext(c);
  }

  /** Seconds of phone movement (src/mobileLogic/motionSeconds.ts) since the last call. Call setContext({ motionAvailable: true }) first. */
  addMotionSeconds(sec: number): void {
    if (!this.done) this.pipe.addMotionSeconds(sec);
  }

  /** Hot path: resample and queue only. No window processing happens here. */
  enqueue(samples: Float32Array, sourceRate: number): void {
    if (this.done) return;
    this.pipe.enqueue(samples, sourceRate);
  }

  backlogSec(): number {
    return this.pipe.backlogSec();
  }

  /** Process a bounded slice of the queue and persist any epochs that closed. */
  pump(maxWindows = PUMP_SLICE_WINDOWS): void {
    if (this.done) return;
    this.persist(this.pipe.pump(maxWindows));
  }

  markGap(sec: number, cause: CaptureGap['cause']): void {
    if (this.done) return;
    this.persist(this.pipe.markGap(sec, cause));
  }

  /** Close the night: drain the queue, write the last epochs and the closed manifest. */
  finish(reason: CaptureEndReason): NightRecord {
    if (this.done) return this.record;
    this.done = true;
    const res = this.pipe.finish(reason);
    this.persist(res.epochs);
    this.record = { ...this.record, captureEnd: res.captureEndMs, endReason: reason, gaps: res.gaps, sampleRateReported: res.sampleRateReported };
    try {
      this.store.writeManifest(this.record);
    } catch {
      this.storageFailed = true;
    }
    return this.record;
  }

  private persist(epochs: readonly EpochRecord[]): void {
    if (epochs.length === 0) return;
    try {
      this.onEpochs?.(epochs);
    } catch {
      /* an observer must never break the night */
    }
    try {
      this.store.appendEpochs(this.id, epochs);
      this.epochCount += epochs.length;
    } catch {
      this.storageFailed = true;
    }
  }
}

/** The summary the Results screens use for a stored night. The schedule is re-derived from the night's own settings. */
export function viewForStored(n: StoredNight): NightView {
  const offset = -new Date(n.record.captureStart).getTimezoneOffset();
  return summarizeNight(n.record, n.epochs, resolveScheduleWindow(n.record.captureStart, n.record.settings, offset));
}
