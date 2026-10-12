import { describe, expect, it } from 'vitest';
import { analyzeAudio, AnalysisCancelledError } from './analyze';
import { assessQuality } from './quality';
import { findQuietGaps } from './quietGaps';
import { downmixToMono } from './decode';
import { lcgNoise } from './features/golden/goldenCases';
import { SAMPLE_RATE } from './constants';

const fast = { yieldToEventLoop: () => Promise.resolve() };

/** Breath-like noise bursts (4 s cycle) with amplitude `amp`; optional quiet stretch. */
function breathing(rate: number, seconds: number, amp = 0.2, quiet?: [number, number]): Float32Array {
  const n = Math.round(rate * seconds);
  const out = new Float32Array(n);
  const noise = lcgNoise(n, 7);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    let env = 0.1 + 0.9 * Math.max(0, Math.sin((2 * Math.PI * t) / 4)) ** 2;
    if (quiet && t >= quiet[0] && t < quiet[1]) env = 0.005;
    out[i] = amp * env * ((noise[i] as number) * 0.5 + 0.5 * Math.sin(2 * Math.PI * 120 * t));
  }
  return out;
}

describe('quality', () => {
  const tone = (secs: number, amp: number) => {
    const x = new Float32Array(SAMPLE_RATE * secs);
    for (let i = 0; i < x.length; i++) x[i] = amp * Math.sin((2 * Math.PI * 300 * i) / SAMPLE_RATE);
    return x;
  };
  it('usable for a normal long recording', () => {
    const q = assessQuality(breathing(SAMPLE_RATE, 300, 0.3));
    expect(q.verdict).toBe('usable');
    expect(q.clippingPct).toBe(0);
    expect(q.reasons).toEqual([]);
  });
  it('flags clipping', () => {
    const x = tone(300, 5); // heavily over-driven
    for (let i = 0; i < x.length; i++) x[i] = Math.max(-1, Math.min(1, x[i] as number));
    const q = assessQuality(x);
    expect(q.clippingPct).toBeGreaterThan(10);
    expect(q.verdict).toBe('unusable');
  });
  it('flags silence and short duration', () => {
    const q = assessQuality(new Float32Array(SAMPLE_RATE * 300));
    expect(q.verdict).toBe('unusable');
    expect(q.silenceRatio).toBe(1);
    expect(assessQuality(tone(10, 0.3)).verdict).toBe('unusable');
    expect(assessQuality(tone(60, 0.3)).verdict).toBe('marginal');
  });
  it('reports a noise floor and marginal for mostly quiet audio', () => {
    const x = tone(300, 0.3);
    x.fill(0, 0, SAMPLE_RATE * 200);
    const q = assessQuality(x);
    expect(q.verdict).toBe('marginal');
    expect(q.silenceRatio).toBeCloseTo(200 / 300, 1);
  });
});

describe('quiet periods', () => {
  it('finds a 15 s drop and ignores short dips and silence-only input', () => {
    const l = Array.from({ length: 120 }, () => -30);
    for (let i = 40; i < 55; i++) l[i] = -60;
    for (let i = 80; i < 85; i++) l[i] = -60;
    const g = findQuietGaps(l);
    expect(g).toEqual([{ t0: 40, t1: 55, durSec: 15 }]);
    expect(findQuietGaps(Array.from({ length: 100 }, () => -100))).toEqual([]);
  });
});

describe('downmix', () => {
  it('averages channels', () => {
    const m = downmixToMono([Float32Array.of(1, 0.5), Float32Array.of(-1, 0.5)]);
    expect(Array.from(m)).toEqual([0, 0.5]);
  });
});

describe('analyzeAudio', () => {
  it('gives the same verdict at 44.1 and 48 kHz and finds the quiet period', async () => {
    const a = await analyzeAudio(breathing(44100, 120, 0.3, [50, 70]), 44100, fast);
    const b = await analyzeAudio(breathing(48000, 120, 0.3, [50, 70]), 48000, fast);
    for (const r of [a, b]) {
      expect(r.status).toBe('done');
      expect(r.quality.durationSec).toBeCloseTo(120, 1);
      expect(r.loudness).toHaveLength(120);
      expect(r.quietGaps.length).toBe(1);
      expect(r.quietGaps[0]!.durSec).toBeGreaterThanOrEqual(15);
      expect(r.modelVersion).toBeNull();
      expect(r.windows).toEqual([]);
    }
    expect(Math.abs(a.quality.noiseFloorDb - b.quality.noiseFloorDb)).toBeLessThan(0.5);
    expect(Math.abs(a.loudness[10]! - b.loudness[10]!)).toBeLessThan(0.5);
  }, 60000);
  it('handles an all-silent file', async () => {
    const r = await analyzeAudio(new Float32Array(48000 * 60), 48000, fast);
    expect(r.quality.verdict).toBe('unusable');
    expect(r.quietWindowCount).toBe(119);
    expect(r.quietGaps).toEqual([]);
  });
  it('reports progress and supports cancel', async () => {
    const x = breathing(16000, 100);
    const seen: number[] = [];
    await analyzeAudio(x, 16000, { ...fast, onProgress: (f) => seen.push(f) });
    expect(seen[seen.length - 1]).toBe(1);
    expect(seen.length).toBeGreaterThan(3);
    let calls = 0;
    await expect(analyzeAudio(x, 16000, { ...fast, isCancelled: () => ++calls > 2 })).rejects.toBeInstanceOf(AnalysisCancelledError);
  });
  it('chunked loudness equals one-shot loudness', async () => {
    const x = breathing(16000, 95);
    const r = await analyzeAudio(x, 16000, fast);
    let s = 0;
    for (let i = 0; i < 16000; i++) s += (x[40 * 16000 + i] as number) ** 2;
    expect(r.loudness[40]).toBeCloseTo(10 * Math.log10(s / 16000), 3);
  });
  it('processes 30 minutes at 48 kHz (performance check)', async () => {
    const x = breathing(48000, 1800, 0.25, [600, 625]);
    const t0 = performance.now();
    const r = await analyzeAudio(x, 48000);
    const ms = performance.now() - t0;
    console.log(`30 min @48 kHz analyze time: ${(ms / 1000).toFixed(1)} s`);
    expect(r.loudness).toHaveLength(1800);
    expect(r.quality.verdict).toBe('usable');
    expect(r.quietGaps.length).toBe(1);
  }, 300000);
});
