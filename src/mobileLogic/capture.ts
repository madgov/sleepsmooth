// Pure rules for the capture session shell on the phone (no React Native, no audio library).
// These decide only app bookkeeping (append vs new night, is the stream alive). They never interpret sound or health data.

export type CaptureEndReason =
  | 'scheduled-end'
  | 'interrupted-call-or-alarm'
  | 'os-killed-or-crash-recovered'
  | 'low-battery'
  | 'mic-lost'
  | 'storage-error'
  | 'user-stop';

export interface CaptureGap {
  fromMs: number;
  toMs: number;
}

export interface SessionRecord {
  startedAtMs: number;
  /** Last time audio was seen, or the stop time. */
  lastActivityMs: number;
  gaps: CaptureGap[];
  endReason: CaptureEndReason | null;
}

/** A restart after an interruption (or other unplanned end) within this window continues the same night. */
export const RESUME_WINDOW_MS = 12 * 3_600_000;

export type StartPlan = { kind: 'new' } | { kind: 'append'; gap: CaptureGap };

/**
 * Resuming after an interruption appends to the same night and records the gap.
 * A user-initiated stop always ends the night: the next start is a new night.
 */
export function planStart(prev: SessionRecord | null, nowMs: number): StartPlan {
  if (!prev || prev.endReason === null || prev.endReason === 'user-stop' || prev.endReason === 'scheduled-end') return { kind: 'new' };
  if (nowMs - prev.lastActivityMs > RESUME_WINDOW_MS || nowMs < prev.lastActivityMs) return { kind: 'new' };
  return { kind: 'append', gap: { fromMs: prev.lastActivityMs, toMs: nowMs } };
}

export type Liveness = 'receiving' | 'interrupted' | 'no-audio' | 'ended-by-interruption';

export interface LivenessInput {
  nowMs: number;
  lastChunkMs: number;
  interruptions: number;
  interruptionsAtLastChunk: number;
}

export const NO_AUDIO_AFTER_MS = 5_000;
export const GIVE_UP_AFTER_INTERRUPTION_MS = 20_000;

/** Meter caption and banner state. "no-audio" is the neutral N-37 caption; it is never an alarm colour. */
export function classifyLiveness(i: LivenessInput): Liveness {
  const quiet = i.nowMs - i.lastChunkMs;
  const interrupted = i.interruptions > i.interruptionsAtLastChunk;
  if (interrupted && quiet >= GIVE_UP_AFTER_INTERRUPTION_MS) return 'ended-by-interruption';
  if (interrupted && quiet >= 2_000) return 'interrupted';
  if (quiet >= NO_AUDIO_AFTER_MS) return 'no-audio';
  return 'receiving';
}

/** When recording started at `startMs`, the next occurrence of the wake time (minute of day) is the scheduled end. */
export function scheduledEndMs(startMs: number, wakeMin: number): number {
  const d = new Date(startMs);
  d.setHours(Math.floor(wakeMin / 60), wakeMin % 60, 0, 0);
  if (d.getTime() <= startMs) d.setDate(d.getDate() + 1);
  return d.getTime();
}
