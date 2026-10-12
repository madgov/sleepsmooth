// expo-file-system adapter for the night store.
//
// Location: <app container>/Library/Application Support/SleepSmooth (not shown in the Files app), falling back to
// <container>/Documents/SleepSmooth only if Application Support cannot be created.
// KNOWN LIMIT: excluding these files from iCloud/iTunes backup needs URLResourceKey.isExcludedFromBackup, which
// expo-file-system 57 does not expose (its Paths API has no Application Support or backup flag). The files are small
// (a manifest and one JSON line per 30 s; no audio) but ARE included in a device backup until a small native module or
// config plugin sets the flag. See the report; do not claim the data is excluded from backup.
import { Directory, File, FileMode, Paths } from 'expo-file-system';
import type { StoreFs } from '@core/mobileLogic/nightStore';

export type StoreLocation = 'application-support' | 'documents';

function openRoot(): { root: Directory; location: StoreLocation } {
  try {
    const root = new Directory(Paths.document.parentDirectory, 'Library', 'Application Support', 'SleepSmooth');
    root.create({ intermediates: true, idempotent: true });
    return { root, location: 'application-support' };
  } catch {
    const root = new Directory(Paths.document, 'SleepSmooth');
    root.create({ intermediates: true, idempotent: true });
    return { root, location: 'documents' };
  }
}

const parts = (p: string) => p.split('/').filter(Boolean);

class ExpoStoreFs implements StoreFs {
  readonly root: Directory;
  readonly location: StoreLocation;
  constructor() {
    const r = openRoot();
    this.root = r.root;
    this.location = r.location;
  }
  private file = (p: string) => new File(this.root, ...parts(p));
  private dir = (p: string) => new Directory(this.root, ...parts(p));

  ensureDir(p: string) {
    this.dir(p).create({ intermediates: true, idempotent: true });
  }
  writeText(p: string, text: string) {
    const f = this.file(p);
    if (!f.exists) f.create({ intermediates: true });
    f.write(text);
  }
  appendText(p: string, text: string) {
    const f = this.file(p);
    if (!f.exists) f.create({ intermediates: true });
    const h = f.open(FileMode.Append);
    try {
      h.writeBytes(new TextEncoder().encode(text));
    } finally {
      h.close();
    }
  }
  readText(p: string) {
    return this.file(p).text();
  }
  exists(p: string) {
    return this.file(p).exists || this.dir(p).exists;
  }
  listDir(p: string) {
    const d = this.dir(p);
    return d.exists ? d.list().map((e) => e.name) : [];
  }
  remove(p: string) {
    const d = this.dir(p);
    if (d.exists) {
      d.delete();
      return;
    }
    const f = this.file(p);
    if (f.exists) f.delete();
  }
}

let fs: ExpoStoreFs | null = null;
/** Lazily created so importing this module never touches the disk. */
export function getStoreFs(): StoreFs & { location: StoreLocation } {
  fs ??= new ExpoStoreFs();
  return fs;
}

/** Root directory of the night store, for binary clip files (the StoreFs interface is text only). */
export function getStoreRootDirectory(): Directory {
  return (getStoreFs() as unknown as ExpoStoreFs).root;
}
