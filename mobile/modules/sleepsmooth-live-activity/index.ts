import { requireOptionalNativeModule } from 'expo';

export type NativeActivityPhase = 'listening' | 'morning' | 'autoStopped';

interface NativeLiveActivity {
  isSupported(): boolean;
  start(startedAtMs: number, windowEndsAtMs: number | null): Promise<string | null>;
  /** Changes the phase. `alert` attaches an AlertConfiguration, which makes iOS expand the island briefly. Resolves false when no activity exists. */
  update(phase: NativeActivityPhase, morningAtMs: number | null, stoppedAtMs: number | null, alert: boolean): Promise<boolean>;
  /** With a finalPhase the last state lingers for `lingerSec` seconds before the system removes it. */
  end(finalPhase: NativeActivityPhase | null, stoppedAtMs: number | null, lingerSec: number | null): Promise<void>;
}

/** null when the native module is not linked (feature flag off, simulator without ActivityKit, Android, web). */
export const nativeLiveActivity = requireOptionalNativeModule<NativeLiveActivity>('SleepSmoothLiveActivity');

interface NativeAutomation {
  /** Returns (and clears) a JSON command stored by an App Intent while JS was not listening. */
  consumePendingCommand(): string | null;
  /** Sets NSURLIsExcludedFromBackupKey. Returns false on failure. NOT VERIFIED on device. */
  setExcludedFromBackup(path: string): boolean;
  addListener(event: 'onCommand', cb: (e: { payload: string }) => void): { remove(): void };
}

/** null in Expo Go, on web, on Android, or when the module is not linked. */
export const nativeAutomation = requireOptionalNativeModule<NativeAutomation>('SleepSmoothAutomation');

export interface NativeHealthSleepSample {
  startMs: number;
  endMs: number;
  kind: 'asleep' | 'inBed';
  source: string;
  userEntered: boolean;
}

interface NativeHealth {
  isAvailable(): boolean;
  /** Shows the READ permission sheet. Resolves true when the request completed (not "allowed": HealthKit hides read decisions). */
  requestReadAuthorization(): Promise<boolean>;
  readSleepSamples(days: number): Promise<NativeHealthSleepSample[]>;
  readStepEdges(nights: number[][]): Promise<{ lastStepBeforeMs: number | null; firstStepAfterMs: number | null }[]>;
}

/** null in Expo Go, on web, on Android, or when the module is not linked. Works only in a build with the HealthKit flag on. */
export const nativeHealth = requireOptionalNativeModule<NativeHealth>('SleepSmoothHealth');

interface NativeMotionActivity {
  isAvailable(): boolean;
  authorizationStatus(): 'notDetermined' | 'restricted' | 'denied' | 'authorized';
  /** Activity change events for the last `days` days (max 7). Triggers the Motion & Fitness prompt the first time. */
  queryActivities(days: number): Promise<{ startMs: number; stationary: boolean }[]>;
}

/** null in Expo Go, on web, on Android, or when the module is not linked. */
export const nativeMotionActivity = requireOptionalNativeModule<NativeMotionActivity>('SleepSmoothMotionActivity');
