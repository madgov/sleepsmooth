// Personal adaptation of WHICH CLIPS ARE SAVED, learned from the user's own clip feedback. Pure logic.
//
// WHAT THIS IS: a small, documented, reversible nudge to the clip picker. The user marks a saved clip "Not snoring" /
// "Not this sound" and says what it was; after a few such answers the picker ranks similar clips lower (loud sounds) or asks
// for a higher per-window score (snore-like clips) on later nights.
//
// WHAT THIS IS NOT:
//  - It NEVER touches a night's observation counts, episodes, state or summary. It is read only by ClipRecorder, which
//    already sits beside the pipeline and cannot change it. Nothing in src/night imports this file.
//  - It is not a trained model and not personalised detection. Two threshold rules, nothing else.
//  - It is not validated. Every constant below is a PROVISIONAL engineering choice.
//  - Feedback on the sample night never counts (the sample's feedback is not stored, and this file refuses it as well).
//
// Rules (all PROVISIONAL):
//  R1 Loud sounds. A "loud-other" clip marked Not this sound with kind "Fan or AC" or "Movement or bedding" is a DISMISSED sound.
//     Once at least ADAPT.minDismissed are dismissed, their median profile is (event length, level above the room floor).
//     A later loud candidate within a factor ADAPT.eventSecFactor of that length and within ADAPT.levelDb of that level has its
//     RANK multiplied by ADAPT.loudPenalty (rank only decides which clips win a slot; the stored score and the 15 s limit are unchanged).
//  R2 Snore-like. Once at least ADAPT.minBreathing snore-like clips are marked Not snoring with kind "Breathing", a snore-like
//     run is only picked when its mean per-window model score is at least ADAPT.snoreMinMeanScore. A run with no score is not picked.
//  Both need the clip's stored profile (eventSec, aboveFloorDb, meanWindowScore). Clips saved before those fields existed are ignored.
import type { ClipFeedbackEntry, FeedbackKind } from './clipFeedback';
import type { ClipMeta } from './clips';

export const ADAPT = {
  /** Dismissed loud clips (same sort of sound) needed before R1 applies. */
  minDismissed: 3,
  /** Breathing answers on snore-like clips needed before R2 applies. */
  minBreathing: 3,
  /** Rank multiplier for a loud candidate similar to the dismissed profile. */
  loudPenalty: 0.5,
  /** Similar length: within this factor, up or down, of the dismissed median. */
  eventSecFactor: 1.5,
  /** Similar level: within this many dB of the dismissed median. */
  levelDb: 6,
  /** Mean per-window model score a snore-like run needs under R2. The shipped model flags a window at about 0.65. */
  snoreMinMeanScore: 0.9,
} as const;

export const LOUD_DISMISS_KINDS: readonly FeedbackKind[] = ['fan-ac', 'movement-bedding'];

export interface ReviewedClip {
  /** True for the labelled sample night: never counted. */
  nightIsSample: boolean;
  clip: ClipMeta;
  entry: ClipFeedbackEntry;
}

export interface LoudProfile {
  eventSec: number;
  aboveFloorDb: number;
}

export interface ClipAdaptation {
  /** Real-night clips with feedback given after the last reset. */
  reviewed: number;
  /** R1 is on when set. */
  loud: LoudProfile | null;
  /** R2 is on when set: the minimum mean per-window score for a snore-like pick. */
  snoreMinMeanScore: number | null;
}

export const NO_ADAPTATION: ClipAdaptation = { reviewed: 0, loud: null, snoreMinMeanScore: null };

export const isAdapting = (a: ClipAdaptation): boolean => a.loud !== null || a.snoreMinMeanScore !== null;

function median(xs: number[]): number {
  const s = xs.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

/** Learn the two rules from stored feedback. `resetAtMs`: feedback given at or before this time is ignored (the Reset control). */
export function deriveAdaptation(reviews: readonly ReviewedClip[], resetAtMs: number | null): ClipAdaptation {
  const live = reviews.filter((r) => !r.nightIsSample && (resetAtMs === null || r.entry.atMs > resetAtMs));
  const dismissed = live.filter(
    (r) =>
      r.clip.category === 'loud-other' &&
      r.entry.verdict === 'not-this-sound' &&
      r.entry.kind !== null &&
      LOUD_DISMISS_KINDS.includes(r.entry.kind) &&
      typeof r.clip.eventSec === 'number' &&
      typeof r.clip.aboveFloorDb === 'number',
  );
  const breathing = live.filter((r) => r.clip.category === 'snore-like' && r.entry.verdict === 'not-this-sound' && r.entry.kind === 'breathing');
  return {
    reviewed: live.length,
    loud:
      dismissed.length >= ADAPT.minDismissed
        ? { eventSec: median(dismissed.map((r) => r.clip.eventSec as number)), aboveFloorDb: median(dismissed.map((r) => r.clip.aboveFloorDb as number)) }
        : null,
    snoreMinMeanScore: breathing.length >= ADAPT.minBreathing ? ADAPT.snoreMinMeanScore : null,
  };
}

/** True when a loud candidate looks like the sounds the user dismissed. */
export function looksDismissed(eventSec: number, aboveFloorDb: number, a: ClipAdaptation): boolean {
  const p = a.loud;
  if (!p || p.eventSec <= 0) return false;
  const ratio = eventSec / p.eventSec;
  return ratio <= ADAPT.eventSecFactor && ratio >= 1 / ADAPT.eventSecFactor && Math.abs(aboveFloorDb - p.aboveFloorDb) <= ADAPT.levelDb;
}

export interface RankInput {
  category: ClipMeta['category'];
  score: number;
  eventSec?: number;
  aboveFloorDb?: number;
}

/** The score the selector ranks by. Equals `score` unless R1 applies. */
export function adaptedRank(c: RankInput, a: ClipAdaptation): number {
  if (c.category !== 'loud-other' || a.loud === null) return c.score;
  if (typeof c.eventSec !== 'number' || typeof c.aboveFloorDb !== 'number') return c.score;
  return looksDismissed(c.eventSec, c.aboveFloorDb, a) ? c.score * ADAPT.loudPenalty : c.score;
}

/** R2: may a snore-like run with this mean per-window score be picked? Always true when R2 is off. */
export function snoreRunPasses(meanScore: number | null, a: ClipAdaptation): boolean {
  if (a.snoreMinMeanScore === null) return true;
  return meanScore !== null && meanScore >= a.snoreMinMeanScore;
}
