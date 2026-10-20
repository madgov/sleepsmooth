// Local settings: one small JSON file in Documents via expo-file-system (no database, no network, no audio).
// Holds consent, sleep hours, onboarding completion and the user's own screening answers.
import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { emptyPartner, normalizePartner, type PartnerObservations } from '@core/questionnaire/partner';
import type { SymptomAnswers } from '@core/questionnaire/symptomChecklist';
import type { AnswerValue } from '@core/types/questionnaire';
import { defaultAutoRecord, mergeAutoRecord, type AutoRecordState } from '@core/mobileLogic/autoRecord';
import { defaultMorningState, mergeMorningState, type MorningState } from '@core/mobileLogic/morningLearning';
import { defaultRoutineMemory, mergeRoutineMemory, type RoutineMemory } from '@core/mobileLogic/routine';
import { defaultClipSettings, mergeClipSettings, type ClipSettings } from '@core/mobileLogic/clips';
import { mergeConsentFields } from '@core/consent/history';
import type { ConsentHistoryRecord } from '@core/types/consent';
import type { WearableObservation } from '@core/types/wearable';
import { normalizeWearable } from '@core/wearable/entries';
import { emptySummaryEdits, normalizeSummaryEdits, type SummaryEdits } from '@core/mobileLogic/summaryEdits';

export const CONSENT_VERSION = 'mobile-consent-1';
export const CONSENT_PURPOSE = 'overnight-local-capture';

export interface Settings {
  v: 1;
  onboardingCompletedAt: string | null;
  /** Derived from `consentHistory` (the latest overnight-capture record). Existing checks read this. */
  consent: { purpose: typeof CONSENT_PURPOSE; version: typeof CONSENT_VERSION; granted: boolean; at: string | null };
  /** Append-only list of consent choices. Cleared only by "Delete my data". */
  consentHistory: ConsentHistoryRecord[];
  bystanderNoticeAckAt: string | null;
  sleep: { bedMin: number; wakeMin: number; userSet: boolean; reminder: boolean };
  answers: Record<string, AnswerValue>;
  symptoms: SymptomAnswers;
  redFlag: boolean | null;
  /** Optional bed-partner observations. User-reported (partner), never scored. */
  partner: PartnerObservations;
  /** Whether the user finished the questionnaire at least once (drives "Added" / "Answered"). */
  questionnaireSavedAt: string | null;
  /** Ids of the next-steps rows the user ticked. Removed by "Delete my data". */
  nextStepsTicks: string[];
  /** One optional user-set follow-up reminder (ISO). The notification itself is local only; see platform/reminder.ts. */
  followUpReminderAt: string | null;
  /** Automatic recording at bedtime (Shortcuts). Never implies the automation is active; see autoRecord.ts. */
  autoRecord: AutoRecordState;
  /** Opt-in short sound clips. Default off: with it off no audio is written. */
  clips: ClipSettings;
  /** Highest first-entry primer version already shown (0 = never). The primer auto-shows once per version. */
  primerShownVersion: number;
  /** Morning stop: learning state (src/mobileLogic/morningLearning.ts). */
  morning: MorningState;
  /** "Not now" memory for the routine suggestion card. */
  routine: RoutineMemory;
  /** Apple Health: set after the read-permission request completed. HealthKit hides read decisions, so this is not "allowed". */
  health: { requestedAt: string | null; lastReadAt: string | null };
  /** The user's edits to the clinician summary, by section. Removed by "Delete my data" (the whole settings file is reset). */
  summaryEdits: SummaryEdits;
  /** Numbers the user typed in from a wearable. Not checked by SleepSmooth. Removed by "Delete my data". */
  wearable: WearableObservation[];
}

export const defaultSettings = (): Settings => ({
  v: 1,
  onboardingCompletedAt: null,
  consent: { purpose: CONSENT_PURPOSE, version: CONSENT_VERSION, granted: false, at: null },
  consentHistory: [],
  bystanderNoticeAckAt: null,
  sleep: { bedMin: 23 * 60, wakeMin: 7 * 60, userSet: false, reminder: false },
  answers: {},
  symptoms: {},
  redFlag: null,
  partner: emptyPartner(),
  questionnaireSavedAt: null,
  nextStepsTicks: [],
  followUpReminderAt: null,
  autoRecord: defaultAutoRecord(),
  clips: defaultClipSettings(),
  primerShownVersion: 0,
  morning: defaultMorningState(),
  routine: defaultRoutineMemory(),
  health: { requestedAt: null, lastReadAt: null },
  summaryEdits: emptySummaryEdits(),
  wearable: [],
});

type Status = 'loading' | 'ready' | 'error';
interface Snapshot {
  status: Status;
  settings: Settings;
  saveError: string | null;
}

const FILE_NAME = 'sleepsmooth-settings.json';
let snap: Snapshot = { status: 'loading', settings: defaultSettings(), saveError: null };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const file = () => new File(Paths.document, FILE_NAME);

function merge(raw: unknown): Settings {
  const d = defaultSettings();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<Settings>;
  return {
    ...d,
    ...r,
    ...(mergeConsentFields(r, CONSENT_PURPOSE, CONSENT_VERSION) as Pick<Settings, 'consent' | 'consentHistory'>),
    sleep: { ...d.sleep, ...(r.sleep ?? {}) },
    answers: { ...(r.answers ?? {}) },
    symptoms: { ...(r.symptoms ?? {}) },
    partner: normalizePartner(r.partner),
    nextStepsTicks: Array.isArray(r.nextStepsTicks) ? r.nextStepsTicks.filter((x) => typeof x === 'string') : [],
    followUpReminderAt: typeof r.followUpReminderAt === 'string' && Number.isFinite(Date.parse(r.followUpReminderAt)) ? r.followUpReminderAt : null,
    autoRecord: mergeAutoRecord(r.autoRecord),
    clips: mergeClipSettings(r.clips),
    primerShownVersion: typeof r.primerShownVersion === 'number' && r.primerShownVersion >= 0 ? Math.floor(r.primerShownVersion) : 0,
    morning: mergeMorningState(r.morning),
    routine: mergeRoutineMemory(r.routine),
    health: mergeHealth(r.health),
    summaryEdits: normalizeSummaryEdits(r.summaryEdits),
    wearable: normalizeWearable(r.wearable),
    v: 1,
  };
}

function mergeHealth(raw: unknown): Settings['health'] {
  const ok = (x: unknown): string | null => (typeof x === 'string' && Number.isFinite(Date.parse(x)) ? x : null);
  const r = raw && typeof raw === 'object' ? (raw as Partial<Settings['health']>) : {};
  return { requestedAt: ok(r.requestedAt), lastReadAt: ok(r.lastReadAt) };
}

/** Reads the file once at launch. A missing or corrupt file means first run, never a crash. */
export async function loadSettings(): Promise<void> {
  try {
    const f = file();
    if (f.exists) snap = { status: 'ready', settings: merge(JSON.parse(await f.text())), saveError: null };
    else snap = { status: 'ready', settings: defaultSettings(), saveError: null };
  } catch {
    snap = { status: 'ready', settings: defaultSettings(), saveError: null };
  }
  emit();
}

function persist(): void {
  try {
    const f = file();
    if (!f.exists) f.create();
    f.write(JSON.stringify(snap.settings));
    if (snap.saveError) snap = { ...snap, saveError: null };
  } catch (e) {
    snap = { ...snap, saveError: e instanceof Error ? e.message : String(e) };
  }
}

export function updateSettings(patch: Partial<Settings> | ((s: Settings) => Settings)): void {
  const next = typeof patch === 'function' ? patch(snap.settings) : { ...snap.settings, ...patch };
  snap = { ...snap, settings: next };
  persist();
  emit();
}

/** "Delete my data": removes the settings file and resets memory. Returns false if the file could not be removed. */
export function deleteAllSettings(): boolean {
  let ok = true;
  try {
    const f = file();
    if (f.exists) f.delete();
  } catch {
    ok = false;
  }
  snap = { status: 'ready', settings: defaultSettings(), saveError: null };
  emit();
  return ok;
}

export function useSettingsSnapshot(): Snapshot {
  return useSyncExternalStore(subscribe, () => snap, () => snap);
}
export const useSettings = (): Settings => useSettingsSnapshot().settings;
export const getSettings = (): Settings => snap.settings;
