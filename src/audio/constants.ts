// FROZEN CONTRACT (ER-4). Do not edit without orchestrator approval
// (except SILENCE_FLOOR_DBFS, which Agent C sets once from data).

export const SAMPLE_RATE = 16000;
export const FRAME_MS = 25;
export const HOP_MS = 10;
export const WINDOW_SEC = 1;
export const WINDOW_HOP_SEC = 0.5;
export const N_MELS = 40;

/** Samples per analysis frame / hop at SAMPLE_RATE. */
export const FRAME_SAMPLES = (SAMPLE_RATE * FRAME_MS) / 1000; // 400
export const HOP_SAMPLES = (SAMPLE_RATE * HOP_MS) / 1000; // 160
/** Frames per 1 s window (frameLogMel output rows). */
export const FRAMES_PER_WINDOW = 100;

/**
 * PROVISIONAL placeholder: set by Agent C from data (RMS distribution of training windows).
 * Shared by training (drop windows below) and inference ("too quiet to assess"). Amendment 2.
 */
export const SILENCE_FLOOR_DBFS = -72; // set by scripts/prepare-data.ts from data: 1st percentile of window RMS dBFS among non-silent (>= -90 dBFS) train/val-fold windows (folds 1-4 plus Kaggle folds 1-4) (p1=-71.2, p5=-51.9, p10=-44.2, p50=-24.8), floored to 1 dB

/**
 * Snore-like fraction of assessable windows at or above which audio counts as
 * `usableSnoreLikeObserved` (ER-3). Documented heuristic constant, not a validated threshold.
 */
export const SNORE_FRACTION_OBSERVED = 0.1;

/** Upload caps (ER-1). */
export const MAX_DURATION_SEC = 20 * 60;
export const MAX_FILE_BYTES = 100 * 1024 * 1024;
export const MIN_DURATION_SEC = 30;
