// Multi-night view for the Nights tab. Pure (no React).
//
// This is a LIST of what each night showed, not a trend. By design it has:
//   - no direction (no arrows, no "better" or "worse"), no score, no average of any model output;
//   - sample nights shown but never counted;
//   - a summary sentence that only counts nights by their state.
// The fixed note below the list is part of the feature and must not be removed.
import type { NightAudioState } from '../night';

export const TREND_WINDOWS = [7, 30] as const;
export type TrendWindow = (typeof TREND_WINDOWS)[number];

export const TREND_FIXED_NOTE = "Nights aren't comparable to a clinical result, and a quiet night doesn't rule anything out.";

/** The four states the list shows. "Inconclusive" covers a night the model could not be applied to, or a build with no model. */
export type TrendState = 'snore-like-observed' | 'few-observations' | 'not-assessed' | 'inconclusive';

export interface TrendStatePresentation {
  state: TrendState;
  label: string;
  /** SF Symbol. A different SHAPE per state so the list reads without colour. */
  icon: 'waveform' | 'ellipsis' | 'circle.dashed' | 'questionmark.circle';
}

const PRESENTATION: Record<TrendState, TrendStatePresentation> = {
  'snore-like-observed': { state: 'snore-like-observed', label: 'Snore-like sound observed', icon: 'waveform' },
  'few-observations': { state: 'few-observations', label: 'Few observations', icon: 'ellipsis' },
  'not-assessed': { state: 'not-assessed', label: 'Not assessed', icon: 'circle.dashed' },
  inconclusive: { state: 'inconclusive', label: 'Inconclusive', icon: 'questionmark.circle' },
};

/** Night state to list state. `not-recorded` has no row (null). */
export function trendStateFor(s: NightAudioState): TrendStatePresentation | null {
  switch (s) {
    case 'snore-like-observed':
      return PRESENTATION['snore-like-observed'];
    case 'few-observations':
      return PRESENTATION['few-observations'];
    case 'not-assessed':
      return PRESENTATION['not-assessed'];
    case 'model-not-applicable':
    case 'no-model':
      return PRESENTATION.inconclusive;
    case 'not-recorded':
      return null;
  }
}

/** "v3", "v1", "Sample" (the synthetic sample), or "No model". Derived from the version string recorded on the night. */
export function modelTag(version: string | null | undefined): string {
  if (!version) return 'No model';
  if (version.startsWith('sleepsmooth-snore-yamnet')) return 'v3';
  if (version.startsWith('sleepsmooth-snore-mlp')) return 'v1';
  if (version.startsWith('synthetic-sample')) return 'Sample';
  return 'Other';
}

/** Structural input: the fields of the app's night list item that this view needs. */
export interface TrendNightInput {
  id: string;
  dateISO: string;
  isSample: boolean;
  state: NightAudioState;
  coverage: { seconds: { scheduled: number; recordedInWindow: number } };
  view: { summary: { modelVersion: string | null } };
}

export interface TrendRow {
  id: string;
  dateISO: string;
  isSample: boolean;
  state: TrendStatePresentation;
  /** Share of the scheduled hours that have recorded audio, 0..1. null when no schedule length is known. */
  recordedShare: number | null;
  model: string;
}

const NIGHT_DATE = { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' } as const;
export const trendDateLabel = (dateISO: string): string => new Date(dateISO).toLocaleDateString(undefined, NIGHT_DATE);

export function recordedShare(c: TrendNightInput['coverage']): number | null {
  const { scheduled, recordedInWindow } = c.seconds;
  if (!(scheduled > 0)) return null;
  return Math.max(0, Math.min(1, recordedInWindow / scheduled));
}

/**
 * The most recent `n` nights that have a recording, newest first. Nights with no recording have no row.
 * Sample nights are kept in order but never counted by trendSentence.
 */
export function selectTrendRows(nights: readonly TrendNightInput[], n: TrendWindow): TrendRow[] {
  const rows: TrendRow[] = [];
  for (const night of [...nights].sort((a, b) => Date.parse(b.dateISO) - Date.parse(a.dateISO))) {
    const state = trendStateFor(night.state);
    if (!state) continue;
    rows.push({
      id: night.id,
      dateISO: night.dateISO,
      isSample: night.isSample,
      state,
      recordedShare: recordedShare(night.coverage),
      model: modelTag(night.view.summary.modelVersion),
    });
    if (rows.length === n) break;
  }
  return rows;
}

const nights = (k: number) => (k === 1 ? '1 night' : `${k} nights`);

/**
 * One neutral sentence. Counts only real nights by state. Never says a night was "fine" or "normal" and never compares nights.
 */
export function trendSentence(rows: readonly TrendRow[], n: TrendWindow): string {
  const real = rows.filter((r) => !r.isSample);
  const sample = rows.length - real.length;
  const sampleNote = sample > 0 ? ` ${sample === 1 ? '1 sample night is' : `${sample} sample nights are`} shown for layout only and not counted.` : '';
  if (real.length === 0) {
    return sample > 0 ? `No recorded nights yet.${sampleNote}` : 'No recorded nights yet.';
  }
  if (real.length === 1) {
    const only = (real[0] as TrendRow).state.label.toLowerCase();
    return `Only 1 recorded night so far (${only}). One night can't show a pattern.${sampleNote}`;
  }
  const count = (s: TrendState) => real.filter((r) => r.state.state === s).length;
  const observed = count('snore-like-observed');
  const notAssessed = count('not-assessed');
  const inconclusive = count('inconclusive');
  const span = real.length < n ? `the ${real.length} recorded nights` : `the last ${n} recorded nights`;
  const parts = [`Snore-like sound was observed on ${observed} of ${span}.`];
  if (notAssessed > 0) parts.push(`${nights(notAssessed)} could not be assessed.`);
  if (inconclusive > 0) parts.push(`${nights(inconclusive)} ${inconclusive === 1 ? 'was' : 'were'} inconclusive.`);
  return parts.join(' ') + sampleNote;
}

export function rowAccessibilityLabel(r: TrendRow): string {
  const cov = r.recordedShare === null ? 'recorded share of scheduled hours unknown' : `recorded ${Math.round(r.recordedShare * 100)} percent of scheduled hours`;
  return `${r.isSample ? 'Sample data. ' : ''}${trendDateLabel(r.dateISO)}: ${r.state.label}. ${cov}. Model ${r.model}.`;
}

/** Text alternative for the whole strip: the sentence, then every row, then the fixed note. */
export function trendAccessibilityLabel(rows: readonly TrendRow[], n: TrendWindow): string {
  return [trendSentence(rows, n), ...rows.map(rowAccessibilityLabel), TREND_FIXED_NOTE].join(' ');
}
