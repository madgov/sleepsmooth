// Audit (reliability review, point 7): can the unvalidated sleep-state estimate exclude useful audio?
//
// FINDINGS, each pinned by a test below:
//  1. Epochs the estimate calls "uncertain" (including the first 10 minutes, "onset-pending") ARE counted in the default
//     view (sensitivity.withUncertain feeds the headline, the night state and the episode rule). Nothing to change there.
//  2. Epochs the estimate calls "likely-awake" inside the scheduled window are NOT counted in the default view. A strong
//     awake indicator is one of: app on screen, plug change, speech-like sound, 10 s of phone movement. Turning over in
//     bed while snoring can raise the motion indicator, so snore-like windows can be dropped from the headline.
//  3. Worst case: the app left on screen all night labels every epoch likely-awake, so the headline says "not assessed"
//     although the whole night was recorded and scored. The audio is not lost, but the headline hides it.
// RESPONSE (documented in docs/OVERNIGHT_PLAN.md addendum and the UI): the verdict rules are not changed, because
// switching them without validation would change what the night state means. Instead summary.sensitivity.allInWindow is
// computed, and night detail always shows a separate line with the snore-like windows found in time estimated as awake.
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

  it('snore-like windows in likely-awake epochs are excluded from the default view but kept in allInWindow', () => {
    const awakeEpochs = new Set([100, 101, 102, 103]);
    const flagged = [...run(epochK(100), 40), ...run(epochK(300), 20)]; // 40 windows in awake epochs, 20 in a quiet stretch
    const v = nightWith(flagged, (e) => (awakeEpochs.has(e.i) ? { ...e, motionSec: 12 } : e));
    expect(v.estimates[101]?.state).toBe('likely-awake');
    expect(v.summary.sensitivity.withUncertain.snoreLikeWindows).toBe(20);
    expect(v.summary.snoreLikeWindows).toBe(20);
    expect(v.summary.sensitivity.allInWindow.snoreLikeWindows).toBe(60);
  });

  it('worst case: app left on screen all night hides every window from the headline, but allInWindow still counts them', () => {
    const flagged = [...run(epochK(100), 30), ...run(epochK(200), 30), ...run(epochK(300), 30)];
    const v = nightWith(flagged, (e) => ({ ...e, appActive: true }));
    expect(v.summary.assessedSec).toBe(0);
    expect(v.summary.nightState).toBe('not-assessed');
    expect(v.summary.snoreLikeWindows).toBe(0);
    expect(v.summary.sensitivity.allInWindow.snoreLikeWindows).toBe(90);
    expect(v.summary.recordedSec).toBeGreaterThan(0); // the recording itself is intact
  });

  it('allInWindow never includes epochs outside the scheduled window', () => {
    const b = buildNightFromFlags({ epochs: 960, flaggedK: run(0, 10) });
    // shrink the schedule so epoch 0 is outside it
    const schedule = { startMs: b.schedule.startMs + 3600_000, endMs: b.schedule.endMs };
    const v = summarizeNight(b.record, b.epochs, schedule);
    expect(v.summary.sensitivity.allInWindow.snoreLikeWindows).toBe(0);
  });
});
