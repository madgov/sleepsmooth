import { activeInstrument } from '../questionnaire/registry';
import { screeningState } from '../questionnaire/score';
import { FREQUENCY_LABELS, SYMPTOM_ITEMS, symptomBurden, type SymptomAnswers } from '../questionnaire/symptomChecklist';
import type { AudioAnalysis } from '../types/audio';
import type { RulesInput } from '../types/evidence';
import type { AnswerValue } from '../types/questionnaire';
import { audioStateFrom } from './audioState';
import type { EvidenceContext } from './engine';
import { NOSAS_ENABLED } from '../content/claims';

export interface ScreeningInputs {
  answers: Record<string, AnswerValue>;
  symptoms: SymptomAnswers;
  redFlag: boolean | null;
  isSynthetic: boolean;
}

/** Turn raw session answers (and an optional analysis) into the engine's inputs. */
export function buildRulesInput(
  s: ScreeningInputs,
  audio: AudioAnalysis | null,
  /** True when `audio` is the public sample recording: shown, but never used for the conclusion. */
  audioIsSample = false,
): { input: RulesInput; context: EvidenceContext } {
  const score = activeInstrument.score(s.answers);
  const partial = activeInstrument.partialScore(s.answers);
  const frequentSymptoms = SYMPTOM_ITEMS.filter((i) => s.symptoms[i.key] === 'often' || s.symptoms[i.key] === 'nightly').map(
    (i) => `${i.text}: ${FREQUENCY_LABELS[s.symptoms[i.key] as keyof typeof FREQUENCY_LABELS].toLowerCase()}`,
  );
  const input: RulesInput = {
    noSas: NOSAS_ENABLED ? screeningState(activeInstrument, s.answers) : 'notAnswered',
    symptoms: symptomBurden(s.symptoms),
    redFlagPresent: s.redFlag === true,
    audio: audioIsSample ? 'notProvided' : audioStateFrom(audio),
    ...(audio && !audioIsSample ? { audioAnalysis: audio } : {}),
    isSynthetic: s.isSynthetic || (audio?.isSynthetic ?? false),
  };
  return { input, context: { noSasTotal: NOSAS_ENABLED ? score.total : null, noSasMissing: NOSAS_ENABLED ? partial.missing : [], frequentSymptoms, ...(audioIsSample && audio ? { audioIsSample: true } : {}) } };
}
