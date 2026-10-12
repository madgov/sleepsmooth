// Apple Health (read-only) wrapper. Everything is a no-op unless the build has the HealthKit flag on (plugins/withHealthKit,
// `healthkit: true` in app.json, surfaced as extra.healthKit) AND the native module is linked AND Health data is available.
// Off, unlinked, Expo Go, web, Android: status is 'unavailable' and the app works as before.
//
// HealthKit never reveals whether a READ type was allowed. "Connected" therefore means "the permission sheet was shown and
// completed"; a read that returns nothing is shown as "no records", never as an error or a result.
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useSyncExternalStore } from 'react';
import { aggregateHealthNights, type HealthNight, type HealthSleepSample } from '@core/mobileLogic/healthSleep';
import { nativeHealth } from '../../modules/sleepsmooth-live-activity';
import { getSettings, updateSettings } from '../state/settings';

export const HEALTH_FLAG: boolean = Platform.OS === 'ios' && (Constants.expoConfig?.extra as { healthKit?: boolean } | undefined)?.healthKit === true;
export const HEALTH_DAYS = 14;

export type HealthStatus = 'unavailable' | 'not-connected' | 'connected';

export function healthAvailable(): boolean {
  if (!HEALTH_FLAG || !nativeHealth) return false;
  try {
    return nativeHealth.isAvailable();
  } catch {
    return false;
  }
}

interface Store {
  nights: HealthNight[];
  loading: boolean;
  error: boolean;
}
let store: Store = { nights: [], loading: false, error: false };
const listeners = new Set<() => void>();
const set = (p: Partial<Store>) => {
  store = { ...store, ...p };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
export const useHealthStore = (): Store => useSyncExternalStore(subscribe, () => store, () => store);

export function healthStatus(requestedAt: string | null): HealthStatus {
  if (!healthAvailable()) return 'unavailable';
  return requestedAt ? 'connected' : 'not-connected';
}

/** Reads the last 14 days of sleep records and reduces them to one stretch per night. Never throws. */
export async function loadHealthNights(): Promise<HealthNight[]> {
  if (!healthAvailable() || !nativeHealth) return [];
  set({ loading: true, error: false });
  try {
    const raw = await nativeHealth.readSleepSamples(HEALTH_DAYS);
    const samples: HealthSleepSample[] = raw.map((r) => ({ startMs: r.startMs, endMs: r.endMs, kind: r.kind, source: r.source }));
    const nights = aggregateHealthNights(samples);
    updateSettings((p) => ({ ...p, health: { ...p.health, lastReadAt: new Date().toISOString() } }));
    set({ nights, loading: false });
    return nights;
  } catch {
    set({ loading: false, error: true });
    return [];
  }
}

/** Taps "Connect Apple Health": shows the read sheet, then reads. Resolves false when the request itself failed. */
export async function connectHealth(): Promise<boolean> {
  if (!healthAvailable() || !nativeHealth) return false;
  try {
    const done = await nativeHealth.requestReadAuthorization();
    if (!done) return false;
    updateSettings((p) => ({ ...p, health: { ...p.health, requestedAt: new Date().toISOString() } }));
    await loadHealthNights();
    return true;
  } catch {
    set({ error: true });
    return false;
  }
}

/** Loads once per launch when already connected. Cheap to call from screens. */
let autoLoaded = false;
export function ensureHealthLoaded(): void {
  if (autoLoaded || !healthAvailable() || !getSettings().health.requestedAt) return;
  autoLoaded = true;
  void loadHealthNights();
}
