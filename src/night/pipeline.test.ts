import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeAudio } from '../audio/analyze';
import { SAMPLE_RATE, SILENCE_FLOOR_DBFS } from '../audio/constants';
import { frameLogMel } from '../audio/features';
import { logMelFrames } from '../audio/features/logmel';
import { resampleAll } from '../audio/features/resample';
import { createModelHook } from '../audio/modelHook';
import { loadShippedModel } from '../audio/model/infer';
import { parseWav } from '../audio/testing/wav';
import { base64ToInt8, decodeBits, decodeScores, dequantizeFeatures } from './codec';
import { EPOCH_MS, FRAMES_PER_HOP, WINDOWS_PER_EPOCH } from './constants';
import { FrameCache, logMelFrameSparse } from './frames';
import { createNightPipeline, type WindowDebug } from './pipeline';
import { StreamingResampler } from './resample';
import { chunks, concat, lcg, noiseAt, silence } from './testkit';
import type { EpochRecord, WindowFeatureRecord } from './types';

const model = loadShippedModel()!;
const wav = parseWav(readFileSync(join(process.cwd(), 'public/sample-audio/esc50-sample.wav')));

function run(x: Float32Array, rate: number, chunk: number, opt: Partial<Parameters<typeof createNightPipeline>[0]> = {}) {
  const p = createNightPipeline({ model, captureStartMs: 1_000_000, ...opt });
  const epochs: EpochRecord[] = [];
  for (const c of chunks(x, chunk)) epochs.push(...p.push(c, rate));
  const res = p.finish('user-stop');
  epochs.push(...res.epochs);
  return { epochs, res, p };
}

describe('StreamingResampler', () => {
  for (const rate of [48000, 44100, 8000, 16000]) {
    it(`matches the one-shot resampler at ${rate} Hz (odd chunk sizes)`, () => {
      const x = noiseAt(7, -20, 5, rate);
      const want = resampleAll(x, rate);
      const r = new StreamingResampler(rate);
      const outs: Float32Array[] = [];
      for (const c of chunks(x, 3333)) outs.push(r.push(c));
      outs.push(r.flush());
      const got = concat(outs);
      expect(got.length).toBe(want.length);
      let maxd = 0;
      for (let i = 0; i < got.length; i++) maxd = Math.max(maxd, Math.abs((got[i] as number) - (want[i] as number)));
      expect(maxd).toBeLessThan(1e-6);
      if (rate === 16000) expect(maxd).toBe(0);
    });
  }
  it('flush starts a fresh segment', () => {
    const r = new StreamingResampler(48000);
    const x = noiseAt(2, -20, 2, 48000);
    const a = concat([r.push(x), r.flush()]);
    const b = concat([r.push(x), r.flush()]);
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});

describe('streaming log-mel (frame reuse + sparse mel)', () => {
  it('sparse mel is bit-equal to the dense implementation on random frames and spectra', () => {
    for (let s = 1; s <= 25; s++) {
      const frame = lcg(400, s);
      if (s % 5 === 0) for (let i = 0; i < 400; i++) frame[i] = (frame[i] as number) * 1e-4; // very quiet
      if (s % 7 === 0) for (let i = 0; i < 400; i++) frame[i] = Math.sin((2 * Math.PI * 100 * s * i) / SAMPLE_RATE); // tone
      const dense = logMelFrames(frame);
      const sparse = logMelFrameSparse(frame).mel;
      expect(Array.from(sparse)).toEqual(Array.from(dense));
    }
  });

  it('windowLogMel equals frameLogMel for every window, shares 48 interior frames, and computes ~52 frames per window', () => {
    const x = lcg(16000 * 6, 9);
    const cache = new FrameCache({ copy: (start, len, dst, off) => dst.set(x.subarray(start, start + len), off) });
    const n = 10;
    for (let k = 0; k < n; k++) {
      const { logMel } = cache.windowLogMel(k);
      const want = frameLogMel(x.subarray(k * 8000, k * 8000 + 16000));
      expect(Array.from(logMel)).toEqual(Array.from(want));
    }
    // 2 edge frames per window + 98 interior for the first + 50 new per later window.
    expect(cache.computed).toBe(2 * n + 98 + 50 * (n - 1));
    // ER-6: interior frames 51..98 of window k equal frames 1..48 of window k+1.
    const a = cache.windowLogMel(2);
    const b = cache.windowLogMel(3);
    for (let j = 0; j < 48; j++) expect(a.interior[FRAMES_PER_HOP + j]).toBe(b.interior[j]);
  });
});

describe('parity with the existing batch pipeline (gate off)', () => {
  it('scores every assessable window of the ESC-50 sample within 1e-9 of analyzeAudio + createModelHook', async () => {
    const batch = await analyzeAudio(wav.samples, wav.sampleRate, { inference: createModelHook(model), yieldToEventLoop: () => Promise.resolve() });
    const seen: WindowDebug[] = [];
    run(wav.samples, wav.sampleRate, 16000, { gate: false, onWindow: (w) => w.status === 'scored' && seen.push(w) });
    expect(seen.length).toBe(batch.windows.length);
    for (let i = 0; i < seen.length; i++) {
      const b = batch.windows[i]!;
      expect(seen[i]!.t0Sec).toBe(b.t0);
      expect(Math.abs((seen[i]!.score as number) - b.score)).toBeLessThan(1e-9);
      expect(seen[i]!.snoreLike).toBe(b.snoreLike);
    }
    expect(seen.some((w) => w.snoreLike)).toBe(true);
  }, 60000);

});

describe('determinism', () => {
  it('identical epoch output for 1 s, 0.37 s and 4 s chunks (16 kHz)', () => {
    const a = run(wav.samples, 16000, 16000).epochs;
    const b = run(wav.samples, 16000, 5920).epochs;
    const c = run(wav.samples, 16000, 64000).epochs;
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(JSON.stringify(c)).toBe(JSON.stringify(a));
    expect(JSON.stringify(run(wav.samples, 16000, 16000).epochs)).toBe(JSON.stringify(a));
  }, 120000);

  it('identical epoch output for different chunk sizes at 48 kHz', () => {
    const x48 = noiseAt(70, -40, 3, 48000);
    const a = run(x48, 48000, 48000).epochs;
    const b = run(x48, 48000, 17760).epochs;
    const c = run(x48, 48000, 192000).epochs;
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(JSON.stringify(c)).toBe(JSON.stringify(a));
  }, 120000);
});

describe('epoch math and boundaries', () => {
  it('60 s of audio gives 2 epochs: 60 windows, then 59 (a window must fit inside the audio)', () => {
    const { epochs } = run(noiseAt(60, -40, 1), 16000, 16000, { gate: false });
    expect(epochs.map((e) => e.i)).toEqual([0, 1]);
    expect(epochs[0]!.t).toBe(1_000_000);
    expect(epochs[1]!.t).toBe(1_000_000 + EPOCH_MS);
    expect(epochs[0]!.cap).toBe(30);
    expect(epochs[1]!.cap).toBe(30);
    expect(epochs[0]!.win.total).toBe(WINDOWS_PER_EPOCH);
    expect(epochs[1]!.win.total).toBe(WINDOWS_PER_EPOCH - 1);
    for (const e of epochs) expect(e.win.total).toBe(e.win.scored + e.win.belowGate + e.win.tooQuiet);
  });
  it('a 45 s capture ends with a partial epoch: cap 15 s and 29 windows', () => {
    const { epochs } = run(noiseAt(45, -40, 1), 16000, 16000, { gate: false });
    expect(epochs).toHaveLength(2);
    expect(epochs[1]!.cap).toBe(15);
    expect(epochs[1]!.win.total).toBe(29);
  });
  it('epoch t advances by exactly 30 s per index', () => {
    const { epochs } = run(noiseAt(95, -40, 1), 16000, 16000, { gate: false });
    epochs.forEach((e, idx) => {
      expect(e.i).toBe(idx);
      expect(e.t).toBe(1_000_000 + idx * EPOCH_MS);
    });
    expect(epochs).toHaveLength(4);
    expect(epochs[3]!.cap).toBeCloseTo(5, 3);
  });
  it('an empty capture produces no epochs', () => {
    expect(run(new Float32Array(0), 16000, 16000).epochs).toEqual([]);
  });
  it('records stay small: no audio-sized field in any epoch', () => {
    const { epochs } = run(wav.samples, 16000, 16000);
    for (const e of epochs) expect(JSON.stringify(e).length).toBeLessThan(900);
  });
});

describe('level gate', () => {
  it('counts unscored windows separately; they never enter the scored or snore-like counts', () => {
    // 150 s steady noise at -40 dBFS: after the 30 s warm-up the floor is -40, gate at -34, so windows close.
    const { epochs } = run(noiseAt(150, -40, 4), 16000, 16000);
    const total = epochs.reduce((a, e) => a + e.win.total, 0);
    const scored = epochs.reduce((a, e) => a + e.win.scored, 0);
    const below = epochs.reduce((a, e) => a + e.win.belowGate, 0);
    expect(scored + below).toBe(total);
    expect(below).toBeGreaterThan(scored); // gate closed for most of the steady noise
    expect(scored).toBeGreaterThan(0); // warm-up windows were scored
    expect(epochs[0]!.win.scored).toBeGreaterThan(40); // first epoch: seed floor, mostly open
    expect(epochs[3]!.win.scored).toBe(0);
    expect(epochs[3]!.win.belowGate).toBe(epochs[3]!.win.total);
    expect(epochs[3]!.snoreBits).toBeUndefined();
  });
  it('opens for a window 6 dB or more above the rolling floor', () => {
    const x = concat([noiseAt(120, -50, 1), noiseAt(10, -30, 2), noiseAt(30, -50, 1)]);
    const seen: WindowDebug[] = [];
    run(x, 16000, 16000, { onWindow: (w) => seen.push(w) });
    const loud = seen.filter((w) => w.t0Sec >= 121 && w.t0Sec <= 129);
    expect(loud.length).toBeGreaterThan(10);
    expect(loud.every((w) => w.status === 'scored')).toBe(true);
    const steady = seen.filter((w) => w.t0Sec >= 60 && w.t0Sec <= 110);
    expect(steady.every((w) => w.status === 'belowGate')).toBe(true);
  });
  it('gate off scores everything above the silence floor; below it stays too quiet', () => {
    const x = concat([noiseAt(40, -40, 1), silence(20)]);
    const { epochs } = run(x, 16000, 16000, { gate: false });
    const scored = epochs.reduce((a, e) => a + e.win.scored, 0);
    const tooQuiet = epochs.reduce((a, e) => a + e.win.tooQuiet, 0);
    expect(scored).toBeGreaterThan(70);
    expect(tooQuiet).toBeGreaterThan(30);
    expect(epochs.reduce((a, e) => a + e.win.belowGate, 0)).toBe(0);
  });
  it('windows under SILENCE_FLOOR_DBFS are tooQuiet, not belowGate', () => {
    const { epochs } = run(noiseAt(30, SILENCE_FLOOR_DBFS - 10, 1), 16000, 16000);
    expect(epochs[0]!.win.tooQuiet).toBe(epochs[0]!.win.total);
    expect(epochs[0]!.win.scored).toBe(0);
  });
  it('capture-only build (no model) scores nothing and reports belowGate, never snore-like', () => {
    const { epochs } = run(noiseAt(40, -30, 1), 16000, 16000, { model: null });
    expect(epochs.reduce((a, e) => a + e.win.scored + e.win.snoreLike, 0)).toBe(0);
    expect(epochs[0]!.win.belowGate).toBeGreaterThan(0);
  });
});

describe('sample decoding of per-window fields', () => {
  it('scoredMask, snoreBits and scoreQ round-trip and agree with the debug stream', () => {
    const seen: WindowDebug[] = [];
    const { epochs } = run(wav.samples, 16000, 16000, { gate: false, onWindow: (w) => w.status === 'scored' && seen.push(w) });
    const fromRecords: { k: number; flag: boolean; score: number }[] = [];
    for (const e of epochs) {
      const mask = decodeBits(e.scoredMask, WINDOWS_PER_EPOCH);
      const flags = decodeBits(e.snoreBits, e.win.scored);
      const scores = decodeScores(e.scoreQ);
      let q = 0;
      mask.forEach((m, j) => {
        if (m) fromRecords.push({ k: e.i * WINDOWS_PER_EPOCH + j, flag: flags[q]!, score: scores[q++]! });
      });
      expect(q).toBe(e.win.scored);
      expect(flags.filter(Boolean).length).toBe(e.win.snoreLike);
    }
    expect(fromRecords.length).toBe(seen.length);
    fromRecords.forEach((r, i) => {
      expect(r.k).toBe(seen[i]!.k);
      expect(r.flag).toBe(seen[i]!.snoreLike);
      expect(Math.abs(r.score - (seen[i]!.score as number))).toBeLessThanOrEqual(1 / 255 / 2 + 1e-9);
    });
  });
});

describe('gaps', () => {
  it('a gap inside an epoch removes the windows that touch it and reduces cap', () => {
    const p = createNightPipeline({ model, captureStartMs: 0, gate: false });
    const epochs: EpochRecord[] = [];
    epochs.push(...p.push(noiseAt(10, -40, 1), 16000));
    epochs.push(...p.markGap(10));
    epochs.push(...p.push(noiseAt(20, -40, 2), 16000));
    epochs.push(...p.finish('user-stop').epochs);
    expect(epochs).toHaveLength(2);
    const e0 = epochs[0]!;
    expect(e0.cap).toBeCloseTo(20, 3);
    // Windows k=0..18 fit in the first 10 s; k>=20 start at/after 10 s + 10 s gap. Window 19 (9.5..10.5 s) is dropped.
    expect(e0.win.total).toBe(19 + (59 - 40 + 1));
    expect(p.gaps).toEqual([{ t0: 10000, t1: 20000, cause: 'late-buffers' }]);
  });
  it('a gap spanning whole epochs emits not-captured epochs with cap 0', () => {
    const p = createNightPipeline({ model, captureStartMs: 0 });
    const out: EpochRecord[] = [];
    out.push(...p.push(noiseAt(20, -40, 1), 16000));
    out.push(...p.markGap(100));
    out.push(...p.push(noiseAt(40, -40, 2), 16000));
    out.push(...p.finish('user-stop').epochs);
    expect(out.map((e) => e.i)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(out[0]!.cap).toBeCloseTo(20, 3);
    for (const i of [1, 2, 3]) {
      expect(out[i]!.cap).toBe(0);
      expect(out[i]!.state).toBe('not-captured');
      expect(out[i]!.win.total).toBe(0);
    }
    expect(out[4]!.cap).toBe(30);
    expect(out[5]!.cap).toBeCloseTo(10, 3);
  });
});

describe('resume after a crash', () => {
  const x = noiseAt(190, -40, 6);
  const full = run(x, 16000, 16000, { gate: false, captureStartMs: 5_000 }).epochs;

  it('continues at the next epoch index; the epochs in between are not captured', () => {
    const last = full[1]!; // persisted up to epoch 1
    const resumeAtMs = 5_000 + 4 * EPOCH_MS + 10_000; // restarted 10 s into epoch 4
    const p = createNightPipeline({ model, captureStartMs: 5_000, gate: false, resume: { lastEpoch: last, resumeAtMs } });
    const out: EpochRecord[] = [];
    out.push(...p.push(x.subarray(Math.round(((resumeAtMs - 5_000) / 1000) * 16000)), 16000));
    out.push(...p.finish('user-stop').epochs);
    expect(out.map((e) => e.i)).toEqual([2, 3, 4, 5, 6]);
    expect(out[0]!.t).toBe(5_000 + 2 * EPOCH_MS);
    expect(out[0]!.cap).toBe(0);
    expect(out[0]!.state).toBe('not-captured');
    expect(out[1]!.cap).toBe(0);
    expect(out[2]!.cap).toBeCloseTo(20, 3); // epoch 4: 10 s were lost
    expect(p.gaps[0]).toEqual({ t0: 5_000 + 2 * EPOCH_MS, t1: resumeAtMs, cause: 'os-killed-or-crash-recovered' });
    // Epoch 5 is a full epoch fed with the same samples as in the uninterrupted run: same window counts.
    expect(out[3]!.win).toEqual(full[5]!.win);
    expect(out[4]!.cap).toBeCloseTo(10, 3);
  });

  it('is deterministic: the same resume twice gives identical output', () => {
    const mk = () => {
      const p = createNightPipeline({ model, captureStartMs: 5_000, gate: false, resume: { lastEpoch: full[2]!, resumeAtMs: 5_000 + 3 * EPOCH_MS } });
      return [...p.push(x.subarray(3 * 480000), 16000), ...p.finish('user-stop').epochs];
    };
    expect(JSON.stringify(mk())).toBe(JSON.stringify(mk()));
  }, 60_000);

  it('resuming exactly at the next epoch boundary reproduces the uninterrupted epochs (gate off)', () => {
    const p = createNightPipeline({ model, captureStartMs: 5_000, gate: false, resume: { lastEpoch: full[1]!, resumeAtMs: 5_000 + 2 * EPOCH_MS } });
    const out = [...p.push(x.subarray(2 * 480000), 16000), ...p.finish('user-stop').epochs];
    expect(out.map((e) => e.i)).toEqual([2, 3, 4, 5, 6]);
    for (const e of out) {
      const f = full[e.i]!;
      expect(e.win).toEqual(f.win);
      expect(e.snoreBits).toBe(f.snoreBits);
      expect(e.scoreQ).toBe(f.scoreQ);
    }
  });

  it('a gate-on resume seeds the floor from the last persisted epoch', () => {
    const noisy = run(noiseAt(120, -40, 8), 16000, 16000, { captureStartMs: 0 }).epochs;
    const last = noisy[1]!; // floor is about -40 here
    expect(last.floor).toBeGreaterThan(-45);
    const p = createNightPipeline({ model, captureStartMs: 0, resume: { lastEpoch: last, resumeAtMs: 2 * EPOCH_MS } });
    const out = [...p.push(noiseAt(30, -40, 8), 16000), ...p.finish('user-stop').epochs];
    // With the seeded floor the steady noise stays gated (without it, the first 30 s would be scored).
    expect(out[0]!.win.scored).toBe(0);
  });

  it('re-primes the live state label from recentEpochs', () => {
    const p = createNightPipeline({ model, captureStartMs: 0, resume: { lastEpoch: full[1]!, resumeAtMs: 2 * EPOCH_MS, recentEpochs: full.slice(0, 2) } });
    expect(p.finish('user-stop').epochs).toEqual([]);
  });
});

describe('overload policy', () => {
  it('never lets the queue exceed 60 s: oldest windows are skipped and recorded as an overload gap', () => {
    const p = createNightPipeline({ model, captureStartMs: 0, gate: false });
    const skipped: number[] = [];
    // Re-create with a debug hook to capture skipped windows.
    const q = createNightPipeline({ model, captureStartMs: 0, gate: false, onWindow: (w) => w.status === 'skipped' && skipped.push(w.k) });
    void p;
    const x = noiseAt(10, -40, 3);
    let maxBacklog = 0;
    const out: EpochRecord[] = [];
    for (let i = 0; i < 40; i++) {
      q.enqueue(x, 16000); // a slow processor: pump only 4 windows after every 10 s of audio
      maxBacklog = Math.max(maxBacklog, q.backlogSec());
      out.push(...q.pump(4));
    }
    out.push(...q.finish('user-stop').epochs);
    expect(maxBacklog).toBeLessThanOrEqual(61.1);
    expect(skipped.length).toBeGreaterThan(100);
    expect(q.gaps.some((g) => g.cause === 'overload')).toBe(true);
    const overload = out.reduce((a, e) => a + (e.overload ?? 0), 0);
    expect(overload).toBe(skipped.length);
    // Skipped windows count in win.total but are not scored and never snore-like.
    for (const e of out) expect(e.win.total).toBe(e.win.scored + e.win.belowGate + e.win.tooQuiet + (e.overload ?? 0));
  }, 120000);
});

describe('dev-only window feature retention (ER-1)', () => {
  it('is off by default: no feature records are produced', () => {
    const got: WindowFeatureRecord[] = [];
    run(noiseAt(20, -30, 1), 16000, 16000, { gate: false });
    expect(got).toEqual([]);
  });
  it('requires the explicit devTuningBuild flag', () => {
    expect(() =>
      createNightPipeline({
        model,
        captureStartMs: 0,
        retainWindowFeatures: { devTuningBuild: false, onRecord: () => undefined } as unknown as { devTuningBuild: true; onRecord: () => void },
      }),
    ).toThrow(/developer tuning build/);
  });
  it('emits int8 80-d vectors that dequantize close to the features', () => {
    const got: WindowFeatureRecord[] = [];
    const { epochs } = run(noiseAt(10, -30, 1), 16000, 16000, { gate: false, retainWindowFeatures: { devTuningBuild: true, onRecord: (r) => got.push(r) } });
    expect(got.length).toBe(epochs[0]!.win.scored);
    const q = base64ToInt8(got[0]!.q);
    expect(q.length).toBe(80);
    const d = dequantizeFeatures(q);
    expect(d.every(Number.isFinite)).toBe(true);
    expect(got[0]!.k).toBe(0);
  });
});

describe('misuse', () => {
  it('rejects a sample-rate change mid-stream and use after finish', () => {
    const p = createNightPipeline({ model, captureStartMs: 0 });
    p.push(noiseAt(1, -30, 1), 16000);
    expect(() => p.push(noiseAt(1, -30, 1, 48000), 48000)).toThrow(/Sample rate changed/);
    p.finish('user-stop');
    expect(() => p.push(noiseAt(1, -30, 1), 16000)).toThrow(/finished/);
  });
});
