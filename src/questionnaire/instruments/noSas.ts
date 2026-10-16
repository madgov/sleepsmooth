import type { AnswerValue, Item } from '../../types/questionnaire';
import type { PartialScore, ScreeningInstrument } from '../types';
import {
  MISSING_NECK,
  NOSAS_BAND_AT_OR_ABOVE,
  NOSAS_BAND_BELOW,
  NOSAS_BAND_INCOMPLETE,
  NOSAS_BAND_NOT_ANSWERED,
  NOSAS_CITATION,
  NOSAS_CUTOFF,
  NOSAS_INCOMPLETE_AT_OR_ABOVE,
  NOSAS_INCOMPLETE_EXPLANATION,
  NOSAS_NOT_ANSWERED_EXPLANATION,
  NOSAS_OTHER_ITEMS_MISSING,
  NOSAS_QUESTIONS,
  NOSAS_URLS,
  nosasCompleteExplanation,
} from '../../content/claims';

export type UnitSystem = 'metric' | 'imperial';

const CM_PER_INCH = 2.54;
const KG_PER_LB = 0.45359237;

export const NOSAS_ITEMS: Item[] = [
  { id: 'units', text: NOSAS_QUESTIONS.units, type: 'choice', options: ['metric', 'imperial'], required: false },
  { id: 'height', text: NOSAS_QUESTIONS.height, type: 'number', required: true },
  { id: 'weight', text: NOSAS_QUESTIONS.weight, type: 'number', required: true },
  { id: 'neck', text: NOSAS_QUESTIONS.neck, type: 'number', required: false },
  { id: 'snoring', text: NOSAS_QUESTIONS.snoring, type: 'yesno', required: true },
  { id: 'age', text: NOSAS_QUESTIONS.age, type: 'number', required: true },
  { id: 'sex', text: NOSAS_QUESTIONS.sex, type: 'choice', options: ['male', 'female'], required: true },
];

function num(v: AnswerValue | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function unitSystem(a: Record<string, AnswerValue>): UnitSystem {
  return a.units === 'imperial' ? 'imperial' : 'metric';
}

/** BMI from height/weight in the chosen units; null when missing or implausible. */
export function bmiFrom(a: Record<string, AnswerValue>): number | null {
  const h = num(a.height);
  const w = num(a.weight);
  if (h === null || w === null) {
    // A precomputed BMI is accepted (used by the synthetic demo case).
    const direct = num(a.bmi);
    return direct !== null && direct >= 10 && direct <= 100 ? direct : null;
  }
  const imperial = unitSystem(a) === 'imperial';
  const cm = imperial ? h * CM_PER_INCH : h;
  const kg = imperial ? w * KG_PER_LB : w;
  if (cm < 50 || cm > 260 || kg < 20 || kg > 500) return null;
  const m = cm / 100;
  return kg / (m * m);
}

export function neckCmFrom(a: Record<string, AnswerValue>): number | null {
  if (a.neckUnknown === true) return null;
  const n = num(a.neck);
  if (n === null) return null;
  const cm = unitSystem(a) === 'imperial' ? n * CM_PER_INCH : n;
  return cm >= 20 && cm <= 80 ? cm : null;
}

function ageFrom(a: Record<string, AnswerValue>): number | null {
  const v = num(a.age);
  return v !== null && v >= 0 && v <= 120 ? v : null;
}

export function bmiPoints(bmi: number): number {
  return bmi >= 30 ? 5 : bmi >= 25 ? 3 : 0;
}

function partialScore(a: Record<string, AnswerValue>): PartialScore {
  let partial = 0;
  let answered = 0;
  const missing: string[] = [];

  const neck = neckCmFrom(a);
  if (neck === null) missing.push(MISSING_NECK);
  else {
    answered++;
    if (neck > 40) partial += 4;
  }
  const bmi = bmiFrom(a);
  if (bmi === null) missing.push('Height and weight (NoSAS item)');
  else {
    answered++;
    partial += bmiPoints(bmi);
  }
  if (typeof a.snoring !== 'boolean') missing.push('Snoring (NoSAS item)');
  else {
    answered++;
    if (a.snoring) partial += 2;
  }
  const age = ageFrom(a);
  if (age === null) missing.push('Age (NoSAS item)');
  else {
    answered++;
    if (age > 55) partial += 4;
  }
  if (a.sex !== 'male' && a.sex !== 'female') missing.push('Sex assigned at birth (NoSAS item)');
  else {
    answered++;
    if (a.sex === 'male') partial += 2;
  }
  return { partial, answeredAny: answered > 0, missing };
}

export const noSas: ScreeningInstrument = {
  id: 'nosas',
  version: '1',
  title: 'NoSAS questionnaire score',
  citation: { text: NOSAS_CITATION, url: NOSAS_URLS[0], verified: true },
  items: NOSAS_ITEMS,
  notDiagnostic: true,
  cutoff: NOSAS_CUTOFF,
  partialScore,
  score(answers) {
    const p = partialScore(answers);
    if (!p.answeredAny) {
      return { total: null, complete: false, band: NOSAS_BAND_NOT_ANSWERED, explanation: NOSAS_NOT_ANSWERED_EXPLANATION };
    }
    if (p.missing.length === 0) {
      return {
        total: p.partial,
        complete: true,
        band: p.partial >= NOSAS_CUTOFF ? NOSAS_BAND_AT_OR_ABOVE : NOSAS_BAND_BELOW,
        explanation: nosasCompleteExplanation(p.partial),
      };
    }
    const parts = [NOSAS_INCOMPLETE_EXPLANATION];
    if (!(p.missing.length === 1 && p.missing[0] === MISSING_NECK)) parts.push(NOSAS_OTHER_ITEMS_MISSING);
    if (p.partial >= NOSAS_CUTOFF) parts.push(NOSAS_INCOMPLETE_AT_OR_ABOVE);
    return { total: null, complete: false, band: NOSAS_BAND_INCOMPLETE, explanation: parts.join(' ') };
  },
};
