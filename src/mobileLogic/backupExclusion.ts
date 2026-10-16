// Backup exclusion for the clips folder. Pure: the native call is injected (SleepSmoothAutomation.setExcludedFromBackup,
// which sets NSURLIsExcludedFromBackupKey). Result is 'unavailable' when the native module is not linked (web, Expo Go).
// NOT VERIFIED on a device: only a real iPhone can show that the flag is set on the folder (docs/PRIVACY_CHECKS.md).
export type BackupExclusion = 'excluded' | 'failed' | 'unavailable';
export interface BackupExcluder {
  setExcludedFromBackup(path: string): boolean;
}

/** `folderUri` may be a file:// URI. The native side receives a plain decoded path. */
export function excludeClipsFolder(native: BackupExcluder | null, folderUri: string): BackupExclusion {
  if (!native) return 'unavailable';
  try {
    const path = decodeURI(folderUri.replace(/^file:\/\//, ''));
    return native.setExcludedFromBackup(path) ? 'excluded' : 'failed';
  } catch {
    return 'failed';
  }
}
