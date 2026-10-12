// Analysis orchestrator: mono samples -> AudioAnalysis. Pure TS (no DOM); runs inside the worker
// but is also called directly in tests. Processes 30 s chunks (Amendment 1), yields to the event
// loop between chunks so progress and cancel messages are delivered.
import type { AudioAnalysis, WindowObs } from '../types/audio';
import { DISCLAIMER_AUDIO, DISCLAIMER_CANNOT_RULE_OUT, NO_MODEL_LINE } from '../content/claims';
import { SAMPLE_RATE, SILENCE_FLOOR_DBFS } from './constants';
import { resampleRange, resampledLength } from './features/resample';
import { sumSquares, toDb, rmsDbPerBlock } from './loudness';
import { assessModelApplicability, BandwidthEstimator, MODEL_NOT_APPLICABLE_REASON } from './bandwidth';
import { buildQualityReport, countClipped, FRAME_BLOCK_SEC } from './quality';
import { findQuietGaps } from './quietGaps';

export const CHUNK_SEC = 30;
const CHUNK_SAMPLES = CHUNK_SEC * SAMPLE_RATE;
const HALF_BLOCK = SAMPLE_RATE / 2;

export class AnalysisCancelledError extends Error {
  constructor() {
    super('Analysis cancelled');
    this.name = 'AnalysisCancelledError';
  }
}

/** Inference hook. M6 plugs the trained model in here; the default build has none. */
export interface InferenceHook {
  modelVersion: string;
  /**
   * `chunk16k` starts at `t0Sec` and includes up to 1 s of lookahead (except for the last chunk).
   * Return windows whose t0 lies in [t0Sec, t0Sec + CHUNK_SEC).
   */
  run(chunk16k: Float32Array, t0Sec: number): WindowObs[] | Promise<WindowObs[]>;
}

export interface AnalyzeOptions {
  isSynthetic?: boolean;
  onProgress?: (fraction: number, stage: string) => void;
  isCancelled?: () => boolean;
  yieldToEventLoop?: () => Promise<void>;
  inference?: InferenceHook | null;
}

const defaultYield = () => new Promise<void>((r) => setTimeout(r, 0));

export async function analyzeAudio(
  samples: Float32Array,
  sampleRate: number,
  opts: AnalyzeOptions = {},
): Promise<AudioAnalysis> {
  const yieldFn = opts.yieldToEventLoop ?? defaultYield;
  const total = resampledLength(samples.length, sampleRate);
  const ratio = sampleRate / SAMPLE_RATE;
  const blockSamples = Math.round(SAMPLE_RATE * FRAME_BLOCK_SEC);

  const loudness: number[] = [];
  const blockDb: number[] = [];
  const halfEnergy: number[] = [];
  const windows: WindowObs[] = [];
  let clipped = 0;
  const infer = opts.inference ?? null;
  const bandwidth = new BandwidthEstimator();
  // Source below 16 kHz: model not applicable up front, so skip inference entirely.
  const sourceTooLow = !assessModelApplicability(sampleRate, null).applicable;

  opts.onProgress?.(0, 'analyzing');
  for (let start = 0; start < total; start += CHUNK_SAMPLES) {
    if (opts.isCancelled?.()) throw new AnalysisCancelledError();
    const end = Math.min(start + CHUNK_SAMPLES, total);
    const isLast = end >= total;
    const chunk = resampleRange(samples, sampleRate, start, end);
    const srcStart = Math.floor(start * ratio);
    const srcEnd = isLast ? samples.length : Math.floor(end * ratio);
    clipped += countClipped(samples, srcStart, srcEnd);
    loudness.push(...rmsDbPerBlock(chunk, SAMPLE_RATE));
    blockDb.push(...rmsDbPerBlock(chunk, blockSamples));
    for (let i = 0; i + HALF_BLOCK <= chunk.length; i += HALF_BLOCK) halfEnergy.push(sumSquares(chunk, i, i + HALF_BLOCK));
    bandwidth.add(chunk);
    if (infer && !sourceTooLow) {
      const ext = isLast ? chunk : resampleRange(samples, sampleRate, start, Math.min(end + SAMPLE_RATE, total));
      windows.push(...(await infer.run(ext, start / SAMPLE_RATE)));
    }
    opts.onProgress?.(end / total, 'analyzing');
    await yieldFn();
  }
  if (opts.isCancelled?.()) throw new AnalysisCancelledError();

  // Windows (1 s, 0.5 s hop) below the silence floor are "too quiet to assess" (Amendment 2).
  let quietWindowCount = 0;
  for (let w = 0; w + 1 < halfEnergy.length; w++) {
    const db = toDb(((halfEnergy[w] as number) + (halfEnergy[w + 1] as number)) / SAMPLE_RATE);
    if (db < SILENCE_FLOOR_DBFS) quietWindowCount++;
  }

  const quality = buildQualityReport({
    durationSec: total / SAMPLE_RATE,
    clippedSamples: clipped,
    totalSamples: samples.length,
    blockDb,
  });
  const quietGaps = findQuietGaps(loudness);

  const applicability = assessModelApplicability(sampleRate, bandwidth.bandwidthHz());
  const modelApplicable = !infer || applicability.applicable;
  if (!modelApplicable) {
    windows.length = 0; // nothing was assessed; never report band-limited audio as "no snore"
    quality.reasons.push(MODEL_NOT_APPLICABLE_REASON);
    if (quality.verdict === 'usable') quality.verdict = 'marginal';
  }

  // Inference only emits assessable windows (too-quiet ones are skipped and counted in quietWindowCount).
  const assessable = windows;
  const snoreLikeFraction = assessable.length ? assessable.filter((w) => w.snoreLike).length / assessable.length : 0;

  const limitations = [
    DISCLAIMER_AUDIO,
    DISCLAIMER_CANNOT_RULE_OUT,
    'Quiet periods come from a simple loudness threshold, not a trained model, and are not a breathing measurement.',
  ];
  if (!infer) limitations.push(NO_MODEL_LINE);
  else if (!modelApplicable) limitations.push(MODEL_NOT_APPLICABLE_REASON);

  opts.onProgress?.(1, 'done');
  return {
    status: 'done',
    quality,
    loudness,
    windows,
    snoreLikeFraction,
    quietWindowCount,
    quietGaps,
    modelVersion: infer ? infer.modelVersion : null,
    isSynthetic: opts.isSynthetic ?? false,
    limitations,
    modelApplicable,
    ...(infer && applicability.effectiveBandwidthHz !== null ? { effectiveBandwidthHz: applicability.effectiveBandwidthHz } : {}),
    ...(infer && !modelApplicable ? { modelNotApplicableReason: MODEL_NOT_APPLICABLE_REASON } : {}),
  };
}
