// Overnight-mode constants. Pure TS (no React, Expo or DOM imports).
//
// PROVISIONAL: every constant marked PROVISIONAL is an unvalidated engineering choice made so the
// pipeline can run. None is a clinical threshold, none has been validated on overnight phone audio, and
// none may be quoted as an accuracy claim. They are tuned only on the labeled sample night and on the
// user's own labeled nights (docs/OVERNIGHT_PLAN.md, ER-3, ER-4, section 7).
import { SAMPLE_RATE, SILENCE_FLOOR_DBFS, WINDOW_HOP_SEC, WINDOW_SEC } from '../audio/constants';

// Single source (ER-7): re-exported, never redefined.
export { SAMPLE_RATE, SILENCE_FLOOR_DBFS, WINDOW_HOP_SEC, WINDOW_SEC };

export const NIGHT_HEURISTICS_VERSION = 'night-heuristics-0.1.0-provisional';
export const EPOCH_SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// Time grid (derived from the frozen audio constants).
// ---------------------------------------------------------------------------
/** Epoch length. Equals the existing analysis chunk length (CHUNK_SEC in audio/analyze.ts). */
export const EPOCH_SEC = 30;
export const EPOCH_MS = EPOCH_SEC * 1000;
export const EPOCH_SAMPLES = EPOCH_SEC * SAMPLE_RATE;
/** Window grid: 1 s windows every 0.5 s. */
export const WINDOW_SAMPLES = Math.round(WINDOW_SEC * SAMPLE_RATE);
export const HOP_SAMPLES_WINDOW = Math.round(WINDOW_HOP_SEC * SAMPLE_RATE);
/** Windows whose start lies in one epoch (60 = 30 s / 0.5 s). */
export const WINDOWS_PER_EPOCH = Math.round(EPOCH_SEC / WINDOW_HOP_SEC);
/** Level analysis block: 100 ms. 1 s = 10 blocks, 0.5 s = 5 blocks. */
export const LEVEL_BLOCK_SAMPLES = SAMPLE_RATE / 10;
/** Model frame hop (10 ms) expressed in samples, and frames added per window hop. */
export const FRAME_HOP = 160;
export const FRAMES_PER_HOP = HOP_SAMPLES_WINDOW / FRAME_HOP; // 50

// ---------------------------------------------------------------------------
// Level gate and rolling noise floor (ER-3).
// ---------------------------------------------------------------------------
/** PROVISIONAL. A window is analysed only if its RMS is at least floor + GATE_DB (and above SILENCE_FLOOR_DBFS). */
export const GATE_DB = 6;
/** PROVISIONAL. Rolling noise floor = 10th percentile of per-second RMS over this many seconds. */
export const ROLLING_FLOOR_SEC = 600;
export const FLOOR_PERCENTILE = 0.1;
/** PROVISIONAL. Until this many seconds of history exist, the floor is the silence floor (or a resume seed). */
export const FLOOR_MIN_HISTORY_SEC = 30;
/** Process queue limit. Beyond this, the oldest unprocessed windows are skipped and recorded as an overload gap. */
export const OVERLOAD_QUEUE_SEC = 60;
/** PROVISIONAL. Bandwidth sampling: feed one 0.5 s block to the estimator every N windows (cost control). */
export const BW_SAMPLE_EVERY_WINDOWS = 8;
/** An epoch reports `bwHz` only when the estimator saw at least this many frames. */
export const BW_MIN_FRAMES = 30;

// ---------------------------------------------------------------------------
// Cues for the sleep-state estimate (plan section 7.1). All PROVISIONAL.
// ---------------------------------------------------------------------------
/** A short burst: at least floor + this many dB for 100 ms to under 1 s, preceded by a quieter block. */
export const HANDLING_DB = 15;
export const HANDLING_MAX_BLOCKS = 9;
/** A second counts as loud when its RMS is at least floor + this many dB. */
export const LOUD_DB = 15;
/** Speech-like cue (0.5 s blocks, 300 to 3400 Hz band envelope). */
export const SPEECH_BAND_HZ = { lo: 300, hi: 3400 } as const;
export const SPEECH_MOD_FRACTION = 0.45; // share of envelope variation in 2 to 8 Hz
export const SPEECH_ENV_STD = 0.4; // natural-log units of band power (about 3.5 dB)
export const SPEECH_FLUX_MIN = 0.15; // mean spectral-shape change per 10 ms frame (log units)

// ---------------------------------------------------------------------------
// Sleep-state estimator (plan section 7.2). All PROVISIONAL.
// ---------------------------------------------------------------------------
export const EST_GRACE_AFTER_WAKE_MS = 30 * 60 * 1000;
export const EST_MIN_CAPTURED_SEC = 15;
export const EST_SPEECH_STRONG_SEC = 5;
export const EST_MOTION_STRONG_SEC = 10;
export const EST_HANDLING_WEAK_EVENTS = 3;
export const EST_LOUD_NONSNORE_WEAK_SEC = 10;
/** Consecutive clean epochs before an epoch can be "likely asleep" (20 x 30 s = 10 min). */
export const EST_ONSET_EPOCHS = 20;
export const EST_STILL_MAX_MOTION_SEC = 2;
export const EST_QUIET_MARGIN_DB = 8;
export const EST_QUIET_EPOCHS = 20;

// ---------------------------------------------------------------------------
// Night rules (plan section 8, amended by ER-3 and ER-4). All PROVISIONAL.
// ---------------------------------------------------------------------------
export const NIGHT_MIN_ASSESSED_SEC = 2 * 3600;
export const NIGHT_MIN_COVERAGE = 0.5;
/** Episode = flagged windows with at most this many seconds between consecutive ones. */
export const NIGHT_EPISODE_MAX_GAP_SEC = 10;
export const NIGHT_EPISODE_MIN_FLAGGED = 5;
export const NIGHT_MIN_EPISODES = 3;
/** ER-3: absolute quantity, independent of how aggressive the gate is. Flagged seconds inside episodes. */
export const NIGHT_MIN_EPISODE_SEC = 120;
/** ER-4: night quality thresholds, deliberately not the clip thresholds. */
export const NIGHT_QUALITY = {
  /** Unusable at or above this clipping percentage of captured samples. */
  unusableClippingPct: 5,
  marginalClippingPct: 1,
  /** An epoch is digital silence when its p90 level is below this (microphone lost or muted). */
  digitalSilenceDbfs: -100,
  unusableDigitalSilenceFraction: 0.5,
  /** Constant-loud night: p10 level above this ceiling in at least this fraction of captured epochs. */
  loudCeilingDbfs: -25,
  unusableLoudFraction: 0.6,
  marginalCoverage: 0.8,
  /** Lower-bound sanity: windows below the silence floor in more than this share of all windows. */
  marginalUncertainFraction: 0.5,
} as const;
