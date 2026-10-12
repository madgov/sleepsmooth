import { describe, expect, it } from 'vitest';
import { NIGHT_MIN_ASSESSED_SEC, NIGHT_QUALITY } from './constants';
import { findEpisodes, flaggedWindowIndices, nightAudioState, summarizeNight, type NightStateInput } from './summary';
import { buildNightFromFlags, run, TEST_NIGHT_START_MS } from './testkit';

const T0 = TEST_NIGHT_START_MS;

describe('findEpisodes: the absolute episode rule', () => {
  it('5 consecutive flagged windows form an episode; 4 do not', () => {
    expect(findEpisodes(run(100, 5), T0).episodes).toHaveLength(1);
    expect(findEpisodes(run(100, 4), T0).episodes).toHaveLength(0);
  });
  it('a gap of exactly 10 s between windows keeps one episode; 10.5 s splits it', () => {
    // window k spans [0.5k, 0.5k + 1]; step 23 -> start-to-start 11.5 s -> gap 10.5 s; step 22 -> gap 10 s
    expect(findEpisodes(run(0, 5, 22), T0).episodes).toHaveLength(1);
    expect(findEpisodes(run(0, 5, 23), T0).episodes).toHaveLength(0); // each alone: 1 flagged
  });
  it('two runs separated by more than 10 s are two episodes', () => {
    const k = [...run(0, 5), ...run(5 + 22 + 1, 5)];
    expect(findEpisodes(k, T0).episodes).toHaveLength(2);
    const near = [...run(0, 5), ...run(4 + 22, 5)];
    expect(findEpisodes(near, T0).episodes).toHaveLength(1);
  });
  it('flagged seconds is the union of window time (overlap not double counted)', () => {
    // 5 adjacent windows cover 0..3 s: 1 + 4*0.5 = 3 s
    expect(findEpisodes(run(0, 5), T0).flaggedSec).toBe(3);
    // 5 windows each 11 s apart start-to-start? use step 2 (1 s apart): no overlap, 5 s
    expect(findEpisodes(run(0, 5, 2), T0).flaggedSec).toBe(5);
  });
  it('flagged seconds count only qualifying episodes', () => {
    expect(findEpisodes([...run(0, 4), ...run(1000, 6)], T0).flaggedSec).toBe(3.5);
  });
  it('episode bounds are in unix ms from the capture start', () => {
    const { episodes } = findEpisodes(run(10, 5), T0);
    expect(episodes[0]).toEqual({ t0: T0 + 5000, t1: T0 + 5000 + 3000, flagged: 5 });
  });
  it('duplicates and unsorted input are handled', () => {
    expect(findEpisodes([...run(0, 5), ...run(0, 5)].reverse(), T0).episodes).toHaveLength(1);
  });
  it('empty input', () => {
    expect(findEpisodes([], T0)).toEqual({ episodes: [], flaggedSec: 0 });
  });
});

describe('nightAudioState rows (first match wins)', () => {
  const ok: NightStateInput = {
    recordedSec: 28800,
    modelVersion: 'm1',
    assessedSec: 26000,
    coverage: 1,
    qualityVerdict: 'usable',
    qualityReasons: [],
    bandwidthApplicable: true,
    assessableWindows: 1000,
    episodes: 3,
    episodeFlaggedSec: 120,
  };
  const st = (o: Partial<NightStateInput>) => nightAudioState({ ...ok, ...o }).state;
  it('nothing recorded', () => expect(st({ recordedSec: 0 })).toBe('not-recorded'));
  it('no model', () => expect(st({ modelVersion: null })).toBe('no-model'));
  it('too short is not assessed (boundary at 2 h)', () => {
    expect(st({ assessedSec: NIGHT_MIN_ASSESSED_SEC - 1 })).toBe('not-assessed');
    expect(st({ assessedSec: NIGHT_MIN_ASSESSED_SEC })).toBe('snore-like-observed');
  });
  it('low coverage is not assessed (boundary at 0.5)', () => {
    expect(st({ coverage: 0.49 })).toBe('not-assessed');
    expect(st({ coverage: 0.5 })).toBe('snore-like-observed');
  });
  it('an unusable quality verdict is not assessed and carries its reasons', () => {
    const r = nightAudioState({ ...ok, qualityVerdict: 'unusable', qualityReasons: ['x'] });
    expect(r.state).toBe('not-assessed');
    expect(r.reasons).toContain('x');
  });
  it('a marginal verdict alone does not block assessment', () => {
    expect(st({ qualityVerdict: 'marginal' })).toBe('snore-like-observed');
  });
  it('band-limited maps to model-not-applicable (before the no-windows row)', () => {
    expect(st({ bandwidthApplicable: false })).toBe('model-not-applicable');
    expect(st({ bandwidthApplicable: false, assessableWindows: 0 })).toBe('model-not-applicable');
  });
  it('no assessable windows is not assessed', () => expect(st({ assessableWindows: 0 })).toBe('not-assessed'));
  it('episode thresholds: 3 episodes and 120 s are both required', () => {
    expect(st({ episodes: 2, episodeFlaggedSec: 500 })).toBe('few-observations');
    expect(st({ episodes: 3, episodeFlaggedSec: 119 })).toBe('few-observations');
    expect(st({ episodes: 3, episodeFlaggedSec: 120 })).toBe('snore-like-observed');
    expect(st({ episodes: 0, episodeFlaggedSec: 0 })).toBe('few-observations');
  });
  it('precedence: not-recorded beats no-model, no-model beats not-assessed', () => {
    expect(st({ recordedSec: 0, modelVersion: null })).toBe('not-recorded');
    expect(st({ modelVersion: null, assessedSec: 0 })).toBe('no-model');
  });
});

describe('summarizeNight on epoch records', () => {
  // Three episodes, each 40 s of consecutive flagged windows (80 windows): 120+ flagged seconds.
  const episodes = [...run(2000, 80), ...run(6000, 80), ...run(10000, 80)];
  it('a night with three long stretches is snore-like-observed', () => {
    const n = buildNightFromFlags({ flaggedK: episodes });
    const v = summarizeNight(n.record, n.epochs, n.schedule);
    expect(v.summary.episodes).toHaveLength(3);
    expect(v.summary.episodeFlaggedSec).toBeGreaterThanOrEqual(120);
    expect(v.summary.nightState).toBe('snore-like-observed');
    expect(v.summary.snoreLikeWindows).toBe(240);
    expect(v.summary.assessableWindows).toBe(240);
  });
  it('119 s versus 120 s of episode time flips the state', () => {
    // Windows adjacent: n windows cover 1 + 0.5 (n-1) s. Three episodes of 80 windows = 3 x 40.5 = 121.5 s.
    // Three episodes of 79 windows = 3 x 40 = 120 s; 78 -> 3 x 39.5 = 118.5 s.
    const mk = (len: number) => buildNightFromFlags({ flaggedK: [...run(2000, len), ...run(6000, len), ...run(10000, len)] });
    const at = mk(79);
    const below = mk(78);
    expect(summarizeNight(at.record, at.epochs, at.schedule).summary.nightState).toBe('snore-like-observed');
    const b = summarizeNight(below.record, below.epochs, below.schedule).summary;
    expect(b.episodeFlaggedSec).toBe(118.5);
    expect(b.nightState).toBe('few-observations');
  });
  it('two long episodes are few-observations', () => {
    const n = buildNightFromFlags({ flaggedK: [...run(2000, 400), ...run(6000, 400)] });
    expect(summarizeNight(n.record, n.epochs, n.schedule).summary.nightState).toBe('few-observations');
  });
  it('many scattered single flagged windows never make an episode', () => {
    const scattered = Array.from({ length: 300 }, (_, i) => 100 + i * 60);
    const n = buildNightFromFlags({ flaggedK: scattered });
    const s = summarizeNight(n.record, n.epochs, n.schedule).summary;
    expect(s.snoreLikeWindows).toBe(300);
    expect(s.episodes).toHaveLength(0);
    expect(s.nightState).toBe('few-observations');
  });
  it('flaggedWindowIndices round-trips the placed windows', () => {
    const n = buildNightFromFlags({ epochs: 10, flaggedK: [3, 59, 60, 61, 599], scoredOnlyK: [4, 70] });
    expect(flaggedWindowIndices(n.epochs)).toEqual([3, 59, 60, 61, 599]);
  });
});

describe('denominator invariant: unscored windows are never "no snore"', () => {
  it('belowGate and tooQuiet windows never enter assessableWindows or any fraction', () => {
    const base = buildNightFromFlags({ flaggedK: run(2000, 80), scoredOnlyK: run(3000, 80) });
    const padded = buildNightFromFlags({ flaggedK: run(2000, 80), scoredOnlyK: run(3000, 80), belowGatePerEpoch: 40, tooQuietPerEpoch: 10 });
    const a = summarizeNight(base.record, base.epochs, base.schedule).summary;
    const b = summarizeNight(padded.record, padded.epochs, padded.schedule).summary;
    expect(b.assessableWindows).toBe(a.assessableWindows);
    expect(b.assessableWindows).toBe(160);
    expect(b.snoreLikeWindows).toBe(a.snoreLikeWindows);
    expect(b.episodeQualifiedFraction).toBe(a.episodeQualifiedFraction);
    expect(b.sensitivity.withUncertain.assessableWindows).toBe(160);
    expect(b.unscoredWindows.belowGate).toBeGreaterThan(0);
    expect(b.unscoredWindows.tooQuiet).toBeGreaterThan(0);
  });
  it('a night with zero scored windows is not-assessed, not a quiet night', () => {
    const n = buildNightFromFlags({ belowGatePerEpoch: 60 });
    const s = summarizeNight(n.record, n.epochs, n.schedule).summary;
    expect(s.assessableWindows).toBe(0);
    expect(s.nightState).toBe('not-assessed');
    expect(s.episodeQualifiedFraction).toBe(0);
  });
  it('snore-like windows never exceed scored windows', () => {
    const n = buildNightFromFlags({ flaggedK: run(0, 500), scoredOnlyK: run(500, 500) });
    const s = summarizeNight(n.record, n.epochs, n.schedule).summary;
    expect(s.snoreLikeWindows).toBeLessThanOrEqual(s.assessableWindows);
  });
});

describe('quality and coverage', () => {
  const flagged = [...run(2000, 80), ...run(6000, 80), ...run(10000, 80)];
  const state = (o: Parameters<typeof buildNightFromFlags>[0]) => {
    const n = buildNightFromFlags({ flaggedK: flagged, ...o });
    return summarizeNight(n.record, n.epochs, n.schedule).summary;
  };
  it('a short night (1 h of 8) is not-assessed', () => {
    const s = state({ epochs: 120 });
    expect(s.nightState).toBe('not-assessed');
    expect(s.notAssessedReasons.length).toBeGreaterThan(0);
  });
  it('heavy clipping makes the night unusable', () => {
    const perEpoch = Math.ceil((NIGHT_QUALITY.unusableClippingPct / 100) * 30 * 16000) + 10;
    const s = state({ clipSamplesPerEpoch: perEpoch });
    expect(s.quality.verdict).toBe('unusable');
    expect(s.nightState).toBe('not-assessed');
  });
  it('digital silence makes the night unusable', () => {
    const s = state({ lvl: { p10: -120, p50: -120, p90: -110 } });
    expect(s.quality.verdict).toBe('unusable');
    expect(s.nightState).toBe('not-assessed');
  });
  it('a constantly loud room makes the night unusable', () => {
    const s = state({ lvl: { p10: -15, p50: -10, p90: -5 }, floor: -15 });
    expect(s.quality.verdict).toBe('unusable');
    expect(s.nightState).toBe('not-assessed');
  });
  it('a band-limited capture is model-not-applicable (low reported rate or low effective bandwidth)', () => {
    expect(state({ sampleRateReported: 8000 }).nightState).toBe('model-not-applicable');
    expect(state({ bwHz: 1500 }).nightState).toBe('model-not-applicable');
  });
  it('no model gives no-model', () => {
    expect(state({ modelVersion: null }).nightState).toBe('no-model');
  });
  it('an empty epoch list is not-recorded', () => {
    const n = buildNightFromFlags({ epochs: 0 });
    expect(summarizeNight(n.record, n.epochs, n.schedule).summary.nightState).toBe('not-recorded');
  });
  it('duplicate epoch lines (crash) do not double count', () => {
    const n = buildNightFromFlags({ flaggedK: flagged });
    const dup = [...n.epochs, ...n.epochs.slice(0, 50)];
    const a = summarizeNight(n.record, n.epochs, n.schedule).summary;
    const b = summarizeNight(n.record, dup, n.schedule).summary;
    expect(b.assessableWindows).toBe(a.assessableWindows);
    expect(b.recordedSec).toBe(a.recordedSec);
  });
  it('estimated sleep is never labeled as detected sleep in the summary shape', () => {
    const s = state({});
    expect(s.estimatedAsleepSec + s.uncertainSec + s.awakeSec).toBeLessThanOrEqual(s.recordedSec);
    expect(Object.keys(s)).not.toContain('sleepScore');
  });
  it('sensitivity lines: asleep-only never has more windows than with-uncertain', () => {
    const s = state({});
    expect(s.sensitivity.asleepOnly.assessableWindows).toBeLessThanOrEqual(s.sensitivity.withUncertain.assessableWindows);
  });
});
