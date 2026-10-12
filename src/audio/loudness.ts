// RMS loudness helpers. Pure TS, no DOM imports. Levels are dB relative to full scale (dBFS).
import { SAMPLE_RATE } from './constants';

export const MIN_DB = -120;

export function toDb(meanSquare: number): number {
  return meanSquare <= 0 ? MIN_DB : Math.max(MIN_DB, 10 * Math.log10(meanSquare));
}

/** Sum of squares of samples[start, end). */
export function sumSquares(samples: Float32Array, start = 0, end = samples.length): number {
  let s = 0;
  for (let i = start; i < end; i++) {
    const v = samples[i] as number;
    s += v * v;
  }
  return s;
}

/** RMS level in dBFS for each block of `blockSamples` samples (last block may be shorter). */
export function rmsDbPerBlock(samples: Float32Array, blockSamples: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < samples.length; i += blockSamples) {
    const end = Math.min(i + blockSamples, samples.length);
    out.push(toDb(sumSquares(samples, i, end) / (end - i)));
  }
  return out;
}

/** RMS dB per second of 16 kHz audio. */
export function loudnessPerSecond(samples16k: Float32Array): number[] {
  return rmsDbPerBlock(samples16k, SAMPLE_RATE);
}
