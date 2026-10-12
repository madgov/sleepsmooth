// FROZEN CONTRACT (ER-4). Do not edit without orchestrator approval.

export interface QualityReport {
  durationSec: number;
  clippingPct: number;
  noiseFloorDb: number;
  silenceRatio: number;
  verdict: 'usable' | 'marginal' | 'unusable';
  reasons: string[];
}

/** Internal model output; `score` is NEVER rendered and is not an apnea probability (Amendment 3). */
export interface WindowObs {
  t0: number;
  t1: number;
  snoreLike: boolean;
  score: number;
}

/** A quiet period found by an energy threshold (non-ML). NOT an apnea event. UI copy: "quiet period". */
export interface QuietGap {
  t0: number;
  t1: number;
  durSec: number;
}

export interface AudioAnalysis {
  status: 'idle' | 'running' | 'done' | 'error';
  quality: QualityReport;
  /** RMS dB per second. */
  loudness: number[];
  windows: WindowObs[];
  /** Computed over assessable windows only (too-quiet windows excluded; Amendment 2). */
  snoreLikeFraction: number;
  /** Count of windows below the silence floor, "too quiet to assess" (Amendment 2). */
  quietWindowCount: number;
  quietGaps: QuietGap[];
  /** null when no trained model is shipped (ER-9). */
  modelVersion: string | null;
  /** false when the recording was too band-limited for the snore model: nothing was assessed. */
  modelApplicable: boolean;
  modelNotApplicableReason?: string;
  effectiveBandwidthHz?: number;
  isSynthetic: boolean;
  limitations: string[];
}
