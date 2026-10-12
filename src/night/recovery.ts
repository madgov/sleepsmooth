// Append-only epoch log helpers (docs/OVERNIGHT_PLAN.md M2, ER-6 persistence). The native file writer lives
// in the mobile app; this module is the pure part: one JSON object per line, tolerant of a truncated last
// line, repeated epoch indices after a crash, and a manifest that was never finalized.
import { EPOCH_MS, EPOCH_SCHEMA_VERSION } from './constants';
import type { CaptureEndReason, EpochRecord, NightRecord } from './types';

export function serializeEpoch(e: EpochRecord): string {
  return `${JSON.stringify(e)}\n`;
}

function looksLikeEpoch(x: unknown): x is EpochRecord {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  const win = o.win as Record<string, unknown> | undefined;
  const lvl = o.lvl as Record<string, unknown> | undefined;
  return (
    typeof o.i === 'number' &&
    Number.isInteger(o.i) &&
    o.i >= 0 &&
    typeof o.t === 'number' &&
    typeof o.cap === 'number' &&
    typeof win === 'object' && win !== null && typeof win.total === 'number' && typeof win.scored === 'number' &&
    typeof lvl === 'object' && lvl !== null && typeof lvl.p50 === 'number' &&
    typeof o.state === 'string'
  );
}

export interface ParsedEpochLog {
  epochs: EpochRecord[];
  /** The last line was cut off (power loss or kill mid-write) and was dropped. */
  truncatedTail: boolean;
  /** Lines that were not valid epoch records (other than a truncated tail). */
  badLines: number;
  /** Epoch indices that appeared more than once; the later line won. */
  duplicates: number;
}

export function parseEpochLog(text: string): ParsedEpochLog {
  const lines = text.split('\n');
  const endsClean = text.endsWith('\n') || text.length === 0;
  const byIndex = new Map<number, EpochRecord>();
  let bad = 0;
  let dup = 0;
  let truncatedTail = false;
  lines.forEach((line, idx) => {
    if (line.trim() === '') return;
    const isLast = idx === lines.length - 1;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      if (isLast && !endsClean) truncatedTail = true;
      else bad++;
      return;
    }
    if (!looksLikeEpoch(parsed)) {
      if (isLast && !endsClean) truncatedTail = true;
      else bad++;
      return;
    }
    if (byIndex.has(parsed.i)) dup++;
    byIndex.set(parsed.i, parsed);
  });
  const epochs = Array.from(byIndex.values()).sort((a, b) => a.i - b.i);
  return { epochs, truncatedTail, badLines: bad, duplicates: dup };
}

export function isSupportedEpochSchema(record: Pick<NightRecord, 'epochSchemaVersion'>): boolean {
  return Number.isInteger(record.epochSchemaVersion) && record.epochSchemaVersion >= 1 && record.epochSchemaVersion <= EPOCH_SCHEMA_VERSION;
}

/**
 * A manifest written at the start of the night has captureEnd null. If the process died, the next launch
 * closes it from the epochs that exist: the end is the last epoch's end and the reason is
 * os-killed-or-crash-recovered. A night that was finalized is returned unchanged.
 */
export function recoverUnfinishedNight(record: NightRecord, epochs: readonly EpochRecord[]): NightRecord {
  if (record.captureEnd !== null && record.endReason !== null) return record;
  const last = epochs.length > 0 ? epochs.reduce((a, e) => (e.i > a.i ? e : a)) : null;
  const reason: CaptureEndReason = record.endReason ?? 'os-killed-or-crash-recovered';
  return { ...record, captureEnd: record.captureEnd ?? (last ? last.t + EPOCH_MS : record.captureStart), endReason: reason };
}

/** Options for NightPipeline's `resume`, from a parsed log. Returns null when nothing was persisted yet. */
export function resumeFromLog(log: ParsedEpochLog, nowMs: number): { lastEpoch: EpochRecord; resumeAtMs: number; recentEpochs: EpochRecord[] } | null {
  const last = log.epochs[log.epochs.length - 1];
  if (!last) return null;
  return { lastEpoch: last, resumeAtMs: nowMs, recentEpochs: log.epochs };
}
