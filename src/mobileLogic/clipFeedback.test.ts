import { describe, expect, it } from 'vitest';
import { FEEDBACK_NOT_SNORING, FEEDBACK_NOT_THIS, FEEDBACK_NOTE, FEEDBACK_NOTE_NO_UPLOAD, FEEDBACK_RIGHT, feedbackCountLine } from '../content/claims';
import { emptyFeedback, feedbackFor, notThisLabel, parseFeedback, reviewedCount, serializeFeedback, setKind, toggleVerdict } from './clipFeedback';

const f0 = emptyFeedback('n1');

describe('clip feedback logic', () => {
  it('sets a verdict, and tapping the same verdict clears it', () => {
    const a = toggleVerdict(f0, 'c1', 'sounds-right', 10);
    expect(feedbackFor(a, 'c1')).toMatchObject({ verdict: 'sounds-right', kind: null });
    expect(feedbackFor(toggleVerdict(a, 'c1', 'sounds-right', 20), 'c1')).toBeNull();
  });

  it('changing the verdict drops a stale "what was it" answer', () => {
    let f = toggleVerdict(f0, 'c1', 'not-this-sound', 1);
    f = setKind(f, 'c1', 'fan-ac', 2);
    expect(feedbackFor(f, 'c1')?.kind).toBe('fan-ac');
    f = toggleVerdict(f, 'c1', 'sounds-right', 3);
    expect(feedbackFor(f, 'c1')).toMatchObject({ verdict: 'sounds-right', kind: null });
  });

  it('the picker only applies after "not this sound"; the same kind twice clears it', () => {
    expect(setKind(f0, 'c1', 'pet', 1)).toBe(f0);
    let f = toggleVerdict(f0, 'c1', 'sounds-right', 1);
    expect(setKind(f, 'c1', 'pet', 2)).toBe(f);
    f = toggleVerdict(f0, 'c1', 'not-this-sound', 1);
    f = setKind(f, 'c1', 'pet', 2);
    expect(feedbackFor(f, 'c1')?.kind).toBe('pet');
    expect(feedbackFor(setKind(f, 'c1', 'pet', 3), 'c1')?.kind).toBeNull();
  });

  it('keeps one entry per clip and counts reviewed clips', () => {
    let f = toggleVerdict(f0, 'c1', 'sounds-right', 1);
    f = toggleVerdict(f, 'c2', 'not-this-sound', 2);
    f = toggleVerdict(f, 'c1', 'not-this-sound', 3);
    expect(f.entries).toHaveLength(2);
    expect(reviewedCount(f)).toBe(2);
    expect(reviewedCount(f, ['c2', 'zzz'])).toBe(1); // an entry for a deleted clip is not counted
    expect(feedbackCountLine(2)).toBe('2 clips reviewed');
    expect(feedbackCountLine(1)).toBe('1 clip reviewed');
  });

  it('round-trips and ignores damaged data or a different night', () => {
    let f = toggleVerdict(f0, 'c1', 'not-this-sound', 5);
    f = setKind(f, 'c1', 'partner', 6);
    expect(parseFeedback(serializeFeedback(f), 'n1')).toEqual(f);
    expect(parseFeedback(serializeFeedback(f), 'other')).toEqual(emptyFeedback('other'));
    expect(parseFeedback('{', 'n1')).toEqual(emptyFeedback('n1'));
    const bad = JSON.stringify({ v: 1, nightId: 'n1', entries: [{ clipId: 'a', verdict: 'maybe', atMs: 1 }, { clipId: 'b', verdict: 'sounds-right', kind: 'pet', atMs: 1 }] });
    const p = parseFeedback(bad, 'n1');
    expect(p.entries).toHaveLength(1);
    expect(p.entries[0]).toMatchObject({ clipId: 'b', kind: null }); // a kind without "not this sound" is dropped
  });

  it('labels: "Not snoring" for snore-like clips, "Not this sound" for the rest', () => {
    expect(notThisLabel('snore-like')).toBe(FEEDBACK_NOT_SNORING);
    expect(notThisLabel('loud-other')).toBe(FEEDBACK_NOT_THIS);
    expect(FEEDBACK_RIGHT).toBe('Sounds right');
  });

  it('the copy says it is the user own feedback, not a medical check, and nothing is uploaded', () => {
    expect(FEEDBACK_NOTE).toMatch(/Your own feedback/);
    expect(FEEDBACK_NOTE).toMatch(/not a medical check/);
    expect(FEEDBACK_NOTE).toMatch(/saved on this iPhone/);
    expect(FEEDBACK_NOTE).not.toMatch(/upload/i); // the upload sentence is a separate, flag-gated constant
    expect(FEEDBACK_NOTE_NO_UPLOAD).toBe('Nothing is uploaded.');
  });
});
