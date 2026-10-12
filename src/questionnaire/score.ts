import type { NoSasState } from '../types/evidence';
import type { AnswerValue } from '../types/questionnaire';
import type { ScreeningInstrument } from './types';

/** Map an instrument's answers to the ER-3 NoSAS state. */
export function screeningState(instrument: ScreeningInstrument, answers: Record<string, AnswerValue>): NoSasState {
  const p = instrument.partialScore(answers);
  if (!p.answeredAny) return 'notAnswered';
  const s = instrument.score(answers);
  if (s.complete && s.total !== null) return s.total >= instrument.cutoff ? 'atOrAbove' : 'below';
  return p.partial >= instrument.cutoff ? 'atOrAbove' : 'incompleteBelow';
}
