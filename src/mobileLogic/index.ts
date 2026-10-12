// Pure helpers for the iPhone UI (no React, no React Native, no Expo). Kept under src/ so the root Vitest can test them.
// Nothing here scores, classifies, or interprets health data.

/** Minutes after midnight, 0..1439. */
export type MinuteOfDay = number;

const NBSP = ' ';

export function formatClock(min: MinuteOfDay): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(mm).padStart(2, '0')}${NBSP}${h24 < 12 ? 'am' : 'pm'}`;
}

/** Minutes between bedtime and wake time, wrapping past midnight. Same time = 24 h. */
export function minutesInBed(bed: MinuteOfDay, wake: MinuteOfDay): number {
  const d = (((wake - bed) % 1440) + 1440) % 1440;
  return d === 0 ? 1440 : d;
}

/** "8 h", "7 h 30 min", "45 min". */
export function formatDuration(totalMin: number): string {
  const t = Math.max(0, Math.round(totalMin));
  const h = Math.floor(t / 60);
  const m = t % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Spoken form for VoiceOver: "7 hours 12 minutes". */
export function spokenDuration(totalMin: number): string {
  const t = Math.max(0, Math.round(totalMin));
  const h = Math.floor(t / 60);
  const m = t % 60;
  const hs = `${h} ${h === 1 ? 'hour' : 'hours'}`;
  const ms = `${m} ${m === 1 ? 'minute' : 'minutes'}`;
  if (h === 0) return ms;
  return m === 0 ? hs : `${hs} ${ms}`;
}

/** "0:42:10" */
export function formatElapsed(totalSec: number): string {
  const t = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function spokenElapsed(totalSec: number): string {
  const t = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} ${h === 1 ? 'hour' : 'hours'}`);
  if (h > 0 || m > 0) parts.push(`${m} ${m === 1 ? 'minute' : 'minutes'}`);
  parts.push(`${s} ${s === 1 ? 'second' : 'seconds'}`);
  return parts.join(' ');
}

/**
 * Display mapping for the room-sound meter: dBFS in [-70, -10] to [0, 1].
 * This is a drawing scale only. It is not a measurement claim and is never shown as a number.
 */
export function dbToMeter(db: number | null | undefined): number {
  if (db === null || db === undefined || !Number.isFinite(db)) return 0;
  return Math.min(1, Math.max(0, (db + 70) / 60));
}

export type MeterBand = 'low' | 'medium' | 'high';
/** Coarse spoken band for the meter's VoiceOver value. Changes rarely so it does not chatter. */
export function meterBand(level01: number): MeterBand {
  return level01 < 0.34 ? 'low' : level01 < 0.67 ? 'medium' : 'high';
}

/** Push a new value into a fixed-length history (oldest dropped). Returns a new array. */
export function pushLevel(history: readonly number[], value: number, size = 24): number[] {
  const next = history.length >= size ? history.slice(history.length - size + 1) : history.slice();
  while (next.length < size - 1) next.unshift(0);
  next.push(value);
  return next;
}

export const BYSTANDER_ACK_VALID_DAYS = 14;

/** Whether a stored bystander acknowledgement is recent enough to allow an auto-start countdown. */
export function bystanderAckIsFresh(ackIso: string | null | undefined, nowMs: number, days = BYSTANDER_ACK_VALID_DAYS): boolean {
  if (!ackIso) return false;
  const t = Date.parse(ackIso);
  if (!Number.isFinite(t)) return false;
  const age = nowMs - t;
  return age >= 0 && age <= days * 86_400_000;
}

/** Next occurrence of a wall-clock minute-of-day strictly after `nowMs`. Used only for display ("ends at"). */
export function nextOccurrence(min: MinuteOfDay, nowMs: number): Date {
  const d = new Date(nowMs);
  d.setHours(Math.floor(min / 60), min % 60, 0, 0);
  if (d.getTime() <= nowMs) d.setDate(d.getDate() + 1);
  return d;
}

/** Whether it is currently inside the bed-to-wake window (wrap-aware). */
export function isWithinSleepWindow(nowMin: MinuteOfDay, bed: MinuteOfDay, wake: MinuteOfDay): boolean {
  if (bed === wake) return true;
  return bed < wake ? nowMin >= bed && nowMin < wake : nowMin >= bed || nowMin < wake;
}

export type PagePosition = { index: number; total: number };
export function pageLabel(p: PagePosition, title: string): string {
  return `Page ${p.index + 1} of ${p.total}, ${title}`;
}

/** Skip on pages 3-5 (1-based) jumps to the final page and never past it. */
export function skipTarget(currentIndex: number, total: number): number {
  return currentIndex >= total - 1 ? total - 1 : total - 1;
}

/** Stack horizontal pairs from this font scale up (Dynamic Type xxxLarge and the AX sizes). */
export const STACK_FONT_SCALE = 1.5;
export const shouldStack = (fontScale: number): boolean => fontScale >= STACK_FONT_SCALE;

/** Timeline: durations (minutes) per epoch state, from equal-length epochs. */
export function epochMinutes<T extends string>(states: readonly T[], epochMin: number): Record<T, number> {
  const out = {} as Record<T, number>;
  for (const s of states) out[s] = (out[s] ?? 0) + epochMin;
  return out;
}
