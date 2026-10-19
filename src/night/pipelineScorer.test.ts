import { describe, expect, it, vi } from 'vitest';
import { YAMNET_PATCH_SAMPLES, type WindowScorer } from '../audio/yamnet/scorer';
import { decodeBits } from './codec';
import { WINDOWS_PER_EPOCH } from './constants';
import { createNightPipeline, type WindowDebug } from './pipeline';
import { V3_OPERATING_POINT, kofnConfirm } from './operatingPoint';
import { chunks, concat, noiseAt, silence } from './testkit';
import type { EpochRecord } from './types';

// The pipeline also computes the v1 spectral frames for the speech cue, so a few minutes of audio take a while on a loaded machine.
vi.setConfig({ testTimeout: 120_000 });

/** Scorer whose output is looked up by the window index implied by the patch's first sample, so tests control which windows are "snore-like". */
function fakeScorer(flagWindows: ReadonlySet<number>, opts: { failFrom?: number } = {}): WindowScorer & { calls: number } {
  const s = {
    version: 'fake-scorer-0',
    flagThreshold: V3_OPERATING_POINT.headThreshold,
    calls: 0,
    score(patch: Float32Array): number {
      if (patch.length !== YAMNET_PATCH_SAMPLES) throw new Error('bad patch');
      s.calls++;
      // The test signal encodes the window index in sample 0 of the patch: see encodedNight().
      const k = Math.round((patch[0] as number) * 1e5);
      if (opts.failFrom !== undefined && k >= opts.failFrom) throw new Error('runtime failure');
      return flagWindows.has(k) ? 0.99 : 0.1;
    },
  };
  return s;
}

/** Loud-enough noise (passes the level gate) with every window's patch start tagged with its index: sample (k*8000 + 200) = k * 1e-5. */
function encodedNight(seconds: number): Float32Array {
  const x = noiseAt(seconds, -30, 5);
  for (let k = 0; k * 8000 + 200 < x.length; k++) x[k * 8000 + 200] = k * 1e-5;
  return x;
}

function runWith(x: Float32Array, scorer: WindowScorer | null, extra: { chunk?: number; gate?: boolean; onWindow?: (w: WindowDebug) => void } = {}) {
  // gate: false scores every window above the silence floor (steady test noise would otherwise sit at its own rolling floor and never pass the +GATE_DB gate).
  const p = createNightPipeline({ model: null, scorer, captureStartMs: 0, gate: extra.gate ?? false, ...(extra.onWindow ? { onWindow: extra.onWindow } : {}) });
  const epochs: EpochRecord[] = [];
  for (const c of chunks(x, extra.chunk ?? 16000)) epochs.push(...p.push(c, 16000));
  epochs.push(...p.finish('user-stop').epochs);
  return { epochs, p };
}

function confirmedWindows(epochs: EpochRecord[]): number[] {
  const out: number[] = [];
  for (const e of epochs) {
    if (e.win.scored === 0) continue;
    const mask = decodeBits(e.scoredMask, WINDOWS_PER_EPOCH);
    const flags = decodeBits(e.snoreBits, e.win.scored);
    let q = 0;
    for (let j = 0; j < WINDOWS_PER_EPOCH; j++) if (mask[j]) out.push(flags[q++] ? e.i * WINDOWS_PER_EPOCH + j : -1);
  }
  return out.filter((v) => v >= 0);
}

describe('night pipeline with a YAMNet window scorer', () => {
  // 3 minutes: 6 epochs. Flagged windows include a pair that crosses an epoch boundary (59, 61), a lone window (150) and a pair 20 windows apart (200, 220).
  const flagged = new Set([40, 41, 42, 59, 61, 150, 200, 220, 300, 301]);
  const x = encodedNight(180);

  it('confirms k-of-n windows exactly as operatingPoint.kofnConfirm, including across epoch boundaries', () => {
    const { epochs } = runWith(x, fakeScorer(flagged));
    expect(confirmedWindows(epochs)).toEqual(kofnConfirm(Array.from(flagged)));
    expect(confirmedWindows(epochs)).toContain(59); // confirmed by 61 in the NEXT epoch: needs the delayed close
    expect(confirmedWindows(epochs)).not.toContain(150);
    expect(confirmedWindows(epochs)).not.toContain(200);
  });
  it('is independent of chunk size', () => {
    const a = runWith(x, fakeScorer(flagged), { chunk: 16000 }).epochs;
    const b = runWith(x, fakeScorer(flagged), { chunk: 6001 }).epochs;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it('closes the same number of epochs, in order, as the v1 path', () => {
    const { epochs } = runWith(x, fakeScorer(flagged));
    expect(epochs.map((e) => e.i)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(epochs[0]!.win.scored).toBeGreaterThan(50);
  });
  it('counts snoreLike from confirmed windows only', () => {
    const { epochs } = runWith(x, fakeScorer(flagged));
    expect(epochs.reduce((a, e) => a + e.win.snoreLike, 0)).toBe(kofnConfirm(Array.from(flagged)).length);
  });
  it('does not call the scorer on windows that fail the level gate (energy pre-gate)', () => {
    const quiet = concat([silence(30), noiseAt(30, -90, 3), noiseAt(30, -30, 4)]);
    const sc = fakeScorer(new Set());
    const { epochs } = runWith(quiet, sc, { gate: true });
    const total = epochs.reduce((a, e) => a + e.win.scored, 0);
    expect(sc.calls).toBe(total);
    expect(total).toBeLessThan(quiet.length / 8000); // far fewer than all windows
    expect(epochs[0]!.win.tooQuiet).toBeGreaterThan(0);
  });
  it('windows on which the scorer throws are counted as not analysed (skipped), never as scored or "no snore"', () => {
    const sc = fakeScorer(new Set([10]), { failFrom: 100 });
    const { epochs, p } = runWith(x, sc);
    expect(p.scorerFailureCount()).toBeGreaterThan(100);
    const e3 = epochs[3]!; // windows 180..239 all fail
    expect(e3.win.scored).toBe(0);
    expect(e3.overload).toBeGreaterThan(50);
  });
  it('without a scorer and without a model nothing is scored (unchanged capture-only behaviour)', () => {
    const { epochs } = runWith(x, null);
    expect(epochs.reduce((a, e) => a + e.win.scored, 0)).toBe(0);
  });
});
