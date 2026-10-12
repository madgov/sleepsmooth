import { describe, expect, it } from 'vitest';
import { aggregateHealthNights, healthLine, healthNightFor, type HealthSleepSample } from './healthSleep';
import { DAY_MS, HOUR_MS, MIN_MS, mergeIntervals, minuteOfDay, nightKey, type Interval } from './intervals';
import { MotionAccumulator, MOTION_MAX_DT_SEC, MOTION_THRESHOLD_G } from './motionSeconds';
import { activitiesToStationary, chargingIntervals, defaultRoutineMemory, pickNights, shouldOfferRoutine, sourceLabel, suggestRoutine, ROUTINE_MIN_NIGHTS } from './routine';

const UTC = () => 0;
const DAY0 = Date.UTC(2026, 9, 1); // a UTC midnight
const at = (day: number, h: number, m = 0) => DAY0 + day * DAY_MS + h * HOUR_MS + m * MIN_MS;
const night = (day: number, bedH: number, bedM: number, wakeH: number, wakeM: number): Interval => ({ startMs: at(day, bedH, bedM), endMs: at(day + 1, wakeH, wakeM) });
const now = at(8, 12);

describe('intervals', () => {
  it('night key groups an evening with the next morning and splits at noon', () => {
    expect(nightKey(at(2, 23), UTC)).toBe(nightKey(at(3, 7), UTC));
    expect(nightKey(at(3, 13), UTC)).not.toBe(nightKey(at(3, 7), UTC));
    expect(minuteOfDay(at(0, 23, 40), UTC)).toBe(23 * 60 + 40);
  });
  it('merges gaps', () => {
    expect(mergeIntervals([{ startMs: 0, endMs: 10 }, { startMs: 15, endMs: 20 }, { startMs: 100, endMs: 110 }], 5)).toEqual([{ startMs: 0, endMs: 20 }, { startMs: 100, endMs: 110 }]);
  });
});

describe('activitiesToStationary', () => {
  it('builds stationary intervals, the last runs to the query end', () => {
    const r = activitiesToStationary([{ startMs: 0, stationary: false }, { startMs: 10, stationary: true }, { startMs: 50, stationary: false }, { startMs: 60, stationary: true }], 100);
    expect(r).toEqual([{ startMs: 10, endMs: 50 }, { startMs: 60, endMs: 100 }]);
  });
});

describe('suggestRoutine', () => {
  const nights = [night(0, 23, 30, 7, 0), night(1, 23, 50, 7, 20), night(2, 23, 40, 7, 10), night(4, 0, 10, 7, 30), night(5, 23, 40, 7, 0)];
  it('needs at least 3 nights', () => {
    expect(suggestRoutine({ nowMs: now, stationary: nights.slice(0, ROUTINE_MIN_NIGHTS - 1), offset: UTC })).toBeNull();
    expect(suggestRoutine({ nowMs: now, stationary: nights.slice(0, 3), offset: UTC })).not.toBeNull();
  });
  it('uses the median onset and end (crossing midnight) and reports the nights used', () => {
    const r = suggestRoutine({ nowMs: now, stationary: nights, offset: UTC });
    expect(r).toMatchObject({ bedMin: 23 * 60 + 40, wakeMin: 7 * 60 + 10, nights: 5, basis: 'phone-stillness', fromStillness: 5, fromHealth: 0 });
  });
  it('ignores naps and daytime stillness', () => {
    const noise: Interval[] = [{ startMs: at(1, 14), endMs: at(1, 16) }, { startMs: at(2, 13), endMs: at(2, 21) }, { startMs: at(3, 2), endMs: at(3, 3, 30) }];
    expect(suggestRoutine({ nowMs: now, stationary: [...nights.slice(0, 3), ...noise], offset: UTC })?.nights).toBe(3);
  });
  it('merges a short bathroom gap into one stretch', () => {
    const split: Interval[] = [];
    for (const n of nights.slice(0, 3)) split.push({ startMs: n.startMs, endMs: n.startMs + 4 * HOUR_MS }, { startMs: n.startMs + 4 * HOUR_MS + 10 * MIN_MS, endMs: n.endMs });
    expect(suggestRoutine({ nowMs: now, stationary: split, offset: UTC })?.nights).toBe(3);
  });
  it('excludes a night still in progress', () => {
    expect(suggestRoutine({ nowMs: at(3, 3), stationary: nights.slice(0, 3), offset: UTC })).toBeNull();
  });
  it('Apple Health beats phone stillness for the same night', () => {
    const health = aggregateHealthNights(
      nights.slice(0, 3).map((n): HealthSleepSample => ({ startMs: n.startMs + 30 * MIN_MS, endMs: n.endMs - 10 * MIN_MS, kind: 'asleep', source: 'Apple Watch' })),
      UTC,
    );
    const r = suggestRoutine({ nowMs: now, stationary: nights.slice(0, 3), health, offset: UTC });
    expect(r).toMatchObject({ nights: 3, fromHealth: 3, basis: 'apple-health' });
    expect(sourceLabel(r!)).toBe('From Apple Health');
  });
  it('a tie between two equal stretches on one night goes to the charging one', () => {
    const a: Interval = { startMs: at(0, 19), endMs: at(0, 23, 30) };
    const b: Interval = { startMs: at(1, 0), endMs: at(1, 4, 30) };
    const pick = (charging: Interval) => pickNights({ nowMs: now, stationary: [a, b], charging: [charging], offset: UTC }).map((n) => n.startMs);
    expect(pick(b)).toEqual([b.startMs]);
    expect(pick(a)).toEqual([a.startMs]);
  });
});

describe('shouldOfferRoutine', () => {
  const s = { bedMin: 1420, wakeMin: 430, nights: 5, fromHealth: 0, fromStillness: 5, basis: 'phone-stillness' as const };
  it('is hidden when it matches the current schedule, after "Not now", or without a suggestion', () => {
    const mem = defaultRoutineMemory();
    expect(shouldOfferRoutine(s, { bedMin: 23 * 60, wakeMin: 7 * 60 }, mem, now)).toBe(true);
    expect(shouldOfferRoutine(s, { bedMin: 1425, wakeMin: 425 }, mem, now)).toBe(false);
    expect(shouldOfferRoutine(s, { bedMin: 23 * 60, wakeMin: 7 * 60 }, { ...mem, dismissedAt: new Date(now - DAY_MS).toISOString() }, now)).toBe(false);
    expect(shouldOfferRoutine(s, { bedMin: 23 * 60, wakeMin: 7 * 60 }, { ...mem, dismissedAt: new Date(now - 8 * DAY_MS).toISOString() }, now)).toBe(true);
    expect(shouldOfferRoutine(null, { bedMin: 0, wakeMin: 0 }, mem, now)).toBe(false);
  });
});

describe('health nights', () => {
  const samples: HealthSleepSample[] = [
    { startMs: at(0, 23, 52), endMs: at(1, 2), kind: 'asleep', source: 'Apple Watch' },
    { startMs: at(1, 2, 20), endMs: at(1, 6, 58), kind: 'asleep', source: 'Apple Watch' },
    { startMs: at(0, 23, 30), endMs: at(1, 7), kind: 'inBed', source: 'iPhone' },
  ];
  it('merges across short awake spells, prefers asleep over in bed, keeps no stages', () => {
    const n = aggregateHealthNights(samples, UTC);
    expect(n).toHaveLength(1);
    expect(n[0]).toMatchObject({ kind: 'asleep', startMs: at(0, 23, 52), endMs: at(1, 6, 58), source: 'Apple Watch' });
  });
  it('falls back to in bed and words it as such', () => {
    const n = aggregateHealthNights([samples[2] as HealthSleepSample], UTC);
    expect(n[0]?.kind).toBe('inBed');
    expect(healthLine(n[0]!, () => 'X')).toBe('Apple Health recorded time in bed from X to X (source: iPhone)');
  });
  it('matches a recorded night by overlap and writes the line', () => {
    const n = aggregateHealthNights(samples, UTC);
    expect(healthNightFor({ startMs: at(0, 23), endMs: at(1, 7) }, n)).toEqual(n[0]);
    expect(healthNightFor({ startMs: at(5, 23), endMs: at(6, 7) }, n)).toBeNull();
    expect(healthLine(n[0]!, (ms) => (ms === at(0, 23, 52) ? '11:52 pm' : '6:58 am'))).toBe('Apple Health recorded sleep from 11:52 pm to 6:58 am (source: Apple Watch)');
  });
});

describe('MotionAccumulator', () => {
  it('counts nothing for a still phone, including a constant tilt', () => {
    const a = new MotionAccumulator();
    for (let i = 0; i < 300; i++) a.add(0.1, -0.2, 0.97, i * 100);
    expect(a.drain()).toBe(0);
  });
  it('counts roughly the shaking time (10 Hz samples above the threshold)', () => {
    const a = new MotionAccumulator();
    for (let i = 0; i < 100; i++) a.add(0, 0, 1, i * 100);
    for (let i = 100; i < 150; i++) a.add(i % 2 ? 0.2 : -0.2, 0, 1, i * 100); // 5 s of shaking
    expect(a.drain()).toBeGreaterThan(4);
    expect(a.drain()).toBe(0);
  });
  it('a sensor stall cannot add more than the cap per sample, and bad values are ignored', () => {
    const a = new MotionAccumulator();
    a.add(0, 0, 1, 0);
    a.add(1, 0, 1, 60_000);
    expect(a.drain()).toBe(MOTION_MAX_DT_SEC);
    a.add(NaN, 0, 0, 1);
    expect(a.drain()).toBe(0);
    expect(MOTION_THRESHOLD_G).toBeGreaterThan(0);
  });
});

describe('chargingIntervals', () => {
  it('merges consecutive charging epochs and ignores unknown or unplugged ones', () => {
    const e = (t: number, charging: boolean | null) => ({ t, charging });
    const out = chargingIntervals([e(0, true), e(30_000, true), e(60_000, false), e(90_000, null), e(120_000, true)]);
    expect(out).toEqual([{ startMs: 0, endMs: 60_000 }, { startMs: 120_000, endMs: 150_000 }]);
  });
  it('is empty without data', () => expect(chargingIntervals([])).toEqual([]));
});
