import { describe, expect, it } from 'vitest';
import { EPOCH_SCHEMA_VERSION } from './constants';
import { isSupportedEpochSchema, parseEpochLog, recoverUnfinishedNight, resumeFromLog, serializeEpoch } from './recovery';
import { buildNightFromFlags, run } from './testkit';

const n = buildNightFromFlags({ epochs: 10, flaggedK: run(5, 6) });
const log = n.epochs.map(serializeEpoch).join('');

describe('epoch log parsing', () => {
  it('round-trips a clean log', () => {
    const p = parseEpochLog(log);
    expect(p.epochs).toEqual(n.epochs);
    expect(p).toMatchObject({ truncatedTail: false, badLines: 0, duplicates: 0 });
  });
  it('drops a truncated last line and keeps everything before it', () => {
    const p = parseEpochLog(log.slice(0, log.length - 40));
    expect(p.truncatedTail).toBe(true);
    expect(p.epochs.map((e) => e.i)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });
  it('de-duplicates repeated epoch indices; the later line wins; output is sorted', () => {
    const changed = { ...n.epochs[3]!, cap: 12 };
    const text = log + serializeEpoch(changed) + serializeEpoch(n.epochs[0]!);
    const p = parseEpochLog(text);
    expect(p.duplicates).toBe(2);
    expect(p.epochs.map((e) => e.i)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(p.epochs[3]!.cap).toBe(12);
  });
  it('counts garbage lines in the middle without failing', () => {
    const lines = log.split('\n');
    lines.splice(2, 0, 'not json', '{"i":"x"}');
    const p = parseEpochLog(lines.join('\n'));
    expect(p.badLines).toBe(2);
    expect(p.epochs).toHaveLength(10);
  });
  it('empty log', () => {
    expect(parseEpochLog('')).toEqual({ epochs: [], truncatedTail: false, badLines: 0, duplicates: 0 });
  });
});

describe('manifest recovery', () => {
  it('an unfinalized night is closed from its last epoch as os-killed-or-crash-recovered', () => {
    const open = { ...n.record, captureEnd: null, endReason: null };
    const r = recoverUnfinishedNight(open, n.epochs);
    expect(r.endReason).toBe('os-killed-or-crash-recovered');
    expect(r.captureEnd).toBe(n.epochs[9]!.t + 30_000);
  });
  it('an unfinalized night with no epochs ends at its start', () => {
    const open = { ...n.record, captureEnd: null, endReason: null };
    expect(recoverUnfinishedNight(open, []).captureEnd).toBe(open.captureStart);
  });
  it('a finalized night is returned unchanged', () => {
    expect(recoverUnfinishedNight(n.record, n.epochs)).toBe(n.record);
  });
});

describe('schema version and resume seed', () => {
  it('supports the current version and older, rejects newer or invalid', () => {
    expect(isSupportedEpochSchema({ epochSchemaVersion: EPOCH_SCHEMA_VERSION })).toBe(true);
    expect(isSupportedEpochSchema({ epochSchemaVersion: EPOCH_SCHEMA_VERSION + 1 })).toBe(false);
    expect(isSupportedEpochSchema({ epochSchemaVersion: 0 })).toBe(false);
    expect(isSupportedEpochSchema({ epochSchemaVersion: 1.5 })).toBe(false);
  });
  it('resumeFromLog returns null for an empty log and the last epoch otherwise', () => {
    expect(resumeFromLog(parseEpochLog(''), 5)).toBeNull();
    const r = resumeFromLog(parseEpochLog(log), 12345)!;
    expect(r.lastEpoch.i).toBe(9);
    expect(r.resumeAtMs).toBe(12345);
    expect(r.recentEpochs).toHaveLength(10);
  });
});
