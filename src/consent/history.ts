// Append-only consent history shared by web and iPhone. Pure functions; callers persist the returned list.
import type { ConsentHistoryRecord, ConsentPurpose, ConsentStatus } from '../types/consent';

export const CONSENT_PURPOSES: readonly ConsentPurpose[] = ['audio-local-analysis', 'session-storage', 'overnight-local-capture'];

export const CONSENT_PURPOSE_LABELS: Record<ConsentPurpose, string> = {
  'audio-local-analysis': 'Analyze a recording on this device',
  'session-storage': 'Keep my answers in this browser tab',
  'overnight-local-capture': 'Overnight sound analysis on this iPhone',
};

export const CONSENT_STATUS_LABELS: Record<ConsentStatus, string> = { granted: 'Agreed', withdrawn: 'Withdrawn' };
export const CONSENT_HISTORY_TITLE = 'Consent history';
export const CONSENT_HISTORY_EMPTY = 'No consent choices recorded yet.';
export const CONSENT_HISTORY_NOTE = 'Each choice you make is added here and never changed. "Delete my data" clears this list too.';

const isPurpose = (x: unknown): x is ConsentPurpose => CONSENT_PURPOSES.includes(x as ConsentPurpose);
const validTime = (x: unknown): x is string => typeof x === 'string' && Number.isFinite(Date.parse(x));

/** Latest record for one purpose, or null. "Latest" is the last one appended. */
export function latestConsent(history: readonly ConsentHistoryRecord[], purpose: ConsentPurpose): ConsentHistoryRecord | null {
  for (let i = history.length - 1; i >= 0; i--) if (history[i]!.purpose === purpose) return history[i]!;
  return null;
}

export const isConsentGranted = (history: readonly ConsentHistoryRecord[], purpose: ConsentPurpose): boolean => latestConsent(history, purpose)?.status === 'granted';

/**
 * Append a record. Returns the same list when the choice would not change anything (granting again while granted,
 * or withdrawing something never granted), so the log records changes of mind, not repeated taps.
 */
export function appendConsent(
  history: readonly ConsentHistoryRecord[],
  entry: { purpose: ConsentPurpose; version: string; granted: boolean; at: string },
): ConsentHistoryRecord[] {
  const status: ConsentStatus = entry.granted ? 'granted' : 'withdrawn';
  const last = latestConsent(history, entry.purpose);
  if ((last?.status ?? 'withdrawn') === status) return history as ConsentHistoryRecord[];
  let n = history.length + 1;
  const ids = new Set(history.map((h) => h.id));
  while (ids.has(`consent-${n}`)) n++;
  return [...history, { id: `consent-${n}`, purpose: entry.purpose, version: entry.version, status, at: entry.at }];
}

/** Whitelist and repair stored data. Order is kept (append order); malformed records are dropped. */
export function normalizeConsentHistory(raw: unknown): ConsentHistoryRecord[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ConsentHistoryRecord[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    if (typeof o.id !== 'string' || seen.has(o.id) || !isPurpose(o.purpose) || typeof o.version !== 'string') continue;
    if ((o.status !== 'granted' && o.status !== 'withdrawn') || !validTime(o.at)) continue;
    seen.add(o.id);
    out.push({ id: o.id, purpose: o.purpose, version: o.version, status: o.status, at: o.at });
  }
  return out;
}

/**
 * Migration from the old latest-only value ({ purpose, granted, at } with an optional version).
 * Nothing is invented: with no timestamp there is no record. A stored "not granted" with a timestamp becomes one
 * "withdrawn" record, because the earlier grant was never logged.
 */
export function migrateLegacyConsent(legacy: unknown, fallbackPurpose: ConsentPurpose, fallbackVersion: string): ConsentHistoryRecord[] {
  if (!legacy || typeof legacy !== 'object') return [];
  const o = legacy as Record<string, unknown>;
  if (!validTime(o.at)) return [];
  const purpose = isPurpose(o.purpose) ? o.purpose : fallbackPurpose;
  const version = typeof o.version === 'string' && o.version ? o.version : fallbackVersion;
  return [{ id: 'consent-1', purpose, version, status: o.granted === true ? 'granted' : 'withdrawn', at: o.at }];
}

/** Newest first, for display. */
export const consentHistoryForDisplay = (history: readonly ConsentHistoryRecord[]): ConsentHistoryRecord[] => [...history].reverse();

/** The iPhone keeps the latest overnight-capture choice as `consent` (read by existing checks) next to the history. */
export interface OvernightConsentFields {
  consent: { purpose: ConsentPurpose; version: string; granted: boolean; at: string | null };
  consentHistory: ConsentHistoryRecord[];
}

const deriveOvernight = (history: readonly ConsentHistoryRecord[], purpose: ConsentPurpose, version: string): OvernightConsentFields['consent'] => {
  const r = latestConsent(history, purpose);
  return { purpose, version, granted: r?.status === 'granted', at: r?.at ?? null };
}

/** Read stored settings: use the history when present, otherwise migrate the old latest-only `consent`. */
export function mergeConsentFields(raw: { consent?: unknown; consentHistory?: unknown }, purpose: ConsentPurpose, version: string): OvernightConsentFields {
  const consentHistory = Array.isArray(raw.consentHistory) ? normalizeConsentHistory(raw.consentHistory) : migrateLegacyConsent(raw.consent, purpose, version);
  return { consentHistory, consent: deriveOvernight(consentHistory, purpose, version) };
}

/** Record a grant or withdrawal of the overnight-capture consent and keep `consent` in step with the history. */
export function setOvernightConsent<T extends OvernightConsentFields>(s: T, granted: boolean, at: string): T {
  const consentHistory = appendConsent(s.consentHistory, { purpose: s.consent.purpose, version: s.consent.version, granted, at });
  if (consentHistory === s.consentHistory) return s;
  return { ...s, consentHistory, consent: deriveOvernight(consentHistory, s.consent.purpose, s.consent.version) };
}
