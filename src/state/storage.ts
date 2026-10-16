import { emptyPartner, normalizePartner, type PartnerObservations } from '../questionnaire/partner';
import type { SymptomAnswers } from '../questionnaire/symptomChecklist';
import type { CareSummary } from '../types/report';
import type { AnswerValue, ConsentRecord } from '../types/questionnaire';

/** Everything persisted. Audio (samples, loudness, windows, analysis) is NEVER part of this. */
export interface PersistedSession {
  consent: ConsentRecord | null;
  answers: Record<string, AnswerValue>;
  symptoms: SymptomAnswers;
  redFlag: boolean | null;
  partner: PartnerObservations;
  isSynthetic: boolean;
  summary: CareSummary | null;
  editedIds: string[];
}

export const STORAGE_KEY = 'sleepsmooth.session.v1';
const PREFIX = 'sleepsmooth.';

export const emptySession = (): PersistedSession => ({
  consent: null,
  answers: {},
  symptoms: {},
  redFlag: null,
  partner: emptyPartner(),
  isSynthetic: false,
  summary: null,
  editedIds: [],
});

export function loadSession(): PersistedSession {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return emptySession();
    const p = JSON.parse(raw) as Partial<PersistedSession>;
    // Whitelist known fields only.
    return { ...emptySession(), ...pick(p) };
  } catch {
    return emptySession();
  }
}

function pick(p: Partial<PersistedSession>): Partial<PersistedSession> {
  return {
    consent: p.consent ?? null,
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
    if (!s.consent?.granted) {
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
