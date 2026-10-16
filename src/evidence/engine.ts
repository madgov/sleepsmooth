import {
  AUDIO_DETAIL,
  DISCLAIMER_AUDIO,
  DISCLAIMER_CANNOT_RULE_OUT,
  DISCLAIMER_NOT_DIAGNOSIS,
  HEADLINE_DISCUSS,
  HEADLINE_INCONCLUSIVE,
  HEADLINE_NOT_ENOUGH,
  MISSING_AUDIO,
  MISSING_AUDIO_UNUSABLE,
  MISSING_MODEL,
  MISSING_MODEL_NOT_APPLICABLE,
  MODEL_NOT_APPLICABLE,
  MISSING_NECK,
  SAMPLE_AUDIO_NOT_USED,
  MISSING_NOSAS,
  MISSING_SYMPTOMS,
  NOSAS_CITATION,
  NOSAS_BELOW_CANNOT_RULE_OUT,
  NOSAS_DETAIL,
  NOSAS_INCOMPLETE_AT_OR_ABOVE,
  NOSAS_LOWER_SCORE_CAVEAT,
  NOSAS_OUTSIDE_VALIDATION_NOTE,
  NOSAS_SCREENING_NOT_DIAGNOSIS,
  NOTE_AUDIO_NEVER_DOWNGRADES,
  NOTE_NO_UNIFIED_SCORE,
  NOTE_SNORE_LIKE,
  NO_MODEL_LINE,
  RED_FLAG_WORDING,
  SYMPTOM_DETAIL,
  SYMPTOM_NOT_VALIDATED,
  nosasScoreStatement,
} from '../content/claims';
import type { EvidenceItem, EvidenceState, EvidenceSummary, RulesInput } from '../types/evidence';
import { conflictsFor } from './conflicts';
import { redFlagsFor } from './redFlags';
import { matchRule } from './rules';

/** Optional detail for richer wording. Never changes the conclusion. */
export interface EvidenceContext {
  noSasTotal?: number | null;
  noSasMissing?: string[];
  /** Labels of symptoms rated often/nightly, for display. */
  frequentSymptoms?: string[];
  /** The analysis on screen is the public sample recording. It is shown and badged, never used. */
  audioIsSample?: boolean;
}

export function missingFor(i: RulesInput, ctx: EvidenceContext = {}): string[] {
  const m: string[] = [];
  if (i.noSas === 'notAnswered') m.push(MISSING_NOSAS);
  else if (i.noSas === 'incompleteBelow' || (i.noSas === 'atOrAbove' && ctx.noSasTotal === null)) {
    m.push(...(ctx.noSasMissing && ctx.noSasMissing.length > 0 ? ctx.noSasMissing : [MISSING_NECK]));
  }
  if (i.symptoms === 'notAnswered') m.push(MISSING_SYMPTOMS);
  if (i.audio === 'notProvided') m.push(MISSING_AUDIO);
  else if (i.audio === 'unusable') m.push(MISSING_AUDIO_UNUSABLE);
  else if (i.audio === 'noModel') m.push(MISSING_MODEL);
  else if (i.audio === 'modelNotApplicable') m.push(MISSING_MODEL_NOT_APPLICABLE);
  return m;
}

export function evaluate(input: RulesInput, ctx: EvidenceContext = {}): EvidenceSummary {
  const { rule, conclusion } = matchRule(input);
  const syn = input.isSynthetic;
  const items: EvidenceItem[] = [];

  // NoSAS (user-reported).
  const nosasState: Record<RulesInput['noSas'], EvidenceState> = {
    atOrAbove: 'present',
    below: 'absent-unreliable',
    incompleteBelow: 'inconclusive',
    notAnswered: 'missing',
  };
  let nosasDetail: string = NOSAS_DETAIL[input.noSas];
  if (typeof ctx.noSasTotal === 'number') nosasDetail = nosasScoreStatement(ctx.noSasTotal);
  if (input.noSas === 'below') nosasDetail = `${nosasDetail} ${NOSAS_BELOW_CANNOT_RULE_OUT}`;
  else if (input.noSas === 'atOrAbove') nosasDetail = `${NOSAS_DETAIL.atOrAbove} ${NOSAS_INCOMPLETE_AT_OR_ABOVE}`;
  items.push({
    id: 'noSas',
    source: 'user-reported',
    label: 'NoSAS screening score',
    detail: nosasDetail,
    state: nosasState[input.noSas],
    isSynthetic: syn,
    limitations: [NOSAS_SCREENING_NOT_DIAGNOSIS, NOSAS_LOWER_SCORE_CAVEAT, NOSAS_OUTSIDE_VALIDATION_NOTE],
    citation: NOSAS_CITATION,
  });

  // Symptoms (user-reported, unvalidated heuristic).
  const symState: Record<RulesInput['symptoms'], EvidenceState> = {
    high: 'present',
    some: 'inconclusive',
    none: 'absent-unreliable',
    notAnswered: 'missing',
  };
  const freq = ctx.frequentSymptoms && ctx.frequentSymptoms.length > 0 ? ` (${ctx.frequentSymptoms.join('; ')})` : '';
  items.push({
    id: 'symptoms',
    source: 'user-reported',
    label: `Symptom checklist (${SYMPTOM_NOT_VALIDATED})`,
    detail: `${SYMPTOM_DETAIL[input.symptoms]}${input.symptoms === 'high' ? freq : ''}`,
    state: symState[input.symptoms],
    isSynthetic: syn,
    limitations: [SYMPTOM_NOT_VALIDATED, DISCLAIMER_NOT_DIAGNOSIS],
  });

  if (input.redFlagPresent) {
    items.push({
      id: 'redFlag',
      source: 'user-reported',
      label: 'Drowsy driving',
      detail: RED_FLAG_WORDING,
      state: 'present',
      isSynthetic: syn,
      limitations: [DISCLAIMER_NOT_DIAGNOSIS],
    });
  }

  // Audio observation.
  const audioState: Record<RulesInput['audio'], EvidenceState> = {
    notProvided: 'missing',
    unusable: 'inconclusive',
    usableFewObservations: 'absent-unreliable',
    usableSnoreLikeObserved: 'present',
    noModel: 'inconclusive',
    modelNotApplicable: 'inconclusive',
  };
  const sample = ctx.audioIsSample === true && input.audio === 'notProvided';
  const audioLimits = [DISCLAIMER_AUDIO, DISCLAIMER_CANNOT_RULE_OUT];
  if (input.audio === 'noModel') audioLimits.push(NO_MODEL_LINE);
  if (input.audio === 'modelNotApplicable') audioLimits.push(MODEL_NOT_APPLICABLE);
  items.push({
    id: 'audio',
    source: input.audio === 'notProvided' && !sample ? 'missing' : 'audio-observation',
    label: sample ? 'Recording (public sample)' : 'Recording',
    detail: sample ? SAMPLE_AUDIO_NOT_USED : AUDIO_DETAIL[input.audio],
    state: audioState[input.audio],
    isSynthetic: sample ? true : input.audio === 'notProvided' ? false : syn,
    limitations: audioLimits,
  });

  const missing = missingFor(input, ctx);
  const conflicts = conflictsFor(input);
  const redFlags = redFlagsFor(input);

  const uncertaintyNotes: string[] = [DISCLAIMER_NOT_DIAGNOSIS, DISCLAIMER_CANNOT_RULE_OUT, NOTE_NO_UNIFIED_SCORE];
  if (rule === 3) uncertaintyNotes.push(NOTE_SNORE_LIKE);
  if (input.audio !== 'notProvided') uncertaintyNotes.push(NOTE_AUDIO_NEVER_DOWNGRADES);

  const headline =
    conclusion === 'discuss-with-clinician'
      ? HEADLINE_DISCUSS
      : conclusion === 'not-enough-information'
        ? HEADLINE_NOT_ENOUGH
        : HEADLINE_INCONCLUSIVE;

  items.push({
    id: 'guidance',
    source: 'app-guidance',
    label: 'What this means',
    detail: headline,
    state: conclusion === 'discuss-with-clinician' ? 'present' : 'inconclusive',
    isSynthetic: syn,
    limitations: [DISCLAIMER_NOT_DIAGNOSIS, DISCLAIMER_CANNOT_RULE_OUT],
  });

  for (const label of missing) {
    if (label === MISSING_AUDIO) continue; // already represented by the audio item (source "missing")
    items.push({
      id: `missing:${label}`,
      source: 'missing',
      label,
      detail:
        label === MISSING_MODEL_NOT_APPLICABLE
          ? 'Not assessed. Nothing was learned from this part of the recording, so it is not a sign that all is well.'
          : 'Not available, so this screening cannot take it into account.',
      state: 'missing',
      isSynthetic: false,
      limitations: [DISCLAIMER_NOT_DIAGNOSIS],
    });
  }

  return { conclusion, headline, items, missing, conflicts, redFlags, uncertaintyNotes };
}
