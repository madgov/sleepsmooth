// Overnight-mode data model (docs/OVERNIGHT_PLAN.md section 6, with the ER-1/ER-3/ER-7 amendments).
// Pure types. No probability, severity, score or confidence field exists here by design.

export type SleepWindowSettings = {
  bedtimeLocal: string; // "23:00"
  wakeLocal: string; // "07:00"
  tz: string; // IANA name captured at setup
  remindEnabled: boolean;
  promptLeadMin: number;
};

export type OvernightConsent = {
  purpose: 'overnight-local-capture';
  granted: boolean;
  version: string;
  at: string;
  bystanderNoticeAckAt: string | null;
  mobileOnlyStorageAckAt: string | null;
};

export type CaptureEndReason =
  | 'user-stop'
  | 'scheduled-end'
  | 'interrupted-call-or-alarm'
  | 'os-killed-or-crash-recovered'
  | 'low-battery'
  | 'mic-lost'
  | 'storage-error';

export type EpochState = 'likely-awake' | 'likely-asleep' | 'uncertain' | 'outside-window' | 'not-captured';

export type SleepReason =
  | 'in-window'
  | 'out-of-window'
  | 'screen-or-app-active'
  | 'charging'
  | 'still'
  | 'sustained-quiet'
  | 'speech-like'
  | 'handling-sounds'
  | 'loud-non-snore'
  | 'motion'
  | 'plug-change'
  | 'onset-pending';

export type CaptureGap = {
  t0: number;
  t1: number;
  cause: CaptureEndReason | 'digital-silence' | 'late-buffers' | 'overload';
};

/** 30 s record. The only per-time data persisted by default. */
export type EpochRecord = {
  i: number; // epoch index from capture start
  t: number; // epoch start, unix ms
  cap: number; // seconds actually captured in the epoch (0..30)
  lvl: { p10: number; p50: number; p90: number }; // dBFS of 1 s RMS
  floor: number; // rolling noise floor, dBFS
  win: {
    /** Windows that existed in the epoch (scored + belowGate + tooQuiet + overload). */
    total: number;
    /** Above the silence floor but under the level gate (or no model): NOT analysed. Never "no snore". */
    belowGate: number;
    /** Under the silence floor: too quiet to assess. Never "no snore". */
    tooQuiet: number;
    scored: number;
    snoreLike: number;
  };
  /** Base64 bitset: bit j = window position j (0..59) in the epoch was scored. (Added: needed to place windows in time.) */
  scoredMask?: string;
  /** Base64 bitset: bit q = the q-th scored window was snore-like. */
  snoreBits?: string;
  /** Base64 uint8, one per scored window: internal score x 255. Never displayed. */
  scoreQ?: string;
  speechLikeSec: number;
  handlingEvents: number;
  loudNonSnoreSec: number;
  motionSec: number | null; // null = accelerometer unavailable
  charging: boolean | null;
  appActive: boolean;
  battery: number | null;
  state: EpochState; // provisional live label; summaries re-derive it from the epochs
  reasons: SleepReason[];
  bwHz?: number;
  /** Added: clipped source samples in the epoch (feeds the night quality check). */
  clipSamples?: number;
  /** Added: windows skipped because the processing queue overflowed (ER-8). They count in win.total only. */
  overload?: number;
};

/** ER-1: the only per-window data that may ever be kept, in a developer tuning build, off by default. */
export type NightRetention = {
  epochs: true;
  windowFeatures: boolean;
  /** Auto-delete horizon for retained window features; null when none are retained. */
  windowFeatureAutoDeleteDays: 7 | null;
};

export const RETENTION_DEFAULT: NightRetention = { epochs: true, windowFeatures: false, windowFeatureAutoDeleteDays: null };
export const RETENTION_DEV_TUNING: NightRetention = { epochs: true, windowFeatures: true, windowFeatureAutoDeleteDays: 7 };

export type NightRecord = {
  id: string;
  deviceModel: string;
  osVersion: string;
  appVersion: string;
  modelVersion: string | null;
  nightHeuristicsVersion: string;
  epochSchemaVersion: number;
  settings: SleepWindowSettings;
  captureStart: number;
  captureEnd: number | null;
  endReason: CaptureEndReason | null;
  gaps: CaptureGap[];
  sampleRateReported: number;
  isSynthetic: boolean; // true for the labeled sample night
  source: 'device-recording' | 'sample-assembled';
  retention: NightRetention;
};

/** One int8-quantized 80-d feature vector (ER-1; dev tuning build only). */
export type WindowFeatureRecord = {
  k: number; // window index from capture start (t0 = k x 0.5 s)
  t: number; // unix ms
  q: string; // base64 of 80 int8 values
};

export type ScheduleWindow = { startMs: number; endMs: number };

export type NightAudioState =
  | 'not-recorded'
  | 'not-assessed'
  | 'model-not-applicable'
  | 'no-model'
  | 'few-observations'
  | 'snore-like-observed';

export type Episode = { t0: number; t1: number; flagged: number };

export type SensitivityLine = {
  epochs: number;
  assessableWindows: number;
  snoreLikeWindows: number;
  episodes: number;
  episodeFlaggedSec: number;
};

export type NightQuality = {
  verdict: 'usable' | 'marginal' | 'unusable';
  reasons: string[];
  clippingPct: number;
  noiseFloorDb: number;
  digitalSilenceFraction: number;
  loudNightFraction: number;
  coverage: number; // captured in-window seconds / scheduled seconds (1 when no schedule)
};

export type NightSummary = {
  nightId: string;
  isSynthetic: boolean;
  modelVersion: string | null;
  recordedSec: number;
  inWindowSec: number;
  estimatedAsleepSec: number;
  uncertainSec: number;
  awakeSec: number;
  notCapturedSec: number;
  estimatedWindow: { start: number; end: number } | null;
  signalsUsed: { name: string; usable: boolean }[];
  /** Seconds captured in epochs analysed for snore-like patterns (likely-asleep + uncertain). */
  assessedSec: number;
  /** Scored windows in analysed epochs. The ONLY denominator: unscored windows never enter it. */
  assessableWindows: number;
  snoreLikeWindows: number;
  /** Windows in analysed epochs that were NOT analysed. Reported, never counted as "no snore". */
  unscoredWindows: { belowGate: number; tooQuiet: number; skipped: number };
  episodes: Episode[];
  episodeFlaggedSec: number;
  /** Flagged windows inside episodes / scored windows (display and report compatibility only). */
  episodeQualifiedFraction: number;
  bandwidthApplicable: boolean;
  effectiveBandwidthHz: number | null;
  /**
   * asleepOnly: likely-asleep epochs. withUncertain: likely-asleep + uncertain (the default view and the verdict input).
   * allInWindow: every captured epoch inside the scheduled window, including epochs the unvalidated estimate labels
   * likely-awake. Shown as a separate, additional line so audio is never silently dropped by the sleep-state guess.
   */
  sensitivity: { asleepOnly: SensitivityLine; withUncertain: SensitivityLine; allInWindow: SensitivityLine };
  quality: NightQuality;
  nightState: NightAudioState;
  notAssessedReasons: string[];
  endedEarly: boolean;
  endReason: CaptureEndReason | null;
  limitations: string[];
};
