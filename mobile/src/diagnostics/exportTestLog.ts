// "Export test log": writes one JSON file (no audio) to the cache, opens the iOS share sheet, then removes the file.
// Nothing is sent anywhere by the app: the user picks the destination in the share sheet.
import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { serializeTestLog } from '@core/mobileLogic/exportLog';
import { readClipsManifest } from '../clips/clipFiles';
import type { NightListItem } from '../data/nightSource';
import { getNightStore } from '../data/nightStoreInstance';
import { getSettings } from '../state/settings';

export type ExportResult = 'shared' | 'web-unavailable' | 'failed';

export async function exportTestLog(night: NightListItem): Promise<ExportResult> {
  if (Platform.OS === 'web') return 'web-unavailable';
  let file: File | null = null;
  try {
    if (!(await Sharing.isAvailableAsync())) return 'failed';
    const feedback = await getNightStore().readFeedback(night.id);
    const manifest = await readClipsManifest(night.id);
    const text = serializeTestLog({
      exportedAtMs: Date.now(),
      app: { version: Constants.expoConfig?.version ?? 'unknown', deviceModel: night.view.record.deviceModel, os: String(Platform.Version) },
      wearable: getSettings().wearable,
      nights: [{ view: night.view, diagnostics: night.diagnostics, feedback, clips: manifest?.clips ?? [] }],
    });
    file = new File(Paths.cache, `sleepsmooth-test-log-${night.id}.json`);
    if (file.exists) file.delete();
    file.create();
    file.write(text);
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'SleepSmooth test log (no audio)' });
    return 'shared';
  } catch {
    return 'failed';
  } finally {
    try {
      if (file?.exists) file.delete();
    } catch {
      /* the cache is cleared by iOS as well */
    }
  }
}
