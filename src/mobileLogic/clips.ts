// Flagged sound clips: pure logic (no React, React Native or Expo). Everything here is an acoustic-pattern heuristic.
//
// WHAT THIS IS NOT: it does not find apnea events and cannot grade severity. It picks a few short stretches of the night
// that the existing snore-like model and level cues flagged, so a person can listen to them or play them to a clinician.
// All constants are PROVISIONAL engineering choices. None is validated. The rank score is never shown to the user.
//
// Ranking (documented, see CLIP_SCORING):
//   snore-like stretch   score = durationSec x clamp(meanLevelAboveFloorDb, 0, 30) + (restart ? RESTART_BONUS : 0)
//   other loud sound     score = durationSec x clamp(meanLevelAboveFloorDb, 0, 30)
// `restart` means: snore-like windows stopped for at least 10 s (and at most 120 s, all of it observed) and then resumed.
// That is an acoustic pattern a clinician may want to hear. It is NOT a confirmed apnea, and 10 s is NOT a diagnostic threshold.
import { SAMPLE_RATE } from '../audio/constants';
import { LOUD_DB } from '../night/constants';
import { StreamingResampler } from '../night/resample';

// ---------------------------------------------------------------------------------------------------------------------
// Categories (typed extension point)
// ---------------------------------------------------------------------------------------------------------------------
export type ImplementedClipCategory = 'snore-like' | 'loud-other';
/** Reserved for a future classifier (for example YAMNet classes). NOT implemented: the selector refuses these. */
export type ReservedClipCategory = 'cough-like' | 'gasp-like' | 'sleep-talking' | 'wheeze-like';
export type ClipCategory = ImplementedClipCategory | ReservedClipCategory;

export interface ClipCategoryMeta {
  /** Chip text on a clip row. */
  chip: string;
  implemented: boolean;
  /** Maximum clips kept per night in this category. 0 for reserved categories. */
  slots: number;
  /** Would need its own explicit opt-in before ever being saved (bystander privacy). */
  needsOwnOptIn: boolean;
  section: 'snore' | 'other';
}

export const CLIP_CATEGORY_META: Record<ClipCategory, ClipCategoryMeta> = {
  'snore-like': { chip: 'Snore-like', implemented: true, slots: 2, needsOwnOptIn: false, section: 'snore' },
  'loud-other': { chip: 'Loud sound', implemented: true, slots: 3, needsOwnOptIn: false, section: 'other' },
  'cough-like': { chip: 'Cough-like', implemented: false, slots: 0, needsOwnOptIn: false, section: 'other' },
  'gasp-like': { chip: 'Gasp-like', implemented: false, slots: 0, needsOwnOptIn: false, section: 'other' },
  'sleep-talking': { chip: 'Talking', implemented: false, slots: 0, needsOwnOptIn: true, section: 'other' },
  'wheeze-like': { chip: 'Wheeze-like', implemented: false, slots: 0, needsOwnOptIn: false, section: 'other' },
};
export const RESERVED_CLIP_CATEGORIES: readonly ReservedClipCategory[] = ['cough-like', 'gasp-like', 'sleep-talking', 'wheeze-like'];

export type ClipTag = 'snoring-stopped-restarted' | 'brief-loud-sound';
export const CLIP_TAG_LABEL: Record<ClipTag, string> = {
  'snoring-stopped-restarted': 'Snoring stopped, then restarted',
  'brief-loud-sound': 'Brief loud sound',
};
export const CLIP_SECTION_TITLE = { snore: 'Most notable snore-like stretches', other: 'Other loud sounds' } as const;

// ---------------------------------------------------------------------------------------------------------------------
// Constants (all PROVISIONAL)
// ---------------------------------------------------------------------------------------------------------------------
export const CLIP_SCORING = {
  ringSec: 20,
  preRollSec: 3,
  postRollSec: 3,
  maxClipSec: 15,
  /** maxClipSec - pre - post. A longer run is split into consecutive segments of at most this length. */
  maxEventSec: 9,
  /** Snore-like windows closer than this (gap between windows) join one run. */
  snoreJoinGapSec: 4,
  loudJoinGapSec: 2,
  /** Snore-like sound stopped at least this long, then resumed: the restart tag and bonus. Not a diagnostic threshold. */
  restartMinGapSec: 10,
  /** A longer quiet stretch is just a new snoring bout, not a restart. */
  restartMaxGapSec: 120,
  restartBonus: 60,
  maxAboveFloorDb: 30,
  minSnoreScore: 20,
  minLoudScore: 15,
  /** A loud run this short or shorter is tagged "Brief loud sound". */
  briefLoudSec: 2.5,
  /** Same-category clips closer than this compete for one slot, so the picks are spread across the night. */
  separationSec: 300,
  minClipSec: 1.5,
  peakBars: 48,
} as const;

export const CLIP_SAMPLE_RATE = SAMPLE_RATE;
export const RETENTION_OPTIONS = [7, 30, 90] as const;
export type RetentionDays = (typeof RETENTION_OPTIONS)[number];
export const DEFAULT_RETENTION_DAYS: RetentionDays = 30;

// ---------------------------------------------------------------------------------------------------------------------
// Settings shape (persisted by the app)
// ---------------------------------------------------------------------------------------------------------------------
export interface ClipSettings {
  /** Opt-in. Default false: with it off, no audio is ever written. */
  enabled: boolean;
  retentionDays: RetentionDays;
  decidedAt: string | null;
}
export const defaultClipSettings = (): ClipSettings => ({ enabled: false, retentionDays: DEFAULT_RETENTION_DAYS, decidedAt: null });
export function mergeClipSettings(raw: unknown): ClipSettings {
  const d = defaultClipSettings();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<ClipSettings>;
  return {
    enabled: r.enabled === true,
    retentionDays: (RETENTION_OPTIONS as readonly number[]).includes(r.retentionDays as number) ? (r.retentionDays as RetentionDays) : d.retentionDays,
    decidedAt: typeof r.decidedAt === 'string' ? r.decidedAt : null,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Storage math
// ---------------------------------------------------------------------------------------------------------------------
const WAV_HEADER_BYTES = 44;
export const clipBytes = (durationSec: number): number => WAV_HEADER_BYTES + Math.round(durationSec * CLIP_SAMPLE_RATE) * 2;
export const MAX_CLIPS_PER_NIGHT = CLIP_CATEGORY_META['snore-like'].slots + CLIP_CATEGORY_META['loud-other'].slots;
/** Worst case for one night: every slot filled with a 15 s clip. 5 x 480,044 bytes = about 2.4 MB. */
export const MAX_NIGHT_CLIP_BYTES = MAX_CLIPS_PER_NIGHT * clipBytes(CLIP_SCORING.maxClipSec);
export const estimateStorageBytes = (nights: number, clipsPerNight = MAX_CLIPS_PER_NIGHT, avgClipSec: number = CLIP_SCORING.maxClipSec): number =>
  Math.max(0, nights) * clipsPerNight * clipBytes(avgClipSec);
export function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

/** Night ids whose clips are older than the retention horizon (judged from the night's start). The night summary is kept. */
export function clipsToPrune(nights: readonly { id: string; startMs: number }[], nowMs: number, retentionDays: number): string[] {
  const cutoff = nowMs - retentionDays * 86_400_000;
  return nights.filter((n) => n.startMs < cutoff).map((n) => n.id);
}

// ---------------------------------------------------------------------------------------------------------------------
// WAV (16-bit PCM mono) and peaks
// ---------------------------------------------------------------------------------------------------------------------
export function encodeWav16(samples: Float32Array, rate: number = CLIP_SAMPLE_RATE): Uint8Array {
  const n = samples.length;
  const out = new Uint8Array(WAV_HEADER_BYTES + n * 2);
  const dv = new DataView(out.buffer);
  const tag = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i));
  };
  tag(0, 'RIFF');
  dv.setUint32(4, 36 + n * 2, true);
  tag(8, 'WAVE');
  tag(12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); // PCM
  dv.setUint16(22, 1, true); // mono
  dv.setUint32(24, rate, true);
  dv.setUint32(28, rate * 2, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  tag(36, 'data');
  dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i] as number));
    dv.setInt16(WAV_HEADER_BYTES + i * 2, Math.round(v < 0 ? v * 32768 : v * 32767), true);
  }
  return out;
}

/** Reads a file written by encodeWav16. Returns null for anything else (never throws). */
export function decodeWav16(bytes: Uint8Array): { rate: number; samples: Float32Array } | null {
  if (bytes.length < WAV_HEADER_BYTES) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (o: number) => String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE' || tag(12) !== 'fmt ' || tag(36) !== 'data') return null;
  if (dv.getUint16(20, true) !== 1 || dv.getUint16(22, true) !== 1 || dv.getUint16(34, true) !== 16) return null;
  const rate = dv.getUint32(24, true);
  const n = Math.min(dv.getUint32(40, true), bytes.length - WAV_HEADER_BYTES) >> 1;
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) samples[i] = dv.getInt16(WAV_HEADER_BYTES + i * 2, true) / 32768;
  return { rate, samples };
}

/** `bars` peak values as integers 0..100, scaled to the clip's own maximum (a drawing aid, not a loudness measure). */
export function computePeaks(samples: Float32Array, bars: number = CLIP_SCORING.peakBars): number[] {
  if (samples.length === 0 || bars <= 0) return [];
  const raw: number[] = [];
  let max = 0;
  for (let b = 0; b < bars; b++) {
    const a = Math.floor((b * samples.length) / bars);
    const z = Math.max(a + 1, Math.floor(((b + 1) * samples.length) / bars));
    let p = 0;
    for (let i = a; i < z && i < samples.length; i++) p = Math.max(p, Math.abs(samples[i] as number));
    raw.push(p);
    max = Math.max(max, p);
  }
  const denom = Math.max(max, 0.02);
  return raw.map((p) => Math.round(Math.min(1, p / denom) * 100));
}

// ---------------------------------------------------------------------------------------------------------------------
// Ring buffer (16 kHz mono, RAM only)
// ---------------------------------------------------------------------------------------------------------------------
export class PcmRing {
  private readonly buf: Float32Array;
  private head = 0; // absolute index of the next sample to write
  constructor(readonly capacity: number = CLIP_SCORING.ringSec * CLIP_SAMPLE_RATE) {
    this.buf = new Float32Array(capacity);
  }
  get headSample(): number {
    return this.head;
  }
  get oldestSample(): number {
    return Math.max(0, this.head - this.capacity);
  }
  push(x: Float32Array): void {
    const src = x.length > this.capacity ? x.subarray(x.length - this.capacity) : x;
    this.head += x.length - src.length; // samples that cannot fit are skipped but time still advances
    for (let i = 0; i < src.length; i++) this.buf[(this.head + i) % this.capacity] = src[i] as number;
    this.head += src.length;
  }
  /** Advance time by `n` samples of silence (a capture gap). Keeps the ring on the pipeline's timeline. */
  advance(n: number): void {
    const m = Math.min(Math.max(0, n), this.capacity);
    this.head += Math.max(0, n) - m;
    for (let i = 0; i < m; i++) this.buf[(this.head + i) % this.capacity] = 0;
    this.head += m;
  }
  /** Samples [start, end) or null when any part has already been overwritten or has not arrived. */
  read(start: number, end: number): Float32Array | null {
    if (end <= start || start < this.oldestSample || end > this.head) return null;
    const out = new Float32Array(end - start);
    for (let i = 0; i < out.length; i++) out[i] = this.buf[(start + i) % this.capacity] as number;
    return out;
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Event tracker: per-window observations in, candidate events out
// ---------------------------------------------------------------------------------------------------------------------
/** Structurally compatible with the pipeline's WindowDebug. */
export interface WindowObs {
  k: number;
  status: 'scored' | 'belowGate' | 'tooQuiet' | 'skipped';
  levelDb: number;
  floorDb?: number;
  snoreLike?: boolean;
  speechLike?: boolean;
}

export interface CandidateEvent {
  category: ImplementedClipCategory;
  tag: ClipTag | null;
  /** Audio-timeline seconds of the event itself (without pre/post roll). */
  startSec: number;
  endSec: number;
  score: number;
  /** Seconds of quiet before a restart. Only for the restart tag. */
  restartGapSec: number | null;
}

interface Run {
  firstK: number;
  lastK: number;
  sumAbove: number;
  n: number;
  restartGapSec: number | null;
}

const HOP = 0.5;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const runEndSec = (r: Run) => r.lastK * HOP + 1;
const runStartSec = (r: Run) => r.firstK * HOP;

export class ClipEventTracker {
  private snore: Run | null = null;
  private loud: Run | null = null;
  private prevK: number | null = null;
  /** End (seconds) of the last snore-like window, or null when the time since then is not fully observed. */
  private lastSnoreEndSec: number | null = null;
  readonly speechWindowStarts: number[] = [];

  /** Feed windows in order. Returns events that closed with this window. */
  observe(w: WindowObs): CandidateEvent[] {
    const out: CandidateEvent[] = [];
    const t0 = w.k * HOP;
    // Missing or skipped windows: the time between is unknown, so it never counts as "snoring stopped".
    if (w.status === 'skipped' || (this.prevK !== null && w.k - this.prevK > 1)) {
      this.closeSnore(out);
      this.closeLoud(out);
      this.lastSnoreEndSec = null;
      if (w.status === 'skipped') {
        this.prevK = w.k;
        return out;
      }
    }
    this.prevK = w.k;

    if (w.speechLike) {
      this.speechWindowStarts.push(t0);
      if (this.speechWindowStarts.length > 400) this.speechWindowStarts.splice(0, 100);
    }

    // Close runs whose join gap has passed.
    if (this.snore && t0 - runEndSec(this.snore) > CLIP_SCORING.snoreJoinGapSec) this.closeSnore(out);
    if (this.loud && t0 - runEndSec(this.loud) > CLIP_SCORING.loudJoinGapSec) this.closeLoud(out);

    const floor = w.floorDb;
    const above = floor === undefined || !Number.isFinite(w.levelDb) ? 0 : clamp(w.levelDb - floor, 0, CLIP_SCORING.maxAboveFloorDb);
    const isSnore = w.status === 'scored' && w.snoreLike === true;
    const isLoud =
      !isSnore && !w.speechLike && (w.status === 'scored' || w.status === 'belowGate') && floor !== undefined && Number.isFinite(w.levelDb) && w.levelDb - floor >= LOUD_DB;

    if (isSnore) {
      // A loud-sound run ends where snoring takes over.
      this.closeLoud(out);
      if (!this.snore) {
        let restartGap: number | null = null;
        if (this.lastSnoreEndSec !== null) {
          const gap = t0 - this.lastSnoreEndSec;
          if (gap >= CLIP_SCORING.restartMinGapSec && gap <= CLIP_SCORING.restartMaxGapSec) restartGap = gap;
        }
        this.snore = { firstK: w.k, lastK: w.k, sumAbove: above, n: 1, restartGapSec: restartGap };
      } else {
        this.snore.lastK = w.k;
        this.snore.sumAbove += above;
        this.snore.n++;
      }
      this.lastSnoreEndSec = w.k * HOP + 1;
      if (runEndSec(this.snore) - runStartSec(this.snore) >= CLIP_SCORING.maxEventSec) this.closeSnore(out, true);
    } else if (isLoud) {
      if (!this.loud) this.loud = { firstK: w.k, lastK: w.k, sumAbove: above, n: 1, restartGapSec: null };
      else {
        this.loud.lastK = w.k;
        this.loud.sumAbove += above;
        this.loud.n++;
      }
      if (runEndSec(this.loud) - runStartSec(this.loud) >= CLIP_SCORING.maxEventSec) this.closeLoud(out);
    } else if (w.speechLike) {
      this.closeLoud(out);
    }
    return out;
  }

  /** End of the night: close what is open. */
  flush(): CandidateEvent[] {
    const out: CandidateEvent[] = [];
    this.closeSnore(out);
    this.closeLoud(out);
    return out;
  }

  private closeSnore(out: CandidateEvent[], continuing = false): void {
    const r = this.snore;
    if (!r) return;
    this.snore = null;
    if (continuing) this.lastSnoreEndSec = runEndSec(r);
    const dur = runEndSec(r) - runStartSec(r);
    const mean = r.n > 0 ? r.sumAbove / r.n : 0;
    const restart = r.restartGapSec !== null;
    const score = dur * mean + (restart ? CLIP_SCORING.restartBonus : 0);
    if (score < CLIP_SCORING.minSnoreScore) return;
    out.push({ category: 'snore-like', tag: restart ? 'snoring-stopped-restarted' : null, startSec: runStartSec(r), endSec: runEndSec(r), score, restartGapSec: r.restartGapSec });
  }

  private closeLoud(out: CandidateEvent[]): void {
    const r = this.loud;
    if (!r) return;
    this.loud = null;
    const dur = runEndSec(r) - runStartSec(r);
    const score = dur * (r.sumAbove / r.n);
    if (score < CLIP_SCORING.minLoudScore) return;
    out.push({ category: 'loud-other', tag: dur <= CLIP_SCORING.briefLoudSec ? 'brief-loud-sound' : null, startSec: runStartSec(r), endSec: runEndSec(r), score, restartGapSec: null });
  }

  /** True when a speech-like window overlaps [fromSec, toSec]. Speech-like stretches are never saved. */
  speechOverlaps(fromSec: number, toSec: number): boolean {
    return this.speechWindowStarts.some((t) => t < toSec && t + 1 > fromSec);
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Top-K selection
// ---------------------------------------------------------------------------------------------------------------------
export interface SelectableClip {
  id: string;
  category: ClipCategory;
  score: number;
  /** Event start, audio-timeline seconds. */
  startSec: number;
}
export interface OfferPlan<T extends SelectableClip> {
  accept: boolean;
  evict: T[];
}

/** Keeps the best clips per category. Replaced clips are returned so the caller can delete their files immediately. */
export class ClipSelector<T extends SelectableClip> {
  private items: T[] = [];

  /** Higher score wins; on a tie the earlier clip wins (stable and deterministic). */
  private static better(a: SelectableClip, b: SelectableClip): boolean {
    return a.score > b.score || (a.score === b.score && a.startSec < b.startSec);
  }

  plan(c: T): OfferPlan<T> {
    const meta = CLIP_CATEGORY_META[c.category];
    if (!meta.implemented || meta.slots <= 0) return { accept: false, evict: [] };
    const same = this.items.filter((x) => x.category === c.category);
    const near = same.filter((x) => Math.abs(x.startSec - c.startSec) < CLIP_SCORING.separationSec);
    if (near.some((x) => !ClipSelector.better(c, x))) return { accept: false, evict: [] };
    const evict = [...near];
    const remaining = same.filter((x) => !near.includes(x));
    if (remaining.length >= meta.slots) {
      const worst = remaining.reduce((a, b) => (ClipSelector.better(a, b) ? b : a));
      if (!ClipSelector.better(c, worst)) return { accept: false, evict: [] };
      evict.push(worst);
    }
    return { accept: true, evict };
  }

  offer(c: T): OfferPlan<T> {
    const p = this.plan(c);
    if (p.accept) {
      this.items = this.items.filter((x) => !p.evict.includes(x));
      this.items.push(c);
    }
    return p;
  }

  /** Best first inside each section; snore-like section before the others. */
  selected(): T[] {
    const order = (x: T) => (CLIP_CATEGORY_META[x.category].section === 'snore' ? 0 : 1);
    return [...this.items].sort((a, b) => order(a) - order(b) || (ClipSelector.better(a, b) ? -1 : 1));
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Recorder: ring + tracker + selector + injected temp-file sink
// ---------------------------------------------------------------------------------------------------------------------
export interface ClipTempSink {
  writeTemp(id: string, wav: Uint8Array): void;
  removeTemp(id: string): void;
}

export interface ClipMeta {
  id: string;
  /** File name inside the night's clips folder. */
  file: string;
  category: ImplementedClipCategory;
  tag: ClipTag | null;
  /** Wall-clock start of the clip (pre-roll included). */
  startMs: number;
  durationSec: number;
  /** 0..100 integers for the mini waveform. */
  peaks: number[];
  /** Internal rank score. Never displayed. */
  score: number;
}

export interface FinishedClip extends ClipMeta {
  /** Audio-timeline seconds of the event start; used only for selection. */
  startSec: number;
}

export interface ClipRecorderStats {
  offered: number;
  droppedSpeech: number;
  droppedLate: number;
  droppedShort: number;
  rejected: number;
  tempWrites: number;
  tempRemovals: number;
}

interface Pending {
  ev: CandidateEvent;
  cutStart: number;
  cutEnd: number;
}

export class ClipRecorder {
  private readonly ring = new PcmRing();
  private readonly tracker = new ClipEventTracker();
  private readonly selector = new ClipSelector<FinishedClip>();
  private resampler: StreamingResampler | null = null;
  private rate = 0;
  private pending: Pending[] = [];
  private seq = 0;
  private closed = false;
  readonly stats: ClipRecorderStats = { offered: 0, droppedSpeech: 0, droppedLate: 0, droppedShort: 0, rejected: 0, tempWrites: 0, tempRemovals: 0 };

  constructor(
    private readonly nightStartMs: number,
    private readonly sink: ClipTempSink,
  ) {}

  /** Same audio the pipeline gets, in source rate. Mirrors the pipeline's resampling so both stay on one timeline. */
  pushAudio(samples: Float32Array, sourceRate: number): void {
    if (this.closed) return;
    if (!this.resampler) {
      this.rate = sourceRate;
      this.resampler = new StreamingResampler(sourceRate);
    } else if (sourceRate !== this.rate) return;
    this.ring.push(this.resampler.push(samples));
  }

  /** Mirrors NightSession.markGap: the audio timeline jumps forward by `sec`. */
  markGap(sec: number): void {
    if (this.closed) return;
    if (this.resampler) this.ring.push(this.resampler.flush());
    this.ring.advance(Math.round(sec * CLIP_SAMPLE_RATE));
  }

  onWindow(w: WindowObs): void {
    if (this.closed) return;
    for (const ev of this.tracker.observe(w)) this.queue(ev);
    this.drain(w.k * HOP);
  }

  /** Finish the night: close open runs, cut what is possible, return the final picks. Temp files stay until `discard`. */
  finish(): FinishedClip[] {
    if (!this.closed) {
      for (const ev of this.tracker.flush()) this.queue(ev);
      this.drain(Infinity);
      this.closed = true;
    }
    return this.selector.selected();
  }

  /** Delete every temp file (night abandoned, opt-out, or delete my data). */
  discard(): void {
    this.closed = true;
    this.pending = [];
    for (const c of this.selector.selected()) this.remove(c.id);
  }

  get pickedCount(): number {
    return this.selector.selected().length;
  }

  private queue(ev: CandidateEvent): void {
    this.pending.push({ ev, cutStart: Math.max(0, ev.startSec - CLIP_SCORING.preRollSec), cutEnd: ev.endSec + CLIP_SCORING.postRollSec });
  }

  private drain(nowWindowStartSec: number): void {
    const ready = this.pending.filter((p) => nowWindowStartSec >= p.cutEnd);
    this.pending = this.pending.filter((p) => !ready.includes(p));
    for (const p of ready) this.cut(p);
  }

  private cut(p: Pending): void {
    this.stats.offered++;
    if (this.tracker.speechOverlaps(p.cutStart, p.cutEnd)) {
      this.stats.droppedSpeech++;
      return;
    }
    const headSec = this.ring.headSample / CLIP_SAMPLE_RATE;
    const end = Math.min(p.cutEnd, headSec);
    if (end - p.cutStart < CLIP_SCORING.minClipSec) {
      this.stats.droppedShort++;
      return;
    }
    const cand: FinishedClip = {
      id: `c${this.seq++}`,
      file: '',
      category: p.ev.category,
      tag: p.ev.tag,
      startMs: Math.round(this.nightStartMs + p.cutStart * 1000),
      durationSec: Math.round((end - p.cutStart) * 100) / 100,
      peaks: [],
      score: Math.round(p.ev.score * 10) / 10,
      startSec: p.ev.startSec,
    };
    cand.file = `${cand.id}.wav`;
    // Decide before writing anything: a clip that would not be kept never touches the disk.
    if (!this.selector.plan(cand).accept) {
      this.stats.rejected++;
      return;
    }
    const pcm = this.ring.read(Math.round(p.cutStart * CLIP_SAMPLE_RATE), Math.round(end * CLIP_SAMPLE_RATE));
    if (!pcm) {
      this.stats.droppedLate++;
      return;
    }
    cand.peaks = computePeaks(pcm);
    this.sink.writeTemp(cand.id, encodeWav16(pcm));
    this.stats.tempWrites++;
    for (const gone of this.selector.offer(cand).evict) this.remove(gone.id);
  }

  private remove(id: string): void {
    this.sink.removeTemp(id);
    this.stats.tempRemovals++;
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Per-night manifest (nights/<id>/clips/clips.json)
// ---------------------------------------------------------------------------------------------------------------------
export const CLIPS_DIR = 'clips';
export const CLIPS_MANIFEST_NAME = 'clips.json';
export interface ClipsManifest {
  v: 1;
  nightId: string;
  createdAt: number;
  /** Clip saving was on for this night. A manifest with zero clips means "none were picked", not "saving was off". */
  clips: ClipMeta[];
}

export function parseClipsManifest(text: string): ClipsManifest | null {
  try {
    const m = JSON.parse(text) as Partial<ClipsManifest>;
    if (!m || m.v !== 1 || typeof m.nightId !== 'string' || !Array.isArray(m.clips)) return null;
    const clips = m.clips.filter(
      (c): c is ClipMeta =>
        !!c &&
        typeof c.id === 'string' &&
        /^[A-Za-z0-9_-]+\.wav$/.test(c.file) &&
        (c.category === 'snore-like' || c.category === 'loud-other') &&
        typeof c.startMs === 'number' &&
        typeof c.durationSec === 'number' &&
        Array.isArray(c.peaks),
    );
    return { v: 1, nightId: m.nightId, createdAt: typeof m.createdAt === 'number' ? m.createdAt : 0, clips };
  } catch {
    return null;
  }
}

export function clipSections(clips: readonly ClipMeta[]): { snore: ClipMeta[]; other: ClipMeta[] } {
  const by = (s: 'snore' | 'other') => clips.filter((c) => CLIP_CATEGORY_META[c.category].section === s).sort((a, b) => b.score - a.score);
  return { snore: by('snore'), other: by('other') };
}

export type NightClipsState = 'saving-off' | 'none-picked' | 'has-clips';
export function nightClipsState(manifest: ClipsManifest | null): NightClipsState {
  return manifest === null ? 'saving-off' : manifest.clips.length === 0 ? 'none-picked' : 'has-clips';
}
