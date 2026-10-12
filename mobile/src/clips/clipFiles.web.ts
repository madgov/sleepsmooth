// Web preview and tests: no real clip storage. The web preview only shows labelled sample clips.
import type { ClipsManifest } from '@core/mobileLogic/clips';

export type BackupExclusion = 'excluded' | 'failed' | 'unavailable';
export const clipTempSink = { writeTemp(): void {}, removeTemp(): void {} };
export function clearClipTemp(): void {}
export async function finalizeClips(): Promise<BackupExclusion> {
  return 'unavailable';
}
export async function readClipsManifest(): Promise<ClipsManifest | null> {
  return null;
}
export async function readClipBytes(): Promise<Uint8Array | null> {
  return null;
}
export function deleteClipsForNight(): void {}
export function deleteAllClips(): number {
  return 0;
}
export function pruneOldClips(): string[] {
  return [];
}
export async function countClips(): Promise<number> {
  return 0;
}
