import { describe, expect, it } from 'vitest';
import { buildNightFromFlags } from '../night/testkit';
import { addGap, newDiagnostics, startRun } from './diagnostics';
import { MemFs } from './memFs';
import { NightStore } from './nightStore';

describe('diagnostics in the night store', () => {
  it('a night closed by the existing recovery path gets a recovered event and a gap, once', async () => {
    const fs = new MemFs();
    const store = new NightStore(fs);
    const b = buildNightFromFlags({ epochs: 100 });
    const open = { ...b.record, id: 'n9', captureEnd: null, endReason: null };
    store.begin(open);
    store.appendEpochs('n9', b.epochs);
    store.writeDiagnostics('n9', startRun(newDiagnostics({ nightId: 'n9', device: { model: 'iPhone', os: '18', app: '1' }, scheduledStartMs: b.schedule.startMs, scheduledEndMs: b.schedule.endMs }), b.record.captureStart, { atMs: b.record.captureStart, pct: 80, charging: true, lowPowerMode: false }));

    const first = await store.list([], b.schedule.endMs + 3600_000);
    expect(first[0]?.recovered).toBe(true);
    expect(first[0]?.diagnostics?.recoveredCount).toBe(1);
    expect(first[0]?.diagnostics?.gaps[0]?.cause).toBe('app-killed-or-recovered');
    expect(first[0]?.diagnostics?.runs[0]?.stopReason).toBe('app-killed-or-recovered');

    const second = await store.list([], b.schedule.endMs + 7200_000);
    expect(second[0]?.recovered).toBe(false);
    expect(second[0]?.diagnostics?.recoveredCount).toBe(1); // not counted twice
  });

  it('a night with no diagnostics file lists with diagnostics null', async () => {
    const fs = new MemFs();
    const store = new NightStore(fs);
    const b = buildNightFromFlags({ epochs: 10 });
    store.begin(b.record);
    store.appendEpochs(b.record.id, b.epochs);
    const out = await store.list();
    expect(out[0]?.diagnostics).toBeNull();
  });

  it('diagnostics and feedback survive a list() round trip', async () => {
    const fs = new MemFs();
    const store = new NightStore(fs);
    const b = buildNightFromFlags({ epochs: 10 });
    store.begin(b.record);
    store.appendEpochs(b.record.id, b.epochs);
    store.writeDiagnostics(b.record.id, addGap(newDiagnostics({ nightId: b.record.id, device: { model: 'm', os: 'o', app: 'a' }, scheduledStartMs: null, scheduledEndMs: null }), { startMs: 1, endMs: 9000, cause: 'route-change' }));
    const out = await store.list();
    expect(out[0]?.diagnostics?.gaps).toHaveLength(1);
  });

  it('rejects an unsafe night id before touching the file system', () => {
    const store = new NightStore(new MemFs());
    expect(() => store.writeDiagnostics('../x', newDiagnostics({ nightId: 'x', device: { model: '', os: '', app: '' }, scheduledStartMs: null, scheduledEndMs: null }))).toThrow();
  });
});
