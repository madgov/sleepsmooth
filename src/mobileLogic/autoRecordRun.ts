// Orchestration for a command handed over by an App Intent. Pure: every side effect is injected, so it is unit tested.
// It never skips consent, the microphone permission or the standing notice, and it only reports 'started' after
// recording really began.
import { decideAutoStart, parsePendingCommand, pendingIsFresh, type AutoOutcome } from './autoRecord';

export interface AutoRunDeps {
  nowMs(): number;
  consentGranted(): boolean;
  micGranted(): Promise<boolean>;
  standingAckAt(): string | null;
  /** True while a recording is starting, running or stopping. */
  recordingActive(): boolean;
  /** Start capture. Resolves true only when the recorder is actually recording afterwards. */
  startRecording(): Promise<boolean>;
  stopRecording(): Promise<void>;
  /** The Live Activity "Stop" button. Records the user's confirmation for morning learning, then stops. Optional. */
  morningStop?(atMs: number): Promise<void>;
  /** The Live Activity "Open" button: route to the night summary (or the recording screen while still recording). Optional. */
  morningOpen?(): void;
  /** Persist what happened. `startedAtMs` is set only for 'started'. */
  report(outcome: AutoOutcome, atMs: number, startedAtMs: number | null): void;
}

export type AutoRunResult = 'ignored' | 'stopped' | 'opened' | AutoOutcome;

export async function handleAutomationCommand(raw: unknown, d: AutoRunDeps): Promise<AutoRunResult> {
  const cmd = parsePendingCommand(raw);
  if (!cmd) return 'ignored';
  const now = d.nowMs();
  if (!pendingIsFresh(cmd, now)) return 'ignored';
  if (cmd.kind === 'morning-open') {
    d.morningOpen?.();
    return d.morningOpen ? 'opened' : 'ignored';
  }
  if (cmd.kind === 'morning-stop') {
    if (!d.recordingActive()) return 'ignored';
    if (d.morningStop) await d.morningStop(now);
    else await d.stopRecording();
    return 'stopped';
  }
  if (cmd.kind === 'stop') {
    if (!d.recordingActive()) return 'ignored';
    await d.stopRecording();
    return 'stopped';
  }
  const gate = decideAutoStart({
    consentGranted: d.consentGranted(),
    micGranted: await d.micGranted(),
    standingAckAt: d.standingAckAt(),
    alreadyRecording: d.recordingActive(),
    nowMs: now,
  });
  if (!gate.ok) {
    d.report(gate.outcome, now, null);
    return gate.outcome;
  }
  let ok: boolean;
  try {
    ok = await d.startRecording();
  } catch {
    ok = false;
  }
  const at = d.nowMs();
  d.report(ok ? 'started' : 'start-failed', at, ok ? at : null);
  return ok ? 'started' : 'start-failed';
}
