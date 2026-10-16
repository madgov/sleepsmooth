// The user's own feedback on a saved clip. Pure logic (no React, no file system).
// Stored on this phone with the clip (nights/<id>/clips/feedback.json), so deleting the clips deletes the feedback.
// Never uploaded. It is NOT a medical check, and it never changes a night's result: it exists to spot mistakes in the
// snore-like pattern finder and to be included in the exported test log.
import { FEEDBACK_NOT_SNORING, FEEDBACK_NOT_THIS } from '../content/claims';
import type { ClipCategory } from './clips';

export const FEEDBACK_NAME = 'feedback.json';
export const FEEDBACK_VERSION = 1;

export type FeedbackVerdict = 'sounds-right' | 'not-this-sound';
export const FEEDBACK_KIND_IDS = ['breathing', 'fan-ac', 'partner', 'movement-bedding', 'pet', 'talking', 'other'] as const;
export type FeedbackKind = (typeof FEEDBACK_KIND_IDS)[number];

export interface ClipFeedbackEntry {
  clipId: string;
  verdict: FeedbackVerdict;
  /** Only ever set together with verdict 'not-this-sound'. */
  kind: FeedbackKind | null;
  atMs: number;
}

export interface FeedbackFile {
  v: typeof FEEDBACK_VERSION;
  nightId: string;
  entries: ClipFeedbackEntry[];
}

export const emptyFeedback = (nightId: string): FeedbackFile => ({ v: FEEDBACK_VERSION, nightId, entries: [] });

const isVerdict = (x: unknown): x is FeedbackVerdict => x === 'sounds-right' || x === 'not-this-sound';
const isKind = (x: unknown): x is FeedbackKind => (FEEDBACK_KIND_IDS as readonly unknown[]).includes(x);

export function parseFeedback(text: string, nightId: string): FeedbackFile {
  try {
    const f = JSON.parse(text) as Partial<FeedbackFile>;
    if (!f || f.v !== FEEDBACK_VERSION || f.nightId !== nightId || !Array.isArray(f.entries)) return emptyFeedback(nightId);
    const entries: ClipFeedbackEntry[] = [];
    const seen = new Set<string>();
    for (const e of f.entries) {
      if (!e || typeof e.clipId !== 'string' || !isVerdict(e.verdict) || typeof e.atMs !== 'number' || seen.has(e.clipId)) continue;
      seen.add(e.clipId);
      entries.push({ clipId: e.clipId, verdict: e.verdict, kind: e.verdict === 'not-this-sound' && isKind(e.kind) ? e.kind : null, atMs: e.atMs });
    }
    return { v: FEEDBACK_VERSION, nightId, entries };
  } catch {
    return emptyFeedback(nightId);
  }
}

export const serializeFeedback = (f: FeedbackFile): string => JSON.stringify(f);

export const feedbackFor = (f: FeedbackFile, clipId: string): ClipFeedbackEntry | null => f.entries.find((e) => e.clipId === clipId) ?? null;

/** Tapping the verdict that is already set clears it (so a mistaken tap is easy to undo). Changing it drops a stale kind. */
export function toggleVerdict(f: FeedbackFile, clipId: string, verdict: FeedbackVerdict, atMs: number): FeedbackFile {
  const cur = feedbackFor(f, clipId);
  const rest = f.entries.filter((e) => e.clipId !== clipId);
  if (cur && cur.verdict === verdict) return { ...f, entries: rest };
  return { ...f, entries: [...rest, { clipId, verdict, kind: null, atMs }] };
}

/** The "What was it?" answer. Only valid after 'not-this-sound'; otherwise the file is returned unchanged. Tapping the same kind clears it. */
export function setKind(f: FeedbackFile, clipId: string, kind: FeedbackKind | null, atMs: number): FeedbackFile {
  const cur = feedbackFor(f, clipId);
  if (!cur || cur.verdict !== 'not-this-sound') return f;
  const next: ClipFeedbackEntry = { ...cur, kind: cur.kind === kind ? null : kind, atMs };
  return { ...f, entries: f.entries.map((e) => (e.clipId === clipId ? next : e)) };
}

export const reviewedCount = (f: FeedbackFile, existingClipIds?: readonly string[]): number =>
  existingClipIds ? f.entries.filter((e) => existingClipIds.includes(e.clipId)).length : f.entries.length;

/** "Not snoring" on a snore-like clip, "Not this sound" on any other category. */
export function notThisLabel(category: ClipCategory): string {
  return category === 'snore-like' ? FEEDBACK_NOT_SNORING : FEEDBACK_NOT_THIS;
}

/** Clips of this night the user marked "Not this sound" and then "Partner". Display only; changes no count or result. */
export function partnerTaggedCount(f: FeedbackFile, existingClipIds: readonly string[]): number {
  return f.entries.filter((e) => e.verdict === 'not-this-sound' && e.kind === 'partner' && existingClipIds.includes(e.clipId)).length;
}
