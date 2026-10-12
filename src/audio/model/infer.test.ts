import { describe, expect, it } from 'vitest';
import type { ModelJson } from './schema';
import { FEATURE_DIM, loadShippedModel, rmsDbfs, scoreFeatures, windowFeatures } from './infer';

const models = import.meta.glob('./model.json', { eager: true, import: 'default' });
const fixtures = import.meta.glob('./infer.fixture.json', { eager: true, import: 'default' });
const model = Object.values(models)[0] as ModelJson | undefined;
const fixture = Object.values(fixtures)[0] as { features: number[]; expected: number }[] | undefined;

describe('windowFeatures / rmsDbfs', () => {
  it('computes per-band mean then std', () => {
    const lm = new Float32Array(100 * 40);
    for (let f = 0; f < 100; f++) for (let b = 0; b < 40; b++) lm[f * 40 + b] = f % 2 ? b + 1 : b - 1;
    const v = windowFeatures(lm);
    expect(v.length).toBe(FEATURE_DIM);
    expect(v[5]).toBeCloseTo(5, 9);
    expect(v[45]).toBeCloseTo(1, 9);
  });
  it('rmsDbfs of full-scale square is about 0 and silence is -120', () => {
    expect(rmsDbfs(new Float32Array(100).fill(1))).toBeCloseTo(0, 9);
    expect(rmsDbfs(new Float32Array(100))).toBe(-120);
  });
});

describe('model availability', () => {
  it('loadShippedModel agrees with whether model.json exists', () => {
    const m = loadShippedModel();
    if (model) expect(m?.weightsHash).toBe(model.weightsHash);
    else expect(m).toBeNull();
  });
});

describe.skipIf(!model || !fixture)('parity with training-side predictions', () => {
  it('matches within 1e-6', () => {
    for (const f of fixture!) expect(Math.abs(scoreFeatures(model!, f.features) - f.expected)).toBeLessThan(1e-6);
  });
  it('model.json has the expected structure', () => {
    expect(model!.norm.mean).toHaveLength(FEATURE_DIM);
    expect(model!.layers.at(-1)!.activation).toBe('sigmoid');
    expect(model!.weightsHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
