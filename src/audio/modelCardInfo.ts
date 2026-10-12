// Test-metric ranges for the Results page, read from model/metrics.json when it is part of the build.
// Shown as 95% ranges only; the file is produced by `npm run evaluate` (never typed by hand here).
type Range = [number, number];
export interface ModelCardRanges {
  recall: Range;
  precision: Range;
  fpr: Range;
}

function isRange(v: unknown): v is Range {
  return Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number' && Number.isFinite(n));
}

export function rangesFromMetrics(metrics: unknown): ModelCardRanges | null {
  const ci = (metrics as { winnerPerSource?: { esc50?: { ci95?: Record<string, unknown> } } } | null)?.winnerPerSource?.esc50?.ci95;
  if (!ci || !isRange(ci.recall) || !isRange(ci.precision) || !isRange(ci.fpr)) return null;
  return { recall: ci.recall, precision: ci.precision, fpr: ci.fpr };
}

export function loadModelCardRanges(): ModelCardRanges | null {
  let found: Record<string, unknown>;
  try {
    found = import.meta.glob('../../model/metrics.json', { eager: true, import: 'default' });
  } catch {
    return null;
  }
  return rangesFromMetrics(Object.values(found)[0]);
}

export const formatRange = ([lo, hi]: Range): string => `${lo.toFixed(2)} to ${hi.toFixed(2)}`;
