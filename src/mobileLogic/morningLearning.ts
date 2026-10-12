// Morning stop: wake-signal detection and the "learn my morning" rule. Pure TypeScript (no React Native, no native code).
//
// What this is: bookkeeping about WHEN THE USER TAPPED STOP compared with a wake signal. It never interprets health data.
// The wake signal is a heuristic from the unvalidated sleep-state estimate (src/night/estimator.ts) plus phone movement
// and pickups. It is not a measurement of waking up, and no sentence in the product may say it is.
//
// Rules (all PROVISIONAL engineering choices, not clinical thresholds):
//   - A morning counts toward learning only when the user CONFIRMED stop within 0..30 minutes after the wake signal.
//   - 3 such mornings in a row switch to automatic stop, 10 minutes after the wake signal.
//   - Tapping "Keep recording", or starting again within 15 minutes of an automatic stop, resets the learning.
//   - A hard stop always exists at the window end plus the estimator's grace period (see hardStopMs).
//   - The user can force "Always ask me". Learning then does not run.
import { EST_GRACE_AFTER_WAKE_MS } from '../night/constants';

export const MORNING_STREAK_TARGET = 3;
export const MORNING_CONFIRM_MAX_AFTER_MS = 30 * 60_000;
export const AUTO_STOP_DELAY_MS = 10 * 60_000;
export const RESTART_RESETS_WITHIN_MS = 15 * 60_000;
/** Early wake signal: this many consecutive "likely awake" epochs (30 s each) = 3 minutes. */
export const EARLY_AWAKE_EPOCHS = 6;

export type MorningPreference = 'learn' | 'always-ask';

export interface MorningState {
  preference: MorningPreference;
  /** Consecutive qualifying confirmed mornings (0..MORNING_STREAK_TARGET). */
  streak: number;
  /** True once the streak reached the target. Cleared by any reset. */
  auto: boolean;
  /** When the last automatic stop happened (ms). Used to detect a quick restart. */
  lastAutoStopAtMs: number | null;
  /** Plain reason for the last reset, for Settings. */
  lastReset: 'keep-recording' | 'restarted-after-auto-stop' | 'forced-always-ask' | null;
}

export const defaultMorningState = (): MorningState => ({ preference: 'learn', streak: 0, auto: false, lastAutoStopAtMs: null, lastReset: null });

const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

export function mergeMorningState(raw: unknown): MorningState {
  const d = defaultMorningState();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<MorningState>;
  const preference: MorningPreference = r.preference === 'always-ask' ? 'always-ask' : 'learn';
  const streak = finite(r.streak) ? Math.max(0, Math.min(MORNING_STREAK_TARGET, Math.floor(r.streak))) : 0;
  const reasons = ['keep-recording', 'restarted-after-auto-stop', 'forced-always-ask'] as const;
  return {
    preference,
    streak,
    auto: preference === 'learn' && r.auto === true && streak >= MORNING_STREAK_TARGET,
    lastAutoStopAtMs: finite(r.lastAutoStopAtMs) ? r.lastAutoStopAtMs : null,
    lastReset: reasons.find((x) => x === r.lastReset) ?? null,
  };
}

// ---- what happened on one morning -----------------------------------------------------------------------------------
export type MorningOutcome =
  | { kind: 'confirmed-stop'; stopAtMs: number; wakeSignalAtMs: number | null }
  | { kind: 'auto-stopped'; stopAtMs: number }
  | { kind: 'keep-recording' }
  /** The hard stop ended the night with no answer from the user. */
  | { kind: 'hard-stop' }
  /** The user stopped before any wake signal, or by another route. Not a confirmation of the morning prompt. */
  | { kind: 'stopped-other' };

export function qualifies(stopAtMs: number, wakeSignalAtMs: number | null): boolean {
  if (wakeSignalAtMs === null) return false;
  const after = stopAtMs - wakeSignalAtMs;
  return after >= 0 && after <= MORNING_CONFIRM_MAX_AFTER_MS;
}

export function recordMorning(s: MorningState, o: MorningOutcome): MorningState {
  if (s.preference === 'always-ask') return s;
  switch (o.kind) {
    case 'confirmed-stop': {
      if (s.auto) return s; // already automatic; a manual stop neither adds nor removes learning
      if (!qualifies(o.stopAtMs, o.wakeSignalAtMs)) return { ...s, streak: 0 };
      const streak = Math.min(MORNING_STREAK_TARGET, s.streak + 1);
      return { ...s, streak, auto: streak >= MORNING_STREAK_TARGET };
    }
    case 'auto-stopped':
      return { ...s, lastAutoStopAtMs: o.stopAtMs };
    case 'keep-recording':
      return { ...s, streak: 0, auto: false, lastAutoStopAtMs: null, lastReset: 'keep-recording' };
    case 'hard-stop':
    case 'stopped-other':
      // No confirmation: the run of confirmed mornings is broken. An automatic user stays automatic.
      return s.auto ? s : { ...s, streak: 0 };
  }
}

/** A new recording started within 15 minutes of an automatic stop means the user did not want it to stop. */
export function onRecordingStarted(s: MorningState, nowMs: number): MorningState {
  if (s.lastAutoStopAtMs !== null && nowMs >= s.lastAutoStopAtMs && nowMs - s.lastAutoStopAtMs <= RESTART_RESETS_WITHIN_MS) {
    return { ...s, streak: 0, auto: false, lastAutoStopAtMs: null, lastReset: 'restarted-after-auto-stop' };
  }
  return s.lastAutoStopAtMs !== null ? { ...s, lastAutoStopAtMs: null } : s;
}

export function setPreference(s: MorningState, p: MorningPreference): MorningState {
  if (p === 'always-ask') return { ...s, preference: p, streak: 0, auto: false, lastReset: 'forced-always-ask' };
  return { ...s, preference: p };
}

export type MorningMode = 'ask' | 'always-ask' | 'learning' | 'automatic';
export const morningMode = (s: MorningState): MorningMode =>
  s.preference === 'always-ask' ? 'always-ask' : s.auto ? 'automatic' : s.streak > 0 ? 'learning' : 'ask';

/** Settings row value: "Ask me", "Learning (2 of 3)", "Automatic". */
export function morningRowValue(s: MorningState): string {
  switch (morningMode(s)) {
    case 'always-ask':
      return 'Always ask me';
    case 'automatic':
      return 'Automatic';
    case 'learning':
      return `Learning (${s.streak} of ${MORNING_STREAK_TARGET})`;
    default:
      return 'Ask me';
  }
}

// ---- times ----------------------------------------------------------------------------------------------------------
/** The latest moment a recording may run: the window end plus the estimator's after-wake grace period. */
export const hardStopMs = (windowEndMs: number): number => windowEndMs + EST_GRACE_AFTER_WAKE_MS;
export const autoStopAtMs = (wakeSignalAtMs: number): number => wakeSignalAtMs + AUTO_STOP_DELAY_MS;

export function shouldAutoStop(s: MorningState, nowMs: number, wakeSignalAtMs: number | null): boolean {
  return s.preference === 'learn' && s.auto && wakeSignalAtMs !== null && nowMs >= autoStopAtMs(wakeSignalAtMs);
}

// ---- wake signal ----------------------------------------------------------------------------------------------------
export interface RecentEpoch {
  /** Epoch start (ms). */
  t: number;
  state: 'likely-awake' | 'likely-asleep' | 'uncertain' | 'outside-window' | 'not-captured';
  /** Seconds of phone movement in the epoch; null when unavailable. */
  motionSec: number | null;
  /** The app was in the foreground: the phone was picked up or the screen was on. */
  appActive: boolean;
}

export interface WakeSignal {
  atMs: number;
  /** 'scheduled' = the user's own wake time arrived. 'early' = sustained likely-awake plus movement or a pickup. */
  kind: 'scheduled' | 'early';
}

export const MOTION_MOVEMENT_SEC = 2;

/**
 * First wake signal of the night, or null. `epochs` is the recent history in time order.
 * Early: after the second half of the window, EARLY_AWAKE_EPOCHS consecutive "likely awake" epochs, at least one of which
 * shows movement or a pickup. The signal time is the start of that run. Otherwise the scheduled wake time is the signal.
 */
export function detectWakeSignal(i: { nowMs: number; windowStartMs: number; windowEndMs: number; epochs: readonly RecentEpoch[] }): WakeSignal | null {
  const mid = i.windowStartMs + (i.windowEndMs - i.windowStartMs) / 2;
  let run: RecentEpoch[] = [];
  for (const e of i.epochs) {
    if (e.t >= mid && e.t <= i.nowMs && e.state === 'likely-awake') {
      run.push(e);
      if (run.length >= EARLY_AWAKE_EPOCHS && run.some((x) => x.appActive || (x.motionSec !== null && x.motionSec >= MOTION_MOVEMENT_SEC))) {
        const first = run[0] as RecentEpoch;
        return { atMs: Math.min(first.t, i.windowEndMs), kind: first.t < i.windowEndMs ? 'early' : 'scheduled' };
      }
    } else {
      run = [];
    }
  }
  if (i.nowMs >= i.windowEndMs) return { atMs: i.windowEndMs, kind: 'scheduled' };
  return null;
}
