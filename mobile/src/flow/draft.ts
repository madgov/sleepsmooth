// The questionnaire draft shared by onboarding and "Retake the questionnaire". Scoring is not here: answers are written to
// settings in the shape the shared core (@core/questionnaire) already reads, and the core scores them.
import type { SymptomAnswers } from '@core/questionnaire/symptomChecklist';
import type { AnswerValue } from '@core/types/questionnaire';
import { getSettings, updateSettings } from '../state/settings';

export type Units = 'metric' | 'imperial';

export interface Draft {
  units: Units;
  height: string;
  weight: string;
  neck: string;
  neckUnknown: boolean;
  snoring: boolean | null;
  age: string;
  sex: 'male' | 'female' | null;
  symptoms: SymptomAnswers;
  redFlag: boolean | null;
}

const str = (v: AnswerValue | undefined) => (typeof v === 'number' ? String(v) : '');

export function initialDraft(): Draft {
  const s = getSettings();
  const a = s.answers;
  return {
    units: a.units === 'imperial' ? 'imperial' : 'metric',
    height: str(a.height),
    weight: str(a.weight),
    neck: str(a.neck),
    neckUnknown: a.neckUnknown === true,
    snoring: typeof a.snoring === 'boolean' ? a.snoring : null,
    age: str(a.age),
    sex: a.sex === 'male' || a.sex === 'female' ? a.sex : null,
    symptoms: { ...s.symptoms },
    redFlag: s.redFlag,
  };
}

export const positive = (t: string): boolean => {
  const n = parseFloat(t);
  return Number.isFinite(n) && n > 0;
};
const num = (t: string): number | null => (positive(t) ? parseFloat(t) : null);

export function toAnswers(d: Draft): Record<string, AnswerValue> {
  const a: Record<string, AnswerValue> = { units: d.units };
  const h = num(d.height);
  const w = num(d.weight);
  const age = num(d.age);
  const neck = d.neckUnknown ? null : num(d.neck);
  if (h !== null) a.height = h;
  if (w !== null) a.weight = w;
  if (neck !== null) a.neck = neck;
  if (d.neckUnknown) a.neckUnknown = true;
  if (d.snoring !== null) a.snoring = d.snoring;
  if (age !== null) a.age = age;
  if (d.sex) a.sex = d.sex;
  return a;
}

/** Writes the draft to local settings. Unanswered items stay unanswered (never zero points). */
export function commitDraft(d: Draft): void {
  updateSettings((p) => ({ ...p, answers: toAnswers(d), symptoms: d.symptoms, redFlag: d.redFlag, questionnaireSavedAt: new Date().toISOString() }));
}
