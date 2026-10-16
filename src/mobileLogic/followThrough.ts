// Follow-through tracker state: four optional ticks and one optional user-set reminder date. Pure logic; storage is up to the caller.
// No streaks, no counts of days, no celebration. Unproven aid (see pathway.ts).
import { TRACKER_ITEMS } from '../content/pathway';

export const TRACKER_IDS: readonly string[] = TRACKER_ITEMS.map((t) => t.id);

/** Keeps only known tracker ids, once each, in tracker order. */
export function sanitizeTrackerTicks(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const set = new Set(raw.filter((x): x is string => typeof x === 'string'));
  return TRACKER_IDS.filter((id) => set.has(id));
}

/** Returns a new list with `id` flipped. Unknown ids are ignored. Other stored ids are kept as they were. */
export function toggleTick(ticks: readonly string[], id: string): string[] {
  if (!TRACKER_IDS.includes(id)) return [...ticks];
  return ticks.includes(id) ? ticks.filter((x) => x !== id) : [...ticks, id];
}

export interface ReminderChoice {
  id: string;
  label: string;
  days: number;
}
export const REMINDER_CHOICES: ReminderChoice[] = [
  { id: 'd3', label: 'In 3 days', days: 3 },
  { id: 'd7', label: 'In 1 week', days: 7 },
  { id: 'd14', label: 'In 2 weeks', days: 14 },
];

/** 09:00 local time, `days` after `from`. */
export function reminderDate(from: Date, days: number): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days, 9, 0, 0, 0);
  return d;
}

/** A stored reminder date only counts while it is in the future and parses. */
export function activeReminder(iso: unknown, now: Date): Date | null {
  if (typeof iso !== 'string') return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) && t > now.getTime() ? new Date(t) : null;
}
