import { afterEach, describe, expect, it } from 'vitest';
import { localDateISO, localDayOfTimestamp, observationLine, validateDraft, emptyWearableDraft, validateDate } from './entries';

const originalTZ = process.env.TZ;
afterEach(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

describe('local calendar day for wearable entries', () => {
  it('localDateISO uses local parts of a constructed local Date', () => {
    expect(localDateISO(new Date(2026, 9, 19, 23, 59))).toBe('2026-10-19');
    expect(localDateISO(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
  });

  it('shows the local day for a timestamp that is already the next day in UTC', () => {
    process.env.TZ = 'America/Los_Angeles';
    expect(localDayOfTimestamp('2026-10-20T03:41:00Z')).toBe('2026-10-19');
    process.env.TZ = 'Pacific/Auckland';
    expect(localDayOfTimestamp('2026-10-19T20:00:00Z')).toBe('2026-10-20');
    process.env.TZ = 'UTC';
    expect(localDayOfTimestamp('2026-10-20T03:41:00Z')).toBe('2026-10-20');
  });

  it('observationLine shows the local entered day', () => {
    process.env.TZ = 'America/Los_Angeles';
    const r = validateDraft({ ...emptyWearableDraft(), values: { ...emptyWearableDraft().values, 'resting-hr': '60' } }, '2026-10-20T03:41:00Z');
    if (!r.ok) throw new Error('expected ok');
    expect(observationLine(r.observations[0]!)).toContain('entered 2026-10-19');
  });

  it('accepts the local today as a night date even when UTC has rolled over', () => {
    process.env.TZ = 'America/Los_Angeles';
    const d = { ...emptyWearableDraft(), forDate: '2026-10-19', values: { ...emptyWearableDraft().values, 'resting-hr': '60' } };
    expect(validateDraft(d, '2026-10-20T03:41:00Z').ok).toBe(true);
    const future = { ...d, forDate: '2026-10-20' };
    const bad = validateDraft(future, '2026-10-20T03:41:00Z');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.forDate).toMatch(/future/);
  });

  it('validateDate checks real calendar days independent of timezone', () => {
    for (const tz of ['America/Los_Angeles', 'Pacific/Auckland', 'UTC']) {
      process.env.TZ = tz;
      expect(validateDate('2026-02-29', '2026-12-31').error).toBeTruthy();
      expect(validateDate('2026-03-01', '2026-12-31').value).toBe('2026-03-01');
    }
  });
});
