import { describe, expect, it } from 'vitest';
import {
  FIRST_ENTRY_PRIMER_VERSION,
  PENDING_MAX_AGE_MS,
  autoRecordRowValue,
  decideAutoStart,
  defaultAutoRecord,
  mergeAutoRecord,
  outcomeNote,
  parsePendingCommand,
  pendingIsFresh,
  shouldOfferAutoRecord,
  shouldShowFirstEntryPrimer,
} from './autoRecord';

const NOW = Date.parse('2026-06-10T23:00:00Z');
describe('autoRecordRowValue', () => {
  it('never claims it runs without an observed start', () => {
    expect(autoRecordRowValue(defaultAutoRecord())).toBe('Not set up');
    expect(autoRecordRowValue({ ...defaultAutoRecord(), decision: 'declined' })).toBe('Not set up');
    expect(autoRecordRowValue({ ...defaultAutoRecord(), decision: 'setup-marked', markedDoneAt: '2026-06-01T00:00:00Z' })).toBe('Set up, not yet seen running');
  });
  it('shows the last observed run', () => {
    const d = new Date(2026, 5, 9, 23, 2); // local Tue 11:02 pm
    expect(autoRecordRowValue({ ...defaultAutoRecord(), decision: 'setup-marked', lastAutoStartAt: d.toISOString() })).toBe('Last ran Tue 11:02 pm');
  });
});
describe('offer and primer gates', () => {
  it('offers the card once, on iOS, after onboarding', () => {
    expect(shouldOfferAutoRecord(defaultAutoRecord(), true, true)).toBe(true);
    expect(shouldOfferAutoRecord(defaultAutoRecord(), false, true)).toBe(false);
    expect(shouldOfferAutoRecord(defaultAutoRecord(), true, false)).toBe(false);
    expect(shouldOfferAutoRecord({ ...defaultAutoRecord(), decision: 'declined' }, true, true)).toBe(false);
  });
  it('shows the first-entry primer only once per version and not after consent', () => {
    expect(shouldShowFirstEntryPrimer({ onboardingDone: true, primerShownVersion: 0, consentGranted: false })).toBe(true);
    expect(shouldShowFirstEntryPrimer({ onboardingDone: true, primerShownVersion: FIRST_ENTRY_PRIMER_VERSION, consentGranted: false })).toBe(false);
    expect(shouldShowFirstEntryPrimer({ onboardingDone: false, primerShownVersion: 0, consentGranted: false })).toBe(false);
    expect(shouldShowFirstEntryPrimer({ onboardingDone: true, primerShownVersion: 0, consentGranted: true })).toBe(false);
  });
});
describe('pending command', () => {
  it('parses strings and objects, rejects junk', () => {
    expect(parsePendingCommand('{"kind":"start","at":5}')).toEqual({ kind: 'start', at: 5 });
    expect(parsePendingCommand({ kind: 'stop', at: 1 })).toEqual({ kind: 'stop', at: 1 });
    expect(parsePendingCommand('{"kind":"x","at":1}')).toBeNull();
    expect(parsePendingCommand('nope')).toBeNull();
    expect(parsePendingCommand(null)).toBeNull();
  });
  it('drops stale commands', () => {
    expect(pendingIsFresh({ kind: 'start', at: NOW - 60_000 }, NOW)).toBe(true);
    expect(pendingIsFresh({ kind: 'start', at: NOW - PENDING_MAX_AGE_MS - 1 }, NOW)).toBe(false);
    expect(pendingIsFresh({ kind: 'start', at: NOW + 3_600_000 }, NOW)).toBe(false);
  });
});
describe('decideAutoStart', () => {
  const ok = { consentGranted: true, micGranted: true, standingAckAt: '2026-06-01T00:00:00Z', alreadyRecording: false, nowMs: NOW };
  it('starts only when everything is in place', () => {
    expect(decideAutoStart(ok)).toEqual({ ok: true });
  });
  it('blocks, in order, and never skips consent or the notice', () => {
    expect(decideAutoStart({ ...ok, alreadyRecording: true })).toEqual({ ok: false, outcome: 'blocked-already-recording' });
    expect(decideAutoStart({ ...ok, consentGranted: false })).toEqual({ ok: false, outcome: 'blocked-consent' });
    expect(decideAutoStart({ ...ok, standingAckAt: null })).toEqual({ ok: false, outcome: 'blocked-ack' });
    expect(decideAutoStart({ ...ok, standingAckAt: '2025-01-01T00:00:00Z' })).toEqual({ ok: false, outcome: 'blocked-ack' });
    expect(decideAutoStart({ ...ok, micGranted: false })).toEqual({ ok: false, outcome: 'blocked-mic' });
  });
  it('explains blocked outcomes', () => {
    expect(outcomeNote('blocked-mic')).toMatch(/microphone/);
    expect(outcomeNote('started')).toBeNull();
  });
});
describe('mergeAutoRecord', () => {
  it('is defensive', () => {
    expect(mergeAutoRecord(undefined)).toEqual(defaultAutoRecord());
    expect(mergeAutoRecord({ decision: 'bogus', lastAutoStartAt: 'not a date' })).toEqual(defaultAutoRecord());
  });
});
