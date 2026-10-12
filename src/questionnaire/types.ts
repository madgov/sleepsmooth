import type { AnswerValue, Instrument } from '../types/questionnaire';

export type { AnswerValue, Instrument, Item, InstrumentScore } from '../types/questionnaire';

export interface PartialScore {
  /** Sum of points for the items that were answered. */
  partial: number;
  answeredAny: boolean;
  /** Labels of unanswered items, for the "missing" list. */
  missing: string[];
}

/** An Instrument plus what the evidence engine needs. Swapping the active instrument touches registry.ts only. */
export interface ScreeningInstrument extends Instrument {
  /** Published cutoff: total (or partial) at or above it counts as `atOrAbove`. */
  cutoff: number;
  partialScore(answers: Record<string, AnswerValue>): PartialScore;
}
