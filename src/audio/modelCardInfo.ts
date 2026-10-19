// Evaluated numbers for the models this build ships, as hand-written constants: v3 (YAMNet float32 TFLite + v3 head) on iPhone,
// v1 as the fallback and on web.
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

/** v1: sleepsmooth-snore-mlp-esc50-0.1.0, the fallback (Expo Go, no runtime, load or self-check failure) and the web model. Source: model/MODEL_CARD.md "Test results" (ESC-50 fold 5, window level). */
export const V1_EVALUATION: ModelCardEvaluation = {
  version: 'sleepsmooth-snore-mlp-esc50-0.1.0',
  heading: 'v1 (fallback and web)',
  testSet: 'ESC-50 fold 5, window level',
  metrics: [
    { label: 'Ranking score (AUC)', value: 0.919, decimals: 3, range: [0.823, 0.978] },
    { label: 'Snoring windows flagged (recall)', value: 0.62, decimals: 3, range: [0.365, 0.864] },
    { label: 'Flags that were snoring (precision)', value: 0.23, decimals: 3, range: [0.072, 0.385] },
  ],
};

/**
 * v3: shipped on iPhone (float32 YAMNet TFLite + this head). Source: model/MODEL_CARD.md "v3" fold-5 table (export column). Desktop parity of the
 * float32 TFLite file with the NumPy features these numbers came from: PASS (model/parity.v3.json). On-iPhone output: NOT VERIFIED.
 */
export const V3_EVALUATION: ModelCardEvaluation = {
  version: 'sleepsmooth-snore-yamnet-logreg_scores-0.3.0',
  heading: 'v3 (iPhone)',
  testSet: 'ESC-50 fold 5, window level',
  metrics: [
    { label: 'Ranking score (AUC)', value: 0.986, decimals: 3, range: [0.968, 0.997] },
    { label: 'Snoring windows flagged (recall)', value: 0.89, decimals: 2, range: [0.76, 1.0] },
    { label: 'Flags that were snoring (precision)', value: 0.38, decimals: 2, range: [0.19, 0.54] },
  ],
};

/**
 * v3 at the shipped night operating point on SYNTHETIC nights (made from ESC-50 development clips; not real recordings, not a test set).
 * Source: model/segment_eval.synthetic.json ("chosen") and model/gate_sweep.synthetic.json (GATE_DB 6, the adopted gate). 10 tuning + 10 check nights, 2 h each.
 */
export const V3_SYNTHETIC_NIGHTS: ModelCardEvaluation = {
  version: 'sleepsmooth-snore-yamnet-logreg_scores-0.3.0',
  heading: 'v3 on synthetic nights',
  testSet: 'SYNTHETIC nights (ESC-50 development clips), 20 nights x 2 h',
  metrics: [
    { label: 'False snore-like stretches per hour (tuning nights)', value: 0.85, decimals: 2 },
    { label: 'Snoring stretches found (tuning nights, 43 of 47)', value: 0.91, decimals: 2 },
    { label: 'False snore-like stretches per hour (check nights)', value: 0.0, decimals: 2 },
    { label: 'Snoring stretches found (check nights, 40 of 47)', value: 0.85, decimals: 2 },
    { label: 'Share of the night loud enough to analyse (check nights)', value: 0.28, decimals: 2 },
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
  yamnetTfliteBytes: 15973484,
  yamnetTfliteSha256: 'c318dadf42d414c3b974b8773f07eb3b7c64debb6aeace0f6cf38a634c2cf8a5',
} as const;

export const formatRange = (m: EvaluatedMetric): string | null =>
  m.range ? `${m.range[0].toFixed(m.decimals)} to ${m.range[1].toFixed(m.decimals)}` : null;

export const formatValue = (m: EvaluatedMetric): string => m.value.toFixed(m.decimals);
