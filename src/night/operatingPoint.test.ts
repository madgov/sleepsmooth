import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GATE_DB, NIGHT_EPISODE_MAX_GAP_SEC, NIGHT_EPISODE_MIN_FLAGGED, NIGHT_MIN_EPISODES, NIGHT_MIN_EPISODE_SEC } from './constants';
import { V3_OPERATING_POINT, findSegments, isConfirmed, kofnConfirm } from './operatingPoint';

interface Case {
  name: string;
  flagged: number[];
  N: number;
  K: number;
  M: number;
  confirmed: number[];
  segments: { t0: number; t1: number; n: number; k0: number; k1: number }[];
}
const fx = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'operatingPoint.fixture.json'), 'utf8')) as { cases: Case[] };

describe('operating point: reproduces scripts/eval/night_logic.py', () => {
  it('has the fixture (random, edge and synthetic-night cases)', () => {
    expect(fx.cases.length).toBeGreaterThanOrEqual(100);
  });
  it('k-of-n confirmation and segments match the Python reference on every case', () => {
    let bad = 0;
    for (const c of fx.cases) {
      const conf = kofnConfirm(c.flagged, c.N, c.K);
      const segs = findSegments(conf, c.M, NIGHT_EPISODE_MAX_GAP_SEC).map((s) => ({ t0: s.t0Sec, t1: s.t1Sec, n: s.n, k0: s.k0, k1: s.k1 }));
      if (JSON.stringify(conf) !== JSON.stringify(c.confirmed) || JSON.stringify(segs) !== JSON.stringify(c.segments)) {
        bad++;
        if (bad <= 3) console.log('mismatch', c.name);
      }
    }
    expect(bad).toBe(0);
  });
  it('the fixture contains non-trivial segments (so the comparison is not vacuous)', () => {
    expect(fx.cases.filter((c) => c.segments.length > 0).length).toBeGreaterThan(40);
    expect(fx.cases.filter((c) => c.confirmed.length < c.flagged.length && c.flagged.length > 0).length).toBeGreaterThan(10);
  });
});

describe('operating point: edge behaviour', () => {
  it('is the pre-registered point', () => {
    expect(V3_OPERATING_POINT).toEqual({ headThreshold: 0.98, confirmN: 14, confirmK: 2, minConfirmed: 3 });
  });
  it('the night summary segments exactly like the operating point (episode = segment of >= minConfirmed confirmed windows)', () => {
    expect(NIGHT_EPISODE_MIN_FLAGGED).toBe(V3_OPERATING_POINT.minConfirmed);
  });
  it('night rule and gate are the values chosen by the pre-registered sweeps (docs/EVAL_PROTOCOL.md sections 8 and 8.1)', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'model');
    const gate = JSON.parse(readFileSync(join(root, 'gate_sweep.synthetic.json'), 'utf8')) as { adopted: number };
    const rule = JSON.parse(readFileSync(join(root, 'night_rule_sweep.synthetic.json'), 'utf8')) as { gate: number; chosen: { E: number; S: number } };
    expect(GATE_DB).toBe(gate.adopted);
    expect(rule.gate).toBe(GATE_DB);
    expect(NIGHT_MIN_EPISODES).toBe(rule.chosen.E);
    expect(NIGHT_MIN_EPISODE_SEC).toBe(rule.chosen.S);
  });
  it('a lone flagged window is not confirmed; two within 13 windows are, 14 apart are not', () => {
    expect(kofnConfirm([50])).toEqual([]);
    expect(kofnConfirm([10, 23])).toEqual([10, 23]);
    expect(kofnConfirm([10, 24])).toEqual([]);
  });
  it('isConfirmed needs the window itself to be flagged', () => {
    const f = new Set([10, 12]);
    expect(isConfirmed(11, (j) => f.has(j))).toBe(false);
    expect(isConfirmed(10, (j) => f.has(j))).toBe(true);
  });
  it('findSegments joins gaps of at most 10 s and needs the minimum count', () => {
    expect(findSegments([0, 1, 2, 23, 24, 25], 3, 10)).toHaveLength(1);
    expect(findSegments([0, 1, 2, 24, 25, 26], 3, 10)).toHaveLength(1); // gap exactly 10 s still joins
    expect(findSegments([0, 1, 2, 25, 26, 27], 3, 10)).toHaveLength(2);
    expect(findSegments([0, 1], 3, 10)).toEqual([]);
    expect(findSegments([], 3, 10)).toEqual([]);
  });
});
