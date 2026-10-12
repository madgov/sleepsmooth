// FROZEN CONTRACT (ER-4): shape of model.json. Do not edit without orchestrator approval.

export interface ModelFeatureSpec {
  sampleRate: number;
  frameMs: number;
  hopMs: number;
  windowSec: number;
  windowHopSec: number;
  nMels: number;
}

export interface ModelLayer {
  type: 'dense';
  /** Row-major [outDim][inDim]. */
  weights: number[][];
  bias: number[];
  activation: 'relu' | 'sigmoid' | 'linear';
}

export interface ModelJson {
  version: string;
  featureSpec: ModelFeatureSpec;
  silenceFloorDbfs: number;
  norm: { mean: number[]; std: number[] };
  layers: ModelLayer[];
  /** Validation-chosen decision threshold. */
  threshold: number;
  weightsHash: string;
  trainedAt: string;
}
