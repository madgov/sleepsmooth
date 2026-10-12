// On-device night store (pure logic; the file system is injected so this is testable without React Native).
//
// Layout, one folder per night:   nights/<id>/manifest.json   (NightRecord)
//                                  nights/<id>/epochs.jsonl    (one EpochRecord per line, append-only)
// That is ALL a night ever writes. There is no audio file, no feature file and no per-window file: ER-1 retention is off
// (RETENTION_DEFAULT) and nothing in this module can persist samples. The test in nightStore.test.ts lists every file after
// a simulated session to prove it.
import { parseEpochLog, recoverUnfinishedNight, serializeEpoch, type EpochRecord, type NightRecord } from '../night';

export interface StoreFs {
  ensureDir(path: string): void;
  writeText(path: string, text: string): void;
  appendText(path: string, text: string): void;
  readText(path: string): Promise<string>;
  exists(path: string): boolean;
  /** Entry names (not paths) directly under `path`. [] when it does not exist. */
  listDir(path: string): string[];
  /** Removes a file or a directory tree. No error when it does not exist. */
  remove(path: string): void;
}

export const NIGHTS_DIR = 'nights';
export const MANIFEST_NAME = 'manifest.json';
export const EPOCHS_NAME = 'epochs.jsonl';
const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;

export interface StoredNight {
  record: NightRecord;
  epochs: EpochRecord[];
  /** The manifest was still open (crash or kill) and was closed from the epochs on this launch. */
  recovered: boolean;
}

function assertId(id: string): void {
  if (!SAFE_ID.test(id)) throw new Error('Invalid night id');
}

export class NightStore {
  constructor(private readonly fs: StoreFs) {}

  private dir = (id: string) => `${NIGHTS_DIR}/${id}`;

  begin(record: NightRecord): void {
    assertId(record.id);
    this.fs.ensureDir(NIGHTS_DIR);
    this.fs.ensureDir(this.dir(record.id));
    this.fs.writeText(`${this.dir(record.id)}/${EPOCHS_NAME}`, '');
    this.fs.writeText(`${this.dir(record.id)}/${MANIFEST_NAME}`, JSON.stringify(record));
  }

  appendEpochs(id: string, epochs: readonly EpochRecord[]): void {
    assertId(id);
    if (epochs.length === 0) return;
    this.fs.appendText(`${this.dir(id)}/${EPOCHS_NAME}`, epochs.map(serializeEpoch).join(''));
  }

  /** Replaces the manifest (end time, end reason, gaps). */
  writeManifest(record: NightRecord): void {
    assertId(record.id);
    this.fs.writeText(`${this.dir(record.id)}/${MANIFEST_NAME}`, JSON.stringify(record));
  }

  /**
   * Reads every stored night, newest first. A night whose manifest was never closed is recovered with
   * recoverUnfinishedNight and its manifest is rewritten. Unreadable folders are skipped, never thrown.
   * `skipIds` (the night being recorded right now) is left untouched.
   */
  async list(skipIds: readonly string[] = []): Promise<StoredNight[]> {
    const out: StoredNight[] = [];
    for (const id of this.fs.listDir(NIGHTS_DIR)) {
      if (!SAFE_ID.test(id) || skipIds.includes(id)) continue;
      try {
        const manifest = JSON.parse(await this.fs.readText(`${this.dir(id)}/${MANIFEST_NAME}`)) as NightRecord;
        const logPath = `${this.dir(id)}/${EPOCHS_NAME}`;
        const epochs = this.fs.exists(logPath) ? parseEpochLog(await this.fs.readText(logPath)).epochs : [];
        const closed = recoverUnfinishedNight(manifest, epochs);
        const recovered = closed !== manifest;
        if (recovered) this.writeManifest(closed);
        out.push({ record: closed, epochs, recovered });
      } catch {
        // A corrupt night is skipped. It stays on disk until the user deletes everything.
      }
    }
    return out.sort((a, b) => b.record.captureStart - a.record.captureStart);
  }

  async get(id: string): Promise<StoredNight | null> {
    if (!SAFE_ID.test(id)) return null;
    return (await this.list()).find((n) => n.record.id === id) ?? null;
  }

  remove(id: string): void {
    assertId(id);
    this.fs.remove(this.dir(id));
  }

  /** "Delete my data": the whole store, including any folder this build did not recognise. */
  removeAll(): void {
    this.fs.remove(NIGHTS_DIR);
  }
}
