// Routine suggestion: a typical bedtime and wake time from the phone's own stillness history, and from Apple Health sleep
// records when the user connected them. Pure TypeScript. The native side only hands over raw intervals.
//
// Honest limits (shown in the UI as "Phone stillness (estimate)"):
//   - Phone stillness is not sleep. A phone left on a desk looks the same as a sleeper's phone. This is an UNVALIDATED estimate.
//   - Method: per night, take the longest overnight stationary stretch (>= 4 h, onset between 6 pm and 4 am), merge stretches
//     separated by short gaps, ignore daytime and naps. The suggestion is the median onset and the median end over at least
//     3 nights. Apple Health records, when present for a night, take priority over phone stillness for that night.
//   - The app never changes the schedule from this. The user must tap "Use this".
import { DAY_MS, HOUR_MS, MIN_MS, localOffset, mergeIntervals, median, minuteOfDay, nightKey, overlapMs, type Interval, type OffsetFn } from './intervals';
import type { HealthNight } from './healthSleep';

export const ROUTINE_MIN_NIGHTS = 3;
export const ROUTINE_MAX_DAYS = 7;
/** Phone stillness: stretches separated by up to this gap (a bathroom trip, a pickup) are one stretch. */
export const STILLNESS_MERGE_GAP_MS = 20 * MIN_MS;
export const STILLNESS_MIN_STRETCH_MS = 4 * HOUR_MS;
export const HEALTH_MIN_STRETCH_MS = 3 * HOUR_MS;
/** Onset window for an overnight stretch: 18:00 .. 04:00 local. */
export const ONSET_FROM_MIN = 18 * 60;
export const ONSET_TO_MIN = 4 * 60;
const SNAP_MIN = 5;

/** One CMMotionActivity change reported by the phone: from `startMs` the activity was `stationary` until the next event. */
export interface ActivityEvent {
  startMs: number;
  stationary: boolean;
}

/** Turn activity change events into stationary intervals. The last event lasts until `queryEndMs`. */
export function activitiesToStationary(events: readonly ActivityEvent[], queryEndMs: number): Interval[] {
  const s = events.filter((e) => Number.isFinite(e.startMs)).sort((a, b) => a.startMs - b.startMs);
  const out: Interval[] = [];
  s.forEach((e, i) => {
    const end = i + 1 < s.length ? (s[i + 1] as ActivityEvent).startMs : queryEndMs;
    if (e.stationary && end > e.startMs) out.push({ startMs: e.startMs, endMs: end });
  });
  return mergeIntervals(out, 0);
}

export type RoutineSource = 'health' | 'stillness';

export interface NightStretch extends Interval {
  key: number;
  source: RoutineSource;
}

export interface RoutineInput {
  nowMs: number;
  /** Stationary intervals from the phone (already built with activitiesToStationary). May be empty. */
  stationary: readonly Interval[];
  /** Apple Health nights (priority over stillness). Optional. */
  health?: readonly HealthNight[];
  /** Times the phone was charging (from the nights we logged). Used only to break ties between stretches. */
  charging?: readonly Interval[];
  offset?: OffsetFn;
}

export interface RoutineSuggestion {
  bedMin: number;
  wakeMin: number;
  nights: number;
  /** How many of the nights came from each source. */
  fromHealth: number;
  fromStillness: number;
  /** 'phone-stillness' is the unvalidated phone estimate; 'apple-health' when every night came from Health. */
  basis: 'phone-stillness' | 'apple-health' | 'mixed';
}

function onsetOk(ms: number, off: OffsetFn): boolean {
  const m = minuteOfDay(ms, off);
  return m >= ONSET_FROM_MIN || m < ONSET_TO_MIN;
}

/** Longest qualifying overnight stretch per night key, from phone stillness. */
export function stillnessStretches(i: RoutineInput): NightStretch[] {
  const off = i.offset ?? localOffset;
  const merged = mergeIntervals(i.stationary, STILLNESS_MERGE_GAP_MS).filter(
    (x) => x.endMs <= i.nowMs && x.endMs - x.startMs >= STILLNESS_MIN_STRETCH_MS && x.startMs >= i.nowMs - (ROUTINE_MAX_DAYS + 1) * DAY_MS && onsetOk(x.startMs, off),
  );
  const best = new Map<number, NightStretch>();
  const chargeMs = (x: Interval) => (i.charging ?? []).reduce((a, c) => a + overlapMs(x, c), 0);
  for (const x of merged) {
    const key = nightKey(x.startMs, off);
    const cur = best.get(key);
    const better = !cur || x.endMs - x.startMs > cur.endMs - cur.startMs || (x.endMs - x.startMs === cur.endMs - cur.startMs && chargeMs(x) > chargeMs(cur));
    if (better) best.set(key, { ...x, key, source: 'stillness' });
  }
  return [...best.values()];
}

/** Recent nights from Apple Health that are long enough. */
export function healthStretches(i: RoutineInput): NightStretch[] {
  const off = i.offset ?? localOffset;
  return (i.health ?? [])
    .filter((h) => h.endMs <= i.nowMs && h.endMs - h.startMs >= HEALTH_MIN_STRETCH_MS && h.startMs >= i.nowMs - (ROUTINE_MAX_DAYS + 1) * DAY_MS && onsetOk(h.startMs, off))
    .map((h) => ({ startMs: h.startMs, endMs: h.endMs, key: nightKey(h.startMs, off), source: 'health' as const }));
}

/** Per night, Health beats stillness. At most ROUTINE_MAX_DAYS most recent nights. */
export function pickNights(i: RoutineInput): NightStretch[] {
  const byKey = new Map<number, NightStretch>();
  for (const s of stillnessStretches(i)) byKey.set(s.key, s);
  for (const s of healthStretches(i)) byKey.set(s.key, s);
  return [...byKey.values()].sort((a, b) => b.key - a.key).slice(0, ROUTINE_MAX_DAYS);
}

const snap = (m: number) => ((Math.round(m / SNAP_MIN) * SNAP_MIN) % 1440 + 1440) % 1440;

/** Median of minutes-of-day that wrap at midnight: shift so `pivot` is the start of the axis. */
function circularMedian(mins: readonly number[], pivot: number): number {
  const shifted = mins.map((m) => (((m - pivot) % 1440) + 1440) % 1440);
  return (median(shifted) + pivot) % 1440;
}

/** Null when fewer than ROUTINE_MIN_NIGHTS nights qualify. */
export function suggestRoutine(i: RoutineInput): RoutineSuggestion | null {
  const off = i.offset ?? localOffset;
  const nights = pickNights(i);
  if (nights.length < ROUTINE_MIN_NIGHTS) return null;
  const bed = circularMedian(nights.map((n) => minuteOfDay(n.startMs, off)), ONSET_FROM_MIN - 6 * 60);
  const wake = circularMedian(nights.map((n) => minuteOfDay(n.endMs, off)), 18 * 60);
  const fromHealth = nights.filter((n) => n.source === 'health').length;
  return {
    bedMin: snap(bed),
    wakeMin: snap(wake),
    nights: nights.length,
    fromHealth,
    fromStillness: nights.length - fromHealth,
    basis: fromHealth === 0 ? 'phone-stillness' : fromHealth === nights.length ? 'apple-health' : 'mixed',
  };
}

// ---- when to show the card ------------------------------------------------------------------------------------------
export const DISMISS_QUIET_DAYS = 7;
export const SAME_AS_CURRENT_WITHIN_MIN = 15;

export interface RoutineMemory {
  /** ISO time the user tapped "Not now". */
  dismissedAt: string | null;
  /** ISO time of the last successful lookup. */
  lastFoundAt: string | null;
}
export const defaultRoutineMemory = (): RoutineMemory => ({ dismissedAt: null, lastFoundAt: null });
const iso = (x: unknown): string | null => (typeof x === 'string' && Number.isFinite(Date.parse(x)) ? x : null);
export function mergeRoutineMemory(raw: unknown): RoutineMemory {
  if (!raw || typeof raw !== 'object') return defaultRoutineMemory();
  const r = raw as Partial<RoutineMemory>;
  return { dismissedAt: iso(r.dismissedAt), lastFoundAt: iso(r.lastFoundAt) };
}

const circDiff = (a: number, b: number) => Math.min(Math.abs(a - b), 1440 - Math.abs(a - b));
/** Offer only when it differs from the current schedule and the user has not said "Not now" recently. */
export function shouldOfferRoutine(s: RoutineSuggestion | null, current: { bedMin: number; wakeMin: number }, mem: RoutineMemory, nowMs: number): boolean {
  if (!s) return false;
  if (circDiff(s.bedMin, current.bedMin) <= SAME_AS_CURRENT_WITHIN_MIN && circDiff(s.wakeMin, current.wakeMin) <= SAME_AS_CURRENT_WITHIN_MIN) return false;
  if (mem.dismissedAt && nowMs - Date.parse(mem.dismissedAt) < DISMISS_QUIET_DAYS * DAY_MS) return false;
  return true;
}

export function sourceLabel(s: RoutineSuggestion): string {
  return s.basis === 'phone-stillness' ? 'Phone stillness (estimate)' : s.basis === 'apple-health' ? 'From Apple Health' : 'From Apple Health and phone stillness (estimate)';
}

/** Intervals during which the phone was charging, from the epoch log of recorded nights (charging history we already log). */
export function chargingIntervals(epochs: readonly { t: number; charging: boolean | null }[], epochMs = 30_000): Interval[] {
  const out: Interval[] = [];
  for (const e of epochs) if (e.charging === true) out.push({ startMs: e.t, endMs: e.t + epochMs });
  return mergeIntervals(out, epochMs);
}
