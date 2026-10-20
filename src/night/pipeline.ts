// Streaming night pipeline (docs/OVERNIGHT_PLAN.md M2, ER-3, ER-5, ER-8).
//
//   PCM chunks (any rate, any size) -> StreamingResampler (16 kHz) -> level analysis at 100 ms blocks
//   -> per-0.5 s-hop windows (1 s, same grid and arithmetic as audio/analyze.ts + modelHook.ts)
//   -> cheap level gate -> [open] streaming log-mel (frame reuse + sparse mel) + shipped MLP
//   -> 30 s EpochRecord, with a live (provisional) sleep-state label from SleepEstimator.
//
// Guarantees:
//  - Deterministic: output depends only on the samples, their timeline positions and the options, never
//    on chunk sizes or timing (tested at 1 s, 0.37 s and 4 s chunks).
//  - Raw audio is held in RAM only (a buffer trimmed to the oldest unprocessed window) and never persisted.
//  - Unscored windows (below the silence floor, below the gate, no model, skipped by overload) are counted
//    and reported as NOT analysed. They are never "no snore".
//  - Resumable: a new pipeline can continue from the last persisted EpochRecord (see `resume`).
//
// No React, Expo, DOM or Worker usage. Time is the audio timeline (sample counts); `captureStartMs` is only
// a label origin, so a wall-clock jump cannot corrupt durations (ER-5.1).
import { SAMPLE_RATE, SILENCE_FLOOR_DBFS } from '../audio/constants';
import { BandwidthEstimator, MIN_SOURCE_RATE_HZ } from '../audio/bandwidth';
import { toDb } from '../audio/loudness';
import { scoreFeatures, windowFeatures } from '../audio/model/infer';
import type { ModelJson } from '../audio/model/schema';
import { YAMNET_PATCH_OFFSET, YAMNET_PATCH_SAMPLES, type WindowScorer } from '../audio/yamnet/scorer';
import { countClipped } from '../audio/quality';
import {
  BW_MIN_FRAMES,
  BW_SAMPLE_EVERY_WINDOWS,
  EPOCH_MS,
  EPOCH_SAMPLES,
  FLOOR_MIN_HISTORY_SEC,
  FLOOR_PERCENTILE,
  FRAMES_PER_HOP,
  GATE_DB,
  GATE_FLATNESS_CAP,
  GATE_LOW_DB,
  HANDLING_DB,
  HANDLING_MAX_BLOCKS,
  HOP_SAMPLES_WINDOW,
  LEVEL_BLOCK_SAMPLES,
  LOUD_DB,
  OVERLOAD_QUEUE_SEC,
  V1_NIGHT,
  ROLLING_FLOOR_SEC,
  WINDOWS_PER_EPOCH,
  WINDOW_SAMPLES,
} from './constants';
import { encodeBits, encodeScores, int8ToBase64, quantizeFeatures, quantizeScore } from './codec';
import { gateTier, spectralFlatness } from './adaptiveGate';
import { isSpeechLikeBlock } from './cues';
import { SleepEstimator, type EpochEstimate } from './estimator';
import { V3_OPERATING_POINT, isConfirmed } from './operatingPoint';
import { FrameCache } from './frames';
import { StreamingResampler } from './resample';
import type { CaptureEndReason, CaptureGap, EpochRecord, ScheduleWindow, WindowFeatureRecord } from './types';

const BLOCKS_PER_SEC = 10;
const BLOCKS_PER_HALF = 5;
const SEC_SAMPLES = SAMPLE_RATE;
const HALF_SAMPLES = HOP_SAMPLES_WINDOW;
const HIST_MIN_DB = -120;
const HIST_BINS = 121;

export interface WindowDebug {
  k: number;
  t0Sec: number;
  status: 'scored' | 'belowGate' | 'tooQuiet' | 'skipped';
  levelDb: number;
  score?: number;
  snoreLike?: boolean;
  /** Rolling noise floor (dBFS) used for this window. Absent for tooQuiet and skipped windows. Read-only observation for the clip picker. */
  floorDb?: number;
  /** Speech-like cue on this window's first 0.5 s block (the same cue that feeds speechLikeSec). Present on scored windows. */
  speechLike?: boolean;
}

export interface NightPipelineOptions {
  /** The v1 model, or null for a capture-only build (levels and aggregates; nothing is scored). Ignored for scoring when `scorer` is set. */
  model: ModelJson | null;
  /**
   * YAMNet v3 window scorer (on-device TFLite). When set, windows that pass the level gate are scored by it instead of `model`, a window is
   * flagged at the scorer's threshold and confirmed k-of-n (src/night/operatingPoint.ts), and an epoch is closed only after its confirmation
   * look-ahead (13 windows = 6.5 s) has been processed. Windows the scorer fails on are NOT analysed (counted as skipped), never as "no snore".
   */
  scorer?: WindowScorer | null;
  /** Unix ms of epoch 0. Labels only. */
  captureStartMs: number;
  /** Used for the live (provisional) state labels. null: every epoch counts as inside the window. */
  schedule?: ScheduleWindow | null;
  /** Level gate. Default true. false scores every window above the silence floor (parity tests). */
  gate?: boolean;
  /**
   * ER-1: per-window feature retention. Dev/tuning builds only, off by default, never part of the demo or
   * user path. The caller must pass `devTuningBuild: true` explicitly; anything else is rejected.
   */
  retainWindowFeatures?: false | { devTuningBuild: true; onRecord: (r: WindowFeatureRecord) => void };
  /** Test/tuning hook: called for every window decision. */
  onWindow?: (w: WindowDebug) => void;
  /**
   * Continue after a crash. `lastEpoch` is the last epoch that was persisted; audio from `resumeAtMs` onward
   * is analysed, rounded up to the 0.5 s grid. Epochs in between are emitted as not captured and a gap
   * with cause os-killed-or-crash-recovered is recorded. `recentEpochs` (optional, ideally everything
   * persisted) re-primes the live sleep-state label; without it the label restarts conservatively at onset.
   */
  resume?: { lastEpoch: EpochRecord; resumeAtMs: number; recentEpochs?: readonly EpochRecord[] };
}

export interface EpochContext {
  appActive: boolean;
  charging: boolean | null;
  battery: number | null;
  /** false when the accelerometer is unavailable: epochs then report motionSec null. */
  motionAvailable: boolean;
}

export interface NightPipelineResult {
  epochs: EpochRecord[];
  gaps: CaptureGap[];
  endReason: CaptureEndReason;
  captureEndMs: number;
  sampleRateReported: number;
}

interface EpochAcc {
  capSamples: number;
  secDbs: number[];
  floorLast: number | null;
  loudSec: number;
  handling: number;
  speechBlocks: number;
  clip: number;
  total: number;
  tooQuiet: number;
  belowGate: number;
  overload: number;
  scoredPos: boolean[];
  flags: boolean[];
  scoresQ: number[];
  /** Scorer mode only: scored window indices in order, raw-flagged ones are confirmed at epoch close. */
  scorerK: number[];
  bw: BandwidthEstimator | null;
}

function newAcc(): EpochAcc {
  return {
    capSamples: 0,
    secDbs: [],
    floorLast: null,
    loudSec: 0,
    handling: 0,
    speechBlocks: 0,
    clip: 0,
    total: 0,
    tooQuiet: 0,
    belowGate: 0,
    overload: 0,
    scoredPos: new Array<boolean>(WINDOWS_PER_EPOCH).fill(false),
    flags: [],
    scoresQ: [],
    scorerK: [],
    bw: null,
  };
}

const r1 = (x: number) => Math.round(x * 10) / 10;
const r3 = (x: number) => Math.round(x * 1000) / 1000;

export class NightPipeline {
  private readonly opt: NightPipelineOptions;
  private readonly model: ModelJson | null;
  private readonly scorer: WindowScorer | null;
  /** Scorer mode: raw-flagged window indices still needed for confirmation of windows not yet in a closed epoch. */
  private readonly rawFlagged = new Set<number>();
  private scorerFailures = 0;
  private readonly gate: boolean;
  private readonly schedule: ScheduleWindow | null;
  private readonly estimator: SleepEstimator;
  private readonly cache: FrameCache;
  private rate = 0;
  private resampler: StreamingResampler | null = null;
  private sourceTooLow = false;

  // 16 kHz sample buffer (RAM only), covering [bufBase, pos).
  private buf = new Float32Array(SAMPLE_RATE * 8);
  private bufBase = 0;
  private bufLen = 0;
  private pos = 0;
  private segStart = 0;

  private nextWindow = 0;
  private emitIdx = 0;
  private finished = false;
  private pending: EpochRecord[] = [];
  readonly gaps: CaptureGap[] = [];

  // Level analysis state.
  private blockSum = 0;
  private halfSum = 0;
  private halfValid = false;
  private secSum = 0;
  private secValid = false;
  private secBlockDb: number[] = [];
  private runLen = 0;
  private runCountable = false;
  private prevBelow = false;
  private readonly halfE = new Map<number, number>();
  private readonly secDb = new Map<number, number>();
  private readonly floorFor = new Map<number, number>();
  private readonly hist = new Int32Array(HIST_BINS);
  private histCount = 0;
  private floorSeed: number = SILENCE_FLOOR_DBFS;

  private readonly accs = new Map<number, EpochAcc>();
  private ctx: EpochContext = { appActive: false, charging: null, battery: null, motionAvailable: false };
  private appSeen = false;
  private motionSec = 0;

  constructor(opt: NightPipelineOptions) {
    this.opt = opt;
    this.model = opt.model;
    this.scorer = opt.scorer ?? null;
    this.gate = opt.gate !== false;
    this.schedule = opt.schedule ?? null;
    if (opt.retainWindowFeatures !== undefined && opt.retainWindowFeatures !== false && opt.retainWindowFeatures.devTuningBuild !== true) {
      throw new Error('Window-feature retention is allowed only in a developer tuning build (ER-1).');
    }
    this.estimator = new SleepEstimator(this.schedule);
    this.cache = new FrameCache({
      copy: (start, len, dst, off) => {
        const s = start - this.bufBase;
        dst.set(this.buf.subarray(s, s + len), off);
      },
    });
    if (opt.resume) this.applyResume(opt.resume);
  }

  /** Update the non-audio context. Values are attributed to the epoch that closes next. */
  setContext(c: Partial<EpochContext>): void {
    this.ctx = { ...this.ctx, ...c };
    if (c.appActive === true) this.appSeen = true;
  }

  /** Seconds of motion (accelerometer above the host's threshold) since the last call. */
  addMotionSeconds(sec: number): void {
    if (sec > 0) this.motionSec += sec;
  }

  /** Feed audio and process everything that is complete. Returns the epochs that closed. */
  push(samples: Float32Array, sourceRate: number): EpochRecord[] {
    // Large inputs are fed in slices of at most 10 s so that processing keeps up and the overload policy
    // (which is for a slow host, see enqueue/pump) is not triggered by a single big call.
    const slice = Math.max(1, Math.round(sourceRate * 10));
    const out: EpochRecord[] = [];
    for (let i = 0; i === 0 || i < samples.length; i += slice) {
      this.enqueue(samples.subarray(i, Math.min(samples.length, i + slice)), sourceRate);
      out.push(...this.pump(Infinity));
    }
    return out;
  }

  /** Feed audio without processing windows (host slices the work with pump()). */
  enqueue(samples: Float32Array, sourceRate: number): void {
    if (this.finished) throw new Error('Pipeline already finished');
    if (this.resampler === null) {
      this.rate = sourceRate;
      this.resampler = new StreamingResampler(sourceRate);
      this.sourceTooLow = sourceRate < MIN_SOURCE_RATE_HZ;
    } else if (sourceRate !== this.rate) {
      throw new Error(`Sample rate changed from ${this.rate} to ${sourceRate}`);
    }
    const clipped = countClipped(samples);
    if (clipped > 0) this.accFor(Math.floor(this.pos / EPOCH_SAMPLES)).clip += clipped;
    this.ingest(this.resampler.push(samples));
    this.limitBacklog();
  }

  /** Process up to `maxWindows` queued windows. Returns the epochs that closed. */
  pump(maxWindows = Infinity): EpochRecord[] {
    this.processWindows(maxWindows);
    return this.takeOut(this.emitReady(false));
  }

  private processWindows(maxWindows: number): void {
    let n = 0;
    while (n < maxWindows && this.nextWindow * HOP_SAMPLES_WINDOW + WINDOW_SAMPLES <= this.pos) {
      this.processWindow(this.nextWindow);
      this.halfE.delete(this.nextWindow);
      this.nextWindow++;
      n++;
    }
    this.cache.evictBefore(FRAMES_PER_HOP * this.nextWindow + 1);
    this.trimBuffer();
  }

  /** Declare `sec` seconds with no audio (interruption, pause). Windows touching the gap do not exist. */
  markGap(sec: number, cause: CaptureGap['cause'] = 'late-buffers'): EpochRecord[] {
    if (this.finished) throw new Error('Pipeline already finished');
    const samples = Math.max(0, Math.round(sec * SAMPLE_RATE));
    if (samples === 0) return [];
    const t0 = this.timeAtSample(this.pos);
    this.endSegment();
    this.startSegmentAt(this.pos + samples);
    this.gaps.push({ t0, t1: this.timeAtSample(this.pos), cause });
    return this.takeOut(this.emitReady(false));
  }

  /** Windows the scorer threw on (not analysed). 0 for the v1 path. For diagnostics. */
  scorerFailureCount(): number {
    return this.scorerFailures;
  }

  /** Queue backlog in seconds of audio (for a UI, and for the overload test). */
  backlogSec(): number {
    return (this.pos - this.nextWindow * HOP_SAMPLES_WINDOW) / SAMPLE_RATE;
  }

  /** Audio timeline position in seconds. */
  positionSec(): number {
    return this.pos / SAMPLE_RATE;
  }

  /** Finish the night: flush, process the rest, close the partial last epoch. */
  finish(endReason: CaptureEndReason): NightPipelineResult {
    if (this.finished) throw new Error('Pipeline already finished');
    this.endSegment();
    const out = this.takeOut(this.emitReady(true));
    this.finished = true;
    return {
      epochs: out,
      gaps: this.gaps.slice(),
      endReason,
      captureEndMs: this.timeAtSample(this.pos),
      sampleRateReported: this.rate,
    };
  }

  // -------------------------------------------------------------------------
  // Resume
  // -------------------------------------------------------------------------
  private applyResume(r: NonNullable<NightPipelineOptions['resume']>): void {
    const last = r.lastEpoch;
    const rawPos = Math.max(0, ((r.resumeAtMs - this.opt.captureStartMs) / 1000) * SAMPLE_RATE);
    const floorPos = Math.max((last.i + 1) * EPOCH_SAMPLES, rawPos);
    const start = Math.ceil(floorPos / HOP_SAMPLES_WINDOW) * HOP_SAMPLES_WINDOW;
    this.floorSeed = last.floor;
    const history = r.recentEpochs && r.recentEpochs.length > 0 ? r.recentEpochs : [last];
    // Re-prime the live label deterministically from the persisted epochs.
    if (r.recentEpochs && r.recentEpochs.length > 0) for (const e of history) this.estimator.step(e);
    this.emitIdx = last.i + 1;
    const lastEnd = last.t + EPOCH_MS;
    this.pos = start;
    this.bufBase = start;
    this.segStart = start;
    this.nextWindow = start / HOP_SAMPLES_WINDOW;
    this.gaps.push({ t0: lastEnd, t1: this.timeAtSample(start), cause: 'os-killed-or-crash-recovered' });
    this.pending.push(...this.emitReady(false));
  }

  // -------------------------------------------------------------------------
  // Buffer and time helpers
  // -------------------------------------------------------------------------
  private timeAtSample(p: number): number {
    return this.opt.captureStartMs + Math.round((p * 1000) / SAMPLE_RATE);
  }

  private accFor(e: number): EpochAcc {
    let a = this.accs.get(e);
    if (!a) {
      a = newAcc();
      this.accs.set(e, a);
    }
    return a;
  }

  private takeOut(fresh: EpochRecord[]): EpochRecord[] {
    if (this.pending.length === 0) return fresh;
    const all = this.pending.concat(fresh);
    this.pending = [];
    return all;
  }

  private append(x: Float32Array): void {
    const need = this.bufLen + x.length;
    if (need > this.buf.length) {
      const grown = new Float32Array(Math.max(this.buf.length * 2, need));
      grown.set(this.buf.subarray(0, this.bufLen), 0);
      this.buf = grown;
    }
    this.buf.set(x, this.bufLen);
    this.bufLen += x.length;
  }

  private trimBuffer(): void {
    const keepFrom = Math.min(this.pos, this.nextWindow * HOP_SAMPLES_WINDOW);
    const shift = keepFrom - this.bufBase;
    if (shift > 0) {
      this.buf.copyWithin(0, shift, this.bufLen);
      this.bufLen -= shift;
      this.bufBase = keepFrom;
    }
  }

  // -------------------------------------------------------------------------
  // Segments (start, gap, end)
  // -------------------------------------------------------------------------
  /** Finish the audio of the current segment: release the resampler tail and process all complete windows. */
  private endSegment(): void {
    if (this.resampler) this.ingest(this.resampler.flush());
    this.processWindows(Infinity);
    // Windows that started before the end but did not fit are dropped (they never existed).
  }

  private startSegmentAt(p: number): void {
    this.pos = p;
    this.bufBase = p;
    this.bufLen = 0;
    this.segStart = p;
    this.nextWindow = Math.ceil(p / HOP_SAMPLES_WINDOW);
    this.blockSum = 0;
    this.halfSum = 0;
    this.halfValid = false;
    this.secSum = 0;
    this.secValid = false;
    this.secBlockDb = [];
    this.runLen = 0;
    this.runCountable = false;
    this.prevBelow = false;
    this.halfE.clear();
    this.cache.clear();
  }

  // -------------------------------------------------------------------------
  // Level analysis (cheap, every sample)
  // -------------------------------------------------------------------------
  private ingest(x: Float32Array): void {
    if (x.length === 0) return;
    const p0 = this.pos;
    this.append(x);
    this.pos = p0 + x.length;
    let p = p0;
    const p1 = this.pos;
    while (p < p1) {
      const blockStart = Math.floor(p / LEVEL_BLOCK_SAMPLES) * LEVEL_BLOCK_SAMPLES;
      const blockEnd = blockStart + LEVEL_BLOCK_SAMPLES;
      const end = Math.min(blockEnd, p1);
      let s = 0;
      for (let i = p - this.bufBase; i < end - this.bufBase; i++) {
        const v = this.buf[i] as number;
        s += v * v;
      }
      this.blockSum += s;
      this.accFor(Math.floor(p / EPOCH_SAMPLES)).capSamples += end - p;
      p = end;
      if (end === blockEnd) {
        this.completeBlock(blockStart, this.blockSum);
        this.blockSum = 0;
      }
    }
  }

  private completeBlock(blockStart: number, sum: number): void {
    const idx = blockStart / LEVEL_BLOCK_SAMPLES;
    const valid = blockStart >= this.segStart;
    if (idx % BLOCKS_PER_HALF === 0) {
      this.halfSum = 0;
      this.halfValid = valid;
    }
    if (idx % BLOCKS_PER_SEC === 0) {
      this.secSum = 0;
      this.secValid = valid;
      this.secBlockDb = [];
    }
    this.halfSum += sum;
    this.secSum += sum;
    this.secBlockDb.push(toDb(sum / LEVEL_BLOCK_SAMPLES));
    if (idx % BLOCKS_PER_HALF === BLOCKS_PER_HALF - 1 && this.halfValid) this.halfE.set((idx - (BLOCKS_PER_HALF - 1)) / BLOCKS_PER_HALF, this.halfSum);
    if (idx % BLOCKS_PER_SEC === BLOCKS_PER_SEC - 1) {
      const s = (idx - (BLOCKS_PER_SEC - 1)) / BLOCKS_PER_SEC;
      if (this.secValid) this.completeSecond(s, this.secSum, this.secBlockDb);
      else {
        this.runLen = 0;
        this.prevBelow = false;
      }
    }
  }

  private histBin(db: number): number {
    return Math.max(0, Math.min(HIST_BINS - 1, Math.round(db) - HIST_MIN_DB));
  }

  private currentFloor(): number {
    if (this.histCount < FLOOR_MIN_HISTORY_SEC) return this.floorSeed;
    const target = Math.max(1, Math.ceil(FLOOR_PERCENTILE * this.histCount));
    let acc = 0;
    for (let i = 0; i < HIST_BINS; i++) {
      acc += this.hist[i] as number;
      if (acc >= target) return Math.max(SILENCE_FLOOR_DBFS, i + HIST_MIN_DB);
    }
    return SILENCE_FLOOR_DBFS;
  }

  private completeSecond(s: number, sum: number, blockDb: number[]): void {
    const db = toDb(sum / SEC_SAMPLES);
    const floor = this.currentFloor();
    this.floorFor.set(s, floor);
    this.secDb.set(s, db);
    const acc = this.accFor(Math.floor(s / (EPOCH_SAMPLES / SEC_SAMPLES)));
    acc.secDbs.push(db);
    acc.floorLast = floor;
    if (db >= floor + LOUD_DB) acc.loudSec++;
    // Short bursts: 100 ms to under 1 s at floor + HANDLING_DB, preceded by a quieter block.
    for (const bdb of blockDb) {
      const above = bdb >= floor + HANDLING_DB;
      if (above) {
        if (this.runLen === 0) this.runCountable = this.prevBelow;
        this.runLen++;
      } else {
        if (this.runLen > 0 && this.runCountable && this.runLen <= HANDLING_MAX_BLOCKS) acc.handling++;
        this.runLen = 0;
        this.prevBelow = true;
      }
    }
    // Rolling histogram: add this second, drop the one that left the 10-minute span.
    this.hist[this.histBin(db)]!++;
    this.histCount++;
    const old = this.secDb.get(s - ROLLING_FLOOR_SEC);
    if (old !== undefined) {
      this.hist[this.histBin(old)]!--;
      this.histCount--;
    }
    this.secDb.delete(s - ROLLING_FLOOR_SEC - 1);
    this.floorFor.delete(s - Math.ceil(OVERLOAD_QUEUE_SEC) - 40);
  }

  // -------------------------------------------------------------------------
  // Windows
  // -------------------------------------------------------------------------
  private limitBacklog(): void {
    const keep = OVERLOAD_QUEUE_SEC * SAMPLE_RATE;
    if (this.pos - this.nextWindow * HOP_SAMPLES_WINDOW <= keep + WINDOW_SAMPLES) return;
    const newNext = Math.ceil((this.pos - keep) / HOP_SAMPLES_WINDOW);
    const t0 = this.timeAtSample(this.nextWindow * HOP_SAMPLES_WINDOW);
    for (let k = this.nextWindow; k < newNext; k++) {
      const a = this.accFor(Math.floor(k / WINDOWS_PER_EPOCH));
      a.total++;
      a.overload++;
      this.halfE.delete(k);
      this.opt.onWindow?.({ k, t0Sec: k * 0.5, status: 'skipped', levelDb: NaN });
    }
    const t1 = this.timeAtSample(newNext * HOP_SAMPLES_WINDOW);
    const prev = this.gaps[this.gaps.length - 1];
    if (prev && prev.cause === 'overload' && prev.t1 === t0) prev.t1 = t1;
    else this.gaps.push({ t0, t1, cause: 'overload' });
    this.nextWindow = newNext;
    this.cache.clear();
    this.trimBuffer();
  }

  private processWindow(k: number): void {
    const e = Math.floor(k / WINDOWS_PER_EPOCH);
    const acc = this.accFor(e);
    const h0 = this.halfE.get(k);
    const h1 = this.halfE.get(k + 1);
    if (h0 === undefined || h1 === undefined) return; // not a window of this segment
    acc.total++;
    const levelDb = toDb((h0 + h1) / SAMPLE_RATE);
    const t0Sec = k * 0.5;
    if (levelDb < SILENCE_FLOOR_DBFS) {
      acc.tooQuiet++;
      this.opt.onWindow?.({ k, t0Sec, status: 'tooQuiet', levelDb });
      return;
    }
    const floorK = this.floorFor.get(Math.floor(k / 2)) ?? this.floorSeed;
    // Adaptive level gate (src/night/adaptiveGate.ts, EVAL_PROTOCOL section 9): tier 1 floor + GATE_DB, tier 2 floor + GATE_LOW_DB for non-stationary-noise-like windows (YAMNet scorer only; the v1 fallback keeps the fixed gate, section 10.A).
    const bufStart = k * HOP_SAMPLES_WINDOW - this.bufBase;
    const open =
      !this.gate ||
      gateTier(levelDb, floorK, SILENCE_FLOOR_DBFS, { marginDb: GATE_DB, lowMarginDb: this.scorer ? GATE_LOW_DB : GATE_DB, flatnessCap: GATE_FLATNESS_CAP }, () => spectralFlatness(this.buf, bufStart)) > 0;
    if ((!this.model && !this.scorer) || this.sourceTooLow || !open) {
      acc.belowGate++;
      this.opt.onWindow?.({ k, t0Sec, status: 'belowGate', levelDb, floorDb: floorK });
      return;
    }
    const { logMel, interior } = this.cache.windowLogMel(k);
    let score: number;
    let flag: boolean;
    let feats: ReturnType<typeof windowFeatures> | null = null;
    if (this.scorer) {
      // Energy pre-gate: only windows that passed the level gate above reach YAMNet.
      const s0 = k * HOP_SAMPLES_WINDOW - this.bufBase + YAMNET_PATCH_OFFSET;
      try {
        score = this.scorer.score(this.buf.subarray(s0, s0 + YAMNET_PATCH_SAMPLES));
      } catch {
        // Not analysed: counted as skipped, never as "no snore".
        this.scorerFailures++;
        acc.overload++;
        this.opt.onWindow?.({ k, t0Sec, status: 'skipped', levelDb, floorDb: floorK });
        return;
      }
      flag = score >= this.scorer.flagThreshold;
      if (flag) this.rawFlagged.add(k);
      acc.scorerK.push(k);
    } else {
      feats = windowFeatures(logMel, (this.model as ModelJson).featureSpec.nMels);
      score = scoreFeatures(this.model as ModelJson, feats);
      flag = score >= V1_NIGHT.flagThreshold; // v1 fallback flag threshold (constants.ts V1_NIGHT, section 10); the model's own 0.795 is not used here
      acc.flags.push(flag);
    }
    acc.scoredPos[k % WINDOWS_PER_EPOCH] = true;
    acc.scoresQ.push(quantizeScore(score));
    // Speech-like cue on this window's first 0.5 s block (frames 1..50 of the window). Snore-like windows are
    // excluded so snoring is never read as talking (which would drop its epoch from the analysis).
    const blk = interior.slice(0, FRAMES_PER_HOP);
    const speechLike = !flag && isSpeechLikeBlock(blk.map((f) => f.env), blk.map((f) => f.mel));
    if (speechLike) acc.speechBlocks++;
    // Sampled bandwidth estimate (cost control).
    if (k % BW_SAMPLE_EVERY_WINDOWS === 0) {
      acc.bw ??= new BandwidthEstimator();
      const s = k * HOP_SAMPLES_WINDOW - this.bufBase;
      acc.bw.add(this.buf, s, s + HALF_SAMPLES);
    }
    const ret = this.opt.retainWindowFeatures;
    if (ret && ret.devTuningBuild === true && feats) ret.onRecord({ k, t: this.timeAtSample(k * HOP_SAMPLES_WINDOW), q: int8ToBase64(quantizeFeatures(feats)) });
    this.opt.onWindow?.({ k, t0Sec, status: 'scored', levelDb, score, snoreLike: flag, floorDb: floorK, speechLike });
  }

  // -------------------------------------------------------------------------
  // Epochs
  // -------------------------------------------------------------------------
  private emitReady(force: boolean): EpochRecord[] {
    const out: EpochRecord[] = [];
    for (;;) {
      const e = this.emitIdx;
      const end = (e + 1) * EPOCH_SAMPLES;
      const ready = this.pos >= end && this.nextWindow >= (e + 1) * WINDOWS_PER_EPOCH + this.confirmLookahead();
      const hasData = e * EPOCH_SAMPLES < this.pos;
      if (!(ready || (force && hasData))) break;
      out.push(this.closeEpoch(e));
      this.emitIdx++;
    }
    return out;
  }

  /** Windows after an epoch's last window that must be processed before the epoch can close (k-of-n confirmation), 0 without a scorer. */
  private confirmLookahead(): number {
    return this.scorer ? V3_OPERATING_POINT.confirmN - 1 : 0;
  }

  private closeEpoch(e: number): EpochRecord {
    const acc = this.accs.get(e) ?? newAcc();
    this.accs.delete(e);
    if (this.scorer) {
      const flagged = this.rawFlagged;
      for (const k of acc.scorerK) acc.flags.push(isConfirmed(k, (j) => flagged.has(j)));
      const keepFrom = (e + 1) * WINDOWS_PER_EPOCH - V3_OPERATING_POINT.confirmN;
      for (const k of flagged) if (k < keepFrom) flagged.delete(k);
    }
    const sorted = acc.secDbs.slice().sort((a, b) => a - b);
    const pick = (p: number) => (sorted.length ? (sorted[Math.floor(p * (sorted.length - 1))] as number) : -120);
    const scored = acc.flags.length;
    const snoreLike = acc.flags.filter(Boolean).length;
    const snoreFraction = scored > 0 ? snoreLike / scored : 0;
    const floor = acc.floorLast ?? this.floorSeed;
    const motion = this.ctx.motionAvailable ? r3(this.motionSec) : null;
    const rec: EpochRecord = {
      i: e,
      t: this.opt.captureStartMs + e * EPOCH_MS,
      cap: r3(Math.min(30, acc.capSamples / SAMPLE_RATE)),
      lvl: { p10: r1(pick(0.1)), p50: r1(pick(0.5)), p90: r1(pick(0.9)) },
      floor: r1(floor),
      win: { total: acc.total, belowGate: acc.belowGate, tooQuiet: acc.tooQuiet, scored, snoreLike },
      speechLikeSec: acc.speechBlocks * 0.5,
      handlingEvents: acc.handling,
      loudNonSnoreSec: snoreFraction < 0.5 ? acc.loudSec : 0,
      motionSec: motion,
      charging: this.ctx.charging,
      appActive: this.ctx.appActive || this.appSeen,
      battery: this.ctx.battery,
      state: 'uncertain',
      reasons: [],
    };
    if (scored > 0) {
      rec.scoredMask = encodeBits(acc.scoredPos);
      rec.snoreBits = encodeBits(acc.flags);
      rec.scoreQ = encodeScores(acc.scoresQ);
    }
    if (acc.bw && acc.bw.frames >= BW_MIN_FRAMES) {
      const bw = acc.bw.bandwidthHz();
      if (bw !== null) rec.bwHz = bw;
    }
    if (acc.clip > 0) rec.clipSamples = acc.clip;
    if (acc.overload > 0) rec.overload = acc.overload;
    const est: EpochEstimate = this.estimator.step(rec);
    rec.state = est.state;
    rec.reasons = est.reasons;
    this.appSeen = false;
    this.motionSec = 0;
    return rec;
  }
}

export function createNightPipeline(opt: NightPipelineOptions): NightPipeline {
  return new NightPipeline(opt);
}
