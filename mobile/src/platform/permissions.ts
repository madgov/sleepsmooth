import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { audioApi } from '../native/audioApi';

const { AudioManager } = audioApi;
import * as Notifications from 'expo-notifications';

export type MicStatus = 'undetermined' | 'granted' | 'denied';
export type NotifStatus = 'undetermined' | 'granted' | 'denied';

function micFrom(s: string): MicStatus {
  return s === 'Granted' ? 'granted' : s === 'Denied' ? 'denied' : 'undetermined';
}

export async function checkMic(): Promise<MicStatus> {
  try {
    return micFrom(await AudioManager.checkRecordingPermissions());
  } catch {
    return 'undetermined';
  }
}
export async function requestMic(): Promise<MicStatus> {
  try {
    return micFrom(await AudioManager.requestRecordingPermissions());
  } catch {
    return 'denied';
  }
}
export async function checkNotifs(): Promise<NotifStatus> {
  try {
    const p = await Notifications.getPermissionsAsync();
    return p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'undetermined';
  }
}
export async function requestNotifs(): Promise<NotifStatus> {
  try {
    const p = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
    return p.granted ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}
export const openSystemSettings = () => void Linking.openSettings();

/** Re-checks the microphone permission whenever the app returns to the foreground (e.g. back from Settings). */
export function useMicPermission(): { mic: MicStatus; refresh: () => Promise<void>; request: () => Promise<MicStatus> } {
  const [mic, setMic] = useState<MicStatus>('undetermined');
  const refresh = useCallback(async () => setMic(await checkMic()), []);
  const request = useCallback(async () => {
    const s = await requestMic();
    setMic(s);
    return s;
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial async permission read
    void refresh();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);
  return { mic, refresh, request };
}
