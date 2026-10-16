// Evaluated numbers for the model this build actually runs (v1), as hand-written constants.
// They are NOT read from model/metrics.json at build time (the release check forbids bundling metrics files).
// src/audio/modelCardInfo.test.ts checks every value below against model/MODEL_CARD.md and model/metrics.json,
// so the in-app card cannot drift from the repository card. Change both together, never one alone.
type Range = readonly [number, number];

export interface EvaluatedMetric {
  label: string;
  value: number;
  /** Decimals exactly as printed in model/MODEL_CARD.md. */
  decimals: number;
  /** 95% range from resampling whole clips; absent when the card gives none. */
  range?: Range;
}

export interface ModelCardEvaluation {
  version: string;
  heading: string;
  testSet: string;
  metrics: readonly EvaluatedMetric[];
}

/** v1: sleepsmooth-snore-mlp-esc50-0.1.0, shipped. Source: model/MODEL_CARD.md "Test results" (ESC-50 fold 5, window level). */
export const V1_EVALUATION: ModelCardEvaluation = {
  version: 'sleepsmooth-snore-mlp-esc50-0.1.0',
  heading: 'v1 (in this app)',
  testSet: 'ESC-50 fold 5, window level',
  metrics: [
    { label: 'Ranking score (AUC)', value: 0.919, decimals: 3, range: [0.823, 0.978] },
    { label: 'Snoring windows flagged (recall)', value: 0.62, decimals: 3, range: [0.365, 0.864] },
    { label: 'Flags that were snoring (precision)', value: 0.23, decimals: 3, range: [0.072, 0.385] },
  ],
};

/** v3: evaluated offline, NOT in the app. Source: model/MODEL_CARD.md "v3" fold-5 table (export column). Parity with the phone runtime is unverified. */
export const V3_OFFLINE_EVALUATION: ModelCardEvaluation = {
  version: 'sleepsmooth-snore-yamnet-logreg_scores-0.3.0',
  heading: 'v3 (offline only, not in this app)',
  testSet: 'ESC-50 fold 5, window level',
  metrics: [
    { label: 'Ranking score (AUC)', value: 0.986, decimals: 3, range: [0.968, 0.997] },
    { label: 'Snoring windows flagged (recall)', value: 0.89, decimals: 2, range: [0.76, 1.0] },
    { label: 'Flags that were snoring (precision)', value: 0.38, decimals: 2, range: [0.19, 0.54] },
  ],
};

/** Facts the card states in prose; also verified by the test. */
export const MODEL_CARD_FACTS = {
  positiveTestClips: 8,
  positiveTestWindows: 71,
  testWindows: 3308,
  v1TruePositives: 44,
  v1FalsePositives: 147,
  v1Recall8kHz: 0,
  v1Auc8kHz: 0.811,
} as const;

export const formatRange = (m: EvaluatedMetric): string | null =>
  m.range ? `${m.range[0].toFixed(m.decimals)} to ${m.range[1].toFixed(m.decimals)}` : null;

export const formatValue = (m: EvaluatedMetric): string => m.value.toFixed(m.decimals);
