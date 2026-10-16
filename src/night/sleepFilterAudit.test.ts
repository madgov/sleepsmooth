// Audit (reliability review, point 7) and the verdict policy that came out of it.
//
// FINDINGS (2026-10-14), each pinned by a test below:
//  1. Epochs the estimate calls "uncertain" (including the first 10 minutes, "onset-pending") were already counted.
//  2. Epochs the estimate calls "likely-awake" inside the scheduled window were NOT counted, so snore-like windows there
//     were silently dropped from the totals.
//  3. Worst case: the app left on screen all night labels every epoch likely-awake, so the night read "not assessed"
//     although the whole night was recorded and scored.
// POLICY (2026-10-15, docs/OVERNIGHT_PLAN.md addendum): the sleep estimate is unvalidated, so it must not hide evidence.
// Every captured epoch inside the scheduled window counts toward the totals and the verdict, whatever the estimate says.
// The estimate only annotates (sensitivity.inLikelyAwake). "Not assessed" remains for uncaptured or unscorable time.
import { describe, expect, it } from 'vitest';
import { summarizeNight } from './summary';
import { buildNightFromFlags, run } from './testkit';
import type { EpochRecord } from './types';

const nightWith = (flagged: number[], tweak: (e: EpochRecord, i: number) => EpochRecord) => {
  const b = buildNightFromFlags({ epochs: 960, flaggedK: flagged });
  const epochs = b.epochs.map(tweak);
  return summarizeNight(b.record, epochs, b.schedule);
};
const epochK = (epoch: number) => epoch * 60; // first window index of an epoch

describe('sleep-state filter audit', () => {
  it('uncertain time inside the schedule is counted in the default view', () => {
    // epochs 2..9 are inside the first 10 minutes: the estimate is still "uncertain" (onset pending)
    const v = nightWith(run(epochK(2), 30), (e) => e);
    expect(v.estimates[2]?.state).toBe('uncertain');
    expect(v.summary.sensitivity.asleepOnly.snoreLikeWindows).toBe(0);
    expect(v.summary.sensitivity.withUncertain.snoreLikeWindows).toBe(30);
    expect(v.summary.snoreLikeWindows).toBe(30); // the headline figure includes uncertain time
  });

  it('snore-like windows in likely-awake epochs are counted in the totals and annotated', () => {
    const awakeEpochs = new Set([100, 101, 102, 103]);
    const flagged = [...run(epochK(100), 40), ...run(epochK(300), 20)]; // 40 windows in awake epochs, 20 in a quiet stretch
    const v = nightWith(flagged, (e) => (awakeEpochs.has(e.i) ? { ...e, motionSec: 12 } : e));
    expect(v.estimates[101]?.state).toBe('likely-awake');
    expect(v.summary.snoreLikeWindows).toBe(60);
    expect(v.summary.sensitivity.withUncertain.snoreLikeWindows).toBe(20); // context only
    expect(v.summary.sensitivity.inLikelyAwake.snoreLikeWindows).toBe(40); // the annotation
    expect(v.summary.episodes.length).toBe(2);
  });

  it('screen on all night: every epoch is likely-awake, yet the night gets a real verdict', () => {
    const flagged = [...run(epochK(100), 30), ...run(epochK(200), 30), ...run(epochK(300), 30)];
    const v = nightWith(flagged, (e) => ({ ...e, appActive: true }));
    expect(v.estimates[500]?.state).toBe('likely-awake');
    expect(v.summary.assessedSec).toBe(960 * 30);
    expect(v.summary.snoreLikeWindows).toBe(90);
    // Same audio with the screen off (estimate: not awake) gives the same verdict, whatever the episode thresholds are.
    const screenOff = nightWith(flagged, (e) => e);
    expect(v.summary.nightState).toBe(screenOff.summary.nightState);
    expect(v.summary.nightState === 'snore-like-observed' || v.summary.nightState === 'few-observations').toBe(true);
    expect(v.summary.episodes).toEqual(screenOff.summary.episodes);
    expect(v.summary.notAssessedReasons).toEqual([]);
    expect(v.summary.sensitivity.inLikelyAwake.snoreLikeWindows).toBe(90);
  });

  it('screen on all night with nothing scorable stays not assessed (uncaptured/too-quiet time is never read as a verdict)', () => {
    const v = nightWith([], (e) => ({ ...e, appActive: true }));
    expect(v.summary.nightState).toBe('not-assessed');
    expect(v.summary.snoreLikeWindows).toBe(0);
  });

  it('screen on all night with scored windows but no snore-like ones gives few-observations, not all-clear and not not-assessed', () => {
    const b = buildNightFromFlags({ epochs: 960, scoredOnlyK: run(0, 960 * 60, 6) });
    const v = summarizeNight(b.record, b.epochs.map((e) => ({ ...e, appActive: true })), b.schedule);
    expect(v.summary.nightState).toBe('few-observations');
    expect(v.summary.assessableWindows).toBeGreaterThan(0);
  });

  it('epochs that were not captured (cap 0) still do not count as assessed time', () => {
    const v = nightWith(run(epochK(100), 30), (e) => (e.i >= 480 ? { ...e, cap: 0, win: { total: 0, belowGate: 0, tooQuiet: 0, scored: 0, snoreLike: 0 } } : e));
    expect(v.summary.assessedSec).toBe(480 * 30);
    expect(v.summary.notCapturedSec).toBeGreaterThanOrEqual(480 * 30);
  });

  it('epochs outside the scheduled window are never counted', () => {
    const b = buildNightFromFlags({ epochs: 960, flaggedK: run(0, 10) });
    // shrink the schedule so epoch 0 is outside it
    const schedule = { startMs: b.schedule.startMs + 3600_000, endMs: b.schedule.endMs };
    const v = summarizeNight(b.record, b.epochs, schedule);
    expect(v.summary.snoreLikeWindows).toBe(0);
    expect(v.summary.sensitivity.inLikelyAwake.snoreLikeWindows).toBe(0);
  });
});
