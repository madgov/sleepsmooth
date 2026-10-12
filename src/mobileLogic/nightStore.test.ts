import { describe, expect, it } from 'vitest';
import model from '../audio/model/model.json';
import type { ModelJson } from '../audio/model/schema';
import { noiseAt, concat, silence, chunks } from '../night/testkit';
import { NightStore, EPOCHS_NAME, MANIFEST_NAME, type StoreFs } from './nightStore';
import { NightSession, viewForStored, type SessionEnv } from './nightSession';

/** In-memory file system that remembers every path ever written, so a test can prove what the app wrote. */
class MemFs implements StoreFs {
  files = new Map<string, string>();
  dirs = new Set<string>();
  everWritten = new Set<string>();
  ensureDir(p: string) {
    this.dirs.add(p);
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
}

const env: SessionEnv = { deviceModel: 'iPhone', osVersion: '18', appVersion: 'test', tz: 'UTC', utcOffsetMinutes: () => 0 };
const T0 = Date.UTC(2026, 0, 15, 23, 0, 0);
const open = (store: NightStore) =>
  NightSession.open({ store, model: model as unknown as ModelJson, env, nowMs: T0, bedtimeLocal: '23:00', wakeLocal: '07:00', remindEnabled: false, initialContext: { appActive: false, charging: true, battery: 80 } });

function feed(s: NightSession, x: Float32Array) {
  for (const c of chunks(x, 16000)) {
    s.enqueue(c, 16000); // hot path: queue only
    while (s.backlogSec() > 1.5) s.pump(); // the controller's slice loop
  }
  while (s.backlogSec() > 1.5) s.pump();
}

describe('night store and session (simulated overnight session)', () => {
  it('writes only a manifest and an epoch log, never audio', async () => {
    const fs = new MemFs();
    const store = new NightStore(fs);
    const s = open(store);
    const audio = concat([noiseAt(70, -45, 3), silence(20), noiseAt(40, -50, 4)]); // 130 s of sound, 16 kHz
    feed(s, audio);
    s.markGap(45, 'interrupted-call-or-alarm');
    feed(s, noiseAt(60, -48, 5));
    s.finish('user-stop');

    // Every path that was ever written, not just what is left: there is no temp audio file either.
    const written = [...fs.everWritten].sort();
    expect(written).toEqual([`nights/${s.id}/${EPOCHS_NAME}`, `nights/${s.id}/${MANIFEST_NAME}`].sort());
    for (const p of written) expect(p).not.toMatch(/\.(wav|caf|m4a|mp3|aac|pcm|raw|flac|ogg|aif|aiff)$/i);
    // Size check: 230 s at 16 kHz float32 would be about 14.7 MB. The whole store is a few KB of JSON lines.
    const bytes = [...fs.files.values()].reduce((a, t) => a + t.length, 0);
    expect(bytes).toBeLessThan(60_000);
    for (const line of (fs.files.get(`nights/${s.id}/${EPOCHS_NAME}`) as string).split('\n').filter(Boolean)) {
      const o = JSON.parse(line) as Record<string, unknown>;
      expect(Object.keys(o)).not.toContain('samples');
      expect(Object.keys(o)).not.toContain('pcm');
    }
    // No window-feature retention (ER-1 stays off).
    const manifest = JSON.parse(fs.files.get(`nights/${s.id}/${MANIFEST_NAME}`) as string) as { retention: { windowFeatures: boolean }; isSynthetic: boolean; endReason: string };
    expect(manifest.retention.windowFeatures).toBe(false);
    expect(manifest.isSynthetic).toBe(false);
    expect(manifest.endReason).toBe('user-stop');
  });

  it('lists stored nights as real nights and summarizes them', async () => {
    const fs = new MemFs();
    const store = new NightStore(fs);
    const s = open(store);
    feed(s, noiseAt(120, -50, 9));
    s.finish('user-stop');
    const list = await store.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.recovered).toBe(false);
    const view = viewForStored(list[0] as NonNullable<(typeof list)[0]>);
    expect(view.summary.isSynthetic).toBe(false);
    expect(view.summary.recordedSec).toBeGreaterThan(100);
  });

  it('recovers a night whose manifest was never closed (killed mid-night)', async () => {
    const fs = new MemFs();
    const store = new NightStore(fs);
    const s = open(store);
    feed(s, noiseAt(100, -50, 2));
    // no finish(): the process "died"
    const list = await new NightStore(fs).list();
    expect(list).toHaveLength(1);
    expect(list[0]?.recovered).toBe(true);
    expect(list[0]?.record.endReason).toBe('os-killed-or-crash-recovered');
    expect(list[0]?.record.captureEnd).not.toBeNull();
    // The closed manifest was written back, so the second listing is a plain read.
    expect((await store.list())[0]?.recovered).toBe(false);
  });

  it('skips the night being recorded right now', async () => {
    const fs = new MemFs();
    const store = new NightStore(fs);
    const s = open(store);
    expect(await store.list([s.id])).toEqual([]);
  });

  it('deletes one night and then everything', async () => {
    const fs = new MemFs();
    const store = new NightStore(fs);
    const a = open(store);
    a.finish('user-stop');
    const b = NightSession.open({ store, model: null, env, nowMs: T0 + 86_400_000, bedtimeLocal: '23:00', wakeLocal: '07:00', remindEnabled: false, initialContext: {} });
    b.finish('user-stop');
    expect((await store.list()).length).toBe(2);
    store.remove(a.id);
    expect((await store.list()).map((n) => n.record.id)).toEqual([b.id]);
    store.removeAll();
    expect(fs.files.size).toBe(0);
    expect(await store.list()).toEqual([]);
  });

  it('rejects unsafe ids', () => {
    const store = new NightStore(new MemFs());
    expect(() => store.remove('../settings')).toThrow();
  });
});
