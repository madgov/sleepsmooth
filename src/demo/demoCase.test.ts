import { describe, expect, it } from 'vitest';
import { demoAudioAnalysis, demoCase, demoRulesInput, demoScreeningResponse, demoSymptoms } from './demoCase';
import { SNORE_FRACTION_OBSERVED } from '../audio/constants';

describe('demo case', () => {
  it('flags every demo object as synthetic', () => {
    expect(demoCase.isSynthetic).toBe(true);
    expect(demoScreeningResponse.isSynthetic).toBe(true);
    expect(demoAudioAnalysis.isSynthetic).toBe(true);
    expect(demoRulesInput.isSynthetic).toBe(true);
    expect(demoSymptoms.length).toBeGreaterThan(0);
    for (const s of demoSymptoms) expect(s.isSynthetic).toBe(true);
  });
  it('matches the ER-3 demo inputs', () => {
    expect(demoRulesInput).toMatchObject({ noSas: 'incompleteBelow', symptoms: 'high', audio: 'usableFewObservations', redFlagPresent: false });
    expect(demoScreeningResponse.answers.neck).toBeNull();
    const often = demoSymptoms.filter((s) => s.frequency === 'often' || s.frequency === 'nightly').map((s) => s.key);
    expect(often).toEqual(expect.arrayContaining(['daytime-sleepiness', 'unrefreshing-sleep']));
  });
  it('has internally consistent audio numbers', () => {
    const a = demoAudioAnalysis;
    expect(a.quality.durationSec).toBeGreaterThanOrEqual(30);
    expect(a.loudness).toHaveLength(a.quality.durationSec);
    expect(a.snoreLikeFraction).toBeLessThan(SNORE_FRACTION_OBSERVED);
    expect(a.snoreLikeFraction).toBeGreaterThan(0);
    expect(a.quietGaps.length).toBeGreaterThan(0);
  });
});
