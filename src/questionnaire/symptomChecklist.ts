import type { SymptomEntry, SymptomFrequency } from '../types/questionnaire';
import type { SymptomBurden } from '../types/evidence';

// Team-written checklist (labeled "Not a validated instrument" in the UI).
// The word "pauses" appears here only: it is user-reported symptom wording (ER-8 allowlist).

export interface SymptomItem {
  key: string;
  text: string;
  core: boolean;
}

export const SYMPTOM_ITEMS: SymptomItem[] = [
  { key: 'loud-snoring', text: 'I snore loudly', core: true },
  { key: 'choking-gasping', text: 'I wake up choking or gasping', core: true },
  { key: 'noticed-breathing-pauses', text: 'Someone has noticed pauses in my breathing during sleep', core: true },
  { key: 'unrefreshing-sleep', text: 'I wake up feeling unrefreshed', core: true },
  { key: 'daytime-sleepiness', text: 'I feel very sleepy during the day', core: true },
  { key: 'morning-headaches', text: 'I wake up with headaches', core: true },
];

export const FREQUENCIES: SymptomFrequency[] = ['never', 'sometimes', 'often', 'nightly'];
export const FREQUENCY_LABELS: Record<SymptomFrequency, string> = {
  never: 'Never',
  sometimes: 'Sometimes',
  often: 'Often',
  nightly: 'Nearly every night',
};

export type SymptomAnswers = Record<string, SymptomFrequency>;

export function toEntries(a: SymptomAnswers): SymptomEntry[] {
  return SYMPTOM_ITEMS.flatMap((i) => {
    const f = a[i.key];
    return f ? [{ key: i.key, frequency: f, userReported: true as const }] : [];
  });
}

/** `high` = >= 2 core items often/nightly; `some` = >= 1 item sometimes or more; `none` = all never. */
export function symptomBurden(a: SymptomAnswers): SymptomBurden {
  const core = SYMPTOM_ITEMS.filter((i) => i.core).flatMap((i) => (a[i.key] ? [a[i.key] as SymptomFrequency] : []));
  if (core.length === 0) return 'notAnswered';
  const frequent = core.filter((f) => f === 'often' || f === 'nightly').length;
  if (frequent >= 2) return 'high';
  if (core.some((f) => f !== 'never')) return 'some';
  return 'none';
}
