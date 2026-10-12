import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { YAMNET_EMBEDDING_DIM, YAMNET_NUM_CLASSES, averageEmbeddings, isSnoreLike, scoreEmbedding, scoresToLogits, validateHead, type YamnetHeadModel } from './head';

const modelDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'model');
const model = JSON.parse(readFileSync(join(modelDir, 'model.v3.json'), 'utf8')) as YamnetHeadModel;
const fixture = JSON.parse(readFileSync(join(modelDir, 'head.v3.fixture.json'), 'utf8')) as { input: number[]; expected: number }[];

const tiny = (over: Partial<YamnetHeadModel> = {}): YamnetHeadModel => ({
  ...model,
  input: { ...model.input, kind: 'embedding', dim: YAMNET_EMBEDDING_DIM },
  norm: { mean: new Array<number>(YAMNET_EMBEDDING_DIM).fill(0), std: new Array<number>(YAMNET_EMBEDDING_DIM).fill(1) },
  layers: [{ type: 'dense', weights: [new Array<number>(YAMNET_EMBEDDING_DIM).fill(0).map((_, i) => (i === 0 ? 1 : 0))], bias: [0], activation: 'sigmoid' }],
  threshold: 0.5,
  ...over,
});

describe('YAMNet head (v3) exported model', () => {
  it('is structurally valid and labelled honestly', () => {
    expect(validateHead(model)).toEqual([]);
    expect(model.schema).toBe('sleepsmooth-yamnet-head/1');
    expect(['shipped', 'candidate-not-shipped']).toContain(model.status);
    expect(model.licenses.trainingData).toMatch(/non-commercial/i);
    expect(model.weightsHash).toMatch(/^[0-9a-f]{64}$/);
  });
  it('weightsHash reproduces from norm + layers + threshold', () => {
    const h = createHash('sha256').update(JSON.stringify({ norm: model.norm, layers: model.layers, threshold: model.threshold })).digest('hex');
    expect(h).toBe(model.weightsHash);
  });
  it('matches the training-side (Python, float64) reference scores within 1e-9', () => {
    expect(fixture.length).toBeGreaterThanOrEqual(10);
    for (const f of fixture) expect(Math.abs(scoreEmbedding(model, f.input) - f.expected)).toBeLessThan(1e-9);
  });
  it('input spec is consistent with the model', () => {
    expect(model.input.dim).toBe(model.input.kind === 'embedding' ? YAMNET_EMBEDDING_DIM : YAMNET_NUM_CLASSES);
    expect(fixture[0]!.input).toHaveLength(model.input.dim);
  });
  it('scores are in [0, 1]', () => {
    for (const f of fixture) {
      const s = scoreEmbedding(model, f.input);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });
});

describe('scoreEmbedding / helpers', () => {
  it('computes sigmoid of the first (standardised) component for a hand-built head', () => {
    const m = tiny();
    const e = new Array<number>(YAMNET_EMBEDDING_DIM).fill(0);
    e[0] = 2;
    expect(scoreEmbedding(m, e)).toBeCloseTo(1 / (1 + Math.exp(-2)), 12);
    expect(isSnoreLike(m, scoreEmbedding(m, e))).toBe(true);
    e[0] = -2;
    expect(isSnoreLike(m, scoreEmbedding(m, e))).toBe(false);
  });
  it('scoresToLogits clips and inverts the sigmoid', () => {
    const l = scoresToLogits([0, 1, 0.5, 1 / (1 + Math.exp(-2))]);
    expect(l[0]).toBeCloseTo(Math.log(1e-6 / (1 - 1e-6)), 9);
    expect(l[1]).toBeCloseTo(-l[0]!, 9);
    expect(l[2]).toBeCloseTo(0, 12);
    expect(l[3]).toBeCloseTo(2, 9);
  });
  it('rejects wrong length and non-finite input', () => {
    expect(() => scoreEmbedding(tiny(), new Array<number>(10).fill(0))).toThrow(/length/);
    const bad = new Array<number>(YAMNET_EMBEDDING_DIM).fill(0);
    bad[3] = Number.NaN;
    expect(() => scoreEmbedding(tiny(), bad)).toThrow(/non-finite/);
  });
  it('validateHead reports a bad shape', () => {
    const m = tiny({ layers: [{ type: 'dense', weights: [[1, 2, 3]], bias: [0], activation: 'sigmoid' }] });
    expect(validateHead(m).join(' ')).toMatch(/input width/);
    expect(validateHead(tiny({ layers: [] }))).toContain('no layers');
  });
  it('averageEmbeddings averages frames and returns null for none', () => {
    expect(averageEmbeddings([])).toBeNull();
    const a = new Array<number>(YAMNET_EMBEDDING_DIM).fill(1);
    const b = new Array<number>(YAMNET_EMBEDDING_DIM).fill(3);
    const avg = averageEmbeddings([a, b])!;
    expect(avg[0]).toBe(2);
    expect(avg[YAMNET_EMBEDDING_DIM - 1]).toBe(2);
    expect(() => averageEmbeddings([[1, 2]])).toThrow(/length/);
  });
});
