// Recording quality gate: duration, clipping, noise floor, silence ratio -> verdict + reasons.
// Thresholds are documented heuristics for this prototype, not validated standards.
import type { QualityReport } from '../types/audio';
import { MIN_DURATION_SEC, SAMPLE_RATE, SILENCE_FLOOR_DBFS } from './constants';
import { rmsDbPerBlock } from './loudness';

export const CLIP_LEVEL = 0.999;
export const FRAME_BLOCK_SEC = 0.1;
export const QUALITY_THRESHOLDS = {
  unusableClippingPct: 10,
  marginalClippingPct: 1,
  unusableSilenceRatio: 0.95,
  marginalSilenceRatio: 0.5,
  marginalNoiseFloorDb: -35,
  marginalDurationSec: 120,
} as const;

/** Count of samples at or beyond full scale. */
export function countClipped(samples: Float32Array, start = 0, end = samples.length): number {
  let c = 0;
  for (let i = start; i < end; i++) if (Math.abs(samples[i] as number) >= CLIP_LEVEL) c++;
  return c;
}

function percentile(values: ArrayLike<number>, p: number): number {
  const a = Array.from(values).sort((x, y) => x - y);
  if (a.length === 0) return -120;
  return a[Math.min(a.length - 1, Math.floor(p * a.length))] as number;
}

export interface QualityInputs {
  durationSec: number;
  clippedSamples: number;
  totalSamples: number;
  /** RMS dBFS per 100 ms block. */
  blockDb: ArrayLike<number>;
}

export function buildQualityReport(inp: QualityInputs): QualityReport {
  const t = QUALITY_THRESHOLDS;
  const clippingPct = inp.totalSamples > 0 ? (100 * inp.clippedSamples) / inp.totalSamples : 0;
  const noiseFloorDb = percentile(inp.blockDb, 0.1);
  let silent = 0;
  for (let i = 0; i < inp.blockDb.length; i++) if ((inp.blockDb[i] as number) < SILENCE_FLOOR_DBFS) silent++;
  const silenceRatio = inp.blockDb.length ? silent / inp.blockDb.length : 1;

  const bad: string[] = [];
  const meh: string[] = [];
  if (inp.durationSec < MIN_DURATION_SEC) bad.push(`The recording is shorter than ${MIN_DURATION_SEC} seconds.`);
  else if (inp.durationSec < t.marginalDurationSec) meh.push('The recording is short. Recording 10 to 20 minutes gives more to look at.');
  if (silenceRatio >= t.unusableSilenceRatio) bad.push('The recording is almost entirely silent.');
  else if (silenceRatio >= t.marginalSilenceRatio) meh.push('Much of the recording is very quiet, so less of it can be assessed.');
  if (clippingPct >= t.unusableClippingPct) bad.push('The audio is heavily distorted (clipped). Try a lower recording volume or move the microphone back.');
  else if (clippingPct >= t.marginalClippingPct) meh.push('Some of the audio is clipped, which can hide detail.');
  if (bad.length === 0 && noiseFloorDb > t.marginalNoiseFloorDb) meh.push('The background noise level is high.');

  const verdict: QualityReport['verdict'] = bad.length ? 'unusable' : meh.length ? 'marginal' : 'usable';
  return {
    durationSec: inp.durationSec,
    clippingPct,
    noiseFloorDb,
    silenceRatio,
    verdict,
    reasons: [...bad, ...meh],
  };
}

/** One-shot convenience for a whole recording already at 16 kHz (tests, small inputs). */
export function assessQuality(samples16k: Float32Array, clippedSamples = countClipped(samples16k)): QualityReport {
  return buildQualityReport({
    durationSec: samples16k.length / SAMPLE_RATE,
    clippedSamples,
    totalSamples: samples16k.length,
    blockDb: rmsDbPerBlock(samples16k, Math.round(SAMPLE_RATE * FRAME_BLOCK_SEC)),
  });
}
