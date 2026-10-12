// "Find my routine": runs ONLY when the user taps it (that tap is what triggers the Motion & Fitness prompt).
// Sources: phone stillness (CMMotionActivityManager history, up to 7 days) and Apple Health sleep records when connected
// (Health takes priority for a night). Nothing changes the schedule until the user taps "Use this".
import { useSyncExternalStore } from 'react';
import { activitiesToStationary, chargingIntervals, shouldOfferRoutine, suggestRoutine, type RoutineSuggestion } from '@core/mobileLogic/routine';
import { nativeMotionActivity } from '../../modules/sleepsmooth-live-activity';
import { nightSource } from '../data/nightSource';
import { healthAvailable, loadHealthNights } from '../health';
import { scheduleBedtimeReminder } from '../platform/reminder';
import { getSettings, updateSettings } from '../state/settings';

export type RoutineStatus = 'idle' | 'finding' | 'found' | 'not-enough' | 'denied' | 'unavailable' | 'error';
interface State {
  status: RoutineStatus;
  suggestion: RoutineSuggestion | null;
}
let state: State = { status: 'idle', suggestion: null };
const listeners = new Set<() => void>();
const set = (s: State) => {
  state = s;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
export const useRoutine = (): State => useSyncExternalStore(subscribe, () => state, () => state);

/** True when this build can look at motion history at all (full build on a device). */
export function routineSupported(): boolean {
  try {
    return !!nativeMotionActivity && nativeMotionActivity.isAvailable();
  } catch {
    return false;
  }
}

export async function findRoutine(): Promise<void> {
  if (state.status === 'finding') return;
  const native = nativeMotionActivity;
  const useHealth = healthAvailable() && !!getSettings().health.requestedAt;
  if (!native && !useHealth) {
    set({ status: 'unavailable', suggestion: null });
    return;
  }
  set({ status: 'finding', suggestion: null });
  try {
    const now = Date.now();
    let stationary: ReturnType<typeof activitiesToStationary> = [];
    if (native && routineSupported()) {
      if (native.authorizationStatus() === 'denied' || native.authorizationStatus() === 'restricted') {
        if (!useHealth) {
          set({ status: 'denied', suggestion: null });
          return;
        }
      } else {
        const events = await native.queryActivities(7); // the first call shows the Motion & Fitness prompt
        stationary = activitiesToStationary(events, now);
      }
    }
    const health = useHealth ? await loadHealthNights() : [];
    let charging: ReturnType<typeof chargingIntervals> = [];
    try {
      const nights = await nightSource.listRealNights();
      charging = nights.flatMap((n) => chargingIntervals(n.view.epochs));
    } catch {
      /* charging history is optional */
    }
    const suggestion = suggestRoutine({ nowMs: now, stationary, health, charging });
    updateSettings((p) => ({ ...p, routine: { ...p.routine, lastFoundAt: new Date(now).toISOString() } }));
    set(suggestion ? { status: 'found', suggestion } : { status: 'not-enough', suggestion: null });
  } catch {
    // A denied Motion prompt rejects the query.
    const denied = native?.authorizationStatus() === 'denied';
    set({ status: denied ? 'denied' : 'error', suggestion: null });
  }
}

/** "Use this": the only place the schedule changes, and only because the user tapped it. */
export function applyRoutine(): void {
  const s = state.suggestion;
  if (!s) return;
  updateSettings((p) => ({ ...p, sleep: { ...p.sleep, bedMin: s.bedMin, wakeMin: s.wakeMin, userSet: true } }));
  if (getSettings().sleep.reminder) void scheduleBedtimeReminder(s.bedMin);
  set({ status: 'idle', suggestion: null });
}

/** "Not now": hides the card for a week. */
export function dismissRoutine(): void {
  updateSettings((p) => ({ ...p, routine: { ...p.routine, dismissedAt: new Date().toISOString() } }));
  set({ status: 'idle', suggestion: null });
}

export function routineOffered(s: RoutineSuggestion | null): boolean {
  const { sleep, routine } = getSettings();
  return shouldOfferRoutine(s, sleep, routine, Date.now());
}

/** Idle card on the Dashboard: hours still the defaults, motion history readable, and no "Not now" in the last 7 days. */
export function routineIdleOffered(): boolean {
  const { sleep, routine } = getSettings();
  const dismissed = routine.dismissedAt ? Date.parse(routine.dismissedAt) : NaN;
  return !sleep.userSet && routineSupported() && !(Number.isFinite(dismissed) && Date.now() - dismissed < 7 * 24 * 3_600_000);
}
