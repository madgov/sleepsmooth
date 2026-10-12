// Labeled SAMPLE night: a deterministic, synthetic set of epoch records for demos and tests.
//
// Nothing here is a recording of anyone's sleep and nothing here was produced by the trained model: the
// epochs are generated from fixed patterns and a seeded LCG (no randomness, no clock). Everything carries
// isSynthetic: true / source 'sample-assembled', and `nightRulesInput` never lets a sample night drive the
// conclusion (it behaves like the web app's audioIsSample path). The model version string says so too.
//
// Variants:
//  - 'snore-episodes': five repeated stretches of flagged windows plus a few isolated false flags, so the
//    episode rule fires (state: snore-like-observed).
//  - 'quiet': no stretches, only a handful of isolated flagged windows (state: few-observations). The
//    existing non-reassuring wording still applies: this cannot rule out sleep apnea.
import { WINDOWS_PER_EPOCH, EPOCH_MS, EPOCH_SCHEMA_VERSION, NIGHT_HEURISTICS_VERSION } from './constants';
import { encodeBits, encodeScores, quantizeScore } from './codec';
import { estimateEpochStates } from './estimator';
import { summarizeNight, type NightView } from './summary';
import { RETENTION_DEFAULT, type EpochRecord, type NightRecord, type ScheduleWindow, type SleepWindowSettings } from './types';

export const SAMPLE_NIGHT_LABEL = 'Sample night (synthetic)';
export const SAMPLE_NIGHT_MODEL_VERSION = 'synthetic-sample-night-0 (illustrative, not a trained model)';
export const SAMPLE_NIGHT_START_MS = Date.UTC(2026, 0, 15, 23, 0, 0);
export type SampleNightVariant = 'snore-episodes' | 'quiet';

const SETTINGS: SleepWindowSettings = { bedtimeLocal: '23:00', wakeLocal: '07:00', tz: 'UTC', remindEnabled: false, promptLeadMin: 0 };
const EPOCHS = 960; // 8 h
const EPISODES: [number, number][] = [[120, 6], [245, 8], [330, 5], [610, 7], [760, 6]]; // [start epoch, length]
const AWAKE_BURSTS: [number, number][] = [[400, 7]]; // mid-night wake
const PHONE_USE_EPOCHS = 20;
const WAKE_FROM = 930;

/** Tiny seeded generator (LCG) returning floats in [0, 1). */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const inRange = (i: number, ranges: [number, number][]) => ranges.some(([a, n]) => i >= a && i < a + n);

export function sampleNightSchedule(): ScheduleWindow {
  return { startMs: SAMPLE_NIGHT_START_MS, endMs: SAMPLE_NIGHT_START_MS + 8 * 3600 * 1000 };
}

export function buildSampleNight(variant: SampleNightVariant = 'snore-episodes'): { record: NightRecord; epochs: EpochRecord[]; schedule: ScheduleWindow } {
  const r = rng(variant === 'quiet' ? 20260115 : 11112026);
  const raw: EpochRecord[] = [];
  for (let i = 0; i < EPOCHS; i++) {
    const phone = i < PHONE_USE_EPOCHS || i >= WAKE_FROM;
    const awakeBurst = inRange(i, AWAKE_BURSTS);
    const inEpisode = variant === 'snore-episodes' && inRange(i, EPISODES);
    const jitter = (r() - 0.5) * 2;
    // Scored windows: during an episode two of every three windows (gate open); otherwise a few at random.
    const scoredPos = new Array<boolean>(WINDOWS_PER_EPOCH).fill(false);
    const flags: boolean[] = [];
    const scores: number[] = [];
    if (inEpisode) {
      for (let j = 0; j < WINDOWS_PER_EPOCH; j++) if (j % 3 !== 2) scoredPos[j] = true;
    } else {
      const n = phone || awakeBurst ? 6 : 1 + Math.floor(r() * 3);
      for (let c = 0; c < n; c++) scoredPos[Math.floor(r() * WINDOWS_PER_EPOCH)] = true;
    }
    // Isolated false flags: one single window in a handful of epochs (never forming a stretch).
    const isolated = !inEpisode && i % 97 === 41;
    let isolatedUsed = false;
    for (let j = 0; j < WINDOWS_PER_EPOCH; j++) {
      if (!scoredPos[j]) continue;
      const flag = inEpisode || (isolated && !isolatedUsed);
      if (!inEpisode && isolated && !isolatedUsed) isolatedUsed = true;
      flags.push(flag);
      scores.push(quantizeScore(flag ? 0.82 + 0.12 * r() : 0.04 + 0.3 * r()));
    }
    const scored = flags.length;
    const tooQuiet = phone ? 0 : Math.floor(r() * 3);
    const total = WINDOWS_PER_EPOCH;
    const base = inEpisode ? { p10: -52, p50: -41, p90: -30 } : awakeBurst ? { p10: -55, p50: -46, p90: -28 } : phone ? { p10: -50, p50: -42, p90: -33 } : { p10: -58, p50: -53, p90: -48 };
    const rec: EpochRecord = {
      i,
      t: SAMPLE_NIGHT_START_MS + i * EPOCH_MS,
      cap: 30,
      lvl: { p10: Math.round((base.p10 + jitter) * 10) / 10, p50: Math.round((base.p50 + jitter) * 10) / 10, p90: Math.round((base.p90 + jitter) * 10) / 10 },
      floor: -58,
      win: { total, belowGate: total - scored - tooQuiet, tooQuiet, scored, snoreLike: flags.filter(Boolean).length },
      speechLikeSec: i >= 20 && i < 22 ? 8 : 0,
      handlingEvents: awakeBurst ? 4 : 0,
      loudNonSnoreSec: awakeBurst ? 12 : 0,
      motionSec: null,
      charging: true,
      appActive: phone,
      battery: 80,
      state: 'uncertain',
      reasons: [],
      bwHz: 7600,
    };
    if (scored > 0) {
      rec.scoredMask = encodeBits(scoredPos);
      rec.snoreBits = encodeBits(flags);
      rec.scoreQ = encodeScores(scores);
    }
    raw.push(rec);
  }
  const schedule = sampleNightSchedule();
  const est = estimateEpochStates(raw, schedule);
  const epochs = raw.map((e, idx) => ({ ...e, state: est[idx]!.state, reasons: est[idx]!.reasons }));
  const record: NightRecord = {
    id: `sample-night-${variant}`,
    deviceModel: 'Sample (synthetic)',
    osVersion: 'n/a',
    appVersion: 'sample',
    modelVersion: SAMPLE_NIGHT_MODEL_VERSION,
    nightHeuristicsVersion: NIGHT_HEURISTICS_VERSION,
    epochSchemaVersion: EPOCH_SCHEMA_VERSION,
    settings: SETTINGS,
    captureStart: SAMPLE_NIGHT_START_MS,
    captureEnd: SAMPLE_NIGHT_START_MS + EPOCHS * EPOCH_MS,
    endReason: 'scheduled-end',
    gaps: [],
    sampleRateReported: 16000,
    isSynthetic: true,
    source: 'sample-assembled',
    retention: RETENTION_DEFAULT,
  };
  return { record, epochs, schedule };
}

export function buildSampleNightView(variant: SampleNightVariant = 'snore-episodes'): NightView {
  const s = buildSampleNight(variant);
  return summarizeNight(s.record, s.epochs, s.schedule);
}
