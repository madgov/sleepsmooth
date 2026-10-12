// Node benchmark helpers for the overnight pipeline (tests / tooling only; not imported by the product path).
// Measures wall-clock time on the machine running it. Hermes on a phone will differ: treat the numbers as
// relative (plain vs frame-reuse, gate open vs closed) and as an order-of-magnitude estimate, not a promise.
import type { ModelJson } from '../audio/model/schema';
import { createNightPipeline } from './pipeline';
import { chunks, noiseAt } from './testkit';

export interface BenchResult {
  audioSec: number;
  wallMs: number;
  /** Wall ms per second of audio. */
  msPerAudioSec: number;
  windows: number;
  scored: number;
  /** Wall ms per 1 s analysis window (windows = 2 per audio second on the 0.5 s hop). */
  msPerWindow: number;
}

export function benchPipeline(model: ModelJson, opts: { audioSec: number; gate: boolean; levelDbfs: number; seed?: number }): BenchResult {
  const x = noiseAt(opts.audioSec, opts.levelDbfs, opts.seed ?? 11);
  const p = createNightPipeline({ model, captureStartMs: 0, gate: opts.gate });
  let epochs = [] as ReturnType<typeof p.push>;
  const t0 = performance.now();
  for (const c of chunks(x, 16000)) epochs = epochs.concat(p.push(c, 16000));
  epochs = epochs.concat(p.finish('user-stop').epochs);
  const wallMs = performance.now() - t0;
  const windows = epochs.reduce((a, e) => a + e.win.total, 0);
  const scored = epochs.reduce((a, e) => a + e.win.scored, 0);
  return { audioSec: opts.audioSec, wallMs, msPerAudioSec: wallMs / opts.audioSec, windows, scored, msPerWindow: wallMs / Math.max(1, windows) };
}

/**
 * Estimate for an 8 h night: every audio second pays the always-on cost (resample, level, floor), and only the
 * gated-open fraction pays the feature + model cost.
 */
export function estimateNightCpu(base: BenchResult, full: BenchResult, openFraction: number, hours = 8): { cpuMinutes: number; dutyCycle: number } {
  const sec = hours * 3600;
  const alwaysOn = base.msPerAudioSec;
  const extra = Math.max(0, full.msPerAudioSec - base.msPerAudioSec);
  const ms = sec * (alwaysOn + openFraction * extra);
  return { cpuMinutes: ms / 60000, dutyCycle: ms / (sec * 1000) };
}
