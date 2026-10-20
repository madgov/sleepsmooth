// Height, weight and neck units. Stored answers are always canonical: centimetres and kilograms.
// The metric/imperial choice is a display preference only (`displayUnits`). Scoring (noSas.ts) is unchanged and still
// understands the older shape (`units: 'imperial'` with values in inches and pounds), so saved answers keep scoring the same.
import type { AnswerValue } from '../types/questionnaire';

export type UnitSystem = 'metric' | 'imperial';
export type BodyField = 'height' | 'weight' | 'neck';

// Same constants as noSas.ts, so a canonical value and the older imperial value score identically.
export const CM_PER_INCH = 2.54;
export const KG_PER_LB = 0.45359237;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Factor from the canonical unit (cm or kg) to the displayed unit. */
const perCanonical = (field: BodyField, system: UnitSystem): number =>
  system === 'metric' ? 1 : field === 'weight' ? 1 / KG_PER_LB : 1 / CM_PER_INCH;

export const unitLabel = (field: BodyField, system: UnitSystem): string =>
  field === 'weight' ? (system === 'metric' ? 'kg' : 'lb') : system === 'metric' ? 'cm' : 'in';

export function toCanonical(field: BodyField, value: number, system: UnitSystem): number {
  return system === 'metric' ? value : field === 'weight' ? value * KG_PER_LB : value * CM_PER_INCH;
}

export function fromCanonical(field: BodyField, canonical: number, system: UnitSystem): number {
  return canonical * perCanonical(field, system);
}

/** Text for an input box or a review line: at most `digits` decimals, no trailing zeros. */
export function formatBody(field: BodyField, canonical: number, system: UnitSystem, digits = 1): string {
  const x = Number(fromCanonical(field, canonical, system).toFixed(digits));
  return String(x);
}

/** Convert a typed value from one unit system to the other (used when the person flips the units choice mid-entry). */
export function convertTyped(field: BodyField, text: string, from: UnitSystem, to: UnitSystem, digits = 2): string {
  const n = parseFloat(text);
  if (!Number.isFinite(n) || from === to) return text;
  return String(Number(fromCanonical(field, toCanonical(field, n, from), to).toFixed(digits)));
}

export function displayUnitSystem(a: Record<string, AnswerValue>): UnitSystem {
  const v = a.displayUnits ?? a.units;
  return v === 'imperial' ? 'imperial' : 'metric';
}

/**
 * Normalises answers to the canonical shape: height and neck in cm, weight in kg, `units: 'metric'`, and the person's
 * choice kept in `displayUnits`. Older saved answers (`units: 'imperial'`, values in inches and pounds) are converted once.
 * Answers that are already canonical are returned unchanged.
 */
export function canonicalizeAnswers(a: Record<string, AnswerValue>): Record<string, AnswerValue> {
  if (a.units !== 'imperial') return a;
  const out: Record<string, AnswerValue> = { ...a, units: 'metric', displayUnits: 'imperial' };
  for (const f of ['height', 'weight', 'neck'] as const) {
    const v = a[f];
    if (isNum(v)) out[f] = toCanonical(f, v, 'imperial');
  }
  return out;
}

/** Writes one displayed value (in the display system) into canonical answers. null clears it. */
export function setBodyValue(a: Record<string, AnswerValue>, field: BodyField, value: number | null, system: UnitSystem): Record<string, AnswerValue> {
  const next = { ...a };
  if (value === null) delete next[field];
  else next[field] = toCanonical(field, value, system);
  return next;
}

export function setDisplayUnits(a: Record<string, AnswerValue>, system: UnitSystem): Record<string, AnswerValue> {
  return { ...a, units: 'metric', displayUnits: system };
}
