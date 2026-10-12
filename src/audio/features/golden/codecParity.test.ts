import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { frameLogMel, resampleTo16k } from '../index';
import { CODEC_TOLERANCE, FIXTURE_RATE, MAX_LAG_16K, alignOffset, codecFeatures, fixtureSignal, meanAbsDiff, type CodecExpected } from './codecParity';

const ref16 = () => resampleTo16k(fixtureSignal(), FIXTURE_RATE);

describe('alignOffset', () => {
  it('recovers known decoder delays (positive and negative)', () => {
    const ref = ref16();
    for (const d of [0, 1, 576, 1105, 2112, -37]) {
      const dec = new Float32Array(ref.length + 5000);
      for (let i = 0; i < ref.length; i++) {
        const j = i + d;
        if (j >= 0 && j < dec.length) dec[j] = ref[i] as number;
      }
      expect(alignOffset(ref, dec)).toBe(d);
    }
  }, 60000);
  it('stays within the search range', () => {
    expect(Math.abs(alignOffset(ref16(), ref16()))).toBeLessThanOrEqual(MAX_LAG_16K);
  });
});

describe('compressed fixtures', () => {
  const dir = join(__dirname, 'fixtures');
  const { expected } = JSON.parse(readFileSync(join(dir, 'expected.json'), 'utf8')) as { expected: CodecExpected[] };
  const clean = frameLogMel(ref16().subarray(8000, 24000));
  it('has mp3 and m4a files', () => {
    for (const f of ['parity.mp3', 'parity.m4a']) expect(readFileSync(join(dir, f)).length).toBeGreaterThan(1000);
  });
  for (const e of expected) {
    it(`${e.format}: stored features recompute and are close to the uncompressed signal`, () => {
      expect(e.values).toHaveLength(4000);
      // delayed copy of the clean signal must align back and reproduce features
      const delayed = new Float32Array(fixtureSignal().length + 1500);
      delayed.set(fixtureSignal(), 1500);
      const r = codecFeatures(delayed, FIXTURE_RATE);
      expect(Math.abs(r.lag - Math.round((1500 * 16000) / FIXTURE_RATE))).toBeLessThanOrEqual(1);
      expect(meanAbsDiff(r.values, clean)).toBeLessThan(0.05);
      expect(meanAbsDiff(e.values, clean)).toBeLessThan(CODEC_TOLERANCE);
    });
  }
});
