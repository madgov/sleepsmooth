import { describe, expect, it } from 'vitest';
import { EPOCH_MS, EST_GRACE_AFTER_WAKE_MS, EST_ONSET_EPOCHS } from './constants';
import { SleepEstimator, estimateEpochStates, resolveScheduleWindow, type EstimatorInput } from './estimator';
import type { ScheduleWindow } from './types';

const T0 = 1_000_000_000_000;
const SCHEDULE: ScheduleWindow = { startMs: T0, endMs: T0 + 8 * 3600_000 };

function ep(i: number, over: Partial<EstimatorInput> = {}): EstimatorInput {
  return {
    t: T0 + i * EPOCH_MS,
    cap: 30,
    lvl: { p10: -62, p50: -58, p90: -40 }, // p90 well above floor + 8: not "quiet" by default
    floor: -62,
    speechLikeSec: 0,
    handlingEvents: 0,
    loudNonSnoreSec: 0,
    motionSec: null,
    charging: null,
    appActive: false,
    ...over,
  };
}
const run = (epochs: EstimatorInput[], schedule: ScheduleWindow | null = SCHEDULE) => estimateEpochStates(epochs, schedule);
const clean = (n: number, from = 0, over: Partial<EstimatorInput> = {}) => Array.from({ length: n }, (_, k) => ep(from + k, over));

describe('window and capture gates', () => {
  it('outside the scheduled window is outside-window (start inclusive, end + grace exclusive)', () => {
    const e = [ep(-1), ep(0), ep((8 * 3600_000 + EST_GRACE_AFTER_WAKE_MS) / EPOCH_MS - 1), ep((8 * 3600_000 + EST_GRACE_AFTER_WAKE_MS) / EPOCH_MS)];
    const s = run(e).map((x) => x.state);
    expect(s[0]).toBe('outside-window');
    expect(s[1]).not.toBe('outside-window');
    expect(s[2]).not.toBe('outside-window');
    expect(s[3]).toBe('outside-window');
    expect(run([ep(-1)])[0]!.reasons).toEqual(['out-of-window']);
  });
  it('under 15 s captured is not-captured; exactly 15 s is captured', () => {
    expect(run([ep(0, { cap: 14.9 })])[0]!.state).toBe('not-captured');
    expect(run([ep(0, { cap: 15 })])[0]!.state).not.toBe('not-captured');
  });
  it('without a schedule every epoch counts as inside the window', () => {
    expect(run([ep(-5)], null)[0]!.state).toBe('uncertain');
  });
  it('a not-captured or outside epoch restarts the onset run', () => {
    const e = [...clean(19, 0, { charging: true }), ep(19, { cap: 0, charging: true }), ...clean(5, 20, { charging: true })];
    const s = run(e);
    expect(s[20]!.reasons).toContain('onset-pending');
    expect(s[24]!.state).toBe('uncertain');
  });
});

describe('awake indicators', () => {
  const asleepEpochs = (n = 25) => clean(n, 0, { charging: true });
  const withAt = (idx: number, over: Partial<EstimatorInput>, n = 25) => asleepEpochs(n).map((e, i) => (i === idx ? { ...e, ...over } : e));

  it('speech-like sound for 5 s or more is a strong indicator; 4.5 s is not', () => {
    expect(run(withAt(22, { speechLikeSec: 5 }))[22]!.state).toBe('likely-awake');
    expect(run(withAt(22, { speechLikeSec: 5 }))[22]!.reasons).toContain('speech-like');
    expect(run(withAt(22, { speechLikeSec: 4.5 }))[22]!.state).toBe('likely-asleep');
  });
  it('the app being active is a strong indicator', () => {
    const s = run(withAt(22, { appActive: true }))[22]!;
    expect(s.state).toBe('likely-awake');
    expect(s.reasons).toContain('screen-or-app-active');
  });
  it('a charger plug change is a strong indicator', () => {
    const s = run(withAt(22, { charging: false }))[22]!;
    expect(s.state).toBe('likely-awake');
    expect(s.reasons).toContain('plug-change');
  });
  it('motion of 10 s or more is a strong indicator; unavailable motion is simply not counted', () => {
    expect(run(withAt(22, { motionSec: 10 }))[22]!.reasons).toContain('motion');
    expect(run(withAt(22, { motionSec: 9 }))[22]!.state).not.toBe('likely-awake');
    expect(run(withAt(22, { motionSec: null }))[22]!.state).toBe('likely-asleep');
  });
  it('one weak indicator alone is not awake but restarts the quiet run', () => {
    const s = run(withAt(22, { handlingEvents: 3 }));
    expect(s[22]!.state).toBe('uncertain');
    expect(s[22]!.reasons).toContain('handling-sounds');
    expect(s[23]!.state).toBe('uncertain'); // onset restarts
    expect(s[23]!.reasons).toContain('onset-pending');
  });
  it('fewer than 3 handling events or under 10 s of loud non-snore sound is not an indicator', () => {
    expect(run(withAt(22, { handlingEvents: 2, loudNonSnoreSec: 9 }))[22]!.state).toBe('likely-asleep');
  });
  it('two weak indicators together are awake', () => {
    const s = run(withAt(22, { handlingEvents: 3, loudNonSnoreSec: 10 }))[22]!;
    expect(s.state).toBe('likely-awake');
    expect(s.reasons).toEqual(expect.arrayContaining(['handling-sounds', 'loud-non-snore']));
  });
  it('a weak indicator on two consecutive epochs is awake on the second', () => {
    const e = asleepEpochs().map((x, i) => (i === 22 || i === 23 ? { ...x, loudNonSnoreSec: 12 } : x));
    const s = run(e);
    expect(s[22]!.state).toBe('uncertain');
    expect(s[23]!.state).toBe('likely-awake');
    expect(s[24]!.state).toBe('uncertain');
  });
  it('after waking, ten minutes of clean epochs are needed again', () => {
    const e = [...asleepEpochs(25), ep(25, { appActive: true, charging: true }), ...clean(25, 26, { charging: true })];
    const s = run(e);
    expect(s[25]!.state).toBe('likely-awake');
    for (let k = 26; k < 26 + EST_ONSET_EPOCHS - 1; k++) expect(s[k]!.state).toBe('uncertain');
    expect(s[26 + EST_ONSET_EPOCHS - 1]!.state).toBe('likely-asleep');
  });
});

describe('onset and support signals', () => {
  it('19 clean epochs stay uncertain (onset-pending); the 20th with support is likely-asleep', () => {
    const s = run(clean(21, 0, { charging: true }));
    for (let k = 0; k < 19; k++) {
      expect(s[k]!.state).toBe('uncertain');
      expect(s[k]!.reasons).toContain('onset-pending');
    }
    expect(s[19]!.state).toBe('likely-asleep');
    expect(s[19]!.reasons).toEqual(['in-window', 'charging']);
  });
  it('stillness alone supports it', () => {
    const s = run(clean(21, 0, { motionSec: 0 }));
    expect(s[20]!.state).toBe('likely-asleep');
    expect(s[20]!.reasons).toContain('still');
  });
  it('sustained quiet alone supports it (p90 under floor + 8 dB for 10 minutes)', () => {
    const s = run(clean(25, 0, { lvl: { p10: -62, p50: -60, p90: -56 } }));
    expect(s[20]!.state).toBe('likely-asleep');
    expect(s[20]!.reasons).toContain('sustained-quiet');
  });
  it('one noisy epoch inside the quiet span breaks sustained quiet', () => {
    const e = clean(25, 0, { lvl: { p10: -62, p50: -60, p90: -56 } }).map((x, i) => (i === 10 ? { ...x, lvl: { p10: -62, p50: -55, p90: -40 } } : x));
    expect(run(e)[22]!.state).toBe('uncertain');
  });
  it('with no supporting signal the epoch stays uncertain after onset (no onset-pending reason)', () => {
    const s = run(clean(25, 0, { charging: false }));
    expect(s[22]!.state).toBe('uncertain');
    expect(s[22]!.reasons).toEqual(['in-window']);
  });
  it('charging false is never a penalty by itself', () => {
    expect(run(clean(25, 0, { charging: false, motionSec: 0 }))[22]!.state).toBe('likely-asleep');
  });
});

describe('scripted scenarios', () => {
  it('reading in bed on a charger with no motion data and a quiet room becomes likely-asleep (a known limit)', () => {
    const s = run(clean(40, 0, { charging: true, lvl: { p10: -62, p50: -60, p90: -56 } }));
    expect(s[39]!.state).toBe('likely-asleep');
  });
  it('phone picked up mid-night: one awake epoch, then ten minutes of onset', () => {
    const e = clean(60, 0, { charging: true }).map((x, i) => (i === 30 ? { ...x, appActive: true } : x));
    const s = run(e).map((x) => x.state);
    expect(s[30]).toBe('likely-awake');
    expect(s[31]).toBe('uncertain');
    expect(s[49]).toBe('uncertain');
    expect(s[50]).toBe('likely-asleep');
  });
  it('TV on: speech-like sound makes the epochs awake even when everything else looks like sleep', () => {
    const e = clean(60, 0, { charging: true, motionSec: 0 }).map((x, i) => (i >= 30 && i < 40 ? { ...x, speechLikeSec: 20, loudNonSnoreSec: 20 } : x));
    const s = run(e).map((x) => x.state);
    for (let k = 30; k < 40; k++) expect(s[k]).toBe('likely-awake');
  });
  it('a snore-dominated epoch (loud, but not counted as loud non-snore) is classified by the other signals', () => {
    const loud = { lvl: { p10: -50, p50: -35, p90: -25 } };
    const withSupport = run(clean(40, 0, { charging: true, ...loud }));
    expect(withSupport[35]!.state).toBe('likely-asleep');
    const noSupport = run(clean(40, 0, { charging: false, ...loud }));
    expect(noSupport[35]!.state).toBe('uncertain');
  });
  it('every optional signal unavailable: never likely-asleep unless the room is quiet', () => {
    const s = run(clean(60, 0));
    expect(s.every((x) => x.state === 'uncertain')).toBe(true);
  });
  it('replay equals stepping', () => {
    const epochs = clean(50, 0, { charging: true });
    const est = new SleepEstimator(SCHEDULE);
    expect(epochs.map((e) => est.step(e))).toEqual(run(epochs));
  });
});

describe('resolveScheduleWindow', () => {
  const settings = { bedtimeLocal: '23:00', wakeLocal: '07:00' };
  it('UTC: capture at 23:05 gives 23:00 to 07:00 next day', () => {
    const w = resolveScheduleWindow(Date.UTC(2026, 0, 15, 23, 5), settings, 0);
    expect(w.startMs).toBe(Date.UTC(2026, 0, 15, 23, 0));
    expect(w.endMs).toBe(Date.UTC(2026, 0, 16, 7, 0));
  });
  it('capture after midnight belongs to the previous evening', () => {
    const w = resolveScheduleWindow(Date.UTC(2026, 0, 16, 1, 30), settings, 0);
    expect(w.startMs).toBe(Date.UTC(2026, 0, 15, 23, 0));
    expect(w.endMs).toBe(Date.UTC(2026, 0, 16, 7, 0));
  });
  it('capture in the afternoon belongs to tonight', () => {
    const w = resolveScheduleWindow(Date.UTC(2026, 0, 15, 17, 0), settings, 0);
    expect(w.startMs).toBe(Date.UTC(2026, 0, 15, 23, 0));
  });
  it('applies the UTC offset (UTC+5:30)', () => {
    const w = resolveScheduleWindow(Date.UTC(2026, 0, 15, 17, 35), settings, 330);
    expect(w.startMs).toBe(Date.UTC(2026, 0, 15, 17, 30));
    expect(w.endMs).toBe(Date.UTC(2026, 0, 16, 1, 30));
  });
  it('handles a same-day window (bed 01:00, wake 08:30)', () => {
    const w = resolveScheduleWindow(Date.UTC(2026, 0, 15, 1, 10), { bedtimeLocal: '01:00', wakeLocal: '08:30' }, 0);
    expect(w.startMs).toBe(Date.UTC(2026, 0, 15, 1, 0));
    expect(w.endMs).toBe(Date.UTC(2026, 0, 15, 8, 30));
  });
  it('rejects malformed times', () => {
    expect(() => resolveScheduleWindow(0, { bedtimeLocal: '25:00', wakeLocal: '07:00' }, 0)).toThrow();
    expect(() => resolveScheduleWindow(0, { bedtimeLocal: 'late', wakeLocal: '07:00' }, 0)).toThrow();
  });
});
