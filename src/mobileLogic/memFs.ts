// In-memory StoreFs for tests. Remembers every path ever written so a test can prove what the app wrote and what it removed.
import type { StoreFs } from './nightStore';

export class MemFs implements StoreFs {
  files = new Map<string, string>();
  dirs = new Set<string>();
  everWritten = new Set<string>();
  ensureDir(p: string) {
    // a real file system creates the parents too
    const parts = p.split('/');
    for (let i = 1; i <= parts.length; i++) this.dirs.add(parts.slice(0, i).join('/'));
  }
  writeText(p: string, t: string) {
    this.files.set(p, t);
    this.everWritten.add(p);
  }
  appendText(p: string, t: string) {
    this.files.set(p, (this.files.get(p) ?? '') + t);
    this.everWritten.add(p);
  }
  async readText(p: string) {
    const t = this.files.get(p);
    if (t === undefined) throw new Error('ENOENT');
    return t;
  }
  exists(p: string) {
    return this.files.has(p) || this.dirs.has(p);
  }
  listDir(p: string) {
    const prefix = `${p}/`;
    const names = new Set<string>();
    for (const f of this.files.keys()) if (f.startsWith(prefix)) names.add(f.slice(prefix.length).split('/')[0] as string);
    for (const d of this.dirs) if (d.startsWith(prefix)) names.add(d.slice(prefix.length).split('/')[0] as string);
    return [...names];
  }
  remove(p: string) {
    for (const f of [...this.files.keys()]) if (f === p || f.startsWith(`${p}/`)) this.files.delete(f);
    for (const d of [...this.dirs]) if (d === p || d.startsWith(`${p}/`)) this.dirs.delete(d);
  }
  /** Every path still present (files and folders). */
  all(): string[] {
    return [...this.files.keys(), ...this.dirs];
  }
}
