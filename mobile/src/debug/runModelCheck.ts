// M0 debug check: runs the SHARED pure-TS core (../src via @core) on Hermes.
//   - loadShippedModel() is called as-is to report whether the Vite-only import.meta.glob path works here.
//   - The model is then loaded explicitly via require() and used through the shared createModelHook /
//     windowFeatures / scoreFeatures code.
//   - Parity: 24 recorded feature vectors from the training side must score within 1e-6.
//   - Timing: ms per 1 s window (log-mel + 80-d features + MLP) over the bundled ESC-50 sample clip.
// The clip is the labeled public ESC-50 sample used by the web demo; it is sample data, not a user recording.
import { Asset } from 'expo-asset';
import { SAMPLE_RATE, SILENCE_FLOOR_DBFS, WINDOW_HOP_SEC, WINDOW_SEC } from '@core/audio/constants';
import { frameLogMel } from '@core/audio/features';
import { createModelHook } from '@core/audio/modelHook';
import { isSnoreLike, loadShippedModel, rmsDbfs, scoreFeatures, scoreWindow, windowFeatures } from '@core/audio/model/infer';
import type { ModelJson } from '@core/audio/model/schema';
import { parseWavPcm16Mono } from './wav';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const model = require('@core/audio/model/model.json') as ModelJson;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fixture = require('@core/audio/model/infer.fixture.json') as { features: number[]; expected: number }[];
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sampleWav = require('../../../public/sample-audio/esc50-sample.wav') as number;

export interface ModelCheckResult {
  engine: string;
  isDevBundle: boolean;
  modelVersion: string;
  modelWeightsHash: string;
  loadShippedModelReturns: 'model' | 'null';
  fixtureCount: number;
  fixtureMaxAbsErr: number;
  fixturePass: boolean;
  clipSeconds: number;
  clipSampleRate: number;
  windows: number;
  scoredWindows: number;
  tooQuietWindows: number;
  snoreLikeWindows: number;
  scoreChecksum: number;
  hookWindows: number;
  hookMatchesDirect: boolean;
  msPerWindowMean: number;
  msPerWindowMedian: number;
  msPerWindowP95: number;
  msLogMelMean: number;
  msMlpMean: number;
  totalMs: number;
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function engineName(): string {
  const g = globalThis as { HermesInternal?: { getRuntimeProperties?: () => Record<string, string> } };
  const props = g.HermesInternal?.getRuntimeProperties?.();
  return props ? `Hermes ${props['OSS Release Version'] ?? ''} (${props['Build'] ?? ''})`.trim() : 'Non-Hermes JS engine';
}

export async function runModelCheck(): Promise<ModelCheckResult> {
  const shipped = loadShippedModel();

  let fixtureMaxAbsErr = 0;
  for (const f of fixture) fixtureMaxAbsErr = Math.max(fixtureMaxAbsErr, Math.abs(scoreFeatures(model, f.features) - f.expected));

  const asset = Asset.fromModule(sampleWav);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  const res = await fetch(uri);
  const wav = parseWavPcm16Mono(await res.arrayBuffer());
  if (wav.sampleRate !== SAMPLE_RATE) throw new Error(`Test clip is ${wav.sampleRate} Hz, expected ${SAMPLE_RATE}`);

  const win = Math.round(WINDOW_SEC * SAMPLE_RATE);
  const hop = Math.round(WINDOW_HOP_SEC * SAMPLE_RATE);
  const x = wav.samples;
  const perWindowMs: number[] = [];
  let logMelMs = 0;
  let mlpMs = 0;
  let scored = 0;
  let quiet = 0;
  let snore = 0;
  let checksum = 0;
  const directScores: number[] = [];
  const total0 = now();
  for (let s = 0; s + win <= x.length; s += hop) {
    const span = x.subarray(s, s + win);
    const t0 = now();
    const lm = frameLogMel(span);
    const t1 = now();
    const score = scoreFeatures(model, windowFeatures(lm, model.featureSpec.nMels));
    const t2 = now();
    // Same arithmetic as scoreWindow; assert the shared helper agrees (cheap, outside the timed region).
    if (Math.abs(score - scoreWindow(model, lm)) > 1e-12) throw new Error('scoreWindow disagrees with scoreFeatures');
    perWindowMs.push(t2 - t0);
    logMelMs += t1 - t0;
    mlpMs += t2 - t1;
    if (rmsDbfs(x, s, win) < SILENCE_FLOOR_DBFS) {
      quiet++;
      continue;
    }
    scored++;
    checksum += score;
    directScores.push(score);
    if (isSnoreLike(model, score)) snore++;
  }
  const totalMs = now() - total0;

  // Same windows through the shared InferenceHook (what the web worker uses), 30 s chunks as analyze.ts does.
  const hook = createModelHook(model);
  const hookScores: number[] = [];
  for (let start = 0; start < x.length; start += 30 * SAMPLE_RATE) {
    const ext = x.subarray(start, Math.min(start + 31 * SAMPLE_RATE, x.length));
    const obs = (await hook.run(ext, start / SAMPLE_RATE)) as { score: number }[];
    for (const o of obs) hookScores.push(o.score);
  }
  const hookMatchesDirect = hookScores.length === directScores.length && hookScores.every((v, i) => Math.abs(v - (directScores[i] as number)) < 1e-9);

  const sorted = [...perWindowMs].sort((a, b) => a - b);
  const n = sorted.length;
  return {
    engine: engineName(),
    isDevBundle: typeof __DEV__ !== 'undefined' && __DEV__,
    modelVersion: model.version,
    modelWeightsHash: model.weightsHash.slice(0, 12),
    loadShippedModelReturns: shipped ? 'model' : 'null',
    fixtureCount: fixture.length,
    fixtureMaxAbsErr,
    fixturePass: fixtureMaxAbsErr < 1e-6,
    clipSeconds: x.length / SAMPLE_RATE,
    clipSampleRate: wav.sampleRate,
    windows: n,
    scoredWindows: scored,
    tooQuietWindows: quiet,
    snoreLikeWindows: snore,
    scoreChecksum: checksum,
    hookWindows: hookScores.length,
    hookMatchesDirect,
    msPerWindowMean: perWindowMs.reduce((a, b) => a + b, 0) / Math.max(1, n),
    msPerWindowMedian: sorted[Math.floor(n / 2)] ?? 0,
    msPerWindowP95: sorted[Math.min(n - 1, Math.floor(n * 0.95))] ?? 0,
    msLogMelMean: logMelMs / Math.max(1, n),
    msMlpMean: mlpMs / Math.max(1, n),
    totalMs,
  };
}
