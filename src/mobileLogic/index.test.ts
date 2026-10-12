import { describe, expect, it } from 'vitest';
import {
  bystanderAckIsFresh,
  dbToMeter,
  epochMinutes,
  formatClock,
  formatDuration,
  formatElapsed,
  isWithinSleepWindow,
  meterBand,
  minutesInBed,
  nextOccurrence,
  pushLevel,
  shouldStack,
  skipTarget,
  spokenDuration,
  spokenElapsed,
} from './index';

describe('mobileLogic', () => {
  it('formats clock times with a non-breaking space before am/pm', () => {
    expect(formatClock(23 * 60)).toBe('11:00 pm');
    expect(formatClock(0)).toBe('12:00 am');
    expect(formatClock(12 * 60 + 5)).toBe('12:05 pm');
    expect(formatClock(-60)).toBe('11:00 pm');
  });
  it('wraps minutes in bed past midnight', () => {
    expect(minutesInBed(23 * 60, 7 * 60)).toBe(8 * 60);
    expect(minutesInBed(60, 120)).toBe(60);
    expect(minutesInBed(480, 480)).toBe(1440);
  });
  it('formats durations', () => {
    expect(formatDuration(480)).toBe('8 h');
    expect(formatDuration(450)).toBe('7 h 30 min');
    expect(formatDuration(45)).toBe('45 min');
    expect(spokenDuration(432)).toBe('7 hours 12 minutes');
    expect(spokenDuration(61)).toBe('1 hour 1 minute');
  });
  it('formats elapsed time', () => {
    expect(formatElapsed(42 * 60 + 10)).toBe('0:42:10');
    expect(formatElapsed(-5)).toBe('0:00:00');
    expect(spokenElapsed(42 * 60 + 10)).toBe('42 minutes 10 seconds');
    expect(spokenElapsed(3600)).toBe('1 hour 0 minutes 0 seconds');
  });
  it('maps dBFS to a 0..1 drawing scale and handles bad input', () => {
    expect(dbToMeter(-70)).toBe(0);
    expect(dbToMeter(-10)).toBe(1);
    expect(dbToMeter(-40)).toBeCloseTo(0.5);
    expect(dbToMeter(-120)).toBe(0);
    expect(dbToMeter(0)).toBe(1);
    expect(dbToMeter(null)).toBe(0);
    expect(dbToMeter(Number.NaN)).toBe(0);
  });
  it('bands the meter coarsely', () => {
    expect(meterBand(0)).toBe('low');
    expect(meterBand(0.5)).toBe('medium');
    expect(meterBand(0.9)).toBe('high');
  });
  it('keeps a fixed-size level history', () => {
    const h = pushLevel([], 0.5, 4);
    expect(h).toEqual([0, 0, 0, 0.5]);
    expect(pushLevel(h, 0.7, 4)).toEqual([0, 0, 0.5, 0.7]);
    expect(pushLevel(h, 0.7, 4)).toHaveLength(4);
  });
  it('treats the bystander acknowledgement as fresh for 14 days only', () => {
    const now = Date.parse('2026-10-20T00:00:00Z');
    expect(bystanderAckIsFresh('2026-10-10T00:00:00Z', now)).toBe(true);
    expect(bystanderAckIsFresh('2026-10-01T00:00:00Z', now)).toBe(false);
    expect(bystanderAckIsFresh(null, now)).toBe(false);
    expect(bystanderAckIsFresh('garbage', now)).toBe(false);
    expect(bystanderAckIsFresh('2026-11-01T00:00:00Z', now)).toBe(false);
  });
  it('finds the next occurrence of a wall-clock time', () => {
    const now = new Date(2026, 9, 11, 22, 0, 0).getTime();
    const n = nextOccurrence(7 * 60, now);
    expect(n.getDate()).toBe(12);
    expect(n.getHours()).toBe(7);
  });
  it('detects the sleep window across midnight', () => {
    expect(isWithinSleepWindow(23 * 60 + 30, 23 * 60, 7 * 60)).toBe(true);
    expect(isWithinSleepWindow(3 * 60, 23 * 60, 7 * 60)).toBe(true);
    expect(isWithinSleepWindow(12 * 60, 23 * 60, 7 * 60)).toBe(false);
  });
  it('skip never goes past the last page', () => {
    expect(skipTarget(2, 6)).toBe(5);
    expect(skipTarget(5, 6)).toBe(5);
  });
  it('stacks at large font scales', () => {
    expect(shouldStack(1.49)).toBe(false);
    expect(shouldStack(1.5)).toBe(true);
  });
  it('sums epoch minutes per state', () => {
    expect(epochMinutes(['a', 'a', 'b'], 30)).toEqual({ a: 60, b: 30 });
  });
});
