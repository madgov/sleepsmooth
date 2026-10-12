import { describe, expect, it } from 'vitest';
import { demoCase } from '../demo';
import { evaluate } from '../evidence/engine';
import { buildRulesInput } from '../evidence/input';
import { generateCareSummary, regenerateSummary, type ReportInput } from './generate';

const symptoms = { 'daytime-sleepiness': 'often', 'unrefreshing-sleep': 'often', 'loud-snoring': 'sometimes' } as const;
const answers = { height: 170, weight: 80, neck: 38, snoring: true, age: 40, sex: 'female' };

function input(synthetic: boolean, audio = null as typeof demoCase.audio | null): ReportInput {
  const screening = { answers, symptoms: { ...symptoms }, redFlag: false, isSynthetic: synthetic };
  const { input: ri, context } = buildRulesInput(screening, audio);
  return { ...screening, evidence: evaluate(ri, context), audio, isSynthetic: ri.isSynthetic, generatedAt: '2026-01-01T00:00:00.000Z' };
}

describe('generateCareSummary', () => {
  it('snapshot (no audio, real user)', () => {
    expect(generateCareSummary(input(false))).toMatchSnapshot();
  });
  it('snapshot (synthetic demo)', () => {
    const s = generateCareSummary({ ...input(true, demoCase.audio), answers: demoCase.screening.answers });
    expect(s).toMatchSnapshot();
  });
  it('separates sources and is deterministic', () => {
    const a = generateCareSummary(input(false));
    expect(a).toEqual(generateCareSummary(input(false)));
    expect(a.sections.map((s) => s.source)).toEqual(['user-reported', 'user-reported', 'missing', 'app-guidance', 'app-guidance', 'app-guidance']);
  });
  it('synthetic label propagates to data sections', () => {
    const s = generateCareSummary(input(true, demoCase.audio));
    for (const id of ['reported', 'screening', 'audio', 'guidance']) {
      const sec = s.sections.find((x) => x.id === id);
      expect(sec?.isSynthetic).toBe(true);
      expect(sec?.text.startsWith('Synthetic / illustrative')).toBe(true);
    }
  });
  it('real data has no synthetic label', () => {
    expect(JSON.stringify(generateCareSummary(input(false)))).not.toMatch(/Synthetic/);
  });
});

describe('regenerateSummary', () => {
  const cur = generateCareSummary(input(false));
  const edited = { ...cur, userEdited: true, sections: cur.sections.map((s) => (s.id === 'questions' ? { ...s, text: 'my edit' } : s)) };
  const fresh = generateCareSummary({ ...input(false), generatedAt: '2026-02-02T00:00:00.000Z' });
  it('no edits: fresh', () => {
    expect(regenerateSummary(cur, fresh, [], false).summary).toBe(fresh);
  });
  it('edits kept unless overwrite confirmed', () => {
    const kept = regenerateSummary(edited, fresh, ['questions'], false);
    expect(kept.summary.sections.find((s) => s.id === 'questions')?.text).toBe('my edit');
    expect(kept.summary.generatedAt).toBe(fresh.generatedAt);
    expect(kept.editedIds).toEqual(['questions']);
    const replaced = regenerateSummary(edited, fresh, ['questions'], true);
    expect(replaced.summary).toBe(fresh);
    expect(replaced.editedIds).toEqual([]);
  });
});
