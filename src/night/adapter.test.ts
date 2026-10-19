import { describe, expect, it } from 'vitest';
import { NO_MODEL_LINE, MODEL_NOT_APPLICABLE, DISCLAIMER_CANNOT_RULE_OUT } from '../content/claims';
import { evaluate } from '../evidence/engine';
import type { ScreeningInputs } from '../evidence/input';
import type { AudioEvidenceState, Conclusion, NoSasState, RulesInput, SymptomBurden } from '../types/evidence';
import { aggregateNights, nightRulesInput, nightStateToAudioEvidence, nightToAudioAnalysis } from './adapter';
import { buildSampleNightView } from './sample';
import { summarizeNight, type NightView } from './summary';
import { buildNightFromFlags, run } from './testkit';
import type { NightAudioState } from './types';

const ALL_STATES: NightAudioState[] = ['not-recorded', 'not-assessed', 'model-not-applicable', 'no-model', 'few-observations', 'snore-like-observed'];
// NIGHT_MIN_EPISODES (5) stretches of 80 adjacent flagged windows each: well above NIGHT_MIN_EPISODE_SEC.
const flaggedLong = [2000, 6000, 10000, 14000, 18000].flatMap((s) => run(s, 80));

function view(o: Parameters<typeof buildNightFromFlags>[0] = {}): NightView {
  const n = buildNightFromFlags({ flaggedK: flaggedLong, ...o });
  return summarizeNight(n.record, n.epochs, n.schedule);
}
const views = {
  observed: () => view(),
  few: () => view({ flaggedK: run(2000, 3) }),
  short: () => view({ epochs: 100 }),
  bandLimited: () => view({ sampleRateReported: 8000 }),
  noModel: () => view({ modelVersion: null }),
  notRecorded: () => view({ epochs: 0 }),
};

const emptyScreening: ScreeningInputs = { answers: {}, symptoms: {}, redFlag: null, isSynthetic: false };
const highSymptoms: ScreeningInputs = { ...emptyScreening, symptoms: { 'loud-snoring': 'nightly', 'unrefreshing-sleep': 'often' } };
const noSymptoms: ScreeningInputs = { ...emptyScreening, symptoms: { 'loud-snoring': 'never', 'unrefreshing-sleep': 'never' } };

describe('nightStateToAudioEvidence mapping', () => {
  const table: [NightAudioState, AudioEvidenceState][] = [
    ['not-recorded', 'notProvided'],
    ['not-assessed', 'unusable'],
    ['model-not-applicable', 'modelNotApplicable'],
    ['no-model', 'noModel'],
    ['few-observations', 'usableFewObservations'],
    ['snore-like-observed', 'usableSnoreLikeObserved'],
  ];
  for (const [from, to] of table) it(`${from} -> ${to}`, () => expect(nightStateToAudioEvidence(from)).toBe(to));
  it('is total over NightAudioState', () => {
    expect(new Set(ALL_STATES.map(nightStateToAudioEvidence)).size).toBe(ALL_STATES.length);
  });
});

describe('summary -> real-night state mapping', () => {
  it('long snore-like night -> usableSnoreLikeObserved', () => {
    expect(nightRulesInput(noSymptoms, [views.observed()]).input.audio).toBe('usableSnoreLikeObserved');
  });
  it('quiet night -> usableFewObservations (non-reassuring wording kept)', () => {
    const r = nightRulesInput(noSymptoms, [views.few()]);
    expect(r.input.audio).toBe('usableFewObservations');
    const s = evaluate(r.input, r.context);
    const audio = s.items.find((i) => i.id === 'audio');
    expect(audio?.state).toBe('absent-unreliable');
    expect(audio?.limitations).toContain(DISCLAIMER_CANNOT_RULE_OUT);
    expect(s.conclusion).not.toBe('discuss-with-clinician');
  });
  it('short, interrupted, noisy or silent night -> unusable', () => {
    expect(nightRulesInput(noSymptoms, [views.short()]).input.audio).toBe('unusable');
    const clipped = view({ clipSamplesPerEpoch: 40000 });
    expect(nightRulesInput(noSymptoms, [clipped]).input.audio).toBe('unusable');
    const silent = view({ lvl: { p10: -120, p50: -120, p90: -110 } });
    expect(nightRulesInput(noSymptoms, [silent]).input.audio).toBe('unusable');
  });
  it('band-limited night -> modelNotApplicable, with the existing explanation', () => {
    const r = nightRulesInput(noSymptoms, [views.bandLimited()]);
    expect(r.input.audio).toBe('modelNotApplicable');
    expect(r.analysis?.modelApplicable).toBe(false);
    expect(r.analysis?.limitations).toContain(MODEL_NOT_APPLICABLE);
    expect(r.analysis?.windows).toEqual([]);
  });
  it('capture-only build -> noModel, with the existing line', () => {
    const r = nightRulesInput(noSymptoms, [views.noModel()]);
    expect(r.input.audio).toBe('noModel');
    expect(evaluate(r.input, r.context).items.find((i) => i.id === 'audio')?.limitations).toContain(NO_MODEL_LINE);
  });
  it('no recording -> notProvided', () => {
    expect(nightRulesInput(noSymptoms, [views.notRecorded()]).input.audio).toBe('notProvided');
    expect(nightRulesInput(noSymptoms, []).input.audio).toBe('notProvided');
  });
});

describe('nightToAudioAnalysis', () => {
  it('lists only scored windows, with unscored counted separately and never listed', () => {
    const v = view({ flaggedK: run(2000, 80), scoredOnlyK: run(3000, 40), belowGatePerEpoch: 30, tooQuietPerEpoch: 5 });
    const a = nightToAudioAnalysis(v);
    expect(a.windows.length).toBe(v.summary.assessableWindows);
    expect(a.windows.filter((w) => w.snoreLike).length).toBe(v.summary.snoreLikeWindows);
    expect(a.quietWindowCount).toBe(v.summary.unscoredWindows.tooQuiet + v.summary.unscoredWindows.belowGate);
    expect(a.quietGaps).toEqual([]);
    expect(a.loudness).toEqual([]);
    expect(a.isSynthetic).toBe(false);
  });
  it('window times are consistent with the 0.5 s grid', () => {
    const a = nightToAudioAnalysis(view({ flaggedK: run(100, 6) }));
    expect(a.windows[0]).toMatchObject({ t0: 50, t1: 51, snoreLike: true });
  });
  it('a not-assessed night reports unusable quality and no windows', () => {
    const a = nightToAudioAnalysis(views.short());
    expect(a.quality.verdict).toBe('unusable');
    expect(a.windows).toEqual([]);
    expect(a.snoreLikeFraction).toBe(0);
  });
  it('a not-recorded night is idle', () => expect(nightToAudioAnalysis(views.notRecorded()).status).toBe('idle'));
});

describe('audio never downgrades (property-style, engine inputs x all night states)', () => {
  const noSas: NoSasState[] = ['atOrAbove', 'below', 'incompleteBelow', 'notAnswered'];
  const symptoms: SymptomBurden[] = ['high', 'some', 'none', 'notAnswered'];
  const rank: Record<Conclusion, number> = { 'not-enough-information': 0, inconclusive: 1, 'discuss-with-clinician': 2 };
  it('for every combination, any night state yields a conclusion at least as strong as no audio', () => {
    let checked = 0;
    for (const n of noSas) for (const s of symptoms) for (const red of [false, true]) for (const state of ALL_STATES) {
      const base: RulesInput = { noSas: n, symptoms: s, redFlagPresent: red, audio: 'notProvided', isSynthetic: false };
      const withNight: RulesInput = { ...base, audio: nightStateToAudioEvidence(state) };
      expect(rank[evaluate(withNight).conclusion]).toBeGreaterThanOrEqual(rank[evaluate(base).conclusion]);
      checked++;
    }
    expect(checked).toBe(4 * 4 * 2 * 6);
  });
  it('only snore-like-observed can raise inconclusive to discuss-with-clinician', () => {
    for (const state of ALL_STATES) {
      const base: RulesInput = { noSas: 'below', symptoms: 'none', redFlagPresent: false, audio: 'notProvided', isSynthetic: false };
      const c = evaluate({ ...base, audio: nightStateToAudioEvidence(state) }).conclusion;
      expect(c).toBe(state === 'snore-like-observed' ? 'discuss-with-clinician' : 'inconclusive');
    }
  });
  it('through nightRulesInput: high symptoms stay discuss-with-clinician for every night kind', () => {
    for (const mk of Object.values(views)) {
      const r = nightRulesInput(highSymptoms, [mk()]);
      expect(evaluate(r.input, r.context).conclusion).toBe('discuss-with-clinician');
    }
  });
  it('through nightRulesInput: a quiet or unusable night never yields a conclusion stronger than the screening alone, nor a reassuring one', () => {
    for (const mk of [views.few, views.short, views.bandLimited, views.noModel, views.notRecorded]) {
      const r = nightRulesInput(noSymptoms, [mk()]);
      expect(evaluate(r.input, r.context).conclusion).toBe('inconclusive');
    }
  });
});

describe('multi-night aggregation', () => {
  const n = (nightState: NightAudioState, isSynthetic = false) => ({ nightState, isSynthetic });
  it('one observed night among quiet ones gives usableSnoreLikeObserved; recurring needs two', () => {
    const a = aggregateNights([n('few-observations'), n('snore-like-observed'), n('few-observations')]);
    expect(a.audioState).toBe('usableSnoreLikeObserved');
    expect(a.recurring).toBe(false);
    expect(aggregateNights([n('snore-like-observed'), n('snore-like-observed')]).recurring).toBe(true);
  });
  it('all quiet nights stay usableFewObservations (no reassurance state exists)', () => {
    expect(aggregateNights([n('few-observations'), n('few-observations')]).audioState).toBe('usableFewObservations');
  });
  it('not-assessed nights do not dilute and do not count as quiet', () => {
    expect(aggregateNights([n('not-assessed'), n('few-observations')]).audioState).toBe('usableFewObservations');
    expect(aggregateNights([n('not-assessed'), n('not-assessed')]).audioState).toBe('unusable');
  });
  it('not-recorded nights are ignored; no real nights is notProvided', () => {
    expect(aggregateNights([n('not-recorded')]).audioState).toBe('notProvided');
    expect(aggregateNights([]).audioState).toBe('notProvided');
  });
  it('no-model and model-not-applicable fall through in that order', () => {
    expect(aggregateNights([n('no-model'), n('model-not-applicable')]).audioState).toBe('noModel');
    expect(aggregateNights([n('model-not-applicable')]).audioState).toBe('modelNotApplicable');
  });
  it('multi-night through nightRulesInput picks the aggregate state', () => {
    const r = nightRulesInput(noSymptoms, [views.few(), views.observed(), views.short()]);
    expect(r.input.audio).toBe('usableSnoreLikeObserved');
    expect(r.aggregate.observedNights).toBe(1);
    expect(r.aggregate.notAssessedNights).toBe(1);
  });
});

describe('sample isolation', () => {
  it('sample night views are synthetic everywhere', () => {
    for (const v of ['snore-episodes', 'quiet'] as const) {
      const sv = buildSampleNightView(v);
      expect(sv.summary.isSynthetic).toBe(true);
      expect(sv.record.isSynthetic).toBe(true);
      expect(nightToAudioAnalysis(sv).isSynthetic).toBe(true);
    }
  });
  it('a sample-only history never drives the conclusion (audio notProvided, flagged as sample)', () => {
    const sv = buildSampleNightView('snore-episodes');
    expect(sv.summary.nightState).toBe('snore-like-observed'); // shown...
    const r = nightRulesInput(noSymptoms, [sv]);
    expect(r.input.audio).toBe('notProvided'); // ...but not used
    expect(r.context.audioIsSample).toBe(true);
    expect(r.aggregate.sampleOnly).toBe(true);
    const s = evaluate(r.input, r.context);
    expect(s.conclusion).toBe('inconclusive');
    const audioItem = s.items.find((i) => i.id === 'audio');
    expect(audioItem?.isSynthetic).toBe(true);
  });
  it('a sample night alongside a real night is excluded from the aggregate', () => {
    const sv = buildSampleNightView('snore-episodes');
    const r = nightRulesInput(noSymptoms, [sv, views.few()]);
    expect(r.input.audio).toBe('usableFewObservations');
    expect(r.aggregate.sampleNights).toBe(1);
    expect(r.context.audioIsSample).not.toBe(true);
  });
  it('sample first or last gives identical results', () => {
    const a = nightRulesInput(noSymptoms, [buildSampleNightView(), views.observed()]);
    const b = nightRulesInput(noSymptoms, [views.observed(), buildSampleNightView()]);
    expect(a.input).toEqual(b.input);
  });
  it('a sample night cannot raise the conclusion for any screening', () => {
    for (const sc of [emptyScreening, noSymptoms]) {
      const without = evaluate(nightRulesInput(sc, []).input).conclusion;
      const withSample = nightRulesInput(sc, [buildSampleNightView('snore-episodes')]);
      expect(evaluate(withSample.input, withSample.context).conclusion).toBe(without);
    }
  });
});
