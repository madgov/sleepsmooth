// Small interval helpers shared by the routine suggestion and the Apple Health night matching. Pure TypeScript.
export interface Interval {
  startMs: number;
  endMs: number;
}

export const MIN_MS = 60_000;
export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

/** Offset in minutes east of UTC in force at `atMs`. */
export type OffsetFn = (atMs: number) => number;
export const localOffset: OffsetFn = (atMs) => -new Date(atMs).getTimezoneOffset();

/** Minute of the local day (0..1439). */
export function minuteOfDay(ms: number, off: OffsetFn): number {
  const local = ms + off(ms) * MIN_MS;
  return Math.floor((((local % DAY_MS) + DAY_MS) % DAY_MS) / MIN_MS);
}

/**
 * Night key: the local calendar day whose noon most recently preceded `ms`. A night that starts at 11:40 pm and ends at
 * 7:10 am the next morning has one key. Daytime hours after noon belong to the key of that day's coming night.
 */
export function nightKey(ms: number, off: OffsetFn): number {
  const local = ms + off(ms) * MIN_MS - 12 * HOUR_MS;
  return Math.floor(local / DAY_MS);
}

/** Sort and merge intervals separated by at most `gapMs`. Drops empty or inverted ones. */
export function mergeIntervals(list: readonly Interval[], gapMs: number): Interval[] {
  const s = list.filter((x) => Number.isFinite(x.startMs) && Number.isFinite(x.endMs) && x.endMs > x.startMs).sort((a, b) => a.startMs - b.startMs);
  const out: Interval[] = [];
  for (const x of s) {
    const last = out[out.length - 1];
    if (last && x.startMs - last.endMs <= gapMs) last.endMs = Math.max(last.endMs, x.endMs);
    else out.push({ startMs: x.startMs, endMs: x.endMs });
  }
  return out;
}

export function overlapMs(a: Interval, b: Interval): number {
  return Math.max(0, Math.min(a.endMs, b.endMs) - Math.max(a.startMs, b.startMs));
}

/** Median of numbers; even counts average the two middle values. */
export function median(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return NaN;
  return n % 2 ? (s[(n - 1) / 2] as number) : ((s[n / 2 - 1] as number) + (s[n / 2] as number)) / 2;
}
