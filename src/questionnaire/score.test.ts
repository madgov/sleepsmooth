import { describe, expect, it } from 'vitest';
import { noSas } from './instruments/noSas';
import { activeInstrument } from './registry';
import { screeningState } from './score';
import { symptomBurden } from './symptomChecklist';
import type { ScreeningInstrument } from './types';
import type { AnswerValue } from '../types/questionnaire';
import { NOSAS_INCOMPLETE_AT_OR_ABOVE, NOSAS_INCOMPLETE_EXPLANATION, NOSAS_SCREENING_NOT_DIAGNOSIS } from '../content/claims';

// Baseline: BMI 24 (0), neck 40 cm (0), no snoring, age 55, female => 0 points.
const base: Record<string, AnswerValue> = { height: 100, weight: 24, neck: 40, snoring: false, age: 55, sex: 'female' };
const total = (o: Record<string, AnswerValue>) => noSas.score({ ...base, ...o }).total;

describe('NoSAS scoring', () => {
  it('baseline is 0 and complete', () => {
    expect(noSas.score(base)).toMatchObject({ total: 0, complete: true });
  });
  it.each([
    [{ neck: 40.1 }, 4],
    [{ neck: 40 }, 0],
    [{ weight: 24.99 }, 0],
    [{ weight: 25 }, 3],
    [{ weight: 29.99 }, 3],
    [{ weight: 30 }, 5],
    [{ snoring: true }, 2],
    [{ age: 55 }, 0],
    [{ age: 56 }, 4],
    [{ sex: 'male' }, 2],
  ])('item %j => %i points', (o, pts) => {
    expect(total(o)).toBe(pts);
  });
  it('maximum is 17 and cutoff boundary is 8', () => {
    expect(total({ neck: 45, weight: 30, snoring: true, age: 60, sex: 'male' })).toBe(17);
    expect(total({ neck: 41, snoring: true, sex: 'male' })).toBe(8); // 4+2+2
    expect(noSas.score({ ...base, neck: 41, snoring: true, sex: 'male' }).band).toMatch(/At or above/);
    expect(total({ neck: 41, snoring: true })).toBe(6);
    expect(noSas.score({ ...base, neck: 41, snoring: true }).band).toMatch(/Below/);
    expect(total({ weight: 25, age: 56 })).toBe(7);
    expect(total({ weight: 25, age: 56, sex: 'male' })).toBe(9);
  });
  it('imperial units convert', () => {
    const imp = { units: 'imperial', height: 39.3701, weight: 55.2, neck: 15.76, snoring: false, age: 30, sex: 'female' };
    expect(noSas.score(imp).total).toBe(3 + 4); // BMI ~25.0 (>=25), neck 40.03 cm
  });
  it('missing neck => incomplete, null total, max-13 explanation', () => {
    const { neck: _n, ...noNeck } = base;
    void _n;
    const s = noSas.score(noNeck);
    expect(s.total).toBeNull();
    expect(s.complete).toBe(false);
    expect(s.explanation).toContain(NOSAS_INCOMPLETE_EXPLANATION);
    expect(s.band).toBe('Incomplete');
    expect(noSas.score({ ...base, neck: null, neckUnknown: true }).complete).toBe(false);
  });
  it('partial >= 8 without neck: may-say 6 and atOrAbove', () => {
    const a = { height: 100, weight: 30, snoring: true, age: 56, sex: 'male' }; // 5+2+4+2 = 13
    const s = noSas.score(a);
    expect(s.total).toBeNull();
    expect(s.explanation).toContain(NOSAS_INCOMPLETE_AT_OR_ABOVE);
    expect(screeningState(noSas, a)).toBe('atOrAbove');
  });
  it('state mapping', () => {
    expect(screeningState(noSas, {})).toBe('notAnswered');
    expect(screeningState(noSas, base)).toBe('below');
    expect(screeningState(noSas, { ...base, snoring: true, sex: 'male', neck: 41 })).toBe('atOrAbove');
    expect(screeningState(noSas, { height: 100, weight: 24, snoring: true, age: 30, sex: 'female' })).toBe('incompleteBelow');
  });
  it('complete score text carries the not-a-diagnosis citation', () => {
    expect(noSas.score(base).explanation).toContain(NOSAS_SCREENING_NOT_DIAGNOSIS);
  });
  it('active instrument citation is verified', () => {
    expect(activeInstrument.citation.verified).toBe(true);
    expect(activeInstrument.notDiagnostic).toBe(true);
  });
});

describe('instrument swap', () => {
  const fake: ScreeningInstrument = {
    id: 'fake',
    version: '0',
    title: 'Fake',
    citation: { text: 't', url: 'u', verified: true },
    items: [],
    notDiagnostic: true,
    cutoff: 3,
    partialScore: (a) => ({ partial: Number(a.x ?? 0), answeredAny: a.x !== undefined, missing: [] }),
    score: (a) => ({ total: Number(a.x ?? 0), complete: a.x !== undefined, band: 'b', explanation: 'e' }),
  };
  it('screeningState works with any ScreeningInstrument', () => {
    expect(screeningState(fake, {})).toBe('notAnswered');
    expect(screeningState(fake, { x: 2 })).toBe('below');
    expect(screeningState(fake, { x: 3 })).toBe('atOrAbove');
  });
});

describe('symptom burden', () => {
  it('thresholds', () => {
    expect(symptomBurden({})).toBe('notAnswered');
    expect(symptomBurden({ 'loud-snoring': 'never' })).toBe('none');
    expect(symptomBurden({ 'loud-snoring': 'sometimes' })).toBe('some');
    expect(symptomBurden({ 'loud-snoring': 'often' })).toBe('some');
    expect(symptomBurden({ 'loud-snoring': 'often', 'unrefreshing-sleep': 'nightly' })).toBe('high');
  });
});
