// Automatic recording at bedtime (Shortcuts): pure state logic. No React, no native code.
//
// HONEST LIMIT: iOS lets only the USER create a Personal Automation. The app ships an App Intent ("Start SleepSmooth
// overnight check") that the user's own automation runs. This file therefore never claims the automation is active:
// the only evidence is `lastAutoStartAt`, written after the native side delivered a start command AND recording began.

export type AutoRecordDecision = 'undecided' | 'declined' | 'setup-marked';

export type AutoOutcome = 'started' | 'blocked-consent' | 'blocked-mic' | 'blocked-ack' | 'blocked-already-recording' | 'start-failed';

export interface AutoRecordState {
  decision: AutoRecordDecision;
  decidedAt: string | null;
  /** The user tapped "Done, I've set it up". A claim by the user, not proof that it runs. */
  markedDoneAt: string | null;
  /** The user said they also made a stop automation at wake time. Optional. */
  stopMarkedDone: boolean;
  /** One-time acknowledgement that an automatic start will record without the usual per-night confirmation. */
  standingAckAt: string | null;
  /** Last time a real intent start was observed and recording began. The ONLY evidence that automation works. */
  lastAutoStartAt: string | null;
  lastOutcome: AutoOutcome | null;
  lastOutcomeAt: string | null;
}

export const defaultAutoRecord = (): AutoRecordState => ({
  decision: 'undecided',
  decidedAt: null,
  markedDoneAt: null,
  stopMarkedDone: false,
  standingAckAt: null,
  lastAutoStartAt: null,
  lastOutcome: null,
  lastOutcomeAt: null,
});

const OUTCOMES: readonly AutoOutcome[] = ['started', 'blocked-consent', 'blocked-mic', 'blocked-ack', 'blocked-already-recording', 'start-failed'];
const str = (x: unknown): string | null => (typeof x === 'string' && Number.isFinite(Date.parse(x)) ? x : null);

export function mergeAutoRecord(raw: unknown): AutoRecordState {
  const d = defaultAutoRecord();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<AutoRecordState>;
  return {
    decision: r.decision === 'declined' || r.decision === 'setup-marked' ? r.decision : 'undecided',
    decidedAt: str(r.decidedAt),
    markedDoneAt: str(r.markedDoneAt),
    stopMarkedDone: r.stopMarkedDone === true,
    standingAckAt: str(r.standingAckAt),
    lastAutoStartAt: str(r.lastAutoStartAt),
    lastOutcome: OUTCOMES.includes(r.lastOutcome as AutoOutcome) ? (r.lastOutcome as AutoOutcome) : null,
    lastOutcomeAt: str(r.lastOutcomeAt),
  };
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function clock12(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

/** Settings row value. Never says "active" or "on": only what was actually seen. */
export function autoRecordRowValue(s: AutoRecordState): string {
  if (s.lastAutoStartAt) {
    const d = new Date(s.lastAutoStartAt);
    if (!Number.isNaN(d.getTime())) return `Last ran ${DAYS[d.getDay()]} ${clock12(d)}`;
  }
  return s.decision === 'setup-marked' ? 'Set up, not yet seen running' : 'Not set up';
}

/** The dashboard card is offered once: until the user chooses either button. */
export function shouldOfferAutoRecord(s: AutoRecordState, onboardingDone: boolean, platformIsIos: boolean): boolean {
  return platformIsIos && onboardingDone && s.decision === 'undecided';
}

// --- native -> JS pending command ----------------------------------------------------------------------------------
/** 'morning-stop' and 'morning-open' come from the Live Activity buttons (SleepSmoothLiveActivityIntents.swift). */
export type PendingCommandKind = 'start' | 'stop' | 'morning-stop' | 'morning-open';
const KINDS: readonly string[] = ['start', 'stop', 'morning-stop', 'morning-open'];
export interface PendingCommand {
  kind: PendingCommandKind;
  /** Epoch ms when the intent ran. */
  at: number;
}
/** Accepts the JSON the native module stores. Anything else is ignored. */
export function parsePendingCommand(raw: unknown): PendingCommand | null {
  let v: unknown = raw;
  if (typeof raw === 'string') {
    try {
      v = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== 'object') return null;
  const o = v as { kind?: unknown; at?: unknown };
  if (typeof o.kind !== 'string' || !KINDS.includes(o.kind) || typeof o.at !== 'number' || !Number.isFinite(o.at)) return null;
  return { kind: o.kind as PendingCommandKind, at: o.at };
}

export const PENDING_MAX_AGE_MS = 10 * 60_000;
/** A command older than 10 minutes is dropped: starting a recording long after the automation fired would surprise. */
export function pendingIsFresh(p: PendingCommand, nowMs: number): boolean {
  const age = nowMs - p.at;
  return age >= -60_000 && age <= PENDING_MAX_AGE_MS;
}

export const STANDING_ACK_VALID_DAYS = 90;
export function standingAckIsFresh(ackIso: string | null, nowMs: number): boolean {
  if (!ackIso) return false;
  const t = Date.parse(ackIso);
  return Number.isFinite(t) && nowMs - t >= 0 && nowMs - t <= STANDING_ACK_VALID_DAYS * 86_400_000;
}

export interface AutoStartContext {
  consentGranted: boolean;
  micGranted: boolean;
  standingAckAt: string | null;
  alreadyRecording: boolean;
  nowMs: number;
}
/** Decide whether an automatic start may proceed. Consent and the bystander notice are never skipped. */
export function decideAutoStart(c: AutoStartContext): { ok: true } | { ok: false; outcome: Exclude<AutoOutcome, 'started' | 'start-failed'> } {
  if (c.alreadyRecording) return { ok: false, outcome: 'blocked-already-recording' };
  if (!c.consentGranted) return { ok: false, outcome: 'blocked-consent' };
  if (!standingAckIsFresh(c.standingAckAt, c.nowMs)) return { ok: false, outcome: 'blocked-ack' };
  if (!c.micGranted) return { ok: false, outcome: 'blocked-mic' };
  return { ok: true };
}

/** Plain-language reason shown in Settings when the last automatic start did not happen. */
export function outcomeNote(o: AutoOutcome | null): string | null {
  switch (o) {
    case 'blocked-consent':
      return 'The last automatic start did not record: consent for overnight recording is not on.';
    case 'blocked-mic':
      return 'The last automatic start did not record: microphone access is off.';
    case 'blocked-ack':
      return 'The last automatic start did not record: please confirm the automatic-recording notice again.';
    case 'blocked-already-recording':
      return 'The last automatic start was ignored because a recording was already running.';
    case 'start-failed':
      return 'The last automatic start could not begin recording.';
    default:
      return null;
  }
}

// --- first-entry primer (Feature B) --------------------------------------------------------------------------------
/** Bump to show the primer once more after a material change to what it asks. */
export const FIRST_ENTRY_PRIMER_VERSION = 1;
export function shouldShowFirstEntryPrimer(p: { onboardingDone: boolean; primerShownVersion: number; consentGranted: boolean }): boolean {
  return p.onboardingDone && p.primerShownVersion < FIRST_ENTRY_PRIMER_VERSION && !p.consentGranted;
}
