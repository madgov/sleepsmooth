// Recording coverage: how much of the scheduled night was recorded, and how much of that could be assessed.
// Pure (no React). Everything is derived from the per-epoch records the night store already keeps, so it works on old nights.
//
// Four kinds of time, never merged, never graded:
//   assessable      recorded, and the share of that epoch's windows that the snore model could actually score
//   notAssessable   recorded, but the windows were too quiet (or skipped) to score. NEVER read as "no snore".
//   notRecorded     inside the scheduled sleep hours but no audio reached the app (a gap, a late start, an early stop)
//   outside         before the scheduled start or after the scheduled end (recorded or not)
// "Assessable" is about the audio only. It is NOT a sleep estimate and does not depend on it.
import {
  COULD_NOT_ASSESS_LINE,
  COVERAGE_NOTHING_ASSESSABLE,
  COVERAGE_NOTHING_RECORDED,
  NO_SNORE_IN_ASSESSABLE,
  coverageOutsideNote,
  coverageSentence,
} from '../content/claims';
import { EPOCH_MS } from '../night/constants';
import type { EpochRecord, ScheduleWindow } from '../night/types';

export type CoverageKind = 'assessable' | 'not-assessable' | 'not-recorded' | 'outside';

export interface CoverageSeconds {
  /** Length of the scheduled sleep hours. When there is no schedule, the span of the recording. */
  scheduled: number;
  /** Audio captured inside the scheduled hours. */
  recordedInWindow: number;
  assessable: number;
  notAssessable: number;
  notRecorded: number;
  /** Audio captured outside the scheduled hours. */
  recordedOutside: number;
}

export interface Coverage {
  startMs: number;
  endMs: number;
  /** Equal-width bins across [startMs, endMs). One dominant kind per bin (see binKind). */
  bins: CoverageKind[];
  seconds: CoverageSeconds;
  /** Windows that were scored, and the subset flagged snore-like, over the in-window epochs. */
  scoredWindows: number;
  snoreLikeWindows: number;
}

export const DEFAULT_BINS = 96;
/** A bin is shown as a gap when at least this share of its scheduled time has no audio, so short gaps are not averaged away. */
export const GAP_BIN_SHARE = 0.25;
/** A bin is drawn as assessable when at least this share of its recorded time was scored. */
export const ASSESSABLE_BIN_SHARE = 0.25;

const EPOCH_SEC = EPOCH_MS / 1000;

type CoverageEpoch = Pick<EpochRecord, 't' | 'cap' | 'win'>;

/**
 * `epochs` are the night's epoch records. `schedule` is the resolved sleep window (null: no schedule known, then the span of
 * the recording is used and nothing counts as outside or as a leading/trailing gap).
 */
export function computeCoverage(epochs: readonly CoverageEpoch[], schedule: ScheduleWindow | null, nBins = DEFAULT_BINS): Coverage {
  const first = epochs.length ? Math.min(...epochs.map((e) => e.t)) : 0;
  const last = epochs.length ? Math.max(...epochs.map((e) => e.t + EPOCH_MS)) : 0;
  const winStart = schedule ? schedule.startMs : first;
  const winEnd = schedule ? schedule.endMs : last;
  const startMs = schedule ? Math.min(winStart, first || winStart) : first;
  const endMs = Math.max(winEnd, schedule && last ? last : winEnd);
  const span = Math.max(1, endMs - startMs);
  const binMs = span / nBins;

  const acc = Array.from({ length: nBins }, () => ({ assessable: 0, notAssessable: 0, windowSec: 0, recordedWindowSec: 0, outsideSec: 0 }));
  const bucket = (ms: number) => Math.min(nBins - 1, Math.max(0, Math.floor((ms - startMs) / binMs)));

  // Scheduled time per bin (how much of each bin lies inside the sleep hours).
  for (let b = 0; b < nBins; b++) {
    const b0 = startMs + b * binMs;
    const b1 = b0 + binMs;
    const w0 = Math.max(b0, winStart);
    const w1 = Math.min(b1, winEnd);
    (acc[b] as (typeof acc)[number]).windowSec = Math.max(0, w1 - w0) / 1000;
    (acc[b] as (typeof acc)[number]).outsideSec = Math.max(0, binMs - Math.max(0, w1 - w0)) / 1000;
  }

  let recordedInWindow = 0;
  let recordedOutside = 0;
  let assessable = 0;
  let notAssessable = 0;
  let scoredWindows = 0;
  let snoreLikeWindows = 0;
  for (const e of epochs) {
    const cap = Math.max(0, Math.min(EPOCH_SEC, e.cap));
    const inside = e.t >= winStart && e.t < winEnd;
    if (!inside) {
      recordedOutside += cap;
      continue;
    }
    const share = e.win.total > 0 ? e.win.scored / e.win.total : 0;
    const a = cap * share;
    recordedInWindow += cap;
    assessable += a;
    notAssessable += cap - a;
    scoredWindows += e.win.scored;
    snoreLikeWindows += e.win.snoreLike;
    const slot = acc[bucket(e.t)] as (typeof acc)[number];
    slot.assessable += a;
    slot.notAssessable += cap - a;
    slot.recordedWindowSec += cap;
  }

  const scheduled = Math.max(0, (winEnd - winStart) / 1000);
  const notRecorded = Math.max(0, scheduled - recordedInWindow);

  const bins: CoverageKind[] = acc.map((s) => binKind(s));
  return {
    startMs,
    endMs,
    bins,
    seconds: { scheduled, recordedInWindow, assessable, notAssessable, notRecorded, recordedOutside },
    scoredWindows,
    snoreLikeWindows,
  };
}

function binKind(s: { assessable: number; notAssessable: number; windowSec: number; recordedWindowSec: number; outsideSec: number }): CoverageKind {
  if (s.outsideSec > 0 && s.outsideSec >= s.windowSec) return 'outside';
  const missing = Math.max(0, s.windowSec - s.recordedWindowSec);
  if (s.windowSec > 0 && missing / s.windowSec >= GAP_BIN_SHARE) return 'not-recorded';
  // Scored windows are sparse in a quiet room (most are under the level gate), so a bin counts as assessable once a quarter of
  // its recorded time was scored. A strict majority rule would hide every real stretch of analysed time.
  return s.assessable >= ASSESSABLE_BIN_SHARE * (s.assessable + s.notAssessable) && s.assessable > 0 ? 'assessable' : 'not-assessable';
}

/** Merge neighbouring bins of the same kind into runs, for drawing with one view per run. */
export function coverageRuns(bins: readonly CoverageKind[]): { kind: CoverageKind; count: number }[] {
  const out: { kind: CoverageKind; count: number }[] = [];
  for (const k of bins) {
    const last = out[out.length - 1];
    if (last && last.kind === k) last.count++;
    else out.push({ kind: k, count: 1 });
  }
  return out;
}

/** "7 h 40 m", "45 m", "0 m". Rounds to whole minutes. */
export function durationText(sec: number): string {
  const min = Math.max(0, Math.round(sec / 60));
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} m` : `${m} m`;
}

/** Spoken form for screen readers: "7 hours 40 minutes". */
export function spokenDurationText(sec: number): string {
  const min = Math.max(0, Math.round(sec / 60));
  const h = Math.floor(min / 60);
  const m = min % 60;
  const hp = h > 0 ? `${h} ${h === 1 ? 'hour' : 'hours'}` : '';
  const mp = m > 0 || h === 0 ? `${m} ${m === 1 ? 'minute' : 'minutes'}` : '';
  return [hp, mp].filter(Boolean).join(' ');
}

/** The one plain sentence above the timeline. */
export function coverageHeadline(c: Coverage): string {
  const s = c.seconds;
  if (s.recordedInWindow <= 0) return COVERAGE_NOTHING_RECORDED(durationText(s.scheduled));
  const base = coverageSentence(durationText(s.recordedInWindow), durationText(s.scheduled), durationText(s.assessable));
  return s.assessable <= 0 ? `${base.split('. ')[0]}. ${COVERAGE_NOTHING_ASSESSABLE}` : base;
}

export function coverageOutsideLine(c: Coverage): string | null {
  return c.seconds.recordedOutside >= 60 ? coverageOutsideNote(durationText(c.seconds.recordedOutside)) : null;
}

/**
 * The two honest outcomes, kept apart:
 *  - 'none-found': windows were assessed and none was snore-like.  Never says "no snoring".
 *  - 'could-not-assess': nothing could be scored.
 *  - 'found': snore-like windows exist (the existing night card carries the wording).
 */
export type AssessOutcome = 'found' | 'none-found' | 'could-not-assess';
export function assessOutcome(c: Coverage): AssessOutcome {
  if (c.scoredWindows <= 0) return 'could-not-assess';
  return c.snoreLikeWindows > 0 ? 'found' : 'none-found';
}
export function assessOutcomeLine(o: AssessOutcome): string | null {
  return o === 'none-found' ? NO_SNORE_IN_ASSESSABLE : o === 'could-not-assess' ? COULD_NOT_ASSESS_LINE : null;
}

/** Text alternative for the timeline graphic, listing each kind and its time. */
export function coverageAccessibilityLabel(c: Coverage): string {
  const s = c.seconds;
  return `${coverageHeadline(c)} ${spokenDurationText(s.assessable)} assessable, ${spokenDurationText(s.notAssessable)} recorded but too quiet to assess, ${spokenDurationText(s.notRecorded)} not recorded.`;
}
