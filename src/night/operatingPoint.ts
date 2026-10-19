// Night-level operating point for the YAMNet v3 head: flag, confirm k-of-n, group into segments.
// Pure TS port of scripts/eval/night_logic.py (kofn_confirm, find_segments); operatingPoint.test.ts reproduces its outputs on
// src/night/operatingPoint.fixture.json. The numbers below are the point chosen BEFORE the nights were scored, by the rule in
// docs/MODEL_ERROR_REPORT.md section 0 (model/segment_eval.synthetic.json, key "chosen"). They were selected and checked on SYNTHETIC
// nights only. They are engineering settings, not clinical thresholds, and say nothing about how often a real night is flagged.
import { WINDOW_HOP_SEC, WINDOW_SEC } from './constants';

export const V3_OPERATING_POINT = {
  /** Flag a scored window when the v3 head probability is at least this. */
  headThreshold: 0.98,
  /** A flagged window is confirmed if some run of CONFIRM_N consecutive window indices containing it has at least CONFIRM_K flagged windows. */
  confirmN: 14, // 14 windows at a 0.5 s hop = 7 s
  confirmK: 2,
  /** A segment needs at least this many confirmed windows with gaps of at most the episode gap (NIGHT_EPISODE_MAX_GAP_SEC). */
  minConfirmed: 3,
} as const;

/**
 * Is window `k` confirmed? `isFlagged(j)` says whether raw-flagged window j exists. Window k itself must be flagged. Equivalent to
 * night_logic.kofn_confirm: some run [j, j+n-1] with j in [k-n+1, k] contains at least `kMin` flagged windows.
 */
export function isConfirmed(k: number, isFlagged: (j: number) => boolean, n: number = V3_OPERATING_POINT.confirmN, kMin: number = V3_OPERATING_POINT.confirmK): boolean {
  if (!isFlagged(k)) return false;
  if (kMin <= 1) return true;
  // Counts of flagged windows in [j, j+n-1] for every start j that covers k, via one sliding sum.
  const lo = k - n + 1;
  let count = 0;
  for (let j = lo; j < lo + n; j++) if (isFlagged(j)) count++; // run starting at lo covers [lo, k]
  if (count >= kMin) return true;
  for (let start = lo + 1; start <= k; start++) {
    if (isFlagged(start - 1)) count--;
    if (isFlagged(start + n - 1)) count++;
    if (count >= kMin) return true;
  }
  return false;
}

/** Confirmed window indices among `flagged` (any order, duplicates ignored), ascending. */
export function kofnConfirm(flagged: readonly number[], n: number = V3_OPERATING_POINT.confirmN, kMin: number = V3_OPERATING_POINT.confirmK): number[] {
  const set = new Set(flagged);
  return Array.from(set)
    .sort((a, b) => a - b)
    .filter((k) => isConfirmed(k, (j) => set.has(j), n, kMin));
}

export interface Segment {
  t0Sec: number;
  t1Sec: number;
  n: number;
  k0: number;
  k1: number;
}

/** Port of night_logic.find_segments (and summary.findEpisodes with a given minimum): runs of window indices with gaps of at most maxGapSec. */
export function findSegments(windowIdx: readonly number[], minFlagged: number, maxGapSec: number): Segment[] {
  const ks = Array.from(new Set(windowIdx)).sort((a, b) => a - b);
  const out: Segment[] = [];
  let run: number[] = [];
  const close = () => {
    if (run.length >= minFlagged) {
      const k0 = run[0] as number;
      const k1 = run[run.length - 1] as number;
      out.push({ t0Sec: k0 * WINDOW_HOP_SEC, t1Sec: k1 * WINDOW_HOP_SEC + WINDOW_SEC, n: run.length, k0, k1 });
    }
    run = [];
  };
  for (const k of ks) {
    if (run.length > 0 && (k - (run[run.length - 1] as number)) * WINDOW_HOP_SEC - WINDOW_SEC > maxGapSec) close();
    run.push(k);
  }
  close();
  return out;
}
