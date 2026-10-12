// Sleep-state estimate (docs/OVERNIGHT_PLAN.md section 7). A heuristic over schedule, app state,
// charging, optional motion and audio cues. It is NOT a sleep tracker, it is unvalidated, and the product
// never says "sleep detected". Output labels are `likely-asleep`, `likely-awake` and `uncertain`
// (plus `outside-window` and `not-captured`), with the signals that produced each label. Its only job is
// to choose which epochs are analysed for snore-like patterns and to show an *estimated* window.
//
// Snore-like windows are deliberately NOT evidence of sleep (circularity).
import {
  EST_GRACE_AFTER_WAKE_MS,
  EST_HANDLING_WEAK_EVENTS,
  EST_LOUD_NONSNORE_WEAK_SEC,
  EST_MIN_CAPTURED_SEC,
  EST_MOTION_STRONG_SEC,
  EST_ONSET_EPOCHS,
  EST_QUIET_EPOCHS,
  EST_QUIET_MARGIN_DB,
  EST_SPEECH_STRONG_SEC,
  EST_STILL_MAX_MOTION_SEC,
} from './constants';
import type { EpochRecord, EpochState, ScheduleWindow, SleepReason, SleepWindowSettings } from './types';

/** The part of an EpochRecord the estimator reads. */
export type EstimatorInput = Pick<
  EpochRecord,
  't' | 'cap' | 'lvl' | 'floor' | 'speechLikeSec' | 'handlingEvents' | 'loudNonSnoreSec' | 'motionSec' | 'charging' | 'appActive'
>;

export type EpochEstimate = { state: EpochState; reasons: SleepReason[] };

export class SleepEstimator {
  private streak = 0; // consecutive in-window captured epochs without any awake indicator
  private prevCharging: boolean | null = null;
  private prevHadWeak = false;
  private readonly quiet: boolean[] = []; // last EST_QUIET_EPOCHS "p90 < floor + margin" flags

  /** `schedule: null` means no schedule is known: every epoch is treated as inside the window. */
  constructor(private readonly schedule: ScheduleWindow | null) {}

  step(e: EstimatorInput): EpochEstimate {
    const s = this.schedule;
    if (s && (e.t < s.startMs || e.t >= s.endMs + EST_GRACE_AFTER_WAKE_MS)) {
      this.resetRun();
      return { state: 'outside-window', reasons: ['out-of-window'] };
    }
    if (e.cap < EST_MIN_CAPTURED_SEC) {
      this.resetRun();
      return { state: 'not-captured', reasons: ['in-window'] };
    }
    const reasons: SleepReason[] = ['in-window'];

    // Awake indicators.
    const plugChange = e.charging !== null && this.prevCharging !== null && e.charging !== this.prevCharging;
    if (e.charging !== null) this.prevCharging = e.charging;
    const strong: SleepReason[] = [];
    if (e.speechLikeSec >= EST_SPEECH_STRONG_SEC) strong.push('speech-like');
    if (e.appActive) strong.push('screen-or-app-active');
    if (plugChange) strong.push('plug-change');
    if (e.motionSec !== null && e.motionSec >= EST_MOTION_STRONG_SEC) strong.push('motion');
    const weak: SleepReason[] = [];
    if (e.handlingEvents >= EST_HANDLING_WEAK_EVENTS) weak.push('handling-sounds');
    if (e.loudNonSnoreSec >= EST_LOUD_NONSNORE_WEAK_SEC) weak.push('loud-non-snore');

    // Sustained quiet over the last EST_QUIET_EPOCHS epochs (this one included).
    this.quiet.push(e.lvl.p90 < e.floor + EST_QUIET_MARGIN_DB);
    if (this.quiet.length > EST_QUIET_EPOCHS) this.quiet.shift();

    // One strong indicator, or two weak ones at once, or a weak one on two consecutive epochs.
    const awake = strong.length >= 1 || weak.length >= 2 || (weak.length >= 1 && this.prevHadWeak);
    const anyIndicator = strong.length + weak.length > 0;
    this.prevHadWeak = weak.length > 0;
    if (anyIndicator) this.streak = 0;
    else this.streak++;

    if (awake) {
      return { state: 'likely-awake', reasons: [...reasons, ...strong, ...weak] };
    }
    if (anyIndicator) {
      // A lone weak indicator: not yet awake, but the quiet run restarts.
      return { state: 'uncertain', reasons: [...reasons, ...weak] };
    }

    const supportCharging = e.charging === true;
    const supportStill = e.motionSec !== null && e.motionSec <= EST_STILL_MAX_MOTION_SEC;
    const supportQuiet = this.quiet.length >= EST_QUIET_EPOCHS && this.quiet.every(Boolean);
    if (this.streak < EST_ONSET_EPOCHS) return { state: 'uncertain', reasons: [...reasons, 'onset-pending'] };
    if (supportCharging || supportStill || supportQuiet) {
      if (supportCharging) reasons.push('charging');
      if (supportStill) reasons.push('still');
      if (supportQuiet) reasons.push('sustained-quiet');
      return { state: 'likely-asleep', reasons };
    }
    return { state: 'uncertain', reasons };
  }

  private resetRun(): void {
    this.streak = 0;
    this.prevHadWeak = false;
    this.quiet.length = 0;
  }
}

/** Deterministic replay: states for a whole night from its epoch records. */
export function estimateEpochStates(epochs: readonly EstimatorInput[], schedule: ScheduleWindow | null): EpochEstimate[] {
  const est = new SleepEstimator(schedule);
  return epochs.map((e) => est.step(e));
}

/**
 * Resolve a night's absolute schedule window from the local bedtime and wake settings.
 * `utcOffsetMinutes` is the offset in force at the capture start (minutes east of UTC). A UTC-offset change
 * during the night (DST) is not modelled; the host can pass a corrected window instead.
 * The window starts at the bedtime that belongs to this capture (the latest one that is not more than 12 h
 * in the future of the capture start) and ends at the next wake time after that bedtime.
 */
export function resolveScheduleWindow(captureStartMs: number, settings: Pick<SleepWindowSettings, 'bedtimeLocal' | 'wakeLocal'>, utcOffsetMinutes: number): ScheduleWindow {
  const parse = (hhmm: string): number => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
    if (!m) throw new Error(`Invalid time "${hhmm}"`);
    const h = Number(m[1]);
    const mi = Number(m[2]);
    if (h > 23 || mi > 59) throw new Error(`Invalid time "${hhmm}"`);
    return h * 60 + mi;
  };
  const bed = parse(settings.bedtimeLocal);
  const wake = parse(settings.wakeLocal);
  const offMs = utcOffsetMinutes * 60000;
  const localStart = captureStartMs + offMs;
  const dayStart = Math.floor(localStart / 86400000) * 86400000;
  // Bedtime on the local day of capture start; if capture began before dawn, the window began the previous evening.
  let bedLocal = dayStart + bed * 60000;
  if (bedLocal > localStart + 12 * 3600000) bedLocal -= 86400000;
  let wakeLocalMs = Math.floor(bedLocal / 86400000) * 86400000 + wake * 60000;
  while (wakeLocalMs <= bedLocal) wakeLocalMs += 86400000;
  return { startMs: bedLocal - offMs, endMs: wakeLocalMs - offMs };
}
