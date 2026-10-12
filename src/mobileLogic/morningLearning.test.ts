import { describe, expect, it } from 'vitest';
import {
  AUTO_STOP_DELAY_MS,
  autoStopAtMs,
  defaultMorningState,
  detectWakeSignal,
  hardStopMs,
  mergeMorningState,
  morningRowValue,
  onRecordingStarted,
  recordMorning,
  setPreference,
  shouldAutoStop,
  type RecentEpoch,
} from './morningLearning';
import { EST_GRACE_AFTER_WAKE_MS } from '../night/constants';

const MIN = 60_000;
const confirmed = (after: number | null, wake = 1_000_000) => ({ kind: 'confirmed-stop' as const, stopAtMs: wake + (after ?? 0) * MIN, wakeSignalAtMs: after === null ? null : wake });

describe('learning', () => {
  it('counts consecutive confirmed mornings within 30 minutes after the wake signal', () => {
    let s = defaultMorningState();
    expect(morningRowValue(s)).toBe('Ask me');
    s = recordMorning(s, confirmed(5));
    expect(morningRowValue(s)).toBe('Learning (1 of 3)');
    s = recordMorning(s, confirmed(30));
    expect(morningRowValue(s)).toBe('Learning (2 of 3)');
    s = recordMorning(s, confirmed(0));
    expect(s.auto).toBe(true);
    expect(morningRowValue(s)).toBe('Automatic');
  });
  it('a stop before the signal, more than 30 minutes after it, or without a signal breaks the run', () => {
    for (const bad of [confirmed(-1), confirmed(31), confirmed(null)]) {
      let s = recordMorning(recordMorning(defaultMorningState(), confirmed(5)), confirmed(5));
      expect(s.streak).toBe(2);
      s = recordMorning(s, bad);
      expect(s.streak).toBe(0);
      expect(s.auto).toBe(false);
    }
  });
  it('a hard stop or another stop breaks the run but does not undo automatic mode', () => {
    let s = recordMorning(defaultMorningState(), confirmed(5));
    expect(recordMorning(s, { kind: 'hard-stop' }).streak).toBe(0);
    expect(recordMorning(s, { kind: 'stopped-other' }).streak).toBe(0);
    for (let i = 0; i < 3; i++) s = recordMorning(s, confirmed(5));
    expect(s.auto).toBe(true);
    expect(recordMorning(s, { kind: 'hard-stop' }).auto).toBe(true);
  });
  it('Keep recording resets everything', () => {
    let s = defaultMorningState();
    for (let i = 0; i < 3; i++) s = recordMorning(s, confirmed(5));
    const r = recordMorning(s, { kind: 'keep-recording' });
    expect(r).toMatchObject({ streak: 0, auto: false, lastReset: 'keep-recording' });
  });
  it('restarting within 15 minutes of an automatic stop resets; later does not', () => {
    let s = defaultMorningState();
    for (let i = 0; i < 3; i++) s = recordMorning(s, confirmed(5));
    s = recordMorning(s, { kind: 'auto-stopped', stopAtMs: 5_000_000 });
    const quick = onRecordingStarted(s, 5_000_000 + 14 * MIN);
    expect(quick).toMatchObject({ auto: false, streak: 0, lastReset: 'restarted-after-auto-stop' });
    const late = onRecordingStarted(s, 5_000_000 + 16 * MIN);
    expect(late.auto).toBe(true);
    expect(late.lastAutoStopAtMs).toBeNull();
  });
  it('forced Always ask disables learning and clears progress', () => {
    let s = recordMorning(defaultMorningState(), confirmed(5));
    s = setPreference(s, 'always-ask');
    expect(morningRowValue(s)).toBe('Always ask me');
    expect(recordMorning(s, confirmed(5)).streak).toBe(0);
    expect(shouldAutoStop({ ...s, auto: true }, 9e12, 1)).toBe(false);
    expect(setPreference(s, 'learn').streak).toBe(0);
  });
  it('merge is defensive', () => {
    expect(mergeMorningState(null)).toEqual(defaultMorningState());
    expect(mergeMorningState({ streak: 99, auto: true }).streak).toBe(3);
    expect(mergeMorningState({ streak: 1, auto: true }).auto).toBe(false);
    expect(mergeMorningState({ preference: 'always-ask', streak: 3, auto: true }).auto).toBe(false);
  });
});

describe('auto stop timing', () => {
  it('fires 10 minutes after the wake signal only in automatic mode', () => {
    const s = { ...defaultMorningState(), streak: 3, auto: true };
    expect(autoStopAtMs(1000)).toBe(1000 + AUTO_STOP_DELAY_MS);
    expect(shouldAutoStop(s, 1000 + AUTO_STOP_DELAY_MS - 1, 1000)).toBe(false);
    expect(shouldAutoStop(s, 1000 + AUTO_STOP_DELAY_MS, 1000)).toBe(true);
    expect(shouldAutoStop(s, 1e12, null)).toBe(false);
    expect(shouldAutoStop(defaultMorningState(), 1e12, 1000)).toBe(false);
  });
  it('hard stop is the window end plus the estimator grace period', () => {
    expect(hardStopMs(1000)).toBe(1000 + EST_GRACE_AFTER_WAKE_MS);
  });
});

describe('detectWakeSignal', () => {
  const start = 0;
  const end = 8 * 3600_000;
  const ep = (t: number, state: RecentEpoch['state'], motionSec: number | null = 0, appActive = false): RecentEpoch => ({ t, state, motionSec, appActive });
  const awakeRun = (t0: number, n: number, motion = 5) => Array.from({ length: n }, (_, k) => ep(t0 + k * 30_000, 'likely-awake', k === 2 ? motion : 0));
  it('null before the window end with no awake run', () => {
    expect(detectWakeSignal({ nowMs: 6 * 3600_000, windowStartMs: start, windowEndMs: end, epochs: [ep(5 * 3600_000, 'likely-asleep')] })).toBeNull();
  });
  it('scheduled wake time is a signal', () => {
    expect(detectWakeSignal({ nowMs: end + 1, windowStartMs: start, windowEndMs: end, epochs: [] })).toEqual({ atMs: end, kind: 'scheduled' });
  });
  it('early signal needs the second half, a 3 minute awake run and movement or a pickup', () => {
    const t0 = 6 * 3600_000;
    const run = awakeRun(t0, 6);
    expect(detectWakeSignal({ nowMs: t0 + 200_000, windowStartMs: start, windowEndMs: end, epochs: run })).toEqual({ atMs: t0, kind: 'early' });
    // no movement, no pickup
    expect(detectWakeSignal({ nowMs: t0 + 200_000, windowStartMs: start, windowEndMs: end, epochs: awakeRun(t0, 6, 0) })).toBeNull();
    // pickup counts
    const pick = awakeRun(t0, 6, 0).map((e, k) => (k === 1 ? { ...e, appActive: true } : e));
    expect(detectWakeSignal({ nowMs: t0 + 200_000, windowStartMs: start, windowEndMs: end, epochs: pick })?.kind).toBe('early');
    // first half of the window
    expect(detectWakeSignal({ nowMs: 3600_000, windowStartMs: start, windowEndMs: end, epochs: awakeRun(1800_000, 6) })).toBeNull();
    // too short
    expect(detectWakeSignal({ nowMs: t0 + 200_000, windowStartMs: start, windowEndMs: end, epochs: awakeRun(t0, 5) })).toBeNull();
  });
  it('a broken run does not accumulate', () => {
    const t0 = 6 * 3600_000;
    const e = [...awakeRun(t0, 4), ep(t0 + 120_000, 'uncertain'), ...awakeRun(t0 + 150_000, 4)];
    expect(detectWakeSignal({ nowMs: t0 + 300_000, windowStartMs: start, windowEndMs: end, epochs: e })).toBeNull();
  });
});
