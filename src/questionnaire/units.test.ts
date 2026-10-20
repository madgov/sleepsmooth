import { describe, expect, it } from 'vitest';
import { noSas } from './instruments/noSas';
import { canonicalizeAnswers, convertTyped, displayUnitSystem, formatBody, setBodyValue, setDisplayUnits, toCanonical } from './units';
import type { AnswerValue } from '../types/questionnaire';

type A = Record<string, AnswerValue>;
const rest = { snoring: true, age: 50, sex: 'male' } as const;

// A grid of body measurements entered in metric, with the same person re-entered in imperial.
const cases: Array<[number, number, number]> = [];
for (const h of [150, 160, 175, 190]) for (const w of [45, 60, 72.5, 80, 95, 130]) for (const n of [30, 36, 39.9, 40, 40.1, 43, 48]) cases.push([h, w, n]);

describe('NoSAS scoring is identical across unit choices', () => {
  it.each(cases)('height %d cm, weight %d kg, neck %d cm', (h, w, n) => {
    const metric: A = { units: 'metric', height: h, weight: w, neck: n, ...rest };
    const imperial: A = {
      units: 'imperial',
      height: h / 2.54,
      weight: w / 0.45359237,
      neck: n / 2.54,
      ...rest,
    };
    const canonical = canonicalizeAnswers(imperial);
    const a = noSas.score(metric);
    expect(noSas.score(imperial)).toEqual(a);
    expect(noSas.score(canonical)).toEqual(a);
  });

  it('the old imperial shape and its canonical form give the same total for the documented imperial case', () => {
    const imp: A = { units: 'imperial', height: 39.3701, weight: 55.2, neck: 15.76, snoring: false, age: 30, sex: 'female' };
    expect(noSas.score(imp).total).toBe(7);
    expect(noSas.score(canonicalizeAnswers(imp)).total).toBe(7);
  });

  it('canonical answers are untouched and old imperial answers keep the display choice', () => {
    const m: A = { units: 'metric', height: 170, weight: 70 };
    expect(canonicalizeAnswers(m)).toBe(m);
    const c = canonicalizeAnswers({ units: 'imperial', height: 70, weight: 150, neck: 16 });
    expect(c.units).toBe('metric');
    expect(c.displayUnits).toBe('imperial');
    expect(c.height).toBeCloseTo(177.8, 6);
    expect(displayUnitSystem(c)).toBe('imperial');
  });

  it('changing the display choice never changes the stored measurements', () => {
    const a: A = { units: 'metric', displayUnits: 'metric', height: 175, weight: 80, neck: 40.1, ...rest };
    const b = setDisplayUnits(a, 'imperial');
    expect({ ...b, displayUnits: undefined }).toEqual({ ...a, displayUnits: undefined });
    expect(noSas.score(b)).toEqual(noSas.score(a));
  });

  it('entering a value in inches stores centimetres, and display converts back', () => {
    const a = setBodyValue({}, 'neck', 15.75, 'imperial');
    expect(a.neck).toBeCloseTo(40.005, 6);
    expect(formatBody('neck', a.neck as number, 'imperial')).toBe('15.8');
    expect(formatBody('weight', toCanonical('weight', 180, 'imperial'), 'imperial')).toBe('180');
    expect(setBodyValue(a, 'neck', null, 'metric').neck).toBeUndefined();
  });

  it('converts typed text when flipping units and leaves blanks and unchanged systems alone', () => {
    expect(convertTyped('height', '175', 'metric', 'imperial')).toBe('68.9');
    expect(convertTyped('weight', '', 'metric', 'imperial')).toBe('');
    expect(convertTyped('weight', '80', 'metric', 'metric')).toBe('80');
    expect(convertTyped('weight', 'abc', 'metric', 'imperial')).toBe('abc');
  });
});
