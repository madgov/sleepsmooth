// Night diagnostics: a per-night technical record that lets the first real overnight test produce hard numbers.
// Pure (no React Native, no file system). It holds timings, gaps, battery and recovery events. It never holds audio,
// feature values, or anything about the content of the night, and it is never used in a user's summary.
//
// NOT VERIFIED on a device: the causes below come from iOS audio-session callbacks that have not been exercised on a real
// iPhone yet (docs: mobile/DEVICE_TEST.md). iOS reports an interruption only as began/ended, so a phone call and an alarm
// cannot be told apart here and are both recorded as 'interruption'.

export const DIAGNOSTICS_NAME = 'diagnostics.json';
export const DIAGNOSTICS_VERSION = 1;
const MAX_EVENTS = 400;
const MAX_GAPS = 400;

export type GapCause =
  | 'interruption' // iOS audio interruption: a call, alarm, Siri or another app taking the microphone
  | 'route-change' // headphones/AirPods/Bluetooth connected or disconnected
  | 'recorder-error' // the audio library reported an error (this includes a media-services reset, which it does not name)
  | 'app-killed-or-recovered' // the process was gone; the night was closed from its epoch log on a later launch
  | 'late-buffers' // audio timeline jumped without a system event
  | 'digital-silence' // exact-zero buffers (microphone muted by the system)
  | 'overload' // processing queue overflowed and windows were skipped
  | 'restart-by-user' // the user stopped and started again inside the same night
  | 'unknown';

export type DiagEventKind =
  | 'run-start'
  | 'run-stop'
  | 'interruption-began'
  | 'interruption-ended'
  | 'route-change'
  | 'app-state'
  | 'resume-attempt'
  | 'resume-ok'
  | 'resume-failed'
  | 'recorder-error'
  | 'battery'
  | 'low-power-mode'
  | 'recovered';

export interface DiagEvent {
  atMs: number;
  kind: DiagEventKind;
  detail?: string;
}

export interface DiagGap {
  startMs: number;
  endMs: number;
  cause: GapCause;
  detail?: string;
}

export interface BatterySample {
  atMs: number;
  /** 0..100, null when the OS did not report it. */
  pct: number | null;
  charging: boolean | null;
  lowPowerMode: boolean | null;
}

export interface DiagRun {
  startMs: number;
  stopMs: number | null;
  stopReason: string | null;
}

export interface NightDiagnostics {
  v: typeof DIAGNOSTICS_VERSION;
  nightId: string;
  device: { model: string; os: string; app: string };
  scheduledStartMs: number | null;
  scheduledEndMs: number | null;
  /** Each start..stop of the recorder inside this night. More than one when the user (or a restart) resumed. */
  runs: DiagRun[];
  gaps: DiagGap[];
  events: DiagEvent[];
  batteryStart: BatterySample | null;
  batteryEnd: BatterySample | null;
  /** Number of times this night was closed from its epoch log after the process disappeared. */
  recoveredCount: number;
  /** Audio seconds the recorder delivered, as counted by the capture layer (the epoch log is the authority for coverage). */
  audioSecDelivered: number;
  /** True only for generated preview data (web layout preview). */
  devPreview?: boolean;
}

export function newDiagnostics(init: { nightId: string; device: NightDiagnostics['device']; scheduledStartMs: number | null; scheduledEndMs: number | null }): NightDiagnostics {
  return {
    v: DIAGNOSTICS_VERSION,
    nightId: init.nightId,
    device: init.device,
    scheduledStartMs: init.scheduledStartMs,
    scheduledEndMs: init.scheduledEndMs,
    runs: [],
    gaps: [],
    events: [],
    batteryStart: null,
    batteryEnd: null,
    recoveredCount: 0,
    audioSecDelivered: 0,
  };
}

/** Immutable updates, so a recorder can be tested without a clock or a file system. */
export function startRun(d: NightDiagnostics, atMs: number, battery: BatterySample | null): NightDiagnostics {
  return pushEvent(
    { ...d, runs: [...d.runs, { startMs: atMs, stopMs: null, stopReason: null }], batteryStart: d.batteryStart ?? battery },
    { atMs, kind: 'run-start' },
  );
}

export function stopRun(d: NightDiagnostics, atMs: number, reason: string, battery: BatterySample | null): NightDiagnostics {
  const runs = d.runs.slice();
  const last = runs[runs.length - 1];
  if (last && last.stopMs === null) runs[runs.length - 1] = { ...last, stopMs: atMs, stopReason: reason };
  return pushEvent({ ...d, runs, batteryEnd: battery ?? d.batteryEnd }, { atMs, kind: 'run-stop', detail: reason });
}

export function pushEvent(d: NightDiagnostics, e: DiagEvent): NightDiagnostics {
  const events = d.events.length >= MAX_EVENTS ? [...d.events.slice(d.events.length - MAX_EVENTS + 1), e] : [...d.events, e];
  return { ...d, events };
}

export function addGap(d: NightDiagnostics, g: DiagGap): NightDiagnostics {
  if (!(g.endMs > g.startMs)) return d;
  const gaps = d.gaps.length >= MAX_GAPS ? d.gaps.slice(d.gaps.length - MAX_GAPS + 1) : d.gaps.slice();
  gaps.push(g);
  return { ...d, gaps };
}

export function recordBatteryEnd(d: NightDiagnostics, b: BatterySample | null): NightDiagnostics {
  return b ? { ...d, batteryEnd: b } : d;
}

export function addAudioSec(d: NightDiagnostics, sec: number): NightDiagnostics {
  return sec > 0 ? { ...d, audioSecDelivered: d.audioSecDelivered + sec } : d;
}

/**
 * The existing recovery path closed this night from its epoch log. Record that, and the unknown time between the last
 * epoch and the close as a gap of cause 'app-killed-or-recovered' when the schedule shows it.
 */
export function withRecovery(d: NightDiagnostics, atMs: number, lastActivityMs: number | null): NightDiagnostics {
  let out = pushEvent({ ...d, recoveredCount: d.recoveredCount + 1 }, { atMs, kind: 'recovered', detail: 'night closed from its epoch log' });
  const runs = out.runs.slice();
  const last = runs[runs.length - 1];
  if (last && last.stopMs === null && lastActivityMs !== null) runs[runs.length - 1] = { ...last, stopMs: lastActivityMs, stopReason: 'app-killed-or-recovered' };
  out = { ...out, runs };
  if (lastActivityMs !== null && d.scheduledEndMs !== null && lastActivityMs < d.scheduledEndMs - 60_000) {
    // From the last audio to the end of the scheduled night nothing was recorded because the process was gone.
    out = addGap(out, { startMs: lastActivityMs, endMs: d.scheduledEndMs, cause: 'app-killed-or-recovered', detail: 'until the scheduled end; the actual restart time is unknown' });
  }
  return out;
}

// ---- Reading / writing -------------------------------------------------------------------------------------------

export function serializeDiagnostics(d: NightDiagnostics): string {
  return JSON.stringify(d);
}

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** Tolerant parse: a missing or damaged file is null, never a throw. */
export function parseDiagnostics(text: string): NightDiagnostics | null {
  try {
    const d = JSON.parse(text) as Partial<NightDiagnostics>;
    if (!d || d.v !== DIAGNOSTICS_VERSION || typeof d.nightId !== 'string' || !Array.isArray(d.runs) || !Array.isArray(d.gaps) || !Array.isArray(d.events)) return null;
    return {
      v: DIAGNOSTICS_VERSION,
      nightId: d.nightId,
      device: d.device && typeof d.device === 'object' ? { model: String(d.device.model ?? ''), os: String(d.device.os ?? ''), app: String(d.device.app ?? '') } : { model: '', os: '', app: '' },
      scheduledStartMs: isNum(d.scheduledStartMs) ? d.scheduledStartMs : null,
      scheduledEndMs: isNum(d.scheduledEndMs) ? d.scheduledEndMs : null,
      runs: d.runs.filter((r) => r && isNum(r.startMs)).map((r) => ({ startMs: r.startMs, stopMs: isNum(r.stopMs) ? r.stopMs : null, stopReason: typeof r.stopReason === 'string' ? r.stopReason : null })),
      gaps: d.gaps.filter((g) => g && isNum(g.startMs) && isNum(g.endMs) && typeof g.cause === 'string'),
      events: d.events.filter((e) => e && isNum(e.atMs) && typeof e.kind === 'string'),
      batteryStart: d.batteryStart && isNum(d.batteryStart.atMs) ? d.batteryStart : null,
      batteryEnd: d.batteryEnd && isNum(d.batteryEnd.atMs) ? d.batteryEnd : null,
      recoveredCount: isNum(d.recoveredCount) ? d.recoveredCount : 0,
      audioSecDelivered: isNum(d.audioSecDelivered) ? d.audioSecDelivered : 0,
      ...(d.devPreview === true ? { devPreview: true } : {}),
    };
  } catch {
    return null;
  }
}

// ---- Numbers and pass/fail --------------------------------------------------------------------------------------

/**
 * PROVISIONAL pass/fail thresholds for the first device tests (mobile/DEVICE_TEST.md). They are engineering targets chosen
 * to decide whether the capture is reliable enough to keep building on. They are not clinical thresholds and not validated.
 */
export const DEVICE_CRITERIA = {
  /** Total unrecorded time inside the scheduled hours, as a share of those hours. */
  maxGapPctOfWindow: 2,
  /** Battery used over a full unplugged night (about 8 h) with Low Power Mode off. */
  maxBatteryDrainPct: 15,
  /** After an interruption ends, recording must be back within this many seconds. */
  maxResumeAfterInterruptionSec: 60,
  /** Captured time as a share of the scheduled hours. */
  minCapturedPctOfWindow: 95,
} as const;

export interface DiagnosticsNumbers {
  scheduledSec: number | null;
  capturedSec: number;
  capturedPctOfWindow: number | null;
  gapCount: number;
  gapTotalSec: number;
  longestGapSec: number;
  gapPctOfWindow: number | null;
  batteryDrainPct: number | null;
  /** Drain is only meaningful when the phone was unplugged at both ends. */
  batteryDrainComparable: boolean;
  recoveredCount: number;
  interruptions: number;
  routeChanges: number;
  resumeAttempts: number;
  resumeFailures: number;
}

/** `capturedSec` should come from the epoch log (Sum of epoch.cap): it is the authority. */
export function diagnosticsNumbers(d: NightDiagnostics, capturedSec: number): DiagnosticsNumbers {
  const scheduledSec = d.scheduledStartMs !== null && d.scheduledEndMs !== null ? Math.max(0, (d.scheduledEndMs - d.scheduledStartMs) / 1000) : null;
  const windowed = d.gaps.map((g) => {
    if (scheduledSec === null) return (g.endMs - g.startMs) / 1000;
    const a = Math.max(g.startMs, d.scheduledStartMs as number);
    const b = Math.min(g.endMs, d.scheduledEndMs as number);
    return Math.max(0, (b - a) / 1000);
  });
  const gapTotalSec = windowed.reduce((a, x) => a + x, 0);
  const bs = d.batteryStart;
  const be = d.batteryEnd;
  const comparable = !!bs && !!be && bs.pct !== null && be.pct !== null && bs.charging === false && be.charging === false;
  const count = (k: DiagEventKind) => d.events.filter((e) => e.kind === k).length;
  return {
    scheduledSec,
    capturedSec,
    capturedPctOfWindow: scheduledSec && scheduledSec > 0 ? (100 * capturedSec) / scheduledSec : null,
    gapCount: d.gaps.length,
    gapTotalSec,
    longestGapSec: windowed.reduce((a, x) => Math.max(a, x), 0),
    gapPctOfWindow: scheduledSec && scheduledSec > 0 ? (100 * gapTotalSec) / scheduledSec : null,
    batteryDrainPct: bs && be && bs.pct !== null && be.pct !== null ? bs.pct - be.pct : null,
    batteryDrainComparable: comparable,
    recoveredCount: d.recoveredCount,
    interruptions: count('interruption-began'),
    routeChanges: count('route-change'),
    resumeAttempts: count('resume-attempt'),
    resumeFailures: count('resume-failed'),
  };
}

export type CriterionResult = 'pass' | 'fail' | 'not-evaluable';
export interface CriteriaResult {
  gapPct: CriterionResult;
  capturedPct: CriterionResult;
  batteryDrain: CriterionResult;
}

export function evaluateCriteria(n: DiagnosticsNumbers): CriteriaResult {
  return {
    gapPct: n.gapPctOfWindow === null ? 'not-evaluable' : n.gapPctOfWindow < DEVICE_CRITERIA.maxGapPctOfWindow ? 'pass' : 'fail',
    capturedPct: n.capturedPctOfWindow === null ? 'not-evaluable' : n.capturedPctOfWindow >= DEVICE_CRITERIA.minCapturedPctOfWindow ? 'pass' : 'fail',
    batteryDrain: n.batteryDrainPct === null || !n.batteryDrainComparable ? 'not-evaluable' : n.batteryDrainPct <= DEVICE_CRITERIA.maxBatteryDrainPct ? 'pass' : 'fail',
  };
}

/** Plain-language rows for the Diagnostics section (label, value). */
export function diagnosticsRows(d: NightDiagnostics, capturedSec: number): { label: string; value: string }[] {
  const n = diagnosticsNumbers(d, capturedSec);
  const hm = (sec: number) => {
    const m = Math.round(sec / 60);
    return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} m` : `${m} m`;
  };
  const bat = (b: BatterySample | null) => (b ? `${b.pct === null ? 'unknown' : `${b.pct}%`}${b.charging === null ? '' : b.charging ? ', charging' : ', unplugged'}${b.lowPowerMode ? ', Low Power Mode' : ''}` : 'not recorded');
  const rows = [
    { label: 'Captured', value: n.scheduledSec !== null ? `${hm(capturedSec)} of ${hm(n.scheduledSec)} scheduled` : hm(capturedSec) },
    { label: 'Gaps', value: n.gapCount === 0 ? 'None recorded' : `${n.gapCount}, ${hm(n.gapTotalSec)} in total, longest ${hm(n.longestGapSec)}` },
    { label: 'Interruptions', value: String(n.interruptions) },
    { label: 'Route changes', value: String(n.routeChanges) },
    { label: 'Resume attempts', value: n.resumeAttempts === 0 ? 'None' : `${n.resumeAttempts}, ${n.resumeFailures} failed` },
    { label: 'Recovered after a crash or kill', value: String(n.recoveredCount) },
    { label: 'Battery at start', value: bat(d.batteryStart) },
    { label: 'Battery at end', value: bat(d.batteryEnd) },
  ];
  return rows;
}

export function gapCauseLabel(c: GapCause): string {
  switch (c) {
    case 'interruption': return 'Interruption (call, alarm, Siri or another app)';
    case 'route-change': return 'Audio route change';
    case 'recorder-error': return 'Recorder error';
    case 'app-killed-or-recovered': return 'App closed or crashed, recovered later';
    case 'late-buffers': return 'Audio gap, cause unknown';
    case 'digital-silence': return 'Microphone muted by the system';
    case 'overload': return 'Phone was too busy, windows skipped';
    case 'restart-by-user': return 'Stopped and started again';
    case 'unknown': return 'Unknown';
  }
}
