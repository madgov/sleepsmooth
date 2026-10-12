import { describe, expect, it } from 'vitest';
import { analyzeAudio } from '../audio/analyze';
import { createModelHook } from '../audio/modelHook';
import { loadShippedModel } from '../audio/model/infer';
import { benchPipeline, estimateNightCpu } from './benchmark';
import { createNightPipeline } from './pipeline';
import { chunks, concat, noiseAt, silence } from './testkit';

const model = loadShippedModel()!;

describe('benchmark', { timeout: 300_000 }, () => {
  it('measures plain vs frame-reuse cost per window and estimates an 8 h night with the gate', async () => {
    const audioSec = 120;
    const plainInput = noiseAt(audioSec, -30, 11);
    const t0 = performance.now();
    const batch = await analyzeAudio(plainInput, 16000, { inference: createModelHook(model), yieldToEventLoop: () => Promise.resolve() });
    const plainMs = performance.now() - t0;
    const plainPerWindow = plainMs / Math.max(1, batch.windows.length);

    benchPipeline(model, { audioSec: 20, gate: false, levelDbfs: -30 }); // warm up the JIT
    const full = benchPipeline(model, { audioSec: audioSec, gate: false, levelDbfs: -30 });
    const base = benchPipeline(model, { audioSec: 300, gate: true, levelDbfs: -60 }); // steady quiet room: gate closed after the 30 s cold start
    const fullPerWindow = full.msPerWindow;
    const est = [0.02, 0.1, 0.25, 1].map((f) => ({ openFraction: f, ...estimateNightCpu(base, full, f) }));
    console.log(
      JSON.stringify({
        plain: { windows: batch.windows.length, msPerWindow: +plainPerWindow.toFixed(3) },
        frameReuse: { windows: full.windows, scored: full.scored, msPerWindow: +fullPerWindow.toFixed(3), msPerAudioSec: +full.msPerAudioSec.toFixed(3) },
        gateClosed: { windows: base.windows, scored: base.scored, msPerAudioSec: +base.msPerAudioSec.toFixed(3) },
        speedupVsPlain: +(plainPerWindow / fullPerWindow).toFixed(2),
        nightEstimate8h: est.map((e) => ({ openFraction: e.openFraction, cpuMinutes: +e.cpuMinutes.toFixed(1), dutyCycle: +e.dutyCycle.toFixed(4) })),
      }),
    );
    expect(full.scored).toBeGreaterThan(audioSec); // gate off, loud: windows are scored
    expect(base.scored).toBeLessThanOrEqual(62); // only the 30 s cold start (floor seed) is scored
    expect(fullPerWindow).toBeLessThan(plainPerWindow); // frame reuse is cheaper than recomputing every frame
  });

  it('a 30 minute pipeline run stays linear in time and does not grow its backlog', () => {
    const minutes = 30;
    const p = createNightPipeline({ model, captureStartMs: 0 });
    const room = noiseAt(60, -60, 5);
    let epochs = 0;
    const times: number[] = [];
    for (let m = 0; m < minutes; m++) {
      const t0 = performance.now();
      const minute = m % 10 === 5 ? concat([room.subarray(0, 30 * 16000), noiseAt(30, -35, 9 + m)]) : room;
      for (const c of chunks(minute, 16000)) epochs += p.push(c, 16000).length;
      expect(p.backlogSec()).toBeLessThan(1);
      times.push(performance.now() - t0);
    }
    epochs += p.finish('scheduled-end').epochs.length;
    expect(epochs).toBe(minutes * 2);
    const first = times.slice(0, 10).reduce((a, b) => a + b, 0);
    const last = times.slice(-10).reduce((a, b) => a + b, 0);
    expect(last).toBeLessThan(first * 3 + 500); // no super-linear growth
  });

  it('silence for 10 minutes costs almost nothing', () => {
    const p = createNightPipeline({ model, captureStartMs: 0 });
    const t0 = performance.now();
    for (const c of chunks(silence(600), 16000)) p.push(c, 16000);
    p.finish('user-stop');
    expect(performance.now() - t0).toBeLessThan(10_000);
  });
});
