import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadShippedModel } from '../audio/model/infer';
import { parseWav } from '../audio/testing/wav';
import { createNightPipeline } from './pipeline';
import { chunks, concat, noiseAt, silence, speechLike } from './testkit';
import type { EpochRecord } from './types';

const model = loadShippedModel()!;

function epochsOf(x: Float32Array, rate = 16000): EpochRecord[] {
  const p = createNightPipeline({ model, captureStartMs: 1_000_000 });
  const out: EpochRecord[] = [];
  for (const c of chunks(x, rate)) out.push(...p.push(c, rate));
  out.push(...p.finish('user-stop').epochs);
  return out;
}
const bg = (sec: number, seed = 3) => noiseAt(sec, -62, seed);

describe('speech-like cue', { timeout: 120_000 }, () => {
  it('speech-like sound over a quiet room is counted; steady noise at the same level is not', () => {
    const speech = epochsOf(concat([bg(90), speechLike(60, -30), bg(30, 4)]));
    const noise = epochsOf(concat([bg(90), noiseAt(60, -30, 9), bg(30, 4)]));
    const sp = speech.reduce((a, e) => a + e.speechLikeSec, 0);
    const nz = noise.reduce((a, e) => a + e.speechLikeSec, 0);
    expect(sp).toBeGreaterThan(20);
    expect(nz).toBe(0);
  });
  it('quiet background alone has no speech-like seconds', () => {
    expect(epochsOf(bg(120)).reduce((a, e) => a + e.speechLikeSec, 0)).toBe(0);
  });
  it('real snoring (ESC-50 sample): snore-like windows are excluded; residual false positives stay bounded (provisional, unvalidated cue)', () => {
    const wav = parseWav(readFileSync(join(process.cwd(), 'public/sample-audio/esc50-sample.wav')));
    const es = epochsOf(wav.samples, wav.sampleRate);
    const total = es.reduce((a, e) => a + e.cap, 0);
    expect(es.reduce((a, e) => a + e.speechLikeSec, 0)).toBeLessThan(0.3 * total);
  });
});

describe('level cues', { timeout: 120_000 }, () => {
  it('a sustained loud, non-snore sound is counted as loud non-snore seconds', () => {
    const es = epochsOf(concat([bg(90), noiseAt(30, -30, 9), bg(30, 4)]));
    expect(es.reduce((a, e) => a + e.loudNonSnoreSec, 0)).toBeGreaterThanOrEqual(10);
  });
  it('short bursts after quiet count as handling events; steady sound does not', () => {
    const burst = concat([noiseAt(0.3, -35, 7), bg(2.7, 5)]);
    const bursts = concat(Array.from({ length: 10 }, () => burst));
    const handled = epochsOf(concat([bg(90), bursts, bg(30, 4)]));
    const steady = epochsOf(concat([bg(90), noiseAt(30, -35, 9), bg(30, 4)]));
    expect(handled.reduce((a, e) => a + e.handlingEvents, 0)).toBeGreaterThanOrEqual(5);
    expect(steady.reduce((a, e) => a + e.handlingEvents, 0)).toBeLessThanOrEqual(1);
  });
  it('level percentiles are ordered and the floor tracks the room', () => {
    const es = epochsOf(bg(300));
    const last = es[es.length - 2]!;
    expect(last.lvl.p10).toBeLessThanOrEqual(last.lvl.p50);
    expect(last.lvl.p50).toBeLessThanOrEqual(last.lvl.p90);
    expect(Math.abs(last.floor - -62)).toBeLessThan(3);
  });
  it('digital silence reports the silence floor without scoring anything', () => {
    const es = epochsOf(silence(120));
    expect(es.reduce((a, e) => a + e.win.scored, 0)).toBe(0);
    expect(es.every((e) => e.win.belowGate === 0)).toBe(true);
  });
});

describe('48 kHz input matches 16 kHz after resampling', { timeout: 120_000 }, () => {
  it('epoch accounting is identical for a tone-plus-noise signal', () => {
    const x16 = concat([bg(60), speechLike(30, -30)]);
    const x48 = new Float32Array(x16.length * 3);
    for (let i = 0; i < x16.length; i++) {
      const a = x16[i] as number;
      const b = (x16[i + 1] ?? a) as number;
      x48[3 * i] = a;
      x48[3 * i + 1] = a + (b - a) / 3;
      x48[3 * i + 2] = a + (2 * (b - a)) / 3;
    }
    const e16 = epochsOf(x16, 16000);
    const e48 = epochsOf(x48, 48000);
    expect(e48.length).toBe(e16.length);
    expect(e48.map((e) => e.cap)).toEqual(e16.map((e) => e.cap));
  });
});
