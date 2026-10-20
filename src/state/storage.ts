import { emptyPartner, normalizePartner, type PartnerObservations } from '../questionnaire/partner';
import type { SymptomAnswers } from '../questionnaire/symptomChecklist';
import type { CareSummary } from '../types/report';
import type { AnswerValue, ConsentRecord } from '../types/questionnaire';
import type { ConsentHistoryRecord } from '../types/consent';
import type { WearableObservation } from '../types/wearable';
import { isConsentGranted, latestConsent, migrateLegacyConsent, normalizeConsentHistory } from '../consent/history';
import { normalizeWearable } from '../wearable/entries';

export const WEB_CONSENT_VERSION = 'web-consent-1';

/** Everything persisted. Audio (samples, loudness, windows, analysis) is NEVER part of this. */
export interface PersistedSession {
  /** Derived: the latest 'session-storage' record as { purpose, granted, at }. Kept so existing checks keep working. */
  consent: ConsentRecord | null;
  /** Append-only. Persisted on its own key so a withdrawal is still on record after the answers are cleared. */
  consentHistory: ConsentHistoryRecord[];
  /** User-entered wearable numbers. Stored only with session-storage consent, like the answers. */
  wearable: WearableObservation[];
  answers: Record<string, AnswerValue>;
  symptoms: SymptomAnswers;
  redFlag: boolean | null;
  partner: PartnerObservations;
  isSynthetic: boolean;
  summary: CareSummary | null;
  editedIds: string[];
}

export const STORAGE_KEY = 'sleepsmooth.session.v1';
export const CONSENT_HISTORY_KEY = 'sleepsmooth.consent-history.v1';
const PREFIX = 'sleepsmooth.';

export const emptySession = (): PersistedSession => ({
  consent: null,
  consentHistory: [],
  wearable: [],
  answers: {},
  symptoms: {},
  redFlag: null,
  partner: emptyPartner(),
  isSynthetic: false,
  summary: null,
  editedIds: [],
});

/** The old latest-only value, derived from the history for code that still reads `consent`. */
export function deriveConsent(history: readonly ConsentHistoryRecord[]): ConsentRecord | null {
  const r = latestConsent(history, 'session-storage');
  return r ? { purpose: 'session-storage', granted: r.status === 'granted', at: r.at } : null;
}

function readHistory(legacy: unknown): ConsentHistoryRecord[] {
  try {
    const raw = sessionStorage.getItem(CONSENT_HISTORY_KEY);
    if (raw) return normalizeConsentHistory(JSON.parse(raw));
  } catch {
    // fall through to migration
  }
  // Migration: a session saved before the history existed holds only the latest consent value.
  return migrateLegacyConsent(legacy, 'session-storage', WEB_CONSENT_VERSION);
}

export function loadSession(): PersistedSession {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const p = raw ? (JSON.parse(raw) as Partial<PersistedSession>) : {};
    const consentHistory = readHistory(p.consent);
    // Whitelist known fields only.
    return { ...emptySession(), ...pick(p), consentHistory, consent: deriveConsent(consentHistory) };
  } catch {
    return emptySession();
  }
}

function pick(p: Partial<PersistedSession>): Partial<PersistedSession> {
  return {
    consent: p.consent ?? null,
    wearable: normalizeWearable(p.wearable),
    answers: p.answers ?? {},
    symptoms: p.symptoms ?? {},
    redFlag: p.redFlag ?? null,
    partner: normalizePartner(p.partner),
    isSynthetic: p.isSynthetic === true,
    summary: p.summary ?? null,
    editedIds: Array.isArray(p.editedIds) ? p.editedIds : [],
  };
}

/** Persist only while the user has granted session-storage consent. */
export function saveSession(s: PersistedSession): void {
  try {
    // The consent history is a record of choices, not health data, so it is kept even after a withdrawal.
    if (s.consentHistory.length > 0) sessionStorage.setItem(CONSENT_HISTORY_KEY, JSON.stringify(s.consentHistory));
    else sessionStorage.removeItem(CONSENT_HISTORY_KEY);
    if (!isConsentGranted(s.consentHistory, 'session-storage')) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pick(s)));
  } catch {
    // Storage unavailable: keep working in memory.
  }
}

/** Remove every SleepSmooth key from session storage. */
export function clearAllStorage(): void {
  try {
    for (const k of Object.keys(sessionStorage)) if (k.startsWith(PREFIX)) sessionStorage.removeItem(k);
  } catch {
    // ignore
  }
}
