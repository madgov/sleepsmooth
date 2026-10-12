import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeAudio } from './analyze';
import { assessModelApplicability, BandwidthEstimator, MODEL_NOT_APPLICABLE_REASON } from './bandwidth';
import { SAMPLE_RATE, SILENCE_FLOOR_DBFS } from './constants';
import { frameLogMel } from './features';
import { lcgNoise } from './features/golden/goldenCases';
import { resampleAll } from './features/resample';
import { createModelHook, shippedModelHook } from './modelHook';
import { isSnoreLike, loadShippedModel, rmsDbfs, scoreFeatures, windowFeatures } from './model/infer';
import { parseWav } from './testing/wav';
import { audioStateFrom } from '../evidence/audioState';
import { buildRulesInput } from '../evidence/input';
import { evaluate } from '../evidence/engine';
import { CONFLICT_QUIET_OR_MISSING_AUDIO } from '../content/claims';

const fast = { yieldToEventLoop: () => Promise.resolve() };
const dir = join(process.cwd(), 'public/sample-audio');
const wav = parseWav(readFileSync(join(dir, 'esc50-sample.wav')));
const segments = JSON.parse(readFileSync(join(dir, 'esc50-sample.segments.json'), 'utf8')) as { start: number; end: number; cls: string }[];
const model = loadShippedModel();
const fixtures = import.meta.glob('./model/infer.fixture.json', { eager: true, import: 'default' });
const fixture = Object.values(fixtures)[0] as { features: number[]; expected: number }[] | undefined;

/** Round trip through 8 kHz sampling: the phone-call-quality proxy used in the model card. */
const toEightKhz = (x: Float32Array) => resampleAll(resampleAll(x, SAMPLE_RATE * 2), SAMPLE_RATE / 2);
const bandLimited = resampleAll(toEightKhz(wav.samples), SAMPLE_RATE / 2);

describe.skipIf(!model)('shipped model on the ESC-50 sample (integration)', () => {
  it('flags windows inside snoring segments and few elsewhere', async () => {
    const r = await analyzeAudio(wav.samples, wav.sampleRate, { ...fast, inference: shippedModelHook() });
    expect(r.modelVersion).toBe(model!.version);
    expect(r.modelApplicable).toBe(true);
    const inside = (w: { t0: number; t1: number }, s: { start: number; end: number }) => w.t0 >= s.start && w.t1 <= s.end;
    const flagged = r.windows.filter((w) => w.snoreLike);
    const inSnoring = flagged.filter((w) => segments.some((s) => s.cls === 'snoring' && inside(w, s)));
    const inOther = flagged.filter((w) => segments.some((s) => s.cls !== 'snoring' && s.cls !== 'silence_gap' && inside(w, s)));
    expect(inSnoring.length).toBeGreaterThanOrEqual(8);
    expect(inOther.length).toBeLessThanOrEqual(4);
    expect(inSnoring.length).toBeGreaterThan(inOther.length * 3);
    // Too-quiet windows are excluded from the denominator, never counted as "no snore".
    expect(r.quietWindowCount).toBeGreaterThan(0);
    expect(r.snoreLikeFraction).toBeCloseTo(flagged.length / r.windows.length, 12);
    for (const w of r.windows) expect(rmsDbfs(wav.samples, Math.round(w.t0 * SAMPLE_RATE), SAMPLE_RATE)).toBeGreaterThanOrEqual(SILENCE_FLOOR_DBFS);
    expect(r.windows.length + r.quietWindowCount).toBe(Math.floor((wav.samples.length - SAMPLE_RATE) / (SAMPLE_RATE / 2)) + 1);
  }, 60000);

  it('parity: analyzer path equals direct inference, and fixture decisions agree', async () => {
    const r = await analyzeAudio(wav.samples, wav.sampleRate, { ...fast, inference: shippedModelHook() });
    for (const w of r.windows.filter((_, i) => i % 7 === 0)) {
      const s = Math.round(w.t0 * SAMPLE_RATE);
      const direct = scoreFeatures(model!, windowFeatures(frameLogMel(wav.samples.subarray(s, s + SAMPLE_RATE))));
      expect(Math.abs(direct - w.score)).toBeLessThan(1e-9);
      expect(w.snoreLike).toBe(isSnoreLike(model!, direct));
    }
    if (fixture) for (const f of fixture) expect(Math.abs(scoreFeatures(model!, f.features) - f.expected)).toBeLessThan(1e-6);
  }, 60000);

  it('chunked hook output matches a single-chunk run', () => {
    const hook = createModelHook(model!);
    const one = hook.run(wav.samples, 0) as { t0: number; score: number }[];
    const first = hook.run(wav.samples.subarray(0, 31 * SAMPLE_RATE), 0) as { t0: number; score: number }[];
    expect(first.length).toBeGreaterThan(0);
    for (const w of first) expect(one.find((o) => o.t0 === w.t0)?.score).toBeCloseTo(w.score, 12);
  }, 30000);
});

describe.skipIf(!model)('bandwidth check', () => {
  it('estimates a high bandwidth for the full-band sample and marks the model applicable', () => {
    const e = new BandwidthEstimator();
    e.add(wav.samples);
    expect(e.bandwidthHz()).toBeGreaterThanOrEqual(6000);
    expect(assessModelApplicability(48000, e.bandwidthHz()).applicable).toBe(true);
  }, 30000);

  it('band-limited (8 kHz) audio: model not applicable, no observations, never reassuring', async () => {
    const e = new BandwidthEstimator();
    e.add(bandLimited);
    expect(e.bandwidthHz()).toBeLessThan(5000);
    const r = await analyzeAudio(bandLimited, SAMPLE_RATE, { ...fast, inference: shippedModelHook() });
    expect(r.modelApplicable).toBe(false);
    expect(r.windows).toEqual([]);
    expect(r.snoreLikeFraction).toBe(0);
    expect(r.modelVersion).toBe(model!.version);
    expect(r.limitations).toContain(MODEL_NOT_APPLICABLE_REASON);
    expect(r.quality.reasons).toContain(MODEL_NOT_APPLICABLE_REASON);
    expect(audioStateFrom(r)).toBe('modelNotApplicable');
    // High symptom burden: the engine adds the "cannot rule out" conflict and the recording is inconclusive.
    const high = buildRulesInput({ answers: {}, symptoms: { 'loud-snoring': 'nightly', 'unrefreshing-sleep': 'often' }, redFlag: null, isSynthetic: false }, r);
    const ev = evaluate(high.input, high.context);
    expect(ev.items.find((i) => i.id === 'audio')?.state).toBe('inconclusive');
    expect(ev.conclusion).toBe('discuss-with-clinician');
    expect(ev.conflicts).toContain(CONFLICT_QUIET_OR_MISSING_AUDIO);
    // No symptoms or answers: never an all-clear.
    const none = buildRulesInput({ answers: {}, symptoms: {}, redFlag: null, isSynthetic: false }, r);
    expect(evaluate(none.input, none.context).items.find((i) => i.id === 'audio')?.state).toBe('inconclusive');
  }, 60000);

  it('a source sampling rate below 16 kHz is not applicable even before looking at the spectrum', async () => {
    expect(assessModelApplicability(8000, 7000).applicable).toBe(false);
    expect(assessModelApplicability(44100, 4200).applicable).toBe(false);
    const noise = lcgNoise(8000 * 60, 3).map((v) => v * 0.2);
    const r = await analyzeAudio(Float32Array.from(noise), 8000, { ...fast, inference: shippedModelHook() });
    expect(r.modelApplicable).toBe(false);
    expect(r.windows).toEqual([]);
  }, 60000);

  it('full-band white noise is applicable', async () => {
    const noise = Float32Array.from(lcgNoise(SAMPLE_RATE * 40, 5), (v) => v * 0.2);
    const r = await analyzeAudio(noise, SAMPLE_RATE, { ...fast, inference: shippedModelHook() });
    expect(r.modelApplicable).toBe(true);
    expect(r.effectiveBandwidthHz).toBeGreaterThan(7000);
    expect(r.windows.length).toBeGreaterThan(0);
  }, 60000);
});

describe('no model in the build (ER-9 analysis side)', () => {
  it('reports modelVersion null, no windows, and noModel', async () => {
    const r = await analyzeAudio(wav.samples, wav.sampleRate, { ...fast, inference: null });
    expect(r.modelVersion).toBeNull();
    expect(r.windows).toEqual([]);
    expect(audioStateFrom(r)).toBe('noModel');
    expect(r.limitations).toContain('No trained snore model is included in this build.');
  }, 30000);
});
