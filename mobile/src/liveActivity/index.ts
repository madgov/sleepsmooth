import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { nativeLiveActivity } from '../../modules/sleepsmooth-live-activity';

// Single feature flag: the `enabled` prop of ./plugins/withLiveActivity in app.json (surfaced as extra.liveActivity).
// Off, unlinked, unsupported or user-disabled: every call below is a no-op and recording is unaffected.
export const LIVE_ACTIVITY_FLAG: boolean = Platform.OS === 'ios' && (Constants.expoConfig?.extra as { liveActivity?: boolean } | undefined)?.liveActivity === true;

export function liveActivityAvailable(): boolean {
  if (!LIVE_ACTIVITY_FLAG || !nativeLiveActivity) return false;
  try {
    return nativeLiveActivity.isSupported();
  } catch {
    return false;
  }
}

/** Starts "Listening tonight". Must be called while the app is in the foreground. Never throws. */
export async function startListeningActivity(startedAtMs: number, windowEndsAtMs: number | null): Promise<boolean> {
  if (!liveActivityAvailable() || !nativeLiveActivity) return false;
  try {
    return (await nativeLiveActivity.start(startedAtMs, windowEndsAtMs)) !== null;
  } catch {
    return false;
  }
}

/**
 * Switches the activity to the morning prompt ("Good morning. Stop recording?") and asks iOS to expand the island briefly.
 * The alert is attached once per night by the caller. Resolves false if there is no activity or the call failed.
 */
export async function showMorningActivity(morningAtMs: number, alert: boolean): Promise<boolean> {
  if (!LIVE_ACTIVITY_FLAG || !nativeLiveActivity) return false;
  try {
    return await nativeLiveActivity.update('morning', morningAtMs, null, alert);
  } catch {
    return false;
  }
}

/** Back to "Listening tonight" (the user tapped Keep recording). */
export async function showListeningActivity(): Promise<void> {
  if (!LIVE_ACTIVITY_FLAG || !nativeLiveActivity) return;
  try {
    await nativeLiveActivity.update('listening', null, null, false);
  } catch {
    /* nothing to do */
  }
}

/** After an automatic stop: show "Auto-stopped at 7:12 am" for a few minutes, then the system removes it. */
export async function endWithAutoStopped(stoppedAtMs: number): Promise<void> {
  if (!LIVE_ACTIVITY_FLAG || !nativeLiveActivity) return;
  try {
    await nativeLiveActivity.end('autoStopped', stoppedAtMs, 300);
  } catch {
    /* nothing to do */
  }
}

export async function endListeningActivity(): Promise<void> {
  if (!LIVE_ACTIVITY_FLAG || !nativeLiveActivity) return;
  try {
    await nativeLiveActivity.end(null, null, null);
  } catch {
    // Nothing to do: the system ends the activity itself after 8 hours.
  }
}
