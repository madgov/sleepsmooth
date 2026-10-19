import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { YamnetHeadModel } from './head';
import { YAMNET_PATCH_OFFSET, YAMNET_PATCH_SAMPLES, createYamnetScorer } from './scorer';

const here = dirname(fileURLToPath(import.meta.url));
const head = JSON.parse(readFileSync(join(here, '..', 'model', 'model.v3.json'), 'utf8')) as YamnetHeadModel;
const fx = JSON.parse(readFileSync(join(here, '..', '..', '..', 'scripts', 'yamnet', 'fixtures', 'synthetic_fixtures.json'), 'utf8')) as {
  fixtures: { name: string; expectedTflite: { scores: number[]; headScore: number } }[];
};

describe('YAMNet window scorer', () => {
  it('patch geometry: a 1 s window uses the centred 15,600 samples', () => {
    expect(YAMNET_PATCH_SAMPLES).toBe(15600);
    expect(YAMNET_PATCH_OFFSET).toBe(200);
  });
  // The fixture's class scores are stored rounded to 6 decimals and the head clips at 1e-6, so agreement is checked to 2e-3, not 1e-9.
  it('turns the float-TFLite class scores of the fixtures into the recorded head probabilities', () => {
    expect(fx.fixtures.length).toBeGreaterThanOrEqual(4);
    for (const f of fx.fixtures) {
      const s = createYamnetScorer(() => f.expectedTflite.scores, head, { flagThreshold: 0.98, runtimeLabel: 'test runner' });
      expect(Math.abs(s.score(new Float32Array(YAMNET_PATCH_SAMPLES)) - f.expectedTflite.headScore)).toBeLessThan(2e-3);
    }
  });
  it('records the head version and runtime in the version string', () => {
    const s = createYamnetScorer(() => new Array<number>(521).fill(0.01), head, { flagThreshold: 0.98, runtimeLabel: 'YAMNet float32 TFLite' });
    expect(s.version).toBe(`${head.version} on YAMNet float32 TFLite`);
    expect(s.flagThreshold).toBe(0.98);
  });
  it('rejects a wrong patch length, a wrong output length and non-finite output', () => {
    const ok = createYamnetScorer(() => new Array<number>(521).fill(0.01), head, { flagThreshold: 0.98, runtimeLabel: 'x' });
    expect(() => ok.score(new Float32Array(100))).toThrow(/patch length/);
    const short = createYamnetScorer(() => new Array<number>(520).fill(0.01), head, { flagThreshold: 0.98, runtimeLabel: 'x' });
    expect(() => short.score(new Float32Array(YAMNET_PATCH_SAMPLES))).toThrow(/521/);
    const nan = createYamnetScorer(() => new Array<number>(521).fill(NaN), head, { flagThreshold: 0.98, runtimeLabel: 'x' });
    expect(() => nan.score(new Float32Array(YAMNET_PATCH_SAMPLES))).toThrow(/non-finite/);
  });
  it('refuses a head that is not on class-score logits', () => {
    const emb = { ...head, input: { ...head.input, kind: 'embedding' as const, dim: 1024 } };
    expect(() => createYamnetScorer(() => [], emb, { flagThreshold: 0.98, runtimeLabel: 'x' })).toThrow();
  });
});

describe('start-up self-check tone', () => {
  it('is the same waveform as the exported fixture (within float32 rounding of the generator)', async () => {
    const { selfCheckTone, SELF_CHECK_EXPECTED_HEAD, selfCheckPasses } = await import('./selfCheck');
    const f = (JSON.parse(readFileSync(join(here, '..', '..', '..', 'scripts', 'yamnet', 'fixtures', 'synthetic_fixtures.json'), 'utf8')) as {
      fixtures: { name: string; pcmF32LE_base64: string; expectedTflite: { headScore: number } }[];
    }).fixtures.find((x) => x.name === 'tone-440hz-amp0.3')!;
    const buf = Buffer.from(f.pcmF32LE_base64, 'base64');
    const ref = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
    const mine = selfCheckTone();
    expect(mine.length).toBe(ref.length);
    let maxd = 0;
    for (let i = 0; i < ref.length; i++) maxd = Math.max(maxd, Math.abs((mine[i] as number) - (ref[i] as number)));
    expect(maxd).toBeLessThan(1e-6);
    expect(SELF_CHECK_EXPECTED_HEAD).toBe(f.expectedTflite.headScore);
    expect(selfCheckPasses(SELF_CHECK_EXPECTED_HEAD + 0.005)).toBe(true);
    expect(selfCheckPasses(SELF_CHECK_EXPECTED_HEAD + 0.05)).toBe(false);
    expect(selfCheckPasses(NaN)).toBe(false);
  });
});
