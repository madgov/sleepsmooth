// On-device clip files (native). Layout: <store root>/nights/<nightId>/clips/{cN.wav, clips.json}.
// Candidates are written to a temp folder in the cache directory while the night runs, then moved here at night end.
// Because the clips live INSIDE the night's folder, NightStore.remove(id) and removeAll() delete them too.
// Backup exclusion goes through the SleepSmoothAutomation native module (NSURLIsExcludedFromBackupKey): NOT VERIFIED.
import { Directory, File, Paths } from 'expo-file-system';
import {
  CLIPS_DIR,
  CLIPS_MANIFEST_NAME,
  clipsToPrune,
  parseClipsManifest,
  type ClipMeta,
  type ClipsManifest,
  type FinishedClip,
} from '@core/mobileLogic/clips';
import { NIGHTS_DIR } from '@core/mobileLogic/nightStore';
import { nativeAutomation } from '../../modules/sleepsmooth-live-activity';
import { getStoreRootDirectory } from '../data/fileStore';

const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;
const tmp = () => new Directory(Paths.cache, 'sleepsmooth-clip-tmp');
const nightClipsDir = (nightId: string) => new Directory(getStoreRootDirectory(), NIGHTS_DIR, nightId, CLIPS_DIR);

/** Result of trying to exclude the clips folder from backup. 'unavailable' when the native module is not linked. */
export type BackupExclusion = 'excluded' | 'failed' | 'unavailable';

export const clipTempSink = {
  writeTemp(id: string, wav: Uint8Array): void {
    const d = tmp();
    d.create({ intermediates: true, idempotent: true });
    const f = new File(d, `${id}.wav`);
    if (f.exists) f.delete();
    f.create();
    f.write(wav);
  },
  removeTemp(id: string): void {
    try {
      const f = new File(tmp(), `${id}.wav`);
      if (f.exists) f.delete();
    } catch {
      /* already gone */
    }
  },
};

/** Remove every temp candidate (a crash may leave some behind). Safe to call at launch. */
export function clearClipTemp(): void {
  try {
    const d = tmp();
    if (d.exists) d.delete();
  } catch {
    /* nothing to clear */
  }
}

/**
 * Move the final picks into the night's clips folder and write the manifest. Written even when zero clips were picked,
 * so the UI can tell "saving was on, none picked" from "saving was off". Returns the backup-exclusion outcome.
 */
export async function finalizeClips(nightId: string, picks: readonly FinishedClip[], createdAtMs: number): Promise<BackupExclusion> {
  if (!SAFE_ID.test(nightId)) return 'failed';
  const dir = nightClipsDir(nightId);
  dir.create({ intermediates: true, idempotent: true });
  const kept: FinishedClip[] = [];
  for (const c of picks) {
    const src = new File(tmp(), `${c.id}.wav`);
    if (!src.exists) continue;
    const dest = new File(dir, c.file);
    if (dest.exists) dest.delete();
    await src.move(dest);
    kept.push(c);
  }
  const manifest: ClipsManifest = {
    v: 1,
    nightId,
    createdAt: createdAtMs,
    clips: kept.map(toMeta),
  };
  const mf = new File(dir, CLIPS_MANIFEST_NAME);
  if (!mf.exists) mf.create();
  mf.write(JSON.stringify(manifest));
  clearClipTemp();
  return excludeFromBackup(dir);
}

/** Drops the selection-only field before the clip is written to the manifest. */
function toMeta(c: FinishedClip): ClipMeta {
  return { id: c.id, file: c.file, category: c.category, tag: c.tag, startMs: c.startMs, durationSec: c.durationSec, peaks: c.peaks, score: c.score };
}

function excludeFromBackup(dir: Directory): BackupExclusion {
  if (!nativeAutomation) return 'unavailable';
  try {
    const path = dir.uri.replace(/^file:\/\//, '');
    return nativeAutomation.setExcludedFromBackup(decodeURI(path)) ? 'excluded' : 'failed';
  } catch {
    return 'failed';
  }
}

export async function readClipsManifest(nightId: string): Promise<ClipsManifest | null> {
  if (!SAFE_ID.test(nightId)) return null;
  try {
    const f = new File(nightClipsDir(nightId), CLIPS_MANIFEST_NAME);
    if (!f.exists) return null;
    return parseClipsManifest(await f.text());
  } catch {
    return null;
  }
}

export async function readClipBytes(nightId: string, file: string): Promise<Uint8Array | null> {
  if (!SAFE_ID.test(nightId) || !/^[A-Za-z0-9_-]+\.wav$/.test(file)) return null;
  try {
    const f = new File(nightClipsDir(nightId), file);
    return f.exists ? await f.bytes() : null;
  } catch {
    return null;
  }
}

function nightIds(): string[] {
  try {
    const d = new Directory(getStoreRootDirectory(), NIGHTS_DIR);
    return d.exists ? d.list().map((e) => e.name).filter((n) => SAFE_ID.test(n)) : [];
  } catch {
    return [];
  }
}

export function deleteClipsForNight(nightId: string): void {
  if (!SAFE_ID.test(nightId)) return;
  try {
    const d = nightClipsDir(nightId);
    if (d.exists) d.delete();
  } catch {
    /* ignore */
  }
}

/** "Delete all clips": removes clip folders only; the nights themselves stay. Returns how many nights had clips. */
export function deleteAllClips(): number {
  let n = 0;
  for (const id of nightIds()) {
    const d = nightClipsDir(id);
    try {
      if (d.exists) {
        d.delete();
        n++;
      }
    } catch {
      /* ignore */
    }
  }
  clearClipTemp();
  return n;
}

/** Delete clips of nights older than the retention horizon (judged from the night id, which is `n<startMs>`). */
export function pruneOldClips(retentionDays: number, nowMs: number = Date.now()): string[] {
  const nights = nightIds()
    .map((id) => ({ id, startMs: Number(id.replace(/^n/, '')) }))
    .filter((n) => Number.isFinite(n.startMs));
  const old = clipsToPrune(nights, nowMs, retentionDays);
  for (const id of old) deleteClipsForNight(id);
  return old;
}

/** Number of clips stored for a night (0 when none or saving was off). */
export async function countClips(nightId: string): Promise<number> {
  return (await readClipsManifest(nightId))?.clips.length ?? 0;
}
