import { describe, expect, it } from 'vitest';
import { CLIP_SCORING } from '../mobileLogic/clips';
import { snorePausesLine } from '../content/claims';
import { PAUSE_MAX_GAP_SEC, PAUSE_MIN_BOUT_WINDOWS, PAUSE_MIN_GAP_SEC, countSnorePauses } from './snorePauses';
import { buildNightFromFlags, run } from './testkit';
import { buildSampleNightView } from './sample';
import { summarizeNight } from './summary';

// 1 s windows on a 0.5 s hop: a gap of g seconds between two bouts is g / 0.5 windows after the last flagged window's end,
// i.e. next start k = lastK + 2 + 2g.
const bout = (k0: number, n = 8) => run(k0, n);
const after = (lastK: number, gapSec: number) => lastK + 2 + gapSec * 2;
const count = (flagged: number[], o: Parameters<typeof buildNightFromFlags>[0] = {}) => countSnorePauses(buildNightFromFlags({ epochs: 60, flaggedK: flagged, ...o }).epochs).count;

describe('countSnorePauses', () => {
  it('uses the clip picker numbers', () => {
    expect(PAUSE_MIN_GAP_SEC).toBe(CLIP_SCORING.restartMinGapSec);
    expect(PAUSE_MAX_GAP_SEC).toBe(CLIP_SCORING.restartMaxGapSec);
  });
  it('counts a quiet stretch of 10 to 120 s between two bouts', () => {
    const a = bout(100);
    expect(count([...a, ...bout(after(107, 12))])).toBe(1);
    expect(count([...a, ...bout(after(107, PAUSE_MIN_GAP_SEC))])).toBe(1);
    expect(count([...a, ...bout(after(107, PAUSE_MAX_GAP_SEC))])).toBe(1);
  });
  it('does not count shorter pauses (normal breathing rhythm) or longer ones (a new bout)', () => {
    const a = bout(100);
    expect(count([...a, ...bout(after(107, 6))])).toBe(0);
    expect(count([...a, ...bout(after(107, PAUSE_MIN_GAP_SEC - 0.5))])).toBe(0);
    expect(count([...a, ...bout(after(107, PAUSE_MAX_GAP_SEC + 1))])).toBe(0);
  });
  it('counts each pause once and handles several', () => {
    const b1 = bout(100);
    const b2 = bout(after(107, 15));
    const b3 = bout(after(b2[b2.length - 1]!, 40));
    expect(count([...b1, ...b2, ...b3])).toBe(2);
  });
  it('needs a real bout on both sides: stray single flags do not form a pattern', () => {
    expect(count([100, after(100, 15), after(after(100, 15), 15)])).toBe(0);
    expect(count([...bout(100, PAUSE_MIN_BOUT_WINDOWS - 1), ...bout(after(100 + PAUSE_MIN_BOUT_WINDOWS - 2, 20))])).toBe(0);
    expect(count([...bout(100, PAUSE_MIN_BOUT_WINDOWS), ...bout(after(100 + PAUSE_MIN_BOUT_WINDOWS - 1, 20), PAUSE_MIN_BOUT_WINDOWS)])).toBe(1);
  });
  it('is zero for an empty night, one bout, or no flags', () => {
    expect(count([])).toBe(0);
    expect(count(bout(100, 40))).toBe(0);
    expect(countSnorePauses([])).toEqual({ count: 0, bouts: 0 });
  });
  it('never counts a pause that was not fully captured', () => {
    const flagged = [...bout(100), ...bout(after(107, 40))];
    const night = buildNightFromFlags({ epochs: 60, flaggedK: flagged });
    expect(countSnorePauses(night.epochs).count).toBe(1);
    // the quiet stretch spans epochs 1 and 2: a capture gap in either one means "unknown", not "stopped"
    const gappy = night.epochs.map((e) => (e.i === 2 ? { ...e, cap: 12 } : e));
    expect(countSnorePauses(gappy).count).toBe(0);
    const overload = night.epochs.map((e) => (e.i === 1 ? { ...e, overload: 4 } : e));
    expect(countSnorePauses(overload).count).toBe(0);
    const missing = night.epochs.filter((e) => e.i !== 1);
    expect(countSnorePauses(missing).count).toBe(0);
  });
  it('works across an epoch boundary', () => {
    // last flagged window 58 (end of epoch 0), next bout starts in epoch 1
    const a = run(51, 8); // 51..58
    expect(count([...a, ...bout(after(58, 14))])).toBe(1);
  });
  it('does not change the night summary: the sample night is identical with and without the count being computed', () => {
    const v = buildSampleNightView('snore-episodes');
    const before = JSON.stringify(v.summary);
    countSnorePauses(v.epochs);
    expect(JSON.stringify(summarizeNight(v.record, v.epochs, v.schedule).summary)).toBe(before);
  });
  it('the sample nights have no pause (their episodes are hours apart)', () => {
    expect(countSnorePauses(buildSampleNightView('snore-episodes').epochs).count).toBe(0);
    expect(countSnorePauses(buildSampleNightView('quiet').epochs).count).toBe(0);
  });
});

describe('wording', () => {
  it('has no rate, severity, event or all-clear language', () => {
    const line = snorePausesLine(3);
    expect(line).toBe("Snore-like sound paused and then restarted 3 times. This pattern can happen with or without sleep apnea, and phone audio can't tell which. Worth mentioning to a clinician if it happens often.");
    expect(snorePausesLine(1)).toContain('1 time.');
    expect(line).not.toMatch(/per hour|\/h|severity|mild|moderate|severe|apnea events?|AHI|normal|safe/i);
  });
});
