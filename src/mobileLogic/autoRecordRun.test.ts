import { describe, expect, it, vi } from 'vitest';
import { handleAutomationCommand, type AutoRunDeps } from './autoRecordRun';

const NOW = Date.parse('2026-06-10T23:00:00Z');
const cmd = (kind: 'start' | 'stop' | 'morning-stop' | 'morning-open', at = NOW - 1000) => JSON.stringify({ kind, at });
function deps(o: Partial<AutoRunDeps> = {}): AutoRunDeps & { report: ReturnType<typeof vi.fn> } {
  const report = vi.fn();
  return {
    nowMs: () => NOW,
    consentGranted: () => true,
    micGranted: async () => true,
    standingAckAt: () => '2026-06-01T00:00:00Z',
    recordingActive: () => false,
    startRecording: async () => true,
    stopRecording: async () => undefined,
    ...o,
    report,
  } as AutoRunDeps & { report: ReturnType<typeof vi.fn> };
}

describe('handleAutomationCommand', () => {
  it('starts and reports the real start time', async () => {
    const d = deps();
    expect(await handleAutomationCommand(cmd('start'), d)).toBe('started');
    expect(d.report).toHaveBeenCalledWith('started', NOW, NOW);
  });
  it('does not start without consent, and never calls startRecording', async () => {
    const start = vi.fn(async () => true);
    const d = deps({ consentGranted: () => false, startRecording: start });
    expect(await handleAutomationCommand(cmd('start'), d)).toBe('blocked-consent');
    expect(start).not.toHaveBeenCalled();
    expect(d.report).toHaveBeenCalledWith('blocked-consent', NOW, null);
  });
  it('blocks on missing microphone permission and a missing notice', async () => {
    expect(await handleAutomationCommand(cmd('start'), deps({ micGranted: async () => false }))).toBe('blocked-mic');
    expect(await handleAutomationCommand(cmd('start'), deps({ standingAckAt: () => null }))).toBe('blocked-ack');
  });
  it('reports start-failed and never claims a start when recording did not begin', async () => {
    const d = deps({ startRecording: async () => false });
    expect(await handleAutomationCommand(cmd('start'), d)).toBe('start-failed');
    expect(d.report).toHaveBeenCalledWith('start-failed', NOW, null);
    const d2 = deps({ startRecording: async () => { throw new Error('x'); } });
    expect(await handleAutomationCommand(cmd('start'), d2)).toBe('start-failed');
  });
  it('ignores stale, junk and a start while already recording', async () => {
    expect(await handleAutomationCommand(cmd('start', NOW - 3_600_000), deps())).toBe('ignored');
    expect(await handleAutomationCommand('junk', deps())).toBe('ignored');
    expect(await handleAutomationCommand(cmd('start'), deps({ recordingActive: () => true }))).toBe('blocked-already-recording');
  });
  it('stop only acts while recording', async () => {
    const stop = vi.fn(async () => undefined);
    expect(await handleAutomationCommand(cmd('stop'), deps({ stopRecording: stop }))).toBe('ignored');
    expect(await handleAutomationCommand(cmd('stop'), deps({ recordingActive: () => true, stopRecording: stop }))).toBe('stopped');
    expect(stop).toHaveBeenCalledTimes(1);
  });
  it('morning-stop records the confirmation through morningStop and ignores it when nothing is recording', async () => {
    const morningStop = vi.fn(async () => undefined);
    const stopRecording = vi.fn(async () => undefined);
    expect(await handleAutomationCommand(cmd('morning-stop'), deps({ recordingActive: () => true, morningStop, stopRecording }))).toBe('stopped');
    expect(morningStop).toHaveBeenCalledWith(NOW);
    expect(stopRecording).not.toHaveBeenCalled();
    expect(await handleAutomationCommand(cmd('morning-stop'), deps({ morningStop }))).toBe('ignored');
  });
  it('morning-stop falls back to a plain stop, and morning-open routes', async () => {
    const stopRecording = vi.fn(async () => undefined);
    expect(await handleAutomationCommand(cmd('morning-stop'), deps({ recordingActive: () => true, stopRecording }))).toBe('stopped');
    expect(stopRecording).toHaveBeenCalled();
    const morningOpen = vi.fn();
    expect(await handleAutomationCommand(cmd('morning-open'), deps({ morningOpen }))).toBe('opened');
    expect(morningOpen).toHaveBeenCalled();
    expect(await handleAutomationCommand(cmd('morning-open', NOW - 11 * 60_000), deps({ morningOpen }))).toBe('ignored');
  });
});
