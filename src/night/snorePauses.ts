// "Snore-like sound paused and then restarted": a per-night count of pauses between stretches of snore-like windows.
// Pure TypeScript, derived only from the persisted epochs (flagged windows), so it applies to old nights too.
//
// WHAT THIS IS: an acoustic-pattern observation. A pause is a quiet stretch of at least PAUSE_MIN_GAP_SEC and at most
// PAUSE_MAX_GAP_SEC between two stretches ("bouts") of snore-like windows, where every second between them was captured.
// It is the same pattern the clip picker tags "Snoring stopped, then restarted" (same two numbers, checked by a test).
//
// WHAT THIS IS NOT:
//  - Not an apnea event, not a breathing pause, not a count of anything clinical. 10 s is the clip picker's number, not a
//    diagnostic threshold. Phone audio does not measure airflow.
//  - No rate (per hour), no severity, no score. Only a count, shown in the night's Details.
//  - "Restarted louder" is NOT assessed: epochs keep no per-window level, so the count does not look at loudness.
//  - A pause only counts when the quiet stretch was fully captured. A recording gap, an overload skip or an epoch the phone
//    guessed was awake (it is dropped by the caller) never counts as "the snoring stopped".
//  - Windows under the level gate are not analysed. Quiet between two bouts therefore means "no window flagged", not "no sound".
import { decodeBits } from './codec';
import { EPOCH_SEC, WINDOWS_PER_EPOCH, WINDOW_HOP_SEC, WINDOW_SEC } from './constants';
import type { NightView } from './summary';
import type { EpochRecord } from './types';

export const PAUSE_MIN_GAP_SEC = 10;
export const PAUSE_MAX_GAP_SEC = 120;
/** Each side of a pause must be a bout of at least this many flagged windows, so two stray flags 15 s apart are not a pattern. PROVISIONAL. */
export const PAUSE_MIN_BOUT_WINDOWS = 3;

export interface SnorePauseResult {
  /** Number of pauses. Never rendered as a rate. */
  count: number;
  /** Bouts of snore-like windows considered (those with at least PAUSE_MIN_BOUT_WINDOWS flagged windows), for tests and tuning. */
  bouts: number;
}

interface Bout {
  first: number;
  last: number;
  n: number;
}

/** Flagged window indices, as in summary.flaggedWindowIndices, but the scored mask is read per epoch here as well. */
function flaggedKs(epochs: readonly EpochRecord[]): number[] {
  const out: number[] = [];
  for (const e of epochs) {
    if (e.win.scored === 0) continue;
    const mask = decodeBits(e.scoredMask, WINDOWS_PER_EPOCH);
    const flags = decodeBits(e.snoreBits, e.win.scored);
    let q = 0;
    for (let j = 0; j < WINDOWS_PER_EPOCH; j++) {
      if (!mask[j]) continue;
      if (flags[q]) out.push(e.i * WINDOWS_PER_EPOCH + j);
      q++;
    }
  }
  return out;
}

/** Count pauses in the given epochs. Pass only the epochs that belong in the night's default view. `minBoutWindows` is for tuning experiments; the product uses the default. */
export function countSnorePauses(epochs: readonly EpochRecord[], minBoutWindows: number = PAUSE_MIN_BOUT_WINDOWS): SnorePauseResult {
  const byIndex = new Map<number, EpochRecord>();
  for (const e of epochs) byIndex.set(e.i, e);
  const ks = flaggedKs(Array.from(byIndex.values())).sort((a, b) => a - b);

  // Bouts: flagged windows with less than PAUSE_MIN_GAP_SEC of quiet between one window's end and the next one's start.
  const gapSec = (k1: number, k2: number) => (k2 - k1) * WINDOW_HOP_SEC - WINDOW_SEC;
  const bouts: Bout[] = [];
  for (const k of ks) {
    const b = bouts[bouts.length - 1];
    if (b && gapSec(b.last, k) < PAUSE_MIN_GAP_SEC) {
      b.last = k;
      b.n++;
    } else bouts.push({ first: k, last: k, n: 1 });
  }

  const captured = (from: number, to: number): boolean => {
    for (let i = from; i <= to; i++) {
      const e = byIndex.get(i);
      if (!e || e.cap < EPOCH_SEC || (e.overload ?? 0) > 0) return false;
    }
    return true;
  };

  let count = 0;
  let strong = 0;
  for (let i = 0; i < bouts.length; i++) {
    const a = bouts[i] as Bout;
    if (a.n >= minBoutWindows) strong++;
    const b = bouts[i + 1];
    if (!b || a.n < minBoutWindows || b.n < minBoutWindows) continue;
    const gap = gapSec(a.last, b.first);
    if (gap < PAUSE_MIN_GAP_SEC || gap > PAUSE_MAX_GAP_SEC) continue;
    if (!captured(Math.floor(a.last / WINDOWS_PER_EPOCH), Math.floor(b.first / WINDOWS_PER_EPOCH))) continue;
    count++;
  }
  return { count, bouts: strong };
}

/** The night's default view: epochs the phone guessed asleep or uncertain (the same ones the verdict uses). */
export function snorePausesForView(view: Pick<NightView, 'epochs' | 'estimates'>): SnorePauseResult {
  const use = view.epochs.filter((_, idx) => {
    const st = view.estimates[idx]?.state;
    return st === 'likely-asleep' || st === 'uncertain';
  });
  return countSnorePauses(use);
}
