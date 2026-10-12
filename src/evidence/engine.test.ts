import { describe, expect, it } from 'vitest';
import { demoCase } from '../demo';
import { SAMPLE_AUDIO_NOT_USED, CONFLICT_QUIET_OR_MISSING_AUDIO, DISCLAIMER_NOT_DIAGNOSIS, NOTE_SNORE_LIKE, RED_FLAG_WORDING } from '../content/claims';
import type { AudioAnalysis } from '../types/audio';
import type { AudioEvidenceState, Conclusion, NoSasState, RulesInput, SymptomBurden } from '../types/evidence';
import { audioStateFrom } from './audioState';
import { evaluate } from './engine';
import { buildRulesInput } from './input';

const mk = (o: Partial<RulesInput>): RulesInput => ({
  noSas: 'notAnswered',
  symptoms: 'notAnswered',
  redFlagPresent: false,
  audio: 'notProvided',
  isSynthetic: false,
  ...o,
});

describe('ER-3 rules table', () => {
  const rows: [string, Partial<RulesInput>, Conclusion, boolean][] = [
    ['1 nothing answered', {}, 'not-enough-information', false],
    ['1 nothing answered even with snore audio', { audio: 'usableSnoreLikeObserved' }, 'not-enough-information', false],
    ['1 red flag does not apply if both unanswered', { redFlagPresent: true }, 'not-enough-information', false],
    ['2 red flag', { redFlagPresent: true, symptoms: 'none' }, 'discuss-with-clinician', true],
    ['2 noSas atOrAbove, no audio', { noSas: 'atOrAbove' }, 'discuss-with-clinician', true],
    ['2 symptoms high, few obs', { symptoms: 'high', audio: 'usableFewObservations' }, 'discuss-with-clinician', true],
    ['2 symptoms high, noModel', { symptoms: 'high', audio: 'noModel' }, 'discuss-with-clinician', true],
    ['2 symptoms high, unusable', { symptoms: 'high', audio: 'unusable' }, 'discuss-with-clinician', true],
    ['2 symptoms high, snore-like (no conflict)', { symptoms: 'high', audio: 'usableSnoreLikeObserved' }, 'discuss-with-clinician', false],
    ['3 snore-like with below/none', { noSas: 'below', symptoms: 'none', audio: 'usableSnoreLikeObserved' }, 'discuss-with-clinician', false],
    ['3 snore-like with incompleteBelow/some', { noSas: 'incompleteBelow', symptoms: 'some', audio: 'usableSnoreLikeObserved' }, 'discuss-with-clinician', false],
    ['4 below/none/few', { noSas: 'below', symptoms: 'none', audio: 'usableFewObservations' }, 'inconclusive', false],
    ['4 below/some/none audio', { noSas: 'below', symptoms: 'some' }, 'inconclusive', false],
    ['4 incompleteBelow only', { noSas: 'incompleteBelow' }, 'inconclusive', false],
    ['2 symptoms high, modelNotApplicable', { symptoms: 'high', audio: 'modelNotApplicable' }, 'discuss-with-clinician', true],
    ['4 symptoms none, modelNotApplicable', { symptoms: 'none', audio: 'modelNotApplicable' }, 'inconclusive', false],
    ['4 symptoms none only', { symptoms: 'none', audio: 'noModel' }, 'inconclusive', false],
  ];
  it.each(rows)('%s', (_n, o, conclusion, conflict) => {
    const s = evaluate(mk(o));
    expect(s.conclusion).toBe(conclusion);
    expect(s.conflicts.includes(CONFLICT_QUIET_OR_MISSING_AUDIO)).toBe(conflict);
    if (_n.startsWith('3')) expect(s.uncertaintyNotes).toContain(NOTE_SNORE_LIKE);
  });

  it('rule 4 lists missing items', () => {
    const s = evaluate(mk({ noSas: 'incompleteBelow', symptoms: 'none' }));
    expect(s.headline).toBe('This screening cannot rule out sleep apnea.');
    expect(s.missing.join(' ')).toMatch(/Neck/);
    expect(s.missing.join(' ')).toMatch(/Audio/);
  });
  it('red flag wording is the generic wording', () => {
    expect(evaluate(mk({ redFlagPresent: true, noSas: 'below' })).redFlags[0]).toBe(RED_FLAG_WORDING);
  });
  it('unusable/noModel audio always appear in missing', () => {
    expect(evaluate(mk({ symptoms: 'none', audio: 'unusable' })).missing.length).toBeGreaterThan(0);
    expect(evaluate(mk({ symptoms: 'none', audio: 'noModel' })).missing.length).toBeGreaterThan(0);
  });
  it('synthetic propagates to items', () => {
    const s = evaluate(mk({ symptoms: 'high', audio: 'usableFewObservations', isSynthetic: true }));
    expect(s.items.filter((i) => i.source !== 'missing').every((i) => i.isSynthetic)).toBe(true);
  });
});

describe('invariants (property test over the whole input space)', () => {
  const noSas: NoSasState[] = ['atOrAbove', 'below', 'incompleteBelow', 'notAnswered'];
  const sym: SymptomBurden[] = ['high', 'some', 'none', 'notAnswered'];
  const audio: AudioEvidenceState[] = ['notProvided', 'unusable', 'usableFewObservations', 'usableSnoreLikeObserved', 'noModel', 'modelNotApplicable'];
  const all: RulesInput[] = [];
  for (const n of noSas) for (const s of sym) for (const a of audio) for (const r of [true, false]) for (const y of [true, false]) {
    all.push({ noSas: n, symptoms: s, audio: a, redFlagPresent: r, isSynthetic: y });
  }
  it('covers 384 combinations', () => expect(all).toHaveLength(384));
  it('no ok/green/low state, always not-a-diagnosis, no score field', () => {
    for (const i of all) {
      const s = evaluate(i);
      expect(['discuss-with-clinician', 'inconclusive', 'not-enough-information']).toContain(s.conclusion);
      expect(s.uncertaintyNotes).toContain(DISCLAIMER_NOT_DIAGNOSIS);
      for (const it of s.items) {
        expect(['present', 'absent-unreliable', 'inconclusive', 'missing', 'conflict']).toContain(it.state);
      }
      expect(JSON.stringify(s)).not.toMatch(/"(ok|green|low|probability|score|severity)"|all clear|low risk/i);
    }
  });
  it('audio never downgrades the conclusion, compared against every other audio state', () => {
    const rank = { 'not-enough-information': 0, inconclusive: 1, 'discuss-with-clinician': 2 } as const;
    const r = (i: RulesInput, a: AudioEvidenceState) => rank[evaluate({ ...i, audio: a }).conclusion];
    for (const i of all) {
      const snore = r(i, 'usableSnoreLikeObserved');
      for (const other of audio) {
        expect(snore).toBeGreaterThanOrEqual(r(i, other)); // a snore-like observation never lowers anything
        if (other !== 'usableSnoreLikeObserved') expect(r(i, other)).toBe(r(i, 'notProvided')); // quiet, missing, unusable: never lower or higher
      }
    }
  });
  it('every conclusion is reachable', () => {
    expect(new Set(all.map((i) => evaluate(i).conclusion)).size).toBe(3);
  });
});

describe('audioStateFrom', () => {
  const a = (o: Partial<AudioAnalysis>): AudioAnalysis => ({ ...demoCase.audio, ...o });
  it('maps analyses', () => {
    expect(audioStateFrom(null)).toBe('notProvided');
    expect(audioStateFrom(a({ status: 'error' }))).toBe('unusable');
    expect(audioStateFrom(a({ quality: { ...demoCase.audio.quality, verdict: 'unusable' } }))).toBe('unusable');
    expect(audioStateFrom(a({ modelVersion: null }))).toBe('noModel');
    expect(audioStateFrom(a({ modelVersion: 'v', modelApplicable: false }))).toBe('modelNotApplicable');
    const na = evaluate(mk({ symptoms: 'none', audio: 'modelNotApplicable' }));
    expect(na.items.find((i) => i.id === 'audio')?.limitations.join(' ')).not.toContain('No trained snore model');
    expect(na.items.find((i) => i.id === 'audio')?.limitations.join(' ')).toContain('too limited');
    expect(audioStateFrom(a({ snoreLikeFraction: 0.5 }))).toBe('usableSnoreLikeObserved');
    expect(audioStateFrom(a({ snoreLikeFraction: 0 }))).toBe('usableFewObservations');
  });
});

describe('audioStateFrom with nothing assessable', () => {
  it('a model run with zero assessable windows is not "few observations"', () => {
    expect(audioStateFrom({ ...demoCase.audio, windows: [], snoreLikeFraction: 0 })).toBe('unusable');
  });
});

describe('public sample audio never drives the conclusion', () => {
  const sampleAudio: AudioAnalysis = { ...demoCase.audio, isSynthetic: false, snoreLikeFraction: 0.5 };
  const base = { answers: { height: 170, weight: 60, neck: 35, snoring: false, age: 30, sex: 'female' }, symptoms: { 'loud-snoring': 'never' } as const, redFlag: false, isSynthetic: false };
  it('own audio with snore-like windows triggers rule 3; the same audio as sample does not', () => {
    const own = buildRulesInput(base, sampleAudio, false);
    expect(own.input.audio).toBe('usableSnoreLikeObserved');
    expect(evaluate(own.input, own.context).conclusion).toBe('discuss-with-clinician');
    const smp = buildRulesInput(base, sampleAudio, true);
    expect(smp.input.audio).toBe('notProvided');
    const s = evaluate(smp.input, smp.context);
    expect(s.conclusion).toBe('inconclusive');
    const card = s.items.find((i) => i.id === 'audio');
    expect(card?.isSynthetic).toBe(true);
    expect(card?.detail).toBe(SAMPLE_AUDIO_NOT_USED);
  });
});

describe('demo case (M3 / ER-3)', () => {
  it('yields discuss-with-clinician + the conflict text', () => {
    const symptoms = Object.fromEntries(demoCase.symptoms.map((e) => [e.key, e.frequency]));
    const { input, context } = buildRulesInput(
      { answers: demoCase.screening.answers, symptoms, redFlag: false, isSynthetic: true },
      demoCase.audio,
    );
    expect(input).toMatchObject({ noSas: 'incompleteBelow', symptoms: 'high', audio: 'usableFewObservations' });
    const s = evaluate(input, context);
    expect(s.conclusion).toBe('discuss-with-clinician');
    expect(s.conflicts).toContain(CONFLICT_QUIET_OR_MISSING_AUDIO);
    expect(s.items.every((i) => i.source === 'missing' || i.isSynthetic)).toBe(true);
  });
});
