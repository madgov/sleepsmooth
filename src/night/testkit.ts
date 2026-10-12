// Deterministic signal generators for tests and the benchmark. Not used by the product path.
import { SAMPLE_RATE } from '../audio/constants';
import { EPOCH_MS, EPOCH_SCHEMA_VERSION, NIGHT_HEURISTICS_VERSION, WINDOWS_PER_EPOCH } from './constants';
import { encodeBits, encodeScores, quantizeScore } from './codec';
import { RETENTION_DEFAULT, type EpochRecord, type NightRecord, type ScheduleWindow } from './types';

/** Uniform noise in [-1, 1) from a small LCG. */
export function lcg(n: number, seed: number): Float32Array {
  let s = seed >>> 0;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    out[i] = s / 2147483648 - 1;
  }
  return out;
}

/** White-ish noise whose RMS is `dbfs` (uniform noise has RMS 1/sqrt(3)). */
export function noiseAt(seconds: number, dbfs: number, seed = 1, rate = SAMPLE_RATE): Float32Array {
  const x = lcg(Math.round(seconds * rate), seed);
  const g = Math.pow(10, dbfs / 20) * Math.sqrt(3);
  for (let i = 0; i < x.length; i++) x[i] = (x[i] as number) * g;
  return x;
}

export function concat(parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export function silence(seconds: number, rate = SAMPLE_RATE): Float32Array {
  return new Float32Array(Math.round(seconds * rate));
}

/** Split into chunks of `chunk` samples (last one may be shorter). */
export function chunks(x: Float32Array, chunk: number): Float32Array[] {
  const out: Float32Array[] = [];
  for (let i = 0; i < x.length; i += chunk) out.push(x.subarray(i, Math.min(x.length, i + chunk)));
  return out;
}

/**
 * Speech-like test signal: a harmonic source (f0 120 Hz) whose spectral emphasis switches between two
 * "vowel" shapes every 125 ms and whose loudness follows a 4 Hz syllable-like envelope. Synthetic, only
 * for exercising the cue.
 */
export function speechLike(seconds: number, dbfs: number, rate = SAMPLE_RATE): Float32Array {
  const n = Math.round(seconds * rate);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const vowel = Math.floor(t / 0.125) % 2;
    const formants = vowel === 0 ? [700, 1200] : [300, 2300];
    let v = 0;
    for (let h = 1; h <= 25; h++) {
      const f = 120 * h;
      if (f > 3400) break;
      let amp = 0.05;
      for (const fm of formants) amp += Math.exp(-(((f - fm) / 250) ** 2));
      v += (amp / h ** 0.3) * Math.sin(2 * Math.PI * f * t);
    }
    const env = 0.5 * (1 + Math.sin(2 * Math.PI * 4 * t - Math.PI / 2));
    out[i] = v * (0.15 + 0.85 * env);
  }
  let ss = 0;
  for (let i = 0; i < n; i++) ss += (out[i] as number) ** 2;
  const rms = Math.sqrt(ss / Math.max(1, n));
  const g = rms > 0 ? Math.pow(10, dbfs / 20) / rms : 0;
  for (let i = 0; i < n; i++) out[i] = (out[i] as number) * g;
  return out;
}

// ---------------------------------------------------------------------------
// Epoch-level night builder for summary/adapter tests (no audio involved).
// ---------------------------------------------------------------------------

export const TEST_NIGHT_START_MS = Date.UTC(2026, 2, 1, 23, 0, 0);

export interface BuiltNight {
  record: NightRecord;
  epochs: EpochRecord[];
  schedule: ScheduleWindow;
}

export interface NightBuildOptions {
  /** Epochs to generate (default 960 = 8 h). */
  epochs?: number;
  /** Window indices (0.5 s grid) that are scored AND flagged snore-like. */
  flaggedK?: readonly number[];
  /** Window indices that are scored but not flagged. Default: none. */
  scoredOnlyK?: readonly number[];
  /** Windows per epoch that are belowGate / tooQuiet (not scored). */
  belowGatePerEpoch?: number;
  tooQuietPerEpoch?: number;
  isSynthetic?: boolean;
  modelVersion?: string | null;
  sampleRateReported?: number;
  bwHz?: number;
  clipSamplesPerEpoch?: number;
  lvl?: { p10: number; p50: number; p90: number };
  floor?: number;
  endReason?: NightRecord['endReason'];
  scheduleHours?: number;
}

export function buildNightFromFlags(o: NightBuildOptions = {}): BuiltNight {
  const n = o.epochs ?? 960;
  const flagged = new Set(o.flaggedK ?? []);
  const scoredOnly = new Set(o.scoredOnlyK ?? []);
  const epochs: EpochRecord[] = [];
  for (let i = 0; i < n; i++) {
    const pos: boolean[] = new Array<boolean>(WINDOWS_PER_EPOCH).fill(false);
    const flags: boolean[] = [];
    const scores: number[] = [];
    for (let j = 0; j < WINDOWS_PER_EPOCH; j++) {
      const k = i * WINDOWS_PER_EPOCH + j;
      if (flagged.has(k)) {
        pos[j] = true;
        flags.push(true);
        scores.push(quantizeScore(0.9));
      } else if (scoredOnly.has(k)) {
        pos[j] = true;
        flags.push(false);
        scores.push(quantizeScore(0.1));
      }
    }
    const scored = flags.length;
    const belowGate = o.belowGatePerEpoch ?? 0;
    const tooQuiet = o.tooQuietPerEpoch ?? 0;
    const rec: EpochRecord = {
      i,
      t: TEST_NIGHT_START_MS + i * EPOCH_MS,
      cap: 30,
      lvl: o.lvl ?? { p10: -62, p50: -58, p90: -50 },
      floor: o.floor ?? -62,
      win: { total: scored + belowGate + tooQuiet, belowGate, tooQuiet, scored, snoreLike: flags.filter(Boolean).length },
      speechLikeSec: 0,
      handlingEvents: 0,
      loudNonSnoreSec: 0,
      motionSec: null,
      charging: true,
      appActive: false,
      battery: 80,
      state: 'uncertain',
      reasons: [],
      ...(o.bwHz !== undefined ? { bwHz: o.bwHz } : { bwHz: 7600 }),
      ...(o.clipSamplesPerEpoch !== undefined ? { clipSamples: o.clipSamplesPerEpoch } : {}),
    };
    if (scored > 0) {
      rec.scoredMask = encodeBits(pos);
      rec.snoreBits = encodeBits(flags);
      rec.scoreQ = encodeScores(scores);
    }
    epochs.push(rec);
  }
  const hours = o.scheduleHours ?? 8;
  const schedule: ScheduleWindow = { startMs: TEST_NIGHT_START_MS, endMs: TEST_NIGHT_START_MS + hours * 3600_000 };
  const record: NightRecord = {
    id: `test-night-${n}`,
    deviceModel: 'test',
    osVersion: 'test',
    appVersion: 'test',
    modelVersion: o.modelVersion === undefined ? 'test-model-1' : o.modelVersion,
    nightHeuristicsVersion: NIGHT_HEURISTICS_VERSION,
    epochSchemaVersion: EPOCH_SCHEMA_VERSION,
    settings: { bedtimeLocal: '23:00', wakeLocal: '07:00', tz: 'UTC', remindEnabled: false, promptLeadMin: 0 },
    captureStart: TEST_NIGHT_START_MS,
    captureEnd: TEST_NIGHT_START_MS + n * EPOCH_MS,
    endReason: o.endReason ?? 'scheduled-end',
    gaps: [],
    sampleRateReported: o.sampleRateReported ?? 16000,
    isSynthetic: o.isSynthetic ?? false,
    source: o.isSynthetic ? 'sample-assembled' : 'device-recording',
    retention: RETENTION_DEFAULT,
  };
  return { record, epochs, schedule };
}

/** Flagged-window indices for `count` consecutive windows starting at k0 (0.5 s apart). */
export const run = (k0: number, count: number, step = 1): number[] => Array.from({ length: count }, (_, i) => k0 + i * step);
