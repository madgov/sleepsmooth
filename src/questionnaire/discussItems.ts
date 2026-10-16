// Optional "worth discussing with a clinician" items (user-reported, never scored). They live in the saved answers
// under `discuss_<id>: true`, so no new storage shape is needed and "Delete my data" removes them with everything else.
import { DISCUSS_ANSWER_PREFIX, DISCUSS_ITEMS } from '../content/claims';
import type { AnswerValue } from '../types/questionnaire';

export type DiscussAnswers = Record<string, AnswerValue>;

export const discussKey = (id: string): string => `${DISCUSS_ANSWER_PREFIX}${id}`;

/** Items the person ticked, in the fixed display order. Unknown keys are ignored. */
export function selectedDiscussItems(answers: DiscussAnswers): { id: string; text: string; source: string }[] {
  return DISCUSS_ITEMS.filter((it) => answers[discussKey(it.id)] === true).map((it) => ({ ...it }));
}

/** Returns a new answers object with the item set or cleared. Unticked means removed (not "no"). */
export function withDiscussItem(answers: DiscussAnswers, id: string, on: boolean): DiscussAnswers {
  const next = { ...answers };
  if (on) next[discussKey(id)] = true;
  else delete next[discussKey(id)];
  return next;
}

/** Ids ticked, for the phone draft. */
export const discussIds = (answers: DiscussAnswers): string[] => selectedDiscussItems(answers).map((i) => i.id);

/** Phone draft to answers: only ticked items are written. */
export function discussToAnswers(ids: readonly string[]): DiscussAnswers {
  const out: DiscussAnswers = {};
  for (const it of DISCUSS_ITEMS) if (ids.includes(it.id)) out[discussKey(it.id)] = true;
  return out;
}
