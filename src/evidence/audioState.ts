import { SNORE_FRACTION_OBSERVED } from '../audio/constants';
import type { AudioAnalysis } from '../types/audio';
import type { AudioEvidenceState } from '../types/evidence';

/** True when the snore model was judged not applicable to this recording (band-limited audio). */
export function isModelNotApplicable(a: AudioAnalysis): boolean {
  return a.modelVersion !== null && a.modelApplicable === false;
}

/** Derive the ER-3 audio input from an analysis. `null` (no recording) is `notProvided`. */
export function audioStateFrom(a: AudioAnalysis | null | undefined): AudioEvidenceState {
  if (!a || a.status === 'idle' || a.status === 'running') return 'notProvided';
  if (a.status === 'error' || a.quality.verdict === 'unusable') return 'unusable';
  // Band-limited audio: no snore analysis was run, which is "not assessed", never "no snoring". It has its own
  // state, treated like noModel by the rules (non-reassuring).
  if (a.modelVersion === null) return 'noModel';
  if (isModelNotApplicable(a)) return 'modelNotApplicable';
  // Nothing loud enough to assess is "not assessed", never "few snore-like sounds observed".
  if (a.windows.length === 0) return 'unusable';
  return a.snoreLikeFraction >= SNORE_FRACTION_OBSERVED ? 'usableSnoreLikeObserved' : 'usableFewObservations';
}
