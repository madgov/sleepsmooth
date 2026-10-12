// Web preview stub (dev only): a tiny in-memory file system mirrored to localStorage so onboarding state survives reloads.
// It implements only what src/state/settings.ts and src/data/fileStore.ts call.
const mem = new Map<string, string>();
const PREFIX = 'ss-web-fs:';
const ls = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};
const get = (k: string): string | undefined => mem.get(k) ?? ls()?.getItem(PREFIX + k) ?? undefined;
const put = (k: string, v: string) => {
  mem.set(k, v);
  try {
    ls()?.setItem(PREFIX + k, v);
  } catch {
    /* quota */
  }
};
const del = (k: string) => {
  mem.delete(k);
  try {
    ls()?.removeItem(PREFIX + k);
  } catch {
    /* ignore */
  }
};
const join = (parts: unknown[]): string => parts.map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri)).join('/');

export class Directory {
  uri: string;
  constructor(...parts: unknown[]) {
    this.uri = join(parts);
  }
  get parentDirectory() {
    return new Directory(this.uri.split('/').slice(0, -1).join('/'));
  }
  get exists() {
    return true;
  }
  create() {}
  delete() {
    for (const k of [...mem.keys()]) if (k.startsWith(this.uri + '/')) del(k);
  }
  list() {
    const names = new Set<string>();
    for (const k of mem.keys()) if (k.startsWith(this.uri + '/')) names.add(k.slice(this.uri.length + 1).split('/')[0] as string);
    return [...names].map((name) => ({ name }));
  }
}
export class File {
  uri: string;
  constructor(...parts: unknown[]) {
    this.uri = join(parts);
  }
  get exists() {
    return get(this.uri) !== undefined;
  }
  create() {
    if (get(this.uri) === undefined) put(this.uri, '');
  }
  write(t: string) {
    put(this.uri, t);
  }
  async text() {
    return get(this.uri) ?? '';
  }
  delete() {
    del(this.uri);
  }
  open() {
    return { writeBytes: (b: Uint8Array) => put(this.uri, (get(this.uri) ?? '') + new TextDecoder().decode(b)), close: () => undefined };
  }
}
export const FileMode = { Append: 'append' } as const;
export const Paths = { document: new Directory('web-docs') };
