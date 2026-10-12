// Windowed-sinc resampler to 16 kHz. Pure TS, no DOM imports (shared by Node and browser).
//
// Method: band-limited interpolation. Each output sample at time n * ratio (in source samples,
// ratio = sourceRate / 16000) is the sum of nearby source samples weighted by a low-pass sinc
// kernel multiplied by a Kaiser window (beta 8, 8 zero crossings each side measured at the
// output rate). The cutoff is 0.97 * min(source, target) Nyquist, so downsampling is
// anti-aliased in the same pass. The kernel is tabulated at 512 steps per source sample and
// linearly interpolated, which keeps cost near 50 taps per output sample for 44.1/48 kHz.
// Samples outside the signal are treated as zero. Output is deterministic.
import { SAMPLE_RATE } from '../constants';

const ZERO_CROSSINGS = 8;
const KAISER_BETA = 8;
const CUTOFF_FRACTION = 0.97;
const TABLE_RES = 512;

function besselI0(x: number): number {
  let sum = 1;
  let term = 1;
  const q = (x * x) / 4;
  for (let k = 1; k < 60; k++) {
    term *= q / (k * k);
    sum += term;
    if (term < 1e-12 * sum) break;
  }
  return sum;
}

interface Kernel {
  halfWidth: number; // source samples
  table: Float64Array; // h(i / TABLE_RES), i = 0..halfWidth*TABLE_RES + 1
}

const kernelCache = new Map<number, Kernel>();

function getKernel(ratio: number): Kernel {
  const key = Math.round(ratio * 1e6);
  const cached = kernelCache.get(key);
  if (cached) return cached;
  // cutoff in cycles per source sample
  const fc = 0.5 * CUTOFF_FRACTION * Math.min(1, 1 / ratio);
  const halfWidth = ZERO_CROSSINGS / (2 * fc);
  const n = Math.ceil(halfWidth * TABLE_RES) + 2;
  const table = new Float64Array(n);
  const i0Beta = besselI0(KAISER_BETA);
  for (let i = 0; i < n; i++) {
    const x = i / TABLE_RES;
    const r = x / halfWidth;
    if (r >= 1) {
      table[i] = 0;
      continue;
    }
    const arg = 2 * Math.PI * fc * x;
    const sinc = x === 0 ? 1 : Math.sin(arg) / arg;
    const win = besselI0(KAISER_BETA * Math.sqrt(1 - r * r)) / i0Beta;
    table[i] = 2 * fc * sinc * win;
  }
  const k = { halfWidth, table };
  kernelCache.set(key, k);
  return k;
}

/** Number of 16 kHz output samples produced for `inputLength` samples at `sourceRate`. */
export function resampledLength(inputLength: number, sourceRate: number): number {
  return Math.floor((inputLength * SAMPLE_RATE) / sourceRate);
}

/**
 * Resample the output index range [outStart, outEnd) (16 kHz sample indices) of the full
 * resampled signal. Concatenating consecutive ranges equals the one-shot result exactly,
 * so the worker can process in chunks with progress.
 */
export function resampleRange(
  samples: Float32Array,
  sourceRate: number,
  outStart: number,
  outEnd: number,
): Float32Array {
  const total = resampledLength(samples.length, sourceRate);
  const end = Math.min(outEnd, total);
  const len = Math.max(0, end - outStart);
  const out = new Float32Array(len);
  if (len === 0) return out;
  if (sourceRate === SAMPLE_RATE) {
    out.set(samples.subarray(outStart, end));
    return out;
  }
  const ratio = sourceRate / SAMPLE_RATE;
  const { halfWidth, table } = getKernel(ratio);
  const lastIdx = samples.length - 1;
  for (let n = 0; n < len; n++) {
    const center = (outStart + n) * ratio;
    let lo = Math.ceil(center - halfWidth);
    let hi = Math.floor(center + halfWidth);
    if (lo < 0) lo = 0;
    if (hi > lastIdx) hi = lastIdx;
    let acc = 0;
    for (let j = lo; j <= hi; j++) {
      const pos = Math.abs(j - center) * TABLE_RES;
      const i = Math.floor(pos);
      const frac = pos - i;
      const a = table[i] as number;
      const b = table[i + 1] as number;
      acc += (samples[j] as number) * (a + (b - a) * frac);
    }
    out[n] = acc;
  }
  return out;
}

/** Resample mono audio to 16 kHz using our own resampler (same code in Node and browser). */
export function resampleAll(samples: Float32Array, sourceRate: number): Float32Array {
  return resampleRange(samples, sourceRate, 0, resampledLength(samples.length, sourceRate));
}
