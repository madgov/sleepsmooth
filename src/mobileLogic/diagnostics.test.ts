import { describe, expect, it } from 'vitest';
import {
  DEVICE_CRITERIA,
  addAudioSec,
  addGap,
  diagnosticsNumbers,
  diagnosticsRows,
  evaluateCriteria,
  newDiagnostics,
  parseDiagnostics,
  pushEvent,
  recordBatteryEnd,
  serializeDiagnostics,
  startRun,
  stopRun,
  withRecovery,
  type BatterySample,
} from './diagnostics';

const S = Date.UTC(2026, 0, 15, 23, 0, 0);
const E = S + 8 * 3600_000;
const base = () => newDiagnostics({ nightId: 'n1', device: { model: 'iPhone', os: '18', app: '1.0' }, scheduledStartMs: S, scheduledEndMs: E });
const bat = (atMs: number, pct: number, charging: boolean | null): BatterySample => ({ atMs, pct, charging, lowPowerMode: false });

describe('diagnostics record', () => {
  it('logs start and stop with battery at both ends', () => {
    let d = startRun(base(), S, bat(S, 90, false));
    d = stopRun(d, E, 'scheduled-end', bat(E, 80, false));
    expect(d.runs).toEqual([{ startMs: S, stopMs: E, stopReason: 'scheduled-end' }]);
    expect(d.batteryStart?.pct).toBe(90);
    expect(d.batteryEnd?.pct).toBe(80);
    expect(d.events.map((e) => e.kind)).toEqual(['run-start', 'run-stop']);
  });

  it('keeps the first battery sample as the start even when the night is resumed', () => {
    let d = startRun(base(), S, bat(S, 90, false));
    d = stopRun(d, S + 1000, 'interrupted-call-or-alarm', bat(S + 1000, 89, false));
    d = startRun(d, S + 5000, bat(S + 5000, 88, false));
    expect(d.runs).toHaveLength(2);
    expect(d.batteryStart?.pct).toBe(90);
  });

  it('records gaps with a cause and ignores empty or inverted ones', () => {
    let d = addGap(base(), { startMs: S + 1000, endMs: S + 61_000, cause: 'interruption' });
    d = addGap(d, { startMs: S + 5000, endMs: S + 5000, cause: 'unknown' });
    d = addGap(d, { startMs: S + 9000, endMs: S + 8000, cause: 'unknown' });
    expect(d.gaps).toHaveLength(1);
    expect(d.gaps[0]?.cause).toBe('interruption');
  });

  it('caps the event list so a long night cannot grow the file without bound', () => {
    let d = base();
    for (let i = 0; i < 1000; i++) d = pushEvent(d, { atMs: S + i, kind: 'route-change' });
    expect(d.events.length).toBeLessThanOrEqual(400);
    expect(d.events[d.events.length - 1]?.atMs).toBe(S + 999);
  });

  it('records a recovery and the time lost until the scheduled end', () => {
    let d = startRun(base(), S, bat(S, 80, true));
    d = withRecovery(d, E + 3600_000, S + 2 * 3600_000);
    expect(d.recoveredCount).toBe(1);
    expect(d.events.some((e) => e.kind === 'recovered')).toBe(true);
    expect(d.runs[0]?.stopReason).toBe('app-killed-or-recovered');
    expect(d.gaps[0]).toMatchObject({ startMs: S + 2 * 3600_000, endMs: E, cause: 'app-killed-or-recovered' });
  });

  it('round-trips through JSON and survives garbage', () => {
    let d = startRun(base(), S, bat(S, 90, false));
    d = addGap(d, { startMs: S + 10, endMs: S + 20_000, cause: 'route-change', detail: 'OldDeviceUnavailable' });
    d = addAudioSec(d, 120);
    expect(parseDiagnostics(serializeDiagnostics(d))).toEqual(d);
    expect(parseDiagnostics('not json')).toBeNull();
    expect(parseDiagnostics('{"v":2}')).toBeNull();
    expect(parseDiagnostics('{"v":1,"nightId":"x","runs":[],"gaps":[{"startMs":"a"}],"events":[]}')?.gaps).toEqual([]);
  });

  it('never carries audio-like data', () => {
    const json = serializeDiagnostics(startRun(base(), S, bat(S, 90, false)));
    expect(json).not.toMatch(/peaks|samples|pcm|waveform/i);
  });
});

describe('diagnostics numbers and criteria', () => {
  const run = () => {
    let d = startRun(base(), S, bat(S, 92, false));
    d = addGap(d, { startMs: S + 3600_000, endMs: S + 3600_000 + 240_000, cause: 'interruption' }); // 4 min
    d = addGap(d, { startMs: S + 7200_000, endMs: S + 7200_000 + 60_000, cause: 'route-change' }); // 1 min
    return recordBatteryEnd(stopRun(d, E, 'scheduled-end', bat(E, 80, false)), bat(E, 80, false));
  };

  it('computes gap totals and percent of the scheduled hours', () => {
    const n = diagnosticsNumbers(run(), 8 * 3600 - 300);
    expect(n.gapCount).toBe(2);
    expect(n.gapTotalSec).toBe(300);
    expect(n.longestGapSec).toBe(240);
    expect(n.gapPctOfWindow).toBeCloseTo((100 * 300) / 28800, 6);
    expect(n.capturedPctOfWindow).toBeCloseTo((100 * (28800 - 300)) / 28800, 6);
    expect(n.batteryDrainPct).toBe(12);
    expect(n.batteryDrainComparable).toBe(true);
    expect(n.interruptions).toBe(0); // counted from events, not gaps
  });

  it('clips a gap that runs past the scheduled end to the scheduled hours', () => {
    const d = addGap(base(), { startMs: E - 60_000, endMs: E + 600_000, cause: 'app-killed-or-recovered' });
    expect(diagnosticsNumbers(d, 0).gapTotalSec).toBe(60);
  });

  it('applies the provisional criteria: pass and fail', () => {
    const r = evaluateCriteria(diagnosticsNumbers(run(), 8 * 3600 - 300));
    expect(r).toEqual({ gapPct: 'pass', capturedPct: 'pass', batteryDrain: 'pass' });
    const bad = evaluateCriteria(diagnosticsNumbers(addGap(run(), { startMs: S + 10_000_000, endMs: S + 10_000_000 + 1_200_000, cause: 'late-buffers' }), 8 * 3600 - 1500 - 3000));
    expect(bad.gapPct).toBe('fail');
    expect(DEVICE_CRITERIA.maxGapPctOfWindow).toBe(2);
  });

  it('battery drain is not evaluable when the phone was charging', () => {
    let d = startRun(base(), S, bat(S, 50, true));
    d = stopRun(d, E, 'scheduled-end', bat(E, 100, true));
    const n = diagnosticsNumbers(d, 28000);
    expect(n.batteryDrainComparable).toBe(false);
    expect(evaluateCriteria(n).batteryDrain).toBe('not-evaluable');
  });

  it('without a schedule nothing is evaluable as a percentage', () => {
    const d = newDiagnostics({ nightId: 'n', device: { model: '', os: '', app: '' }, scheduledStartMs: null, scheduledEndMs: null });
    const n = diagnosticsNumbers(d, 100);
    expect(n.gapPctOfWindow).toBeNull();
    expect(evaluateCriteria(n).gapPct).toBe('not-evaluable');
  });

  it('rows are plain language', () => {
    const rows = diagnosticsRows(run(), 8 * 3600 - 300);
    expect(rows.find((r) => r.label === 'Gaps')?.value).toMatch(/2, 5 m in total, longest 4 m/);
    expect(rows.find((r) => r.label === 'Battery at start')?.value).toBe('92%, unplugged');
  });
});
