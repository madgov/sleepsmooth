// Deterministic synthetic signals and the golden cases computed from them. Shared by the
// Node generator, the Vitest parity test, and the browser /parity page. No DOM imports.
import { computeLogMel, frameLogMel, resampleTo16k } from '../index';
import { frameSignal } from '../frame';

/** Small deterministic PRNG (LCG), uniform in [-1, 1). */
export function lcgNoise(n: number, seed: number): Float32Array {
  let s = seed >>> 0;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    out[i] = s / 2147483648 - 1;
  }
  return out;
}

export function sine(freq: number, rate: number, seconds: number, amp = 0.5): Float32Array {
  const n = Math.round(rate * seconds);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = amp * Math.sin((2 * Math.PI * freq * i) / rate);
  return out;
}

/** Linear chirp 100 Hz -> 6000 Hz over 1 s at 16 kHz plus low-level noise. */
export function chirpNoise(): Float32Array {
  const n = 16000;
  const noise = lcgNoise(n, 12345);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / 16000;
    out[i] = 0.4 * Math.sin(2 * Math.PI * (100 * t + (5900 / 2) * t * t)) + 0.05 * (noise[i] as number);
  }
  return out;
}

export interface GoldenCase {
  name: string;
  compute: () => Float32Array;
}

export const GOLDEN_CASES: GoldenCase[] = [
  { name: 'frameLogMel-sine440', compute: () => frameLogMel(sine(440, 16000, 1)) },
  { name: 'frameLogMel-chirp-noise', compute: () => frameLogMel(chirpNoise()) },
  { name: 'computeLogMel-5-frames', compute: () => computeLogMel(frameSignal(chirpNoise().subarray(0, 1200))) },
  { name: 'resample-44100-sine1000', compute: () => resampleTo16k(sine(1000, 44100, 1), 44100) },
  { name: 'resample-48000-sine1000', compute: () => resampleTo16k(sine(1000, 48000, 1), 48000) },
];

export interface GoldenFile {
  name: string;
  length: number;
  values: number[];
}

export const GOLDEN_TOLERANCE = 1e-4;

export function maxAbsDiff(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length) return Infinity;
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs((a[i] as number) - (b[i] as number)));
  return m;
}
