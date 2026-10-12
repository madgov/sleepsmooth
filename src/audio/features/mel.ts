// HTK-scale mel filterbank: mel(f) = 2595 * log10(1 + f / 700), 40 triangular filters with
// edges evenly spaced in mel between 0 and 8000 Hz, peak weight 1 (no area normalization),
// applied to the power spectrum of a 512-point FFT at 16 kHz (257 bins). No DOM imports.
import { N_MELS, SAMPLE_RATE } from '../constants';

export const FFT_SIZE = 512;
export const N_BINS = FFT_SIZE / 2 + 1;
export const MEL_FMIN = 0;
export const MEL_FMAX = SAMPLE_RATE / 2;

export const hzToMel = (f: number): number => 2595 * Math.log10(1 + f / 700);
export const melToHz = (m: number): number => 700 * (Math.pow(10, m / 2595) - 1);

let cached: Float64Array[] | null = null;

/** Returns N_MELS arrays of N_BINS weights. */
export function melFilterbank(): Float64Array[] {
  if (cached) return cached;
  const mMin = hzToMel(MEL_FMIN);
  const mMax = hzToMel(MEL_FMAX);
  const edges: number[] = [];
  for (let i = 0; i < N_MELS + 2; i++) edges.push(melToHz(mMin + ((mMax - mMin) * i) / (N_MELS + 1)));
  const binHz = SAMPLE_RATE / FFT_SIZE;
  const bank: Float64Array[] = [];
  for (let m = 0; m < N_MELS; m++) {
    const lo = edges[m] as number;
    const mid = edges[m + 1] as number;
    const hi = edges[m + 2] as number;
    const w = new Float64Array(N_BINS);
    for (let b = 0; b < N_BINS; b++) {
      const f = b * binHz;
      if (f > lo && f <= mid) w[b] = (f - lo) / (mid - lo);
      else if (f > mid && f < hi) w[b] = (hi - f) / (hi - mid);
    }
    bank.push(w);
  }
  cached = bank;
  return bank;
}
