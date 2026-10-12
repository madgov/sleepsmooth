// Night summary (docs/OVERNIGHT_PLAN.md sections 7.3, 8; ER-3, ER-4).
// Always recomputed from the persisted epochs (ER-7), so a heuristic fix applies to old nights.
//
// Denominator rule (invariant): only SCORED windows are ever a denominator. Windows that were below the
// silence floor, below the level gate, skipped by the overload policy or not scored because no model ran
// are reported as "not analyzed" and are never read as "no snore".
import { MIN_EFFECTIVE_BANDWIDTH_HZ, MIN_SOURCE_RATE_HZ } from '../audio/bandwidth';
import {
  MODEL_NOT_APPLICABLE,
  NIGHT_LIMITATIONS,
  NIGHT_MARGINAL_BAND_LIMITED,
  NIGHT_MARGINAL_CLIPPING,
  NIGHT_MARGINAL_COVERAGE,
  NIGHT_MARGINAL_ENDED_EARLY,
  NIGHT_REASON_CLIPPING,
  NIGHT_REASON_CONSTANT_LOUD,
  NIGHT_REASON_LOW_COVERAGE,
  NIGHT_REASON_NO_RECORDING,
  NIGHT_REASON_NO_WINDOWS,
  NIGHT_REASON_SILENT,
  NIGHT_REASON_TOO_SHORT,
  DISCLAIMER_AUDIO,
  DISCLAIMER_CANNOT_RULE_OUT,
  NO_MODEL_LINE,
} from '../content/claims';
import { decodeBits } from './codec';
import {
  EPOCH_MS,
  NIGHT_EPISODE_MAX_GAP_SEC,
  NIGHT_EPISODE_MIN_FLAGGED,
  NIGHT_MIN_ASSESSED_SEC,
  NIGHT_MIN_COVERAGE,
  NIGHT_MIN_EPISODES,
  NIGHT_MIN_EPISODE_SEC,
  NIGHT_QUALITY,
  WINDOWS_PER_EPOCH,
  WINDOW_HOP_SEC,
  WINDOW_SEC,
} from './constants';
import { estimateEpochStates, type EpochEstimate } from './estimator';
import type { Episode, EpochRecord, EpochState, NightAudioState, NightQuality, NightRecord, NightSummary, ScheduleWindow, SensitivityLine } from './types';

export interface NightView {
  summary: NightSummary;
  /** Re-derived per-epoch sleep-state estimates, aligned with `epochs`. */
  estimates: EpochEstimate[];
  epochs: readonly EpochRecord[];
  record: NightRecord;
  schedule: ScheduleWindow | null;
}

/** Sort by index and drop duplicates (a crash can leave a repeated line; the last copy wins). */
export function normalizeEpochs(epochs: readonly EpochRecord[]): EpochRecord[] {
  const byIndex = new Map<number, EpochRecord>();
  for (const e of epochs) byIndex.set(e.i, e);
  return Array.from(byIndex.values()).sort((a, b) => a.i - b.i);
}

// ---------------------------------------------------------------------------
// Episodes (ER-3: absolute quantities)
// ---------------------------------------------------------------------------
export interface FlaggedWindow {
  /** Window index from capture start; t0 = k x 0.5 s. */
  k: number;
}

/**
 * Episode = flagged windows with at most NIGHT_EPISODE_MAX_GAP_SEC between one window's end and the next
 * window's start, and at least NIGHT_EPISODE_MIN_FLAGGED flagged windows. `flaggedSec` is the union of
 * the flagged windows' time (windows overlap by half), so it is never double counted.
 */
export function findEpisodes(flaggedK: readonly number[], captureStartMs: number): { episodes: Episode[]; flaggedSec: number } {
  const ks = flaggedK.slice().sort((a, b) => a - b);
  const episodes: Episode[] = [];
  let flaggedSec = 0;
  let run: number[] = [];
  const close = () => {
    if (run.length >= NIGHT_EPISODE_MIN_FLAGGED) {
      let sec = WINDOW_SEC;
      for (let i = 1; i < run.length; i++) sec += Math.min(WINDOW_SEC, ((run[i] as number) - (run[i - 1] as number)) * WINDOW_HOP_SEC);
      flaggedSec += sec;
      episodes.push({
        t0: captureStartMs + Math.round((run[0] as number) * WINDOW_HOP_SEC * 1000),
        t1: captureStartMs + Math.round(((run[run.length - 1] as number) * WINDOW_HOP_SEC + WINDOW_SEC) * 1000),
        flagged: run.length,
      });
    }
    run = [];
  };
  for (const k of ks) {
    if (run.length > 0) {
      const prev = run[run.length - 1] as number;
      if (k === prev) continue;
      const gapSec = (k - prev) * WINDOW_HOP_SEC - WINDOW_SEC;
      if (gapSec > NIGHT_EPISODE_MAX_GAP_SEC) close();
    }
    run.push(k);
  }
  close();
  return { episodes, flaggedSec };
}

/** Indices of flagged (snore-like) windows in the given epochs. */
export function flaggedWindowIndices(epochs: readonly EpochRecord[]): number[] {
  const out: number[] = [];
  for (const e of epochs) {
    if (e.win.scored === 0) continue;
    const mask = decodeBits(e.scoredMask, WINDOWS_PER_EPOCH);
    const flags = decodeBits(e.snoreBits, e.win.scored);
    let q = 0;
    for (let j = 0; j < WINDOWS_PER_EPOCH; j++) {
      if (!mask[j]) continue;
      if (flags[q]) out.push(e.i * WINDOWS_PER_EPOCH + j);
      q++;
    }
  }
  return out;
}

function sensitivity(epochs: readonly EpochRecord[], captureStartMs: number): SensitivityLine {
  const { episodes, flaggedSec } = findEpisodes(flaggedWindowIndices(epochs), captureStartMs);
  return {
    epochs: epochs.length,
    assessableWindows: epochs.reduce((a, e) => a + e.win.scored, 0),
    snoreLikeWindows: epochs.reduce((a, e) => a + e.win.snoreLike, 0),
    episodes: episodes.length,
    episodeFlaggedSec: flaggedSec,
  };
}

// ---------------------------------------------------------------------------
// Night state (plan table 8.1 with ER-3 and ER-4)
// ---------------------------------------------------------------------------
export interface NightStateInput {
  recordedSec: number;
  modelVersion: string | null;
  assessedSec: number;
  coverage: number;
  qualityVerdict: NightQuality['verdict'];
  qualityReasons: string[];
  bandwidthApplicable: boolean;
  assessableWindows: number;
  episodes: number;
  episodeFlaggedSec: number;
}

/**
 * First match wins. Deviation from the plan table, documented: the bandwidth row is evaluated before the
 * "no assessable windows" sub-condition, so a band-limited night is reported as model-not-applicable
 * (the more specific cause) rather than as a generic not-assessed night.
 */
export function nightAudioState(i: NightStateInput): { state: NightAudioState; reasons: string[] } {
  if (i.recordedSec <= 0) return { state: 'not-recorded', reasons: [NIGHT_REASON_NO_RECORDING] };
  if (i.modelVersion === null) return { state: 'no-model', reasons: [NO_MODEL_LINE] };
  const reasons: string[] = [];
  if (i.assessedSec < NIGHT_MIN_ASSESSED_SEC) reasons.push(NIGHT_REASON_TOO_SHORT);
  if (i.coverage < NIGHT_MIN_COVERAGE) reasons.push(NIGHT_REASON_LOW_COVERAGE);
  if (i.qualityVerdict === 'unusable') reasons.push(...i.qualityReasons);
  if (reasons.length > 0) return { state: 'not-assessed', reasons };
  if (!i.bandwidthApplicable) return { state: 'model-not-applicable', reasons: [MODEL_NOT_APPLICABLE] };
  if (i.assessableWindows === 0) return { state: 'not-assessed', reasons: [NIGHT_REASON_NO_WINDOWS] };
  if (i.episodes >= NIGHT_MIN_EPISODES && i.episodeFlaggedSec >= NIGHT_MIN_EPISODE_SEC) return { state: 'snore-like-observed', reasons: [] };
  return { state: 'few-observations', reasons: [] };
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
function median(xs: number[]): number {
  if (xs.length === 0) return -120;
  const s = xs.slice().sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)] as number;
}

export function summarizeNight(night: NightRecord, rawEpochs: readonly EpochRecord[], schedule: ScheduleWindow | null): NightView {
  const epochs = normalizeEpochs(rawEpochs);
  const estimates = estimateEpochStates(epochs, schedule);
  const stateOf = (idx: number): EpochState => (estimates[idx] as EpochEstimate).state;

  let recordedSec = 0, inWindowSec = 0, asleepSec = 0, uncertainSec = 0, awakeSec = 0, notCapturedSec = 0, assessedSec = 0;
  let firstAsleep = -1, lastAsleep = -1;
  const analyzed: EpochRecord[] = [];
  const asleepOnly: EpochRecord[] = [];
  const unscored = { belowGate: 0, tooQuiet: 0, skipped: 0 };
  let captured = 0, digitalSilent = 0, loud = 0, clip = 0;
  const floors: number[] = [];
  let anyCharging = false, anyMotion = false;

  epochs.forEach((e, idx) => {
    const st = stateOf(idx);
    recordedSec += e.cap;
    if (e.charging !== null) anyCharging = true;
    if (e.motionSec !== null) anyMotion = true;
    if (st !== 'outside-window') {
      inWindowSec += e.cap;
      notCapturedSec += Math.max(0, EPOCH_MS / 1000 - e.cap);
    }
    if (st === 'likely-asleep') {
      asleepSec += e.cap;
      if (firstAsleep < 0) firstAsleep = idx;
      lastAsleep = idx;
      asleepOnly.push(e);
    } else if (st === 'uncertain') uncertainSec += e.cap;
    else if (st === 'likely-awake') awakeSec += e.cap;
    if (st === 'likely-asleep' || st === 'uncertain') {
      analyzed.push(e);
      assessedSec += e.cap;
      unscored.belowGate += e.win.belowGate;
      unscored.tooQuiet += e.win.tooQuiet;
      unscored.skipped += e.overload ?? 0;
    }
    if (e.cap > 0 && st !== 'outside-window') {
      captured++;
      floors.push(e.floor);
      clip += e.clipSamples ?? 0;
      if (e.lvl.p90 < NIGHT_QUALITY.digitalSilenceDbfs) digitalSilent++;
      if (e.lvl.p10 > NIGHT_QUALITY.loudCeilingDbfs) loud++;
    }
  });
  // Seconds in the window that no epoch covers (capture ended early) are also "not captured".
  if (schedule && epochs.length > 0) {
    const lastEnd = (epochs[epochs.length - 1] as EpochRecord).t + EPOCH_MS;
    if (lastEnd < schedule.endMs) notCapturedSec += (schedule.endMs - lastEnd) / 1000;
  } else if (schedule && epochs.length === 0) {
    notCapturedSec = (schedule.endMs - schedule.startMs) / 1000;
  }

  const scheduledSec = schedule ? Math.max(1, (schedule.endMs - schedule.startMs) / 1000) : 0;
  const coverage = schedule ? Math.min(1, inWindowSec / scheduledSec) : 1;
  const clippingPct = captured > 0 ? (100 * clip) / Math.max(1, inWindowSec * 16000) : 0;
  const digitalSilenceFraction = captured > 0 ? digitalSilent / captured : 0;
  const loudNightFraction = captured > 0 ? loud / captured : 0;
  const endedEarly = !!schedule && night.captureEnd !== null && night.captureEnd < schedule.endMs - 15 * 60 * 1000;

  const assessableWindows = analyzed.reduce((a, e) => a + e.win.scored, 0);
  const snoreLikeWindows = analyzed.reduce((a, e) => a + e.win.snoreLike, 0);
  const sens = { asleepOnly: sensitivity(asleepOnly, night.captureStart), withUncertain: sensitivity(analyzed, night.captureStart) };
  const { episodes, flaggedSec } = findEpisodes(flaggedWindowIndices(analyzed), night.captureStart);
  const inEpisodeFlagged = episodes.reduce((a, e) => a + e.flagged, 0);

  // Bandwidth: median of the sampled per-epoch effective bandwidths, plus the reported capture rate.
  const bws = analyzed.filter((e) => e.bwHz !== undefined).map((e) => e.bwHz as number);
  const effectiveBandwidthHz = bws.length > 0 ? median(bws) : null;
  const bandwidthApplicable = night.sampleRateReported >= MIN_SOURCE_RATE_HZ && (effectiveBandwidthHz === null || effectiveBandwidthHz >= MIN_EFFECTIVE_BANDWIDTH_HZ);

  // Quality (ER-4): night-specific thresholds, not the clip thresholds.
  const q = NIGHT_QUALITY;
  const bad: string[] = [];
  const meh: string[] = [];
  if (clippingPct >= q.unusableClippingPct) bad.push(NIGHT_REASON_CLIPPING);
  else if (clippingPct >= q.marginalClippingPct) meh.push(NIGHT_MARGINAL_CLIPPING);
  if (digitalSilenceFraction >= q.unusableDigitalSilenceFraction) bad.push(NIGHT_REASON_SILENT);
  if (loudNightFraction >= q.unusableLoudFraction) bad.push(NIGHT_REASON_CONSTANT_LOUD);
  if (schedule && coverage >= NIGHT_MIN_COVERAGE && coverage < q.marginalCoverage) meh.push(NIGHT_MARGINAL_COVERAGE);
  if (endedEarly) meh.push(NIGHT_MARGINAL_ENDED_EARLY);
  if (!bandwidthApplicable) meh.push(NIGHT_MARGINAL_BAND_LIMITED);
  const verdict: NightQuality['verdict'] = bad.length ? 'unusable' : meh.length ? 'marginal' : 'usable';
  const quality: NightQuality = {
    verdict,
    reasons: [...bad, ...meh],
    clippingPct,
    noiseFloorDb: Math.round(median(floors) * 10) / 10,
    digitalSilenceFraction,
    loudNightFraction,
    coverage,
  };

  const st = nightAudioState({
    recordedSec,
    modelVersion: night.modelVersion,
    assessedSec,
    coverage,
    qualityVerdict: verdict,
    qualityReasons: bad,
    bandwidthApplicable,
    assessableWindows,
    episodes: episodes.length,
    episodeFlaggedSec: flaggedSec,
  });

  const limitations = [DISCLAIMER_AUDIO, DISCLAIMER_CANNOT_RULE_OUT, ...NIGHT_LIMITATIONS];
  if (night.modelVersion === null) limitations.push(NO_MODEL_LINE);

  const summary: NightSummary = {
    nightId: night.id,
    isSynthetic: night.isSynthetic,
    modelVersion: night.modelVersion,
    recordedSec,
    inWindowSec,
    estimatedAsleepSec: asleepSec,
    uncertainSec,
    awakeSec,
    notCapturedSec,
    estimatedWindow: firstAsleep >= 0 ? { start: (epochs[firstAsleep] as EpochRecord).t, end: (epochs[lastAsleep] as EpochRecord).t + EPOCH_MS } : null,
    signalsUsed: [
      { name: 'Schedule', usable: schedule !== null },
      { name: 'App state', usable: epochs.length > 0 },
      { name: 'Charging', usable: anyCharging },
      { name: 'Motion', usable: anyMotion },
      { name: 'Audio level', usable: recordedSec > 0 },
    ],
    assessedSec,
    assessableWindows,
    snoreLikeWindows,
    unscoredWindows: unscored,
    episodes,
    episodeFlaggedSec: flaggedSec,
    episodeQualifiedFraction: assessableWindows > 0 ? inEpisodeFlagged / assessableWindows : 0,
    bandwidthApplicable,
    effectiveBandwidthHz,
    sensitivity: sens,
    quality,
    nightState: st.state,
    notAssessedReasons: st.state === 'few-observations' || st.state === 'snore-like-observed' ? [] : st.reasons,
    endedEarly,
    endReason: night.endReason,
    limitations,
  };
  return { summary, estimates, epochs, record: night, schedule };
}
