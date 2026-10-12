import { CONFLICT_QUIET_OR_MISSING_AUDIO } from '../content/claims';
import type { RulesInput } from '../types/evidence';
import { matchRule } from './rules';

/** Rule 2 only: concerning answers combined with a quiet, missing, unusable, or non-ML recording. */
export function conflictsFor(i: RulesInput): string[] {
  if (matchRule(i).rule !== 2) return [];
  const weakAudio =
    i.audio === 'usableFewObservations' || i.audio === 'noModel' || i.audio === 'modelNotApplicable' || i.audio === 'notProvided' || i.audio === 'unusable';
  return weakAudio ? [CONFLICT_QUIET_OR_MISSING_AUDIO] : [];
}
