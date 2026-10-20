import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RollingFloor, gateTier, spectralFlatness } from './adaptiveGate';

const fx = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'adaptiveGate.fixture.json'), 'utf8')) as {
  flatness: { kind: string; start: number; value: number }[];
  floors: Record<string, number[]>;
};

// Integer recipes identical to scripts/eval/gen_adaptive_gate_fixture.py.
function* lcg(seed: number): Generator<number> {
  let s = seed >>> 0;
  for (;;) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    yield s;
  }
}
function signal(kind: 'white' | 'colored' | 'tonal', n = 24000): Float32Array {
  const g = lcg(777);
  const nz: number[] = [];
  for (let i = 0; i < n; i++) nz.push((((g.next().value as number) >>> 8) & 0xffff) - 32768);
  const x = new Float32Array(n);
  if (kind === 'white') for (let i = 0; i < n; i++) x[i] = Math.floor((nz[i] as number) / 4) / 32768;
  else if (kind === 'colored') {
    for (let i = 0; i + 16 <= n; i++) {
      let s = 0;
      for (let j = 0; j < 16; j++) s += nz[i + j] as number;
      x[i] = Math.floor(s / 4) / 32768;
    }
  } else for (let i = 0; i < n; i++) x[i] = ((Math.floor(i / 40) % 2 === 0 ? 1600 : -1600) + ((nz[i] as number) >> 6)) / 32768;
  return x;
}

describe('adaptive gate: reproduces scripts/eval/adaptive_gate.py', () => {
  it('spectral flatness matches the Python reference', () => {
    const sig = { white: signal('white'), colored: signal('colored'), tonal: signal('tonal') };
    expect(fx.flatness.length).toBe(9);
    for (const f of fx.flatness) {
      const v = spectralFlatness(sig[f.kind as keyof typeof sig], f.start);
      expect(Math.abs(v - f.value)).toBeLessThan(1e-9);
    }
  });
  it('orders flatness sensibly: white noise flat, a square wave far less', () => {
    const w = spectralFlatness(signal('white'), 0);
    const t = spectralFlatness(signal('tonal'), 0);
    expect(w).toBeGreaterThan(0.5);
    expect(t).toBeLessThan(0.5 * w);
  });
  it('rolling floor matches the Python reference for horizons 180, 300 and 600 s', () => {
    const g = lcg(4242);
    const db: number[] = [];
    for (let i = 0; i < 3000; i++) db.push(-80 + ((((g.next().value as number) >>> 8) & 1023) / 1024) * 40);
    for (const R of [180, 300, 600]) {
      const rf = new RollingFloor(R, 0.1, 30, -72);
      const want = fx.floors[String(R)] as number[];
      let bad = 0;
      for (let s = 0; s < db.length; s++) {
        if (rf.current() !== want[s]) bad++;
        rf.add(s, db[s] as number);
      }
      expect(bad).toBe(0);
    }
  });
  it('gateTier: tier 1 above the margin, tier 2 only when quiet-margin AND not flat, never below the silence floor', () => {
    const p = { marginDb: 6, lowMarginDb: 2, flatnessCap: 0.25 };
    let calls = 0;
    const flat = (v: number) => () => {
      calls++;
      return v;
    };
    expect(gateTier(-40, -50, -72, p, flat(0.9))).toBe(1);
    expect(calls).toBe(0); // flatness is not computed for tier-1 windows
    expect(gateTier(-47, -50, -72, p, flat(0.1))).toBe(2);
    expect(gateTier(-47, -50, -72, p, flat(0.9))).toBe(0);
    expect(gateTier(-49, -50, -72, p, flat(0.1))).toBe(0); // below floor + 2
    expect(gateTier(-80, -90, -72, p, flat(0.1))).toBe(0); // under the silence floor
    expect(gateTier(-47, -50, -72, { ...p, lowMarginDb: 6 }, flat(0.1))).toBe(0); // tier 2 disabled
  });
});

import { V1_NIGHT, nightRuleFor, NIGHT_MIN_EPISODES, NIGHT_MIN_EPISODE_SEC } from './constants';
describe('per-model night rule', () => {
  it('v1 has its own rule, everything else the shared one', () => {
    expect(nightRuleFor('sleepsmooth-snore-mlp-esc50-0.1.0')).toEqual({ minEpisodes: V1_NIGHT.minEpisodes, minEpisodeSec: V1_NIGHT.minEpisodeSec });
    expect(nightRuleFor('sleepsmooth-snore-yamnet-logreg_scores-0.3.0')).toEqual({ minEpisodes: NIGHT_MIN_EPISODES, minEpisodeSec: NIGHT_MIN_EPISODE_SEC });
    expect(nightRuleFor(null)).toEqual({ minEpisodes: NIGHT_MIN_EPISODES, minEpisodeSec: NIGHT_MIN_EPISODE_SEC });
  });
});
