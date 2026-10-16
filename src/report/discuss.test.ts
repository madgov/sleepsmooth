import { describe, expect, it } from 'vitest';
import { DISCUSS_ITEMS, DISCUSS_SOURCE_LINE, DISCUSS_SUMMARY_TITLE, NOSAS_BAND_BELOW, NOSAS_BELOW_CANNOT_RULE_OUT } from '../content/claims';
import { evaluate } from '../evidence/engine';
import { buildRulesInput } from '../evidence/input';
import { selectedDiscussItems, withDiscussItem, discussToAnswers, discussIds } from '../questionnaire/discussItems';
import { generateCareSummary } from './generate';

const base = { height: 170, weight: 80, neck: 38, snoring: true, age: 40, sex: 'female' } as const;
const build = (answers: Record<string, string | number | boolean>) => {
  const screening = { answers, symptoms: {}, redFlag: null, isSynthetic: false };
  const { input, context } = buildRulesInput(screening, null);
  return { evidence: evaluate(input, context), summary: generateCareSummary({ ...screening, evidence: evaluate(input, context), audio: null, isSynthetic: false, generatedAt: '2026-01-01T00:00:00.000Z' }) };
};

describe('clinician-discussion checklist', () => {
  it('only cited items from the clinical-pathway research are offered', () => {
    expect(DISCUSS_ITEMS.map((i) => i.id)).toEqual(['resistant_hypertension', 'atrial_fibrillation', 'heart_failure', 'stroke', 'opioids', 'drowsy_driving']);
    for (const i of DISCUSS_ITEMS) expect(i.source.length).toBeGreaterThan(5);
  });
  it('toggles are immutable and ids round-trip', () => {
    const a = withDiscussItem({ ...base }, 'opioids', true);
    expect(selectedDiscussItems(a).map((i) => i.id)).toEqual(['opioids']);
    expect(withDiscussItem(a, 'opioids', false)).toEqual(base);
    expect(discussIds({ ...base, ...discussToAnswers(['stroke', 'heart_failure']) })).toEqual(['heart_failure', 'stroke']);
  });
  it('ticked items appear in the summary as a user-reported section with sources; none ticked adds no section', () => {
    expect(build({ ...base }).summary.sections.some((s) => s.id === 'discuss')).toBe(false);
    const sec = build({ ...base, ...discussToAnswers(['heart_failure', 'drowsy_driving']) }).summary.sections.find((s) => s.id === 'discuss');
    expect(sec?.title).toBe(DISCUSS_SUMMARY_TITLE);
    expect(sec?.source).toBe('user-reported');
    expect(sec?.text).toContain('Heart failure');
    expect(sec?.text).toContain('Sleepiness that affects your driving');
    expect(sec?.text).toContain(DISCUSS_SOURCE_LINE);
    expect(sec?.text).not.toMatch(/you are at risk|score/i);
  });
  it('does not change the NoSAS score', () => {
    expect(build({ ...base, ...discussToAnswers(['stroke']) }).evidence.items.find((i) => i.id === 'noSas')?.detail).toBe(build({ ...base }).evidence.items.find((i) => i.id === 'noSas')?.detail);
  });
});

describe('below-cutoff NoSAS wording', () => {
  it('always says "cannot rule out" and never reassures', () => {
    const { evidence, summary } = build({ ...base });
    const item = evidence.items.find((i) => i.id === 'noSas');
    expect(item?.state).toBe('absent-unreliable');
    expect(item?.detail).toContain(NOSAS_BELOW_CANNOT_RULE_OUT);
    const screening = summary.sections.find((s) => s.id === 'screening')?.text ?? '';
    expect(screening).toContain(NOSAS_BAND_BELOW);
    expect(screening).toMatch(/cannot rule out sleep apnea/);
    expect(screening).not.toMatch(/reassur|low risk|normal|healthy/i);
  });
});
