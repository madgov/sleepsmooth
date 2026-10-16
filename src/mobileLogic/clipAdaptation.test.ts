import { describe, expect, it } from 'vitest';
import { ADAPT, NO_ADAPTATION, adaptedRank, deriveAdaptation, isAdapting, looksDismissed, snoreRunPasses, type ReviewedClip } from './clipAdaptation';
import type { FeedbackKind, FeedbackVerdict } from './clipFeedback';
import { CLIP_SCORING, ClipRecorder, ClipSelector, type ClipMeta, type SelectableClip, type WindowObs } from './clips';

const meta = (id: string, category: ClipMeta['category'], o: Partial<ClipMeta> = {}): ClipMeta => ({
  id, file: `${id}.wav`, category, tag: null, startMs: 0, durationSec: 9, peaks: [], score: 100, eventSec: 3, aboveFloorDb: 20, ...o,
});
const review = (clip: ClipMeta, verdict: FeedbackVerdict, kind: FeedbackKind | null, o: { sample?: boolean; atMs?: number } = {}): ReviewedClip => ({
  nightIsSample: o.sample ?? false, clip, entry: { clipId: clip.id, verdict, kind, atMs: o.atMs ?? 1000 },
});
const fanClips = (n: number, o: { sample?: boolean; kind?: FeedbackKind } = {}) =>
  Array.from({ length: n }, (_, i) => review(meta(`f${i}`, 'loud-other'), 'not-this-sound', o.kind ?? 'fan-ac', { sample: o.sample }));
const breathingClips = (n: number) => Array.from({ length: n }, (_, i) => review(meta(`b${i}`, 'snore-like', { meanWindowScore: 0.7 }), 'not-this-sound', 'breathing'));

describe('deriveAdaptation', () => {
  it('does nothing without enough feedback', () => {
    const a = deriveAdaptation([...fanClips(ADAPT.minDismissed - 1), ...breathingClips(ADAPT.minBreathing - 1)], null);
    expect(isAdapting(a)).toBe(false);
    expect(a.reviewed).toBe(2 * (ADAPT.minDismissed - 1));
  });
  it('turns the loud rule on after the documented number of Fan or AC / Movement answers', () => {
    const mixed = [...fanClips(2), review(meta('m', 'loud-other'), 'not-this-sound', 'movement-bedding')];
    const a = deriveAdaptation(mixed, null);
    expect(a.loud).toEqual({ eventSec: 3, aboveFloorDb: 20 });
    expect(a.snoreMinMeanScore).toBeNull();
  });
  it('ignores other kinds, "Sounds right", and clips without a stored profile', () => {
    const other = fanClips(5, { kind: 'pet' });
    const right = Array.from({ length: 5 }, (_, i) => review(meta(`r${i}`, 'loud-other'), 'sounds-right', null));
    const old = Array.from({ length: 5 }, (_, i) => review(meta(`o${i}`, 'loud-other', { eventSec: undefined, aboveFloorDb: undefined }), 'not-this-sound', 'fan-ac'));
    expect(deriveAdaptation([...other, ...right, ...old], null).loud).toBeNull();
  });
  it('turns the snore rule on after repeated Breathing answers on snore-like clips only', () => {
    expect(deriveAdaptation(breathingClips(ADAPT.minBreathing), null).snoreMinMeanScore).toBe(ADAPT.snoreMinMeanScore);
    const loudBreathing = Array.from({ length: 5 }, (_, i) => review(meta(`x${i}`, 'loud-other'), 'not-this-sound', 'breathing'));
    expect(deriveAdaptation(loudBreathing, null).snoreMinMeanScore).toBeNull();
  });
  it('sample-night feedback never counts', () => {
    const a = deriveAdaptation([...fanClips(10, { sample: true }), ...breathingClips(0)], null);
    expect(a).toEqual(NO_ADAPTATION);
  });
  it('Reset ignores feedback given at or before the reset time', () => {
    const rs = fanClips(4);
    expect(deriveAdaptation(rs, 999).loud).not.toBeNull();
    expect(deriveAdaptation(rs, 1000)).toEqual(NO_ADAPTATION);
    expect(deriveAdaptation(rs, 5000).reviewed).toBe(0);
  });
});

describe('adaptedRank and looksDismissed', () => {
  const on = deriveAdaptation(fanClips(3), null);
  it('halves the rank of a similar loud candidate and leaves the stored score alone', () => {
    expect(adaptedRank({ category: 'loud-other', score: 80, eventSec: 3.5, aboveFloorDb: 22 }, on)).toBe(80 * ADAPT.loudPenalty);
  });
  it('leaves dissimilar candidates, snore-like clips and old candidates alone', () => {
    expect(adaptedRank({ category: 'loud-other', score: 80, eventSec: 9, aboveFloorDb: 20 }, on)).toBe(80); // much longer
    expect(adaptedRank({ category: 'loud-other', score: 80, eventSec: 3, aboveFloorDb: 30 }, on)).toBe(80); // much louder
    expect(adaptedRank({ category: 'snore-like', score: 80, eventSec: 3, aboveFloorDb: 20 }, on)).toBe(80);
    expect(adaptedRank({ category: 'loud-other', score: 80 }, on)).toBe(80);
    expect(adaptedRank({ category: 'loud-other', score: 80, eventSec: 3, aboveFloorDb: 20 }, NO_ADAPTATION)).toBe(80);
  });
  it('similarity is bounded on both sides', () => {
    expect(looksDismissed(3 * ADAPT.eventSecFactor, 20, on)).toBe(true);
    expect(looksDismissed(3 * ADAPT.eventSecFactor + 0.1, 20, on)).toBe(false);
    expect(looksDismissed(3 / ADAPT.eventSecFactor - 0.1, 20, on)).toBe(false);
    expect(looksDismissed(3, 20 + ADAPT.levelDb + 0.1, on)).toBe(false);
  });
});

describe('snoreRunPasses', () => {
  it('is always true when the rule is off, and needs a score when on', () => {
    expect(snoreRunPasses(null, NO_ADAPTATION)).toBe(true);
    const a = deriveAdaptation(breathingClips(3), null);
    expect(snoreRunPasses(0.7, a)).toBe(false);
    expect(snoreRunPasses(null, a)).toBe(false);
    expect(snoreRunPasses(0.95, a)).toBe(true);
  });
});

describe('selection changes, observations do not', () => {
  it('a penalised loud clip loses its slot to an equal-score dissimilar one', () => {
    const on = deriveAdaptation(fanClips(3), null);
    const sel = new ClipSelector<SelectableClip & { rank: number }>();
    const fan = { id: 'fan', category: 'loud-other' as const, score: 60, startSec: 0, rank: adaptedRank({ category: 'loud-other', score: 60, eventSec: 3, aboveFloorDb: 20 }, on) };
    const other = { id: 'other', category: 'loud-other' as const, score: 58, startSec: 1000, rank: adaptedRank({ category: 'loud-other', score: 58, eventSec: 8, aboveFloorDb: 12 }, on) };
    const keep = (rank: boolean) => {
      const s = new ClipSelector<SelectableClip>();
      for (const c of [fan, other, ...[1, 2, 3].map((i) => ({ id: `z${i}`, category: 'loud-other' as const, score: 55, startSec: 2000 + i * 400 }))]) s.offer(rank ? c : { id: c.id, category: c.category, score: c.score, startSec: c.startSec });
      return s.selected().map((c) => c.id);
    };
    expect(keep(false)).toContain('fan');
    expect(keep(true)).not.toContain('fan');
    expect(keep(true)).toContain('other');
    void sel;
  });

  function sink() {
    const files = new Map<string, Uint8Array>();
    return { files, sink: { writeTemp: (id: string, w: Uint8Array) => void files.set(id, w), removeTemp: (id: string) => void files.delete(id) } };
  }
  /** A night with one snore-like stretch whose windows score `score`. Returns the picks and every window the recorder was shown. */
  function night(adaptation = NO_ADAPTATION, score = 0.7) {
    const { sink: s } = sink();
    const rec = new ClipRecorder(0, s, adaptation);
    const shown: WindowObs[] = [];
    for (let sec = 0; sec < 60; sec++) {
      rec.pushAudio(new Float32Array(16000).fill(0.2), 16000);
      for (const k of [sec * 2, sec * 2 + 1]) {
        const snore = sec >= 20 && sec < 28;
        const w: WindowObs = snore ? { k, status: 'scored', levelDb: -35, floorDb: -50, snoreLike: true, speechLike: false, score } : { k, status: 'scored', levelDb: -50, floorDb: -50, snoreLike: false, speechLike: false, score: 0.1 };
        shown.push(w);
        rec.onWindow(w);
      }
    }
    return { picks: rec.finish(), shown, rec };
  }

  it('after repeated Breathing answers a low-score snore-like stretch is not picked, but the same windows were still observed', () => {
    const a = deriveAdaptation(breathingClips(3), null);
    const before = night(NO_ADAPTATION, 0.7);
    const after = night(a, 0.7);
    expect(before.picks).toHaveLength(1);
    expect(after.picks).toHaveLength(0);
    expect(after.rec.adaptSkipped).toBe(1);
    // The recorder is shown exactly the same observations either way: it has no way to change them.
    expect(after.shown).toEqual(before.shown);
    expect(after.shown.filter((w) => w.snoreLike)).toHaveLength(16);
  });
  it('a high-score stretch is still picked with the rule on', () => {
    expect(night(deriveAdaptation(breathingClips(3), null), 0.97).picks).toHaveLength(1);
  });
  it('picked clips store their profile for later learning, and the raw score is not changed by the rank', () => {
    const { picks } = night(NO_ADAPTATION, 0.8);
    const c = picks[0]!;
    expect(c.eventSec).toBeGreaterThan(0);
    expect(c.aboveFloorDb).toBeGreaterThan(0);
    expect(c.meanWindowScore).toBeCloseTo(0.8, 2);
    expect(c.rank).toBe(c.score);
    expect(CLIP_SCORING.minSnoreScore).toBeLessThan(c.score);
  });
});
