// Compressed-format parity helpers (mp3/m4a). No DOM imports; used by Node generator, Vitest and /parity.
//
// Decoders add leading delay (encoder priming + decoder delay, hundreds to ~2000 samples), and
// different decoders may differ by a sample or two. So the decoded signal is first aligned to the
// known synthetic reference by cross-correlation, then log-mel features of a fixed 1 s window are
// compared. Lossy coding changes spectral detail, so the comparison is NOT 1e-4: it uses the mean
// absolute difference of log-mel values (natural log units) with CODEC_TOLERANCE.
import { frameLogMel, resampleTo16k } from '../index';
import { lcgNoise } from './goldenCases';

/**
 * MEASURED (Node, ffmpeg 128 kbps decode vs uncompressed signal, mean abs log-mel difference, nats):
 *   mp3: mean 0.123, max 0.765, p95 per-frame mean 0.150
 *   m4a: mean 0.168, max 1.263, p95 per-frame mean 0.226
 * Tolerance is ~2x the larger mean (0.168) to allow for browser decoder differences.
 */
export const CODEC_TOLERANCE = 0.34;
export const FIXTURE_RATE = 44100;
export const MAX_LAG_16K = 4000;

/** 3 s at 44.1 kHz: 100 Hz -> 6 kHz chirp swept 3 times plus low-level noise. */
export function fixtureSignal(): Float32Array {
  const n = FIXTURE_RATE * 3;
  const noise = lcgNoise(n, 777);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = (i / FIXTURE_RATE) % 1;
    out[i] = 0.4 * Math.sin(2 * Math.PI * (100 * t + (5900 / 2) * t * t)) + 0.05 * (noise[i] as number);
  }
  return out;
}

/**
 * Lag L (in samples) maximizing normalized correlation so that decoded[i + L] ~ reference[i].
 * Positive L means the decoder output is delayed. Searches [-maxLag, maxLag] using a
 * `segLen`-sample segment of the reference starting at `segStart`.
 */
export function alignOffset(reference: Float32Array, decoded: Float32Array, maxLag = MAX_LAG_16K, segStart = 8000, segLen = 8000): number {
  let best = 0;
  let bestScore = -Infinity;
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    let dot = 0;
    let e = 0;
    for (let i = 0; i < segLen; i++) {
      const d = decoded[segStart + i + lag];
      if (d === undefined) continue;
      dot += (reference[segStart + i] as number) * d;
      e += d * d;
    }
    const score = e > 0 ? dot / Math.sqrt(e) : -Infinity;
    if (score > bestScore) {
      bestScore = score;
      best = lag;
    }
  }
  return best;
}

export const meanAbsDiff = (a: ArrayLike<number>, b: ArrayLike<number>): number => {
  if (a.length !== b.length) return Infinity;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs((a[i] as number) - (b[i] as number));
  return s / a.length;
};

/** Align `decodedRate` mono audio to the reference, then return lag and 1 s log-mel (window at 0.5 s). */
export function codecFeatures(decoded: Float32Array, decodedRate: number): { lag: number; values: Float32Array } {
  const ref16 = resampleTo16k(fixtureSignal(), FIXTURE_RATE);
  const dec16 = resampleTo16k(decoded, decodedRate);
  const lag = alignOffset(ref16, dec16);
  const win = dec16.subarray(8000 + lag, 24000 + lag);
  return { lag, values: frameLogMel(win) };
}

export interface CodecExpected {
  format: 'mp3' | 'm4a';
  lag: number;
  values: number[];
}
