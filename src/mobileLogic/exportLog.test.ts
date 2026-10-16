import { describe, expect, it } from 'vitest';
import { buildSampleNightView } from '../night/sample';
import { summarizeNight } from '../night/summary';
import { buildNightFromFlags, run } from '../night/testkit';
import { addGap, newDiagnostics, startRun } from './diagnostics';
import { emptyFeedback, setKind, toggleVerdict } from './clipFeedback';
import { buildTestLog, serializeTestLog } from './exportLog';
import type { ClipMeta } from './clips';

const app = { version: '0.1.0', deviceModel: 'iPhone', os: '18' };

describe('test log export', () => {
  const b = buildNightFromFlags({ flaggedK: run(100, 12) });
  const view = summarizeNight(b.record, b.epochs, b.schedule);
  const clip: ClipMeta = { id: 'c1', file: 'c1.wav', category: 'snore-like', tag: null, startMs: b.record.captureStart + 60_000, durationSec: 9, peaks: [1, 2, 3], score: 77 };
  let fb = toggleVerdict(emptyFeedback(b.record.id), 'c1', 'not-this-sound', 5);
  fb = setKind(fb, 'c1', 'fan-ac', 6);
  const diag = addGap(startRun(newDiagnostics({ nightId: b.record.id, device: { model: 'iPhone', os: '18', app: '1' }, scheduledStartMs: b.schedule.startMs, scheduledEndMs: b.schedule.endMs }), b.record.captureStart, null), { startMs: b.record.captureStart + 1000, endMs: b.record.captureStart + 61_000, cause: 'interruption' });

  it('includes gaps, coverage and the user clip feedback', () => {
    const log = buildTestLog({ exportedAtMs: 0, app, nights: [{ view, diagnostics: diag, feedback: fb, clips: [clip] }] }) as { nights: Record<string, unknown>[] };
    type N = { diagnostics: { gaps: { cause: string }[] }; coverageSec: { scheduled: number }; criteriaResult: unknown; clipFeedback: { kind: string | null; verdict: string; category: string | null }[]; windows: Record<string, number> };
    const n = log.nights[0] as unknown as N;
    expect(n.diagnostics.gaps[0]?.cause).toBe('interruption');
    expect(n.coverageSec.scheduled).toBe(8 * 3600);
    expect(n.clipFeedback[0]).toMatchObject({ clipId: 'c1', verdict: 'not-this-sound', kind: 'fan-ac', category: 'snore-like', durationSec: 9 });
    expect(n.criteriaResult).toBeTruthy();
  });

  it('contains no audio-like fields (no peaks, no scores, no samples)', () => {
    const json = serializeTestLog({ exportedAtMs: 0, app, nights: [{ view, diagnostics: diag, feedback: fb, clips: [clip] }] });
    expect(json).not.toMatch(/"peaks"|"score"|"samples"|"pcm"|scoreQ|scoredMask/);
    expect(json).toMatch(/Contains no audio/);
  });

  it('never exports the sample night', () => {
    const sample = buildSampleNightView('snore-episodes');
    const log = buildTestLog({ exportedAtMs: 0, app, nights: [{ view: sample, diagnostics: null, feedback: null, clips: [] }] }) as { nights: unknown[] };
    expect(log.nights).toEqual([]);
  });

  it('a night without diagnostics still exports with null numbers', () => {
    const log = buildTestLog({ exportedAtMs: 0, app, nights: [{ view, diagnostics: null, feedback: null, clips: [] }] }) as { nights: Record<string, unknown>[] };
    expect(log.nights[0]?.diagnosticsNumbers).toBeNull();
    expect(log.nights[0]?.clipFeedback).toEqual([]);
  });
});
