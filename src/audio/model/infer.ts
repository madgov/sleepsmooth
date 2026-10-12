// Pure TypeScript inference from model.json. No DOM, no network. Shared by Node tests and the browser worker.
//
// Per-window feature vector (80-d): for each of the 40 mel bands, the mean then the (population) std of the
// log-mel value over the 100 frames of a 1 s window: [mean_0..mean_39, std_0..std_39].
// Scores are internal; they must never be shown to users as a percentage or "confidence" (Amendment 3).
import type { ModelJson } from './schema';
import { N_MELS } from '../constants';

export const FEATURE_DIM = N_MELS * 2;

/** `logMel` is the flat row-major (frames x 40) output of `frameLogMel`. */
export function windowFeatures(logMel: Float32Array | number[], nMels = N_MELS): Float64Array {
  const frames = Math.floor(logMel.length / nMels);
  const out = new Float64Array(nMels * 2);
  if (frames === 0) return out;
  for (let b = 0; b < nMels; b++) {
    let s = 0;
    for (let f = 0; f < frames; f++) s += logMel[f * nMels + b] as number;
    const mean = s / frames;
    let v = 0;
    for (let f = 0; f < frames; f++) v += ((logMel[f * nMels + b] as number) - mean) ** 2;
    out[b] = mean;
    out[nMels + b] = Math.sqrt(v / frames);
  }
  return out;
}

/** RMS level of a sample span in dBFS (floor -120). Used with SILENCE_FLOOR_DBFS. */
export function rmsDbfs(x: Float32Array, start = 0, len = x.length - start): number {
  let s = 0;
  for (let i = start; i < start + len; i++) s += (x[i] as number) ** 2;
  const rms = Math.sqrt(s / Math.max(1, len));
  return rms > 0 ? Math.max(-120, 20 * Math.log10(rms)) : -120;
}

/** Score an 80-d (un-normalized) feature vector. Returns the sigmoid output in [0, 1]. */
export function scoreFeatures(model: ModelJson, features: ArrayLike<number>): number {
  let h: number[] = [];
  for (let i = 0; i < features.length; i++) {
    h.push(((features[i] as number) - (model.norm.mean[i] as number)) / (model.norm.std[i] as number));
  }
  for (const layer of model.layers) {
    const next: number[] = new Array(layer.bias.length);
    for (let o = 0; o < next.length; o++) {
      const w = layer.weights[o] as number[];
      let z = layer.bias[o] as number;
      for (let i = 0; i < h.length; i++) z += (w[i] as number) * (h[i] as number);
      next[o] = layer.activation === 'relu' ? Math.max(0, z) : layer.activation === 'sigmoid' ? 1 / (1 + Math.exp(-z)) : z;
    }
    h = next;
  }
  return h[0] as number;
}

/** Score a 1 s window given its frameLogMel output. */
export function scoreWindow(model: ModelJson, logMel: Float32Array): number {
  return scoreFeatures(model, windowFeatures(logMel, model.featureSpec.nMels));
}

export function isSnoreLike(model: ModelJson, score: number): boolean {
  return score >= model.threshold;
}

/**
 * The shipped model, or null when no model is included in this build (ER-9: the app then reports
 * "No trained snore model is included in this build."). Resolved at build time by Vite; null under plain Node.
 */
export function loadShippedModel(): ModelJson | null {
  let found: Record<string, unknown>;
  try {
    // Literal call so Vite can statically resolve it; an absent model.json yields an empty record.
    found = import.meta.glob('./model.json', { eager: true, import: 'default' });
  } catch {
    return null; // not running under Vite (plain Node)
  }
  const m = Object.values(found)[0];
  return m ? (m as ModelJson) : null;
}
