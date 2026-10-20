import { describe, expect, it } from 'vitest';
import {
  appendConsent,
  consentHistoryForDisplay,
  isConsentGranted,
  latestConsent,
  mergeConsentFields,
  migrateLegacyConsent,
  normalizeConsentHistory,
  setOvernightConsent,
  type OvernightConsentFields,
} from './history';

const T1 = '2026-06-01T20:00:00.000Z';
const T2 = '2026-06-02T08:00:00.000Z';
const T3 = '2026-06-03T09:00:00.000Z';
const e = (purpose: 'session-storage' | 'audio-local-analysis' | 'overnight-local-capture', granted: boolean, at: string) => ({ purpose, version: 'v1', granted, at });

describe('append-only consent history', () => {
  it('appends a record with id, purpose, version, status and timestamp', () => {
    const h = appendConsent([], e('session-storage', true, T1));
    expect(h).toEqual([{ id: 'consent-1', purpose: 'session-storage', version: 'v1', status: 'granted', at: T1 }]);
  });
  it('withdrawing appends instead of overwriting', () => {
    const h1 = appendConsent([], e('session-storage', true, T1));
    const h2 = appendConsent(h1, e('session-storage', false, T2));
    expect(h2).toHaveLength(2);
    expect(h2[0]).toEqual(h1[0]);
    expect(h2[1]).toMatchObject({ status: 'withdrawn', at: T2 });
    expect(new Set(h2.map((r) => r.id)).size).toBe(2);
    expect(h1).toHaveLength(1); // input untouched
  });
  it('ignores repeats that change nothing', () => {
    const h1 = appendConsent([], e('session-storage', true, T1));
    expect(appendConsent(h1, e('session-storage', true, T2))).toBe(h1);
    expect(appendConsent([], e('session-storage', false, T1))).toEqual([]);
  });
  it('reads the latest record per purpose', () => {
    let h = appendConsent([], e('session-storage', true, T1));
    h = appendConsent(h, e('audio-local-analysis', true, T1));
    h = appendConsent(h, e('session-storage', false, T2));
    expect(isConsentGranted(h, 'session-storage')).toBe(false);
    expect(isConsentGranted(h, 'audio-local-analysis')).toBe(true);
    expect(isConsentGranted(h, 'overnight-local-capture')).toBe(false);
    expect(latestConsent(h, 'session-storage')?.status).toBe('withdrawn');
    h = appendConsent(h, e('session-storage', true, T3));
    expect(isConsentGranted(h, 'session-storage')).toBe(true);
    expect(consentHistoryForDisplay(h)[0]?.at).toBe(T3);
  });
  it('normalize drops malformed records and duplicate ids', () => {
    const good = { id: 'a', purpose: 'session-storage', version: 'v1', status: 'granted', at: T1 };
    expect(normalizeConsentHistory([good, good, { ...good, id: 'b', status: 'maybe' }, { ...good, id: 'c', purpose: 'x' }, { ...good, id: 'd', at: 'nope' }, 3, null])).toEqual([good]);
    expect(normalizeConsentHistory('x')).toEqual([]);
  });
});

describe('migration from the latest-only value', () => {
  it('a granted legacy value becomes one granted record, keeping its timestamp', () => {
    expect(migrateLegacyConsent({ purpose: 'session-storage', granted: true, at: T1 }, 'session-storage', 'web-1')).toEqual([
      { id: 'consent-1', purpose: 'session-storage', version: 'web-1', status: 'granted', at: T1 },
    ]);
  });
  it('a withdrawn legacy value becomes one withdrawn record; nothing is invented', () => {
    const h = migrateLegacyConsent({ purpose: 'session-storage', granted: false, at: T2 }, 'session-storage', 'web-1');
    expect(h.map((r) => r.status)).toEqual(['withdrawn']);
  });
  it('no timestamp, null or junk gives an empty history', () => {
    expect(migrateLegacyConsent({ purpose: 'session-storage', granted: false, at: null }, 'session-storage', 'v')).toEqual([]);
    expect(migrateLegacyConsent(null, 'session-storage', 'v')).toEqual([]);
    expect(migrateLegacyConsent('x', 'session-storage', 'v')).toEqual([]);
  });
});

describe('iPhone settings fields', () => {
  const legacyGranted = { consent: { purpose: 'overnight-local-capture', version: 'mobile-consent-1', granted: true, at: T1 } };
  it('migrates an old settings file and keeps `consent` working for existing checks', () => {
    const m = mergeConsentFields(legacyGranted, 'overnight-local-capture', 'mobile-consent-1');
    expect(m.consent).toEqual({ purpose: 'overnight-local-capture', version: 'mobile-consent-1', granted: true, at: T1 });
    expect(m.consentHistory).toHaveLength(1);
  });
  it('a fresh install has an empty history and consent off', () => {
    const m = mergeConsentFields({}, 'overnight-local-capture', 'mobile-consent-1');
    expect(m.consent).toMatchObject({ granted: false, at: null });
    expect(m.consentHistory).toEqual([]);
  });
  it('an existing history wins over a stale consent value', () => {
    const history = [{ id: 'consent-1', purpose: 'overnight-local-capture', version: 'mobile-consent-1', status: 'withdrawn', at: T2 }];
    const m = mergeConsentFields({ ...legacyGranted, consentHistory: history }, 'overnight-local-capture', 'mobile-consent-1');
    expect(m.consent.granted).toBe(false);
  });
  it('grant, withdraw, grant appends three records and `consent` follows the latest', () => {
    let s: OvernightConsentFields = mergeConsentFields({}, 'overnight-local-capture', 'mobile-consent-1');
    s = setOvernightConsent(s, true, T1);
    expect(s.consent.granted).toBe(true);
    s = setOvernightConsent(s, false, T2);
    expect(s.consent).toMatchObject({ granted: false, at: T2 });
    s = setOvernightConsent(s, true, T3);
    expect(s.consent.granted).toBe(true);
    expect(s.consentHistory.map((r) => r.status)).toEqual(['granted', 'withdrawn', 'granted']);
    expect(setOvernightConsent(s, true, T3)).toBe(s);
  });
});
