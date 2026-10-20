// Overnight-mode constants. Pure TS (no React, Expo or DOM imports).
//
// PROVISIONAL: every constant marked PROVISIONAL is an unvalidated engineering choice made so the
// pipeline can run. None is a clinical threshold, none has been validated on overnight phone audio, and
// none may be quoted as an accuracy claim. They are tuned only on the labeled sample night and on the
// user's own labeled nights (docs/OVERNIGHT_PLAN.md, ER-3, ER-4, section 7).
import { SAMPLE_RATE, SILENCE_FLOOR_DBFS, WINDOW_HOP_SEC, WINDOW_SEC } from '../audio/constants';

// Single source (ER-7): re-exported, never redefined.
export { SAMPLE_RATE, SILENCE_FLOOR_DBFS, WINDOW_HOP_SEC, WINDOW_SEC };

export const NIGHT_HEURISTICS_VERSION = 'night-heuristics-0.2.0-provisional';
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
/**
 * PROVISIONAL. A window is analysed only if its RMS is at least floor + GATE_DB (and above SILENCE_FLOOR_DBFS). It is also the energy pre-gate
 * in front of YAMNet: below-gate windows never reach the model. Re-evaluated 2026-10-19 with v3 at the operating point on SYNTHETIC nights by the rule
 * pre-registered in docs/EVAL_PROTOCOL.md section 8 (model/gate_sweep.synthetic.json): no lower gate kept false segments <= 2 per hour on the
 * tuning nights (G = 4 dB: 5.10/h, G = 0: 12.15/h, versus 0.85/h at 6), and recall did not rise (0.915 at every gate), so it stays 6.
 */
export const GATE_DB = 6;
/**
 * PROVISIONAL, SYNTHETIC-night selection only. Tier 2 of the adaptive gate (src/night/adaptiveGate.ts, docs/EVAL_PROTOCOL.md section 9,
 * model/adaptive_gate.synthetic.json): a window that is below floor + GATE_DB is still analysed if it is at least floor + GATE_LOW_DB AND its
 * spectral flatness is at most GATE_FLATNESS_CAP (not stationary-noise-like). Chosen by the pre-registered rule from 75 candidates on the 10 tuning nights:
 * same 0.85 false segments/h and recall as the fixed gate, assessable fraction 0.184 -> 0.276 (tuning) and 0.278 -> 0.290 (check, scored once). Most of the
 * extra analysed windows are background-only; the gain says nothing about real bedrooms.
 */
export const GATE_LOW_DB = 0;
export const GATE_FLATNESS_CAP = 0.05;
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
/**
 * Minimum flagged windows per episode. 3 = V3_OPERATING_POINT.minConfirmed (src/night/operatingPoint.ts; pinned by operatingPoint.test.ts), so an
 * episode in the night summary is exactly a segment of the pre-registered v3 operating point (flagged = confirmed windows). Was 5 for v1-only builds.
 * v1 fallback nights use the same value; the v1 night behaviour at 3 has not been evaluated.
 */
export const NIGHT_EPISODE_MIN_FLAGGED = 3;
/**
 * Night rule: snore-like-observed iff episodes >= NIGHT_MIN_EPISODES AND flagged seconds inside episodes >= NIGHT_MIN_EPISODE_SEC.
 * Re-derived 2026-10-19 for the v3 segmenting (t = 0.98, 2-of-14 confirmation, >= 3 windows per segment, GATE_DB 6) by the rule pre-registered in
 * docs/EVAL_PROTOCOL.md section 8.1 BEFORE the segment durations were tabulated (model/night_rule_sweep.synthetic.json). Rule: among
 * E in {1..5}, S in {10..120} s, keep candidates with no TUNING night firing from false segments alone; pick the one firing on the most tuning
 * nights; ties to larger E, then larger S. Result E = 5, S = 60: 7/10 tuning and 8/10 check nights fire, 0 fire from false segments alone
 * (the old 3 / 120 s fired on 4/10 and 4/10). SYNTHETIC 2-hour nights only: false segments 0.85 per hour (tuning) and 0.00 (check); flagged seconds
 * per segment median 3.5 s for false and about 5 s for true segments. Thin margin: the worst tuning night (breathing background) had 53 s of false
 * flagged time in 2 h, so a real 7-8 h night with similar sound would likely pass 60 s. Engineering settings, not clinical thresholds; they
 * carry no information about how often a real night is flagged.
 */
export const NIGHT_MIN_EPISODES = 5;
/** ER-3: absolute quantity, independent of how aggressive the gate is. Flagged seconds inside episodes. See NIGHT_MIN_EPISODES. */
export const NIGHT_MIN_EPISODE_SEC = 60;
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

// ---------------------------------------------------------------------------
// v1 fallback model (docs/EVAL_PROTOCOL.md section 10, model/v1_night_eval.synthetic.json). SYNTHETIC nights only; PROVISIONAL.
// ---------------------------------------------------------------------------
/** Version-string prefix of the v1 MLP (src/audio/model/model.json). Anything else (the YAMNet scorer, sample or test nights) uses the shared constants above. */
export const V1_MODEL_VERSION_PREFIX = 'sleepsmooth-snore-mlp-';
/**
 * v1 under the shared rule (flag at its shipped 0.795, 3-window episodes, 5 episodes / 60 s) gave 13.25 false segments per hour and 4 of 10 tuning nights
 * firing from false segments alone on the synthetic nights, so it has its own settings, chosen by the rule pre-registered in section 10.3 (tuning nights only):
 * flag threshold 0.95, episodes of >= 3 windows (same as shared), 5 episodes, 45 s. Check nights (scored once) were still worse than the v3 point: 4.35 false
 * segments/h, 2 of 10 nights firing from false segments alone, segment recall 0.68. v1 is a fallback with no validated operating point.
 */
export const V1_NIGHT = { flagThreshold: 0.95, minEpisodes: 5, minEpisodeSec: 45 } as const;

/** Night-level rule for the model that produced the night. */
export function nightRuleFor(modelVersion: string | null): { minEpisodes: number; minEpisodeSec: number } {
  if (modelVersion !== null && modelVersion.startsWith(V1_MODEL_VERSION_PREFIX)) return { minEpisodes: V1_NIGHT.minEpisodes, minEpisodeSec: V1_NIGHT.minEpisodeSec };
  return { minEpisodes: NIGHT_MIN_EPISODES, minEpisodeSec: NIGHT_MIN_EPISODE_SEC };
}
