// Streaming log-mel with two exact optimizations (docs/OVERNIGHT_PLAN.md section 10.1):
//  1. Frame reuse across the 50 percent window overlap. Window k (samples [8000k, 8000k+16000)) uses
//     frameWindow()'s 100 frames: frame 0 and frame 99 touch the zero padding and are unique to the
//     window; interior frames 1..98 sit on a global 10 ms grid G(a) starting at sample 160a - 120
//     (a = 50k + j). Consecutive windows share 48 interior frames, so each window computes only 50
//     new interior frames plus 2 edge frames (52 instead of 100).
//  2. Sparse mel. Each HTK triangular filter is non-zero on a short span of the 257 power bins. Adding
//     the zero-weight terms never changes a floating-point sum, so looping only over the non-zero span
//     (ascending, same order) is bit-identical to the dense loop in audio/features/logmel.ts.
// The arithmetic otherwise mirrors logMelFrames() exactly (float32 sample x float64 Hann, radix-2 FFT of
// 512, power |X|^2, ln(e + LOG_EPS)), so results are bit-equal, and a test asserts it.
import { FRAME_SAMPLES, N_MELS, SAMPLE_RATE } from '../audio/constants';
import { fft, hannWindow } from '../audio/features/fft';
import { LOG_EPS } from '../audio/features/logmel';
import { FFT_SIZE, N_BINS, melFilterbank } from '../audio/features/mel';
import { FRAMES_PER_WINDOW } from '../audio/constants';
import { FRAMES_PER_HOP, FRAME_HOP, HOP_SAMPLES_WINDOW, SPEECH_BAND_HZ, WINDOW_SAMPLES } from './constants';

const PAD = (((FRAMES_PER_WINDOW - 1) * FRAME_HOP + FRAME_SAMPLES - WINDOW_SAMPLES) / 2) | 0; // 120

interface SparseFilter {
  lo: number;
  hi: number; // exclusive
  w: Float64Array;
}

let hann: Float64Array | null = null;
let sparse: SparseFilter[] | null = null;
let speechBins: { lo: number; hi: number } | null = null;

function ensureTables(): { hann: Float64Array; sparse: SparseFilter[] } {
  hann ??= hannWindow(FRAME_SAMPLES);
  if (!sparse) {
    const dense = melFilterbank();
    sparse = dense.map((row) => {
      let lo = N_BINS;
      let hi = 0;
      for (let b = 0; b < N_BINS; b++) {
        if ((row[b] as number) !== 0) {
          if (b < lo) lo = b;
          hi = b + 1;
        }
      }
      if (hi === 0) lo = 0;
      return { lo, hi, w: row };
    });
    const binHz = SAMPLE_RATE / FFT_SIZE;
    speechBins = { lo: Math.ceil(SPEECH_BAND_HZ.lo / binHz), hi: Math.floor(SPEECH_BAND_HZ.hi / binHz) + 1 };
  }
  return { hann, sparse };
}

export interface FrameResult {
  /** N_MELS log-mel values for the frame. */
  mel: Float32Array;
  /** ln(power summed over the 300 to 3400 Hz bins + LOG_EPS). Feeds the speech-like cue only. */
  env: number;
}

const re = new Float64Array(FFT_SIZE);
const im = new Float64Array(FFT_SIZE);
const power = new Float64Array(N_BINS);

/** Log-mel of one 400-sample frame (already windowed-by-position, zeros where padding applies). */
export function logMelFrameSparse(frame: Float32Array): FrameResult {
  const t = ensureTables();
  re.fill(0);
  im.fill(0);
  for (let i = 0; i < FRAME_SAMPLES; i++) re[i] = (frame[i] as number) * (t.hann[i] as number);
  fft(re, im);
  for (let b = 0; b < N_BINS; b++) power[b] = (re[b] as number) ** 2 + (im[b] as number) ** 2;
  const mel = new Float32Array(N_MELS);
  for (let m = 0; m < N_MELS; m++) {
    const f = t.sparse[m] as SparseFilter;
    let e = 0;
    for (let b = f.lo; b < f.hi; b++) e += (f.w[b] as number) * (power[b] as number);
    mel[m] = Math.log(e + LOG_EPS);
  }
  const sb = speechBins as { lo: number; hi: number };
  let se = 0;
  for (let b = sb.lo; b < sb.hi; b++) se += power[b] as number;
  return { mel, env: Math.log(se + LOG_EPS) };
}

/** Sample source for frame extraction: 16 kHz audio addressed by absolute sample index. */
export interface SampleSource {
  /** Copy [start, start + len) into dst at dstOffset. All indices are guaranteed to be available. */
  copy(start: number, len: number, dst: Float32Array, dstOffset: number): void;
}

/** Computes and caches the interior frames of the global grid, and assembles per-window log-mel. */
export class FrameCache {
  private readonly cache = new Map<number, FrameResult>();
  private readonly scratch = new Float32Array(FRAME_SAMPLES);
  /** Number of frames computed (for the reuse test and the benchmark). */
  computed = 0;

  constructor(private readonly src: SampleSource) {}

  /** Interior frame a of the global grid (start sample 160a - 120). */
  interior(a: number): FrameResult {
    const hit = this.cache.get(a);
    if (hit) return hit;
    this.src.copy(a * FRAME_HOP - PAD, FRAME_SAMPLES, this.scratch, 0);
    const r = logMelFrameSparse(this.scratch);
    this.cache.set(a, r);
    this.computed++;
    return r;
  }

  /** Frame 0 of window k: 120 leading zeros, then the first 280 samples of the window. */
  private edgeFirst(s0: number): FrameResult {
    this.scratch.fill(0);
    this.src.copy(s0, FRAME_SAMPLES - PAD, this.scratch, PAD);
    this.computed++;
    return logMelFrameSparse(this.scratch);
  }

  /** Frame 99 of window k: the last 280 samples of the window, then 120 trailing zeros. */
  private edgeLast(s0: number): FrameResult {
    this.scratch.fill(0);
    this.src.copy(s0 + WINDOW_SAMPLES - (FRAME_SAMPLES - PAD), FRAME_SAMPLES - PAD, this.scratch, 0);
    this.computed++;
    return logMelFrameSparse(this.scratch);
  }

  /**
   * Row-major (100 x 40) log-mel for window k, equal to frameLogMel(window) bit for bit.
   * Also returns the 98 interior frames' envelopes (indices 1..98) for the speech-like cue.
   */
  windowLogMel(k: number): { logMel: Float32Array; interior: FrameResult[] } {
    const s0 = k * HOP_SAMPLES_WINDOW;
    const out = new Float32Array(FRAMES_PER_WINDOW * N_MELS);
    out.set(this.edgeFirst(s0).mel, 0);
    const interior: FrameResult[] = [];
    for (let j = 1; j <= FRAMES_PER_WINDOW - 2; j++) {
      const r = this.interior(FRAMES_PER_HOP * k + j);
      interior.push(r);
      out.set(r.mel, j * N_MELS);
    }
    out.set(this.edgeLast(s0).mel, (FRAMES_PER_WINDOW - 1) * N_MELS);
    return { logMel: out, interior };
  }

  /** Drop cached frames with grid index below `a`. */
  evictBefore(a: number): void {
    for (const key of this.cache.keys()) if (key < a) this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}
