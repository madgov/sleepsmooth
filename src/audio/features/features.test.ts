import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fft, naiveDft } from './fft';
import { FFT_SIZE, N_BINS, hzToMel, melFilterbank, melToHz } from './mel';
import { computeLogMel, frameLogMel, resampleTo16k } from './index';
import { lcgNoise, sine, GOLDEN_CASES, GOLDEN_TOLERANCE, maxAbsDiff, type GoldenFile } from './golden/goldenCases';
import { FRAMES_PER_WINDOW, FRAME_SAMPLES, N_MELS } from '../constants';

function dominantFreq(x: Float32Array, rate: number): number {
  const n = 8192;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  const off = Math.floor((x.length - n) / 2);
  for (let i = 0; i < n; i++) re[i] = (x[off + i] as number) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n));
  fft(re, im);
  let best = 1;
  let bestP = 0;
  for (let k = 1; k < n / 2; k++) {
    const p = (re[k] as number) ** 2 + (im[k] as number) ** 2;
    if (p > bestP) {
      bestP = p;
      best = k;
    }
  }
  return (best * rate) / n;
}

describe('fft', () => {
  it('matches naive DFT on random complex input', () => {
    const n = 64;
    const re = Float64Array.from(lcgNoise(n, 1));
    const im = Float64Array.from(lcgNoise(n, 2));
    const ref = naiveDft(re, im);
    fft(re, im);
    for (let k = 0; k < n; k++) {
      expect(re[k]).toBeCloseTo(ref.re[k] as number, 9);
      expect(im[k]).toBeCloseTo(ref.im[k] as number, 9);
    }
  });
  it('matches naive DFT at 512 points', () => {
    const re = Float64Array.from(lcgNoise(FFT_SIZE, 3));
    const im = new Float64Array(FFT_SIZE);
    const ref = naiveDft(re, im);
    fft(re, im);
    let m = 0;
    for (let k = 0; k < FFT_SIZE; k++) m = Math.max(m, Math.abs((re[k] as number) - (ref.re[k] as number)), Math.abs((im[k] as number) - (ref.im[k] as number)));
    expect(m).toBeLessThan(1e-9);
  });
  it('rejects non power-of-two', () => {
    expect(() => fft(new Float64Array(6), new Float64Array(6))).toThrow();
  });
});

describe('mel filterbank', () => {
  const bank = melFilterbank();
  it('has 40 non-negative filters over 257 bins', () => {
    expect(bank).toHaveLength(N_MELS);
    for (const f of bank) {
      expect(f).toHaveLength(N_BINS);
      for (const w of f) {
        expect(w).toBeGreaterThanOrEqual(0);
        expect(w).toBeLessThanOrEqual(1 + 1e-12);
      }
      expect(f.some((w) => w > 0)).toBe(true);
    }
  });
  it('covers the spectrum between the first and last filter and is ordered', () => {
    const centroid = bank.map((f) => {
      let s = 0;
      let sw = 0;
      f.forEach((w, i) => {
        s += w * i;
        sw += w;
      });
      return s / sw;
    });
    for (let i = 1; i < centroid.length; i++) expect(centroid[i]).toBeGreaterThan(centroid[i - 1] as number);
    // bins strictly inside the covered range are covered by at least one filter
    const firstNonZero = bank[0]!.findIndex((w) => w > 0);
    for (let b = firstNonZero; b < N_BINS - 2; b++) expect(bank.some((f) => (f[b] as number) > 0)).toBe(true);
  });
  it('mel conversion round-trips', () => {
    for (const f of [0, 100, 1000, 8000]) expect(melToHz(hzToMel(f))).toBeCloseTo(f, 6);
  });
});

describe('resample', () => {
  for (const rate of [8000, 22050, 44100, 48000]) {
    it(`preserves a 1 kHz tone from ${rate} Hz with unit gain`, () => {
      const out = resampleTo16k(sine(1000, rate, 3), rate);
      expect(out.length).toBe(48000);
      expect(Math.abs(dominantFreq(out, 16000) - 1000)).toBeLessThan(3);
      let peak = 0;
      for (let i = 2000; i < out.length - 2000; i++) peak = Math.max(peak, Math.abs(out[i] as number));
      expect(peak).toBeGreaterThan(0.49);
      expect(peak).toBeLessThan(0.51);
    });
  }
  it('attenuates content above the output Nyquist (anti-alias)', () => {
    const out = resampleTo16k(sine(12000, 48000, 1), 48000);
    let peak = 0;
    for (let i = 2000; i < out.length - 2000; i++) peak = Math.max(peak, Math.abs(out[i] as number));
    expect(peak).toBeLessThan(0.01);
  });
  it('is identity at 16 kHz and deterministic', () => {
    const x = lcgNoise(1000, 9);
    expect(Array.from(resampleTo16k(x, 16000))).toEqual(Array.from(x));
    expect(Array.from(resampleTo16k(x, 44100))).toEqual(Array.from(resampleTo16k(x, 44100)));
  });
});

describe('logmel', () => {
  it('has the expected shapes', () => {
    expect(frameLogMel(sine(440, 16000, 1))).toHaveLength(FRAMES_PER_WINDOW * N_MELS);
    expect(computeLogMel(new Float32Array(3 * FRAME_SAMPLES))).toHaveLength(3 * N_MELS);
    expect(() => computeLogMel(new Float32Array(401))).toThrow();
  });
  it('peaks in the expected mel band for a 1 kHz tone and is finite for silence', () => {
    const lm = frameLogMel(sine(1000, 16000, 1));
    const row = Array.from(lm.subarray(50 * N_MELS, 51 * N_MELS));
    const peak = row.indexOf(Math.max(...row));
    const bank = melFilterbank();
    const bin = Math.round((1000 * FFT_SIZE) / 16000);
    expect((bank[peak] as Float64Array)[bin]).toBeGreaterThan(0.3);
    const silent = frameLogMel(new Float32Array(16000));
    expect(silent.every((v) => Number.isFinite(v))).toBe(true);
  });
  it('is deterministic', () => {
    const x = sine(300, 16000, 1);
    expect(Array.from(frameLogMel(x))).toEqual(Array.from(frameLogMel(x)));
  });
});

describe('golden parity (Node JSON vs recomputation)', () => {
  for (const c of GOLDEN_CASES) {
    it(`${c.name} within ${GOLDEN_TOLERANCE}`, () => {
      const file = JSON.parse(readFileSync(join(__dirname, 'golden', 'golden', `${c.name}.json`), 'utf8')) as GoldenFile;
      expect(maxAbsDiff(c.compute(), file.values)).toBeLessThan(GOLDEN_TOLERANCE);
    });
  }
});
