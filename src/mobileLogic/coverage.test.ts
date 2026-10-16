import { describe, expect, it } from 'vitest';
import { buildNightFromFlags, run, TEST_NIGHT_START_MS } from '../night/testkit';
import { EPOCH_MS } from '../night/constants';
import { assessOutcome, assessOutcomeLine, computeCoverage, coverageHeadline, coverageOutsideLine, coverageRuns, durationText, GAP_BIN_SHARE } from './coverage';

const night = (o: Parameters<typeof buildNightFromFlags>[0] = {}) => buildNightFromFlags(o);

describe('durationText', () => {
  it('formats hours and minutes', () => {
    expect(durationText(7 * 3600 + 40 * 60)).toBe('7 h 40 m');
    expect(durationText(8 * 3600)).toBe('8 h 00 m');
    expect(durationText(45 * 60)).toBe('45 m');
    expect(durationText(0)).toBe('0 m');
    expect(durationText(-5)).toBe('0 m');
  });
});

describe('bin kinds in a quiet room', () => {
  const epochsWith = (scored: number) =>
    Array.from({ length: 4 }, (_, i) => ({ t: i * EPOCH_MS, cap: 30, win: { total: 60, belowGate: 60 - scored, tooQuiet: 0, scored, snoreLike: 0 } }));
  const sched = { startMs: 0, endMs: 4 * EPOCH_MS };
  it('a bin with a quarter of its time scored is drawn as assessable, so sparse analysed time is not hidden', () => {
    expect(computeCoverage(epochsWith(15), sched, 1).bins).toEqual(['assessable']);
  });
  it('a bin with almost nothing scored stays not-assessable', () => {
    expect(computeCoverage(epochsWith(3), sched, 1).bins).toEqual(['not-assessable']);
  });
});

describe('computeCoverage', () => {
  it('a full night with every window scored is all assessable', () => {
    const b = night({ scoredOnlyK: run(0, 960 * 60) });
    const c = computeCoverage(b.epochs, b.schedule);
    expect(c.seconds.scheduled).toBe(8 * 3600);
    expect(c.seconds.recordedInWindow).toBe(8 * 3600);
    expect(c.seconds.notRecorded).toBe(0);
    expect(c.seconds.assessable).toBeCloseTo(8 * 3600, 3);
    expect(c.bins.every((k) => k === 'assessable')).toBe(true);
  });

  it('windows that were not scored are recorded-but-not-assessable, never counted as assessable', () => {
    const b = night({ belowGatePerEpoch: 60 }); // nothing scored
    const c = computeCoverage(b.epochs, b.schedule);
    expect(c.seconds.assessable).toBe(0);
    expect(c.seconds.notAssessable).toBe(8 * 3600);
    expect(c.bins.every((k) => k === 'not-assessable')).toBe(true);
    expect(assessOutcome(c)).toBe('could-not-assess');
    expect(coverageHeadline(c)).toMatch(/None of the recorded time could be assessed/);
  });

  it('half-scored epochs split their seconds in proportion', () => {
    const b = night({ epochs: 2, scoredOnlyK: run(0, 30), belowGatePerEpoch: 30, scheduleHours: 1 });
    // epoch 0: 30 scored + 30 belowGate (the 60 windows of epoch 1 are all unscored: total 0)
    const c = computeCoverage(b.epochs, b.schedule);
    expect(c.seconds.assessable).toBeCloseTo(15, 5);
    expect(c.seconds.notAssessable).toBeCloseTo(45, 5);
  });

  it('time inside the schedule with no epochs is a gap', () => {
    const b = night({ epochs: 480, scoredOnlyK: run(0, 480 * 60) }); // 4 h recorded of an 8 h window
    const c = computeCoverage(b.epochs, b.schedule);
    expect(c.seconds.recordedInWindow).toBe(4 * 3600);
    expect(c.seconds.notRecorded).toBe(4 * 3600);
    const runs = coverageRuns(c.bins);
    expect(runs.map((r) => r.kind)).toEqual(['assessable', 'not-recorded']);
    expect(runs[0]?.count).toBe(48);
  });

  it('a mid-night hole is shown as a gap even when it is a small share of the bin run', () => {
    const b = night({ scoredOnlyK: run(0, 960 * 60) });
    const epochs = b.epochs.filter((e) => e.i < 200 || e.i >= 220); // 10 minutes missing
    const c = computeCoverage(epochs, b.schedule);
    expect(c.seconds.notRecorded).toBe(600);
    expect(c.bins.filter((k) => k === 'not-recorded').length).toBeGreaterThanOrEqual(2);
    expect(GAP_BIN_SHARE).toBeLessThanOrEqual(0.5);
  });

  it('audio before the scheduled start is outside, and extends the timeline', () => {
    const b = night({ epochs: 970, scoredOnlyK: run(0, 970 * 60) });
    const shifted = b.epochs.map((e) => ({ ...e, t: e.t - 10 * EPOCH_MS })); // starts 5 minutes before bedtime
    const c = computeCoverage(shifted, b.schedule);
    expect(c.seconds.recordedOutside).toBeGreaterThanOrEqual(300);
    expect(c.startMs).toBe(TEST_NIGHT_START_MS - 300_000);
    expect(c.bins[0]).toBe('outside');
    expect(coverageOutsideLine(c)).toMatch(/outside your sleep hours/);
  });

  it('no epochs: nothing recorded, nothing assessed', () => {
    const b = night();
    const c = computeCoverage([], b.schedule);
    expect(c.seconds.recordedInWindow).toBe(0);
    expect(c.seconds.notRecorded).toBe(8 * 3600);
    expect(c.bins.every((k) => k === 'not-recorded')).toBe(true);
    expect(coverageHeadline(c)).toBe('Nothing was recorded in your 8 h 00 m sleep hours. Nothing could be assessed.');
  });

  it('no schedule: uses the span of the recording and reports no gap', () => {
    const b = night({ epochs: 100, scoredOnlyK: run(0, 6000) });
    const c = computeCoverage(b.epochs, null);
    expect(c.seconds.scheduled).toBe(3000);
    expect(c.seconds.notRecorded).toBe(0);
  });

  it('the headline matches the requested form', () => {
    const b = night({ epochs: 920, scoredOnlyK: run(0, 740 * 60 + 30), belowGatePerEpoch: 0 });
    const c = computeCoverage(b.epochs, b.schedule);
    expect(coverageHeadline(c)).toMatch(/^Recorded 7 h 40 m of 8 h 00 m\. \d h \d\d m could be assessed\.$/);
  });
});

describe('assessOutcome keeps "nothing found" and "could not assess" apart', () => {
  it('none found: scored windows exist, none snore-like', () => {
    const b = night({ scoredOnlyK: run(0, 600) });
    const c = computeCoverage(b.epochs, b.schedule);
    expect(assessOutcome(c)).toBe('none-found');
    const line = assessOutcomeLine('none-found') ?? '';
    expect(line).toMatch(/does not rule out sleep apnea/);
    expect(line).not.toMatch(/no snoring|healthy|normal/i);
  });
  it('could not assess says it is not a sign that all is well', () => {
    expect(assessOutcomeLine('could-not-assess')).toMatch(/not a sign that all is well/);
  });
  it('found has no extra line (the night card carries it)', () => {
    expect(assessOutcomeLine('found')).toBeNull();
  });
  it('snore-like windows give "found"', () => {
    const b = night({ flaggedK: run(0, 10) });
    expect(assessOutcome(computeCoverage(b.epochs, b.schedule))).toBe('found');
  });
});
