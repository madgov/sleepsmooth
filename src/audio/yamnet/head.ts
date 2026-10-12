// YAMNet-embedding snore-like head (v3): pure TypeScript, no DOM, no network, no YAMNet runtime.
//
// This file only scores a 1024-d YAMNet embedding. Getting the embedding needs YAMNet itself running on-device (see
// docs/YAMNET_INTEGRATION.md). NOTHING in the web bundle imports this module or model.v3.json today.
// Scores are internal and must never be shown to users as a percentage or "confidence". A score below the threshold says nothing
// about sleep apnea; a score above it means "snore-like acoustic pattern", not an apnea event.
import type { ModelLayer } from '../model/schema';

export const YAMNET_EMBEDDING_DIM = 1024;
export const YAMNET_NUM_CLASSES = 521;

/** logit(p) of a YAMNet class score, clipped exactly as in training (scripts/yamnet/train_cv.py). */
export function scoresToLogits(scores: ArrayLike<number>): Float64Array {
  const out = new Float64Array(scores.length);
  for (let i = 0; i < scores.length; i++) {
    const p = Math.min(1 - 1e-6, Math.max(1e-6, scores[i] as number));
    out[i] = Math.log(p / (1 - p));
  }
  return out;
}

export interface YamnetHeadModel {
  schema: 'sleepsmooth-yamnet-head/1';
  version: string;
  kind: 'logreg' | 'mlp';
  /**
   * What the head consumes. 'class-score-logits' = logit of the 521 YAMNet class scores of one 0.975 s patch (works with the classification-only
   * TFLite file). 'embedding' = the 1024-d pooled embedding (needs a YAMNet build that exposes it). Only valid for input produced the same way.
   */
  input: { kind: 'embedding' | 'class-score-logits'; dim: number; windowSamples: 15600; sampleRate: 16000; note: string };
  norm: { mean: number[]; std: number[] };
  layers: ModelLayer[];
  /** CV-chosen decision threshold (clean out-of-fold, bedroom-negative FPR <= 5%). Not clinically meaningful. */
  threshold: number;
  weightsHash: string;
  trainedAt: string;
  /** 'shipped' only if it passed the pre-registered fold-5 gate AND beat v1 on the CV criterion; otherwise 'candidate-not-shipped'. */
  status: 'shipped' | 'candidate-not-shipped';
  licenses: { trainingData: string; embeddingModel: string; labels: string };
}

/** Problems with a model object (empty array = structurally usable). */
export function validateHead(m: YamnetHeadModel): string[] {
  const errs: string[] = [];
  const dim = m.input.dim;
  if (m.input.kind === 'embedding' ? dim !== YAMNET_EMBEDDING_DIM : dim !== YAMNET_NUM_CLASSES) errs.push('input dim does not match input kind');
  if (m.norm.mean.length !== dim || m.norm.std.length !== dim) errs.push(`norm length is not ${dim}`);
  if (m.layers.length === 0) errs.push('no layers');
  let inDim = dim;
  for (const [i, l] of m.layers.entries()) {
    if (l.weights.length !== l.bias.length) errs.push(`layer ${i}: weights/bias row mismatch`);
    if (l.weights.some((row) => row.length !== inDim)) errs.push(`layer ${i}: input width is not ${inDim}`);
    inDim = l.bias.length;
  }
  if (inDim !== 1) errs.push('last layer must output exactly 1 value');
  if (m.layers.at(-1)?.activation !== 'sigmoid') errs.push('last layer must be sigmoid');
  if (m.norm.std.some((s) => !(s > 0))) errs.push('std must be positive');
  return errs;
}

/** Mean of per-frame 1024-d embeddings (YAMNet emits one per 0.48 s hop). Returns null when there are no frames. */
export function averageEmbeddings(frames: ArrayLike<number>[]): Float64Array | null {
  if (frames.length === 0) return null;
  const out = new Float64Array(YAMNET_EMBEDDING_DIM);
  for (const f of frames) {
    if (f.length !== YAMNET_EMBEDDING_DIM) throw new Error(`embedding length ${f.length}, expected ${YAMNET_EMBEDDING_DIM}`);
    for (let i = 0; i < YAMNET_EMBEDDING_DIM; i++) out[i]! += f[i] as number;
  }
  for (let i = 0; i < YAMNET_EMBEDDING_DIM; i++) out[i]! /= frames.length;
  return out;
}

/**
 * Score one head input (a 1024-d embedding, or 521 class-score LOGITS: apply scoresToLogits to raw YAMNet scores first, see model.input.kind).
 * Returns the internal sigmoid output in [0, 1]. Throws on a wrong-length or non-finite input.
 */
export function scoreEmbedding(model: YamnetHeadModel, embedding: ArrayLike<number>): number {
  const dim = model.input.dim;
  if (embedding.length !== dim) throw new Error(`input length ${embedding.length}, expected ${dim}`);
  let h: number[] = new Array<number>(dim);
  for (let i = 0; i < dim; i++) {
    const v = embedding[i] as number;
    if (!Number.isFinite(v)) throw new Error('non-finite input value');
    h[i] = (v - (model.norm.mean[i] as number)) / (model.norm.std[i] as number);
  }
  for (const layer of model.layers) {
    const next = new Array<number>(layer.bias.length);
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

export function isSnoreLike(model: YamnetHeadModel, score: number): boolean {
  return score >= model.threshold;
}
