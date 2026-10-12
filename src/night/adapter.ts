// Adapters from the overnight summary to the existing evidence types (docs/OVERNIGHT_PLAN.md 8.3, 8.4).
// The evidence engine, the rules and the frozen types are unchanged. This file only produces their inputs.
//
// Safety properties, each covered by a test:
//  - A night maps onto the existing AudioEvidenceState and into the existing rules, so audio can only
//    raise `inconclusive` to `discuss-with-clinician` through rule 3, never lower anything.
//  - A short, interrupted, too noisy, band-limited or silent night is `unusable` or `modelNotApplicable`
//    (never "few observations"), and a quiet night keeps the existing non-reassuring wording.
//  - Sample (synthetic) nights are shown and labeled but never drive the conclusion.
import { MODEL_NOT_APPLICABLE } from '../content/claims';
import { buildRulesInput, type ScreeningInputs } from '../evidence/input';
import type { EvidenceContext } from '../evidence/engine';
import type { AudioAnalysis, WindowObs } from '../types/audio';
import type { AudioEvidenceState, RulesInput } from '../types/evidence';
import { decodeBits, decodeScores } from './codec';
import { WINDOWS_PER_EPOCH, WINDOW_HOP_SEC, WINDOW_SEC } from './constants';
import type { NightView } from './summary';
import type { NightAudioState } from './types';

/** Night state -> the existing engine input enum. Total and exhaustive. */
export function nightStateToAudioEvidence(state: NightAudioState): AudioEvidenceState {
  switch (state) {
    case 'not-recorded':
      return 'notProvided';
    case 'not-assessed':
      return 'unusable';
    case 'model-not-applicable':
      return 'modelNotApplicable';
    case 'no-model':
      return 'noModel';
    case 'few-observations':
      return 'usableFewObservations';
    case 'snore-like-observed':
      return 'usableSnoreLikeObserved';
  }
}

/**
 * Night view -> AudioAnalysis (so report/generate and any consumer of the existing type work unchanged).
 * Notes:
 *  - `windows` lists only SCORED windows of analysed epochs, with the quantized internal scores. Unscored
 *    windows are counted in `quietWindowCount` and never listed.
 *  - `quietWindowCount` = too-quiet + below-gate windows (not analysed because quiet), plus nothing else.
 *  - `quietGaps` is always empty and `loudness` is empty: an 8 h loudness-threshold "quiet period" list would
 *    be meaningless and potentially alarming, and per-second levels are not stored (plan 8.3).
 *  - `snoreLikeFraction` is the episode-qualified fraction, for display. The night state is decided by
 *    nightAudioState(), not by audioStateFrom(); use nightRulesInput() to feed the engine.
 */
export function nightToAudioAnalysis(view: NightView): AudioAnalysis {
  const s = view.summary;
  const state = s.nightState;
  const windows: WindowObs[] = [];
  view.epochs.forEach((e, idx) => {
    const st = (view.estimates[idx] as { state: string }).state;
    if ((st !== 'likely-asleep' && st !== 'uncertain') || e.win.scored === 0) return;
    const mask = decodeBits(e.scoredMask, WINDOWS_PER_EPOCH);
    const flags = decodeBits(e.snoreBits, e.win.scored);
    const scores = decodeScores(e.scoreQ);
    let q = 0;
    for (let j = 0; j < WINDOWS_PER_EPOCH; j++) {
      if (!mask[j]) continue;
      const t0 = (e.i * WINDOWS_PER_EPOCH + j) * WINDOW_HOP_SEC;
      windows.push({ t0, t1: t0 + WINDOW_SEC, snoreLike: flags[q] === true, score: scores[q] ?? 0 });
      q++;
    }
  });
  const notAssessed = state === 'not-assessed';
  const notApplicable = state === 'model-not-applicable';
  const analyzedWindowsTotal = s.assessableWindows + s.unscoredWindows.belowGate + s.unscoredWindows.tooQuiet + s.unscoredWindows.skipped;
  const limitations = [...s.limitations];
  if (notApplicable) limitations.push(MODEL_NOT_APPLICABLE);
  return {
    status: state === 'not-recorded' ? 'idle' : 'done',
    quality: {
      durationSec: s.assessedSec,
      clippingPct: s.quality.clippingPct,
      noiseFloorDb: s.quality.noiseFloorDb,
      silenceRatio: analyzedWindowsTotal > 0 ? s.unscoredWindows.tooQuiet / analyzedWindowsTotal : 1,
      verdict: notAssessed ? 'unusable' : s.quality.verdict === 'unusable' ? 'unusable' : notApplicable ? 'marginal' : s.quality.verdict,
      reasons: Array.from(new Set([...s.notAssessedReasons, ...s.quality.reasons])),
    },
    loudness: [],
    windows: notApplicable || notAssessed ? [] : windows,
    snoreLikeFraction: notApplicable || notAssessed ? 0 : s.episodeQualifiedFraction,
    quietWindowCount: s.unscoredWindows.tooQuiet + s.unscoredWindows.belowGate,
    quietGaps: [],
    modelVersion: s.modelVersion,
    modelApplicable: !notApplicable,
    ...(notApplicable ? { modelNotApplicableReason: MODEL_NOT_APPLICABLE } : {}),
    ...(s.effectiveBandwidthHz !== null ? { effectiveBandwidthHz: s.effectiveBandwidthHz } : {}),
    isSynthetic: s.isSynthetic,
    limitations,
  };
}

// ---------------------------------------------------------------------------
// Multi-night aggregation (plan 8.4)
// ---------------------------------------------------------------------------
export interface NightAggregate {
  audioState: AudioEvidenceState;
  /** Real (non-sample) nights with any recording. */
  recordedNights: number;
  /** Real nights that were not "not-assessed" / "not-recorded". */
  assessedNights: number;
  observedNights: number;
  fewNights: number;
  notAssessedNights: number;
  /** Descriptive only: observed on two or more nights. No threshold or severity claim. */
  recurring: boolean;
  sampleNights: number;
  /** True when only sample nights exist (they never drive the conclusion). */
  sampleOnly: boolean;
}

/** Sample nights are excluded from the conclusion by construction. */
export function aggregateNights(nights: readonly { nightState: NightAudioState; isSynthetic: boolean }[]): NightAggregate {
  const real = nights.filter((n) => !n.isSynthetic);
  const sampleNights = nights.length - real.length;
  const recorded = real.filter((n) => n.nightState !== 'not-recorded');
  const observed = recorded.filter((n) => n.nightState === 'snore-like-observed').length;
  const few = recorded.filter((n) => n.nightState === 'few-observations').length;
  const notAssessed = recorded.filter((n) => n.nightState === 'not-assessed').length;
  const noModel = recorded.filter((n) => n.nightState === 'no-model').length;
  const assessed = recorded.length - notAssessed;
  let audioState: AudioEvidenceState;
  if (recorded.length === 0) audioState = 'notProvided';
  else if (assessed === 0) audioState = 'unusable';
  else if (observed > 0) audioState = 'usableSnoreLikeObserved';
  else if (few > 0) audioState = 'usableFewObservations';
  else if (noModel > 0) audioState = 'noModel';
  else audioState = 'modelNotApplicable';
  return {
    audioState,
    recordedNights: recorded.length,
    assessedNights: assessed,
    observedNights: observed,
    fewNights: few,
    notAssessedNights: notAssessed,
    recurring: observed >= 2,
    sampleNights,
    sampleOnly: real.length === 0 && sampleNights > 0,
  };
}

const INFORMATIVE: Record<NightAudioState, number> = {
  'snore-like-observed': 5,
  'few-observations': 4,
  'model-not-applicable': 3,
  'no-model': 2,
  'not-assessed': 1,
  'not-recorded': 0,
};

/**
 * Rules input for one or more nights: wraps the existing buildRulesInput() and then sets `audio` from
 * the aggregate. If only sample nights exist, the existing sample behavior applies: audio is `notProvided`
 * and the context carries audioIsSample, so the sample is displayed but never used.
 */
export function nightRulesInput(
  screening: ScreeningInputs,
  nights: readonly NightView[],
): { input: RulesInput; context: EvidenceContext; aggregate: NightAggregate; analysis: AudioAnalysis | null } {
  const aggregate = aggregateNights(nights.map((n) => ({ nightState: n.summary.nightState, isSynthetic: n.summary.isSynthetic })));
  const real = nights.filter((n) => !n.summary.isSynthetic && n.summary.nightState !== 'not-recorded');
  const best = real.slice().sort((a, b) => INFORMATIVE[b.summary.nightState] - INFORMATIVE[a.summary.nightState] || b.summary.assessedSec - a.summary.assessedSec)[0];
  if (best) {
    const analysis = nightToAudioAnalysis(best);
    const built = buildRulesInput(screening, analysis, false);
    return { input: { ...built.input, audio: aggregate.audioState }, context: built.context, aggregate, analysis };
  }
  const sample = nights.find((n) => n.summary.isSynthetic && n.summary.nightState !== 'not-recorded');
  if (sample) {
    const analysis = nightToAudioAnalysis(sample);
    const built = buildRulesInput(screening, analysis, true);
    return { input: built.input, context: built.context, aggregate, analysis };
  }
  const built = buildRulesInput(screening, null, false);
  return { input: { ...built.input, audio: aggregate.audioState }, context: built.context, aggregate, analysis: null };
}

