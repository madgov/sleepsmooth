// Apple Health sleep records, reduced to one asleep-or-in-bed stretch per night. Pure TypeScript.
//
// The native module returns raw samples. Here they are aggregated to "asleep" versus "in bed" only: stages are never
// kept or shown. Apple Health data is shown next to our own estimate and never merged with it.
import { HOUR_MS, MIN_MS, localOffset, mergeIntervals, nightKey, overlapMs, type Interval, type OffsetFn } from './intervals';

export interface HealthSleepSample extends Interval {
  kind: 'asleep' | 'inBed';
  /** Display name of the source device or app, as Apple Health reports it (for example "Apple Watch"). */
  source: string;
}

export interface HealthNight extends Interval {
  key: number;
  /** 'asleep' when the night has asleep records, otherwise 'inBed'. */
  kind: 'asleep' | 'inBed';
  source: string;
}

/** Asleep pieces separated by awake spells up to this long are one stretch for the night. */
export const HEALTH_MERGE_GAP_MS = 60 * MIN_MS;

/** One stretch per night key: the longest merged stretch, preferring asleep records over in-bed records. */
export function aggregateHealthNights(samples: readonly HealthSleepSample[], off: OffsetFn = localOffset): HealthNight[] {
  const groups = new Map<number, { asleep: HealthSleepSample[]; inBed: HealthSleepSample[] }>();
  for (const s of samples) {
    if (!(s.endMs > s.startMs) || !Number.isFinite(s.startMs)) continue;
    const key = nightKey(s.startMs, off);
    const g = groups.get(key) ?? { asleep: [], inBed: [] };
    (s.kind === 'asleep' ? g.asleep : g.inBed).push(s);
    groups.set(key, g);
  }
  const out: HealthNight[] = [];
  for (const [key, g] of groups) {
    const kind: 'asleep' | 'inBed' = g.asleep.length > 0 ? 'asleep' : 'inBed';
    const pool = kind === 'asleep' ? g.asleep : g.inBed;
    const merged = mergeIntervals(pool, HEALTH_MERGE_GAP_MS);
    const longest = merged.reduce((a, b) => (b.endMs - b.startMs > a.endMs - a.startMs ? b : a), merged[0] as Interval);
    // Source: whichever source contributes the most time inside the chosen stretch.
    const bySource = new Map<string, number>();
    for (const s of pool) bySource.set(s.source, (bySource.get(s.source) ?? 0) + overlapMs(s, longest));
    const source = [...bySource.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Apple Health';
    out.push({ key, kind, startMs: longest.startMs, endMs: longest.endMs, source });
  }
  return out.sort((a, b) => a.startMs - b.startMs);
}

/** The Health night that belongs to a recorded night: the one overlapping its capture span by at least 1 hour. */
export function healthNightFor(span: Interval, nights: readonly HealthNight[]): HealthNight | null {
  let best: HealthNight | null = null;
  let bestOverlap = 0;
  for (const n of nights) {
    const o = overlapMs(span, n);
    if (o >= HOUR_MS && o > bestOverlap) {
      best = n;
      bestOverlap = o;
    }
  }
  return best;
}

/** "Apple Health recorded sleep from 11:52 pm to 6:58 am (source: Apple Watch)". Records in bed are described as such. */
export function healthLine(n: HealthNight, clock: (ms: number) => string): string {
  const what = n.kind === 'asleep' ? 'recorded sleep' : 'recorded time in bed';
  return `Apple Health ${what} from ${clock(n.startMs)} to ${clock(n.endMs)} (source: ${n.source})`;
}

/** A step-count boundary around a night, from Apple Health. Informational: shown, never used to change a result. */
export interface StepEdges {
  lastStepBeforeMs: number | null;
  firstStepAfterMs: number | null;
}
