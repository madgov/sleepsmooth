// The questionnaire draft shared by onboarding and "Retake the questionnaire". Scoring is not here: answers are written to
// settings in the shape the shared core (@core/questionnaire) already reads, and the core scores them.
import { normalizePartner, type PartnerObservations } from '@core/questionnaire/partner';
import { discussIds, discussToAnswers } from '@core/questionnaire/discussItems';
import type { SymptomAnswers } from '@core/questionnaire/symptomChecklist';
import type { AnswerValue } from '@core/types/questionnaire';
import { canonicalizeAnswers, convertTyped, displayUnitSystem, formatBody, toCanonical, type BodyField } from '@core/questionnaire/units';
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
  /** Optional "worth discussing with a clinician" items (ids from DISCUSS_ITEMS). Stored in answers as discuss_<id>. */
  discuss: string[];
  partner: PartnerObservations;
}

const str = (v: AnswerValue | undefined) => (typeof v === 'number' ? String(v) : '');

export function initialDraft(): Draft {
  const s = getSettings();
  // Stored answers are canonical (cm, kg). The draft shows them in the chosen units; older saved answers are converted once.
  const a = canonicalizeAnswers(s.answers);
  const units = displayUnitSystem(a);
  const body = (f: BodyField) => (typeof a[f] === 'number' ? formatBody(f, a[f] as number, units, 2) : '');
  return {
    units,
    height: body('height'),
    weight: body('weight'),
    neck: body('neck'),
    neckUnknown: a.neckUnknown === true,
    snoring: typeof a.snoring === 'boolean' ? a.snoring : null,
    age: str(a.age),
    sex: a.sex === 'male' || a.sex === 'female' ? a.sex : null,
    symptoms: { ...s.symptoms },
    redFlag: s.redFlag,
    discuss: discussIds(a),
    partner: normalizePartner(s.partner),
  };
}

export const positive = (t: string): boolean => {
  const n = parseFloat(t);
  return Number.isFinite(n) && n > 0;
};
const num = (t: string): number | null => (positive(t) ? parseFloat(t) : null);

/** Flipping the units choice converts what was already typed, so the numbers keep meaning the same body measurement. */
export function convertDraftUnits(d: Draft, to: Units): Draft {
  if (d.units === to) return d;
  return {
    ...d,
    units: to,
    height: convertTyped('height', d.height, d.units, to),
    weight: convertTyped('weight', d.weight, d.units, to),
    neck: convertTyped('neck', d.neck, d.units, to),
  };
}

/** Answers are written in the canonical units (cm, kg) with the display choice in displayUnits. */
export function toAnswers(d: Draft): Record<string, AnswerValue> {
  const a: Record<string, AnswerValue> = { units: 'metric', displayUnits: d.units };
  const h = num(d.height);
  const w = num(d.weight);
  const age = num(d.age);
  const neck = d.neckUnknown ? null : num(d.neck);
  if (h !== null) a.height = toCanonical('height', h, d.units);
  if (w !== null) a.weight = toCanonical('weight', w, d.units);
  if (neck !== null) a.neck = toCanonical('neck', neck, d.units);
  if (d.neckUnknown) a.neckUnknown = true;
  if (d.snoring !== null) a.snoring = d.snoring;
  if (age !== null) a.age = age;
  if (d.sex) a.sex = d.sex;
  return { ...a, ...discussToAnswers(d.discuss) };
}

/** Writes the draft to local settings. Unanswered items stay unanswered (never zero points). */
export function commitDraft(d: Draft): void {
  updateSettings((p) => ({ ...p, answers: toAnswers(d), symptoms: d.symptoms, redFlag: d.redFlag, partner: d.partner, questionnaireSavedAt: new Date().toISOString() }));
}
