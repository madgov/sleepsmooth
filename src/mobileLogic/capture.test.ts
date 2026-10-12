import { describe, expect, it } from 'vitest';
import { classifyLiveness, planStart, scheduledEndMs, type SessionRecord } from './capture';

const rec = (over: Partial<SessionRecord>): SessionRecord => ({ startedAtMs: 0, lastActivityMs: 1_000_000, gaps: [], endReason: null, ...over });

describe('planStart', () => {
  it('starts a new night when there is no previous session', () => {
    expect(planStart(null, 5)).toEqual({ kind: 'new' });
  });
  it('starts a new night after a user stop or a scheduled end', () => {
    expect(planStart(rec({ endReason: 'user-stop' }), 2_000_000)).toEqual({ kind: 'new' });
    expect(planStart(rec({ endReason: 'scheduled-end' }), 2_000_000)).toEqual({ kind: 'new' });
  });
  it('appends to the same night and records the gap after an interruption', () => {
    expect(planStart(rec({ endReason: 'interrupted-call-or-alarm', lastActivityMs: 1_000 }), 61_000)).toEqual({ kind: 'append', gap: { fromMs: 1_000, toMs: 61_000 } });
  });
  it('starts a new night when the interruption is too old or the clock went backwards', () => {
    expect(planStart(rec({ endReason: 'mic-lost', lastActivityMs: 0 }), 13 * 3_600_000)).toEqual({ kind: 'new' });
    expect(planStart(rec({ endReason: 'mic-lost', lastActivityMs: 100 }), 50)).toEqual({ kind: 'new' });
  });
});

describe('classifyLiveness', () => {
  const base = { lastChunkMs: 1_000, interruptions: 0, interruptionsAtLastChunk: 0 };
  it('is receiving while chunks arrive', () => {
    expect(classifyLiveness({ ...base, nowMs: 2_000 })).toBe('receiving');
  });
  it('reports no-audio after 5 s without chunks and no interruption', () => {
    expect(classifyLiveness({ ...base, nowMs: 6_100 })).toBe('no-audio');
  });
  it('reports interrupted, then gives up after 20 s', () => {
    expect(classifyLiveness({ ...base, interruptions: 1, nowMs: 3_500 })).toBe('interrupted');
    expect(classifyLiveness({ ...base, interruptions: 1, nowMs: 21_500 })).toBe('ended-by-interruption');
  });
  it('recovers when a chunk arrives after the interruption', () => {
    expect(classifyLiveness({ ...base, interruptions: 1, interruptionsAtLastChunk: 1, nowMs: 3_000 })).toBe('receiving');
  });
});

describe('scheduledEndMs', () => {
  it('uses the next occurrence of the wake time, across midnight', () => {
    const start = new Date(2026, 9, 11, 23, 0, 0).getTime();
    const end = new Date(scheduledEndMs(start, 7 * 60));
    expect(end.getDate()).toBe(12);
    expect(end.getHours()).toBe(7);
  });
  it('uses the same day when the wake time is still ahead', () => {
    const start = new Date(2026, 9, 11, 5, 0, 0).getTime();
    expect(new Date(scheduledEndMs(start, 7 * 60)).getDate()).toBe(11);
  });
});
