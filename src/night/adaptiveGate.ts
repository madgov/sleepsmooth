// Adaptive level gate (docs/EVAL_PROTOCOL.md section 9). Pure TypeScript, no React, Expo or DOM imports.
//
// A window is analysed iff  level >= max(silenceFloor, floor + GATE_DB)   (tier 1: windows that clearly stand out)
//                      or  (level >= max(silenceFloor, floor + GATE_LOW_DB) AND spectralFlatness <= GATE_FLATNESS_CAP)   (tier 2).
// `floor` is a rolling 10th percentile of per-second level over a configurable horizon (RollingFloor). Tier 2 exists so quiet,
// stationary bedrooms are not left unanalysed merely because a window is within a few dB of its own background; it admits only windows
// that are not stationary-noise-like (low flatness = tonal or low-frequency heavy).
//
// Engineering settings chosen on SYNTHETIC nights only (model/adaptive_gate.synthetic.json). They are NOT clinical thresholds and say
// nothing about real bedrooms. Reference implementation: scripts/eval/adaptive_gate.py (flatness_of, rolling_floors); the fixture
// src/night/adaptiveGate.fixture.json is generated from it and checked by adaptiveGate.test.ts.
import { fft, hannWindow } from '../audio/features/fft';

export const FLAT_FRAMES = 8;
export const FLAT_FRAME_LEN = 512;
export const FLAT_BIN_LO = 8; // 250 Hz at 16 kHz / 512
export const FLAT_BIN_HI = 240; // exclusive: 7500 Hz
export const FLAT_EPS = 1e-18;
const WINDOW_LEN = 16000;

let hann: Float64Array | null = null;
const re = new Float64Array(FLAT_FRAME_LEN);
const im = new Float64Array(FLAT_FRAME_LEN);

/**
 * Spectral flatness (0..1, geometric over arithmetic mean of the power spectrum, 250 to 7500 Hz) of the 1 s window starting at `buf[start]`.
 * Eight Hann-windowed 512-sample frames spread over the window, power averaged across frames. Flat noise is near 1; tonal or low-frequency-heavy
 * sound is near 0. Needs `start + 16000 <= buf.length`.
 */
export function spectralFlatness(buf: Float32Array, start: number): number {
  hann ??= hannWindow(FLAT_FRAME_LEN);
  const nb = FLAT_BIN_HI - FLAT_BIN_LO;
  const p = new Float64Array(nb);
  for (let f = 0; f < FLAT_FRAMES; f++) {
    const s = start + Math.round((f * (WINDOW_LEN - FLAT_FRAME_LEN)) / (FLAT_FRAMES - 1));
    for (let i = 0; i < FLAT_FRAME_LEN; i++) {
      re[i] = (buf[s + i] as number) * (hann[i] as number);
      im[i] = 0;
    }
    fft(re, im);
    for (let b = 0; b < nb; b++) {
      const bin = b + FLAT_BIN_LO;
      p[b] = (p[b] as number) + (re[bin] as number) ** 2 + (im[bin] as number) ** 2;
    }
  }
  let sumLog = 0;
  let sum = 0;
  for (let b = 0; b < nb; b++) {
    const v = (p[b] as number) / FLAT_FRAMES;
    sumLog += Math.log(v + FLAT_EPS);
    sum += v;
  }
  return Math.exp(sumLog / nb) / (sum / nb + FLAT_EPS);
}

const HIST_MIN_DB = -120;
const HIST_BINS = 121;

/**
 * Rolling percentile of per-second dB over the last `horizonSec` seconds (1 dB bins). Same arithmetic as the pipeline's own floor
 * (and scripts/eval/night_logic.py window_status): the floor for second s is read BEFORE second s is added; until `minHistorySec`
 * seconds exist the floor is `seed`.
 */
export class RollingFloor {
  private readonly hist = new Int32Array(HIST_BINS);
  private count = 0;
  private readonly bins = new Map<number, number>();
  constructor(
    private readonly horizonSec: number,
    private readonly percentile: number,
    private readonly minHistorySec: number,
    private readonly silenceFloorDb: number,
    private seed: number = silenceFloorDb,
  ) {}

  setSeed(db: number): void {
    this.seed = db;
  }

  private static bin(db: number): number {
    return Math.max(0, Math.min(HIST_BINS - 1, Math.round(db) - HIST_MIN_DB));
  }

  /** Floor to use for the second about to be added. */
  current(): number {
    if (this.count < this.minHistorySec) return this.seed;
    const target = Math.max(1, Math.ceil(this.percentile * this.count));
    let acc = 0;
    for (let i = 0; i < HIST_BINS; i++) {
      acc += this.hist[i] as number;
      if (acc >= target) return Math.max(this.silenceFloorDb, i + HIST_MIN_DB);
    }
    return this.silenceFloorDb;
  }

  /** Add second `s` (its dB level) and drop second s - horizon. */
  add(s: number, db: number): void {
    const b = RollingFloor.bin(db);
    this.hist[b]!++;
    this.count++;
    this.bins.set(s, b);
    const old = s - this.horizonSec;
    const ob = this.bins.get(old);
    if (ob !== undefined) {
      this.hist[ob]!--;
      this.count--;
    }
    this.bins.delete(old - 1);
  }
}

export interface GateParams {
  /** Tier 1 margin over the floor, dB. */
  marginDb: number;
  /** Tier 2 margin over the floor, dB (<= marginDb). */
  lowMarginDb: number;
  /** Tier 2 flatness cap. */
  flatnessCap: number;
}

/** Which tier (if any) admits a window. `flatness` is called lazily, only when tier 2 could apply. */
export function gateTier(levelDb: number, floorDb: number, silenceFloorDb: number, p: GateParams, flatness: () => number): 0 | 1 | 2 {
  if (levelDb < silenceFloorDb) return 0;
  if (levelDb >= Math.max(silenceFloorDb, floorDb + p.marginDb)) return 1;
  if (p.lowMarginDb < p.marginDb && levelDb >= Math.max(silenceFloorDb, floorDb + p.lowMarginDb) && flatness() <= p.flatnessCap) return 2;
  return 0;
}
