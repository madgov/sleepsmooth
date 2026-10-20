// Manual wearable entry: metric table, validation, immutable list updaters, storage normalisation and the summary section.
// Pure TypeScript shared by web and iPhone. Nothing here scores, rates, colours or interprets a number.
import {
  WEARABLE_METRIC_LABELS,
  WEARABLE_NEUTRAL_LINE,
  WEARABLE_NONE_ENTERED_ERROR,
  WEARABLE_SOURCE_LABEL,
  WEARABLE_SUMMARY_NONE,
  WEARABLE_SUMMARY_TITLE,
} from '../content/wearable';
import type { CareSummarySection } from '../types/report';
import type { WearableMetric, WearableObservation } from '../types/wearable';

export const WEARABLE_METRICS: readonly WearableMetric[] = ['spo2-lowest', 'spo2-average', 'resting-hr', 'breathing-disturbances', 'sleep-duration'];
export const MAX_WEARABLE_ENTRIES = 200;
export const MAX_SOURCE_LENGTH = 60;

interface MetricSpec {
  unit: string;
  min: number;
  max: number;
  integer: boolean;
  /** Friendly message shown when the value is outside the range. */
  rangeError: string;
}

export const METRIC_SPEC: Record<WearableMetric, MetricSpec> = {
  'spo2-lowest': { unit: '%', min: 50, max: 100, integer: false, rangeError: 'SpO2 is a percent from 50 to 100. Check the number on your device.' },
  'spo2-average': { unit: '%', min: 50, max: 100, integer: false, rangeError: 'SpO2 is a percent from 50 to 100. Check the number on your device.' },
  'resting-hr': { unit: 'bpm', min: 25, max: 220, integer: true, rangeError: 'Heart rate is beats per minute, from 25 to 220. Check the number on your device.' },
  'breathing-disturbances': { unit: 'as shown in device app', min: 0, max: 1000, integer: false, rangeError: 'Enter the number your device app shows, from 0 to 1000.' },
  'sleep-duration': { unit: 'h', min: 0.5, max: 24, integer: false, rangeError: 'Sleep duration is in hours, from 0.5 to 24 (for example 7.5).' },
};

/** What the form holds while typing. All strings, so empty is a normal state. */
export interface WearableDraft {
  source: string;
  deviceLabel: string;
  /** 'YYYY-MM-DD' or empty. */
  forDate: string;
  values: Partial<Record<WearableMetric, string>>;
}

export const emptyWearableDraft = (): WearableDraft => ({ source: '', deviceLabel: '', forDate: '', values: {} });

export type WearableErrors = Partial<Record<WearableMetric | 'source' | 'deviceLabel' | 'forDate' | 'form', string>>;
export type DraftResult = { ok: true; observations: WearableObservation[] } | { ok: false; errors: WearableErrors };

const cleanText = (t: unknown, max: number): string =>
  typeof t === 'string' ? [...t].map((c) => (c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 ? ' ' : c)).join('').replace(/\s+/g, ' ').trim().slice(0, max) : '';

/** Parses a typed number. Accepts a decimal comma. Returns null for empty, NaN for not-a-number. */
export function parseNumber(raw: string | undefined): number | null {
  const t = (raw ?? '').trim().replace(',', '.');
  if (t === '') return null;
  if (!/^-?\d+(\.\d+)?$/.test(t)) return Number.NaN;
  return Number(t);
}

export function validateMetric(metric: WearableMetric, raw: string | undefined): { value: number | null; error?: string } {
  const n = parseNumber(raw);
  if (n === null) return { value: null };
  const spec = METRIC_SPEC[metric];
  if (Number.isNaN(n)) return { value: null, error: `${WEARABLE_METRIC_LABELS[metric]}: type a number, for example ${spec.integer ? '58' : metric === 'sleep-duration' ? '7.5' : '94'}.` };
  if (n < spec.min || n > spec.max) return { value: null, error: spec.rangeError };
  if (spec.integer && !Number.isInteger(n)) return { value: null, error: `${WEARABLE_METRIC_LABELS[metric]}: use a whole number.` };
  return { value: Math.round(n * 10) / 10 };
}

/** YYYY-MM-DD for the device's local calendar day (not the UTC day). */
export function localDateISO(d: Date): string {
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

/** Local day for a stored ISO timestamp; falls back to the raw date part if it cannot be parsed. */
export function localDayOfTimestamp(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : localDateISO(d);
}

/** Empty is allowed. A date must be a real calendar day and not in the future. */
export function validateDate(raw: string, todayISODate: string): { value: string | null; error?: string } {
  const t = raw.trim();
  if (t === '') return { value: null };
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  const d = m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
  if (!m || !d || d.toISOString().slice(0, 10) !== t) return { value: null, error: 'Use the form YYYY-MM-DD, for example 2026-06-01, or leave it empty.' };
  if (t > todayISODate) return { value: null, error: 'That date is in the future. Use the night you are describing, or leave it empty.' };
  return { value: t };
}

let counter = 0;
const newId = (nowISO: string, metric: WearableMetric) => `w-${Date.parse(nowISO).toString(36)}-${metric}-${(counter++).toString(36)}`;

/** Validates the whole add form. At least one reading is required; every other field may be empty. */
export function validateDraft(draft: WearableDraft, nowISO: string): DraftResult {
  const errors: WearableErrors = {};
  const observations: WearableObservation[] = [];
  const source = cleanText(draft.source, MAX_SOURCE_LENGTH);
  if (draft.source.trim().length > MAX_SOURCE_LENGTH) errors.source = `Keep the device name to ${MAX_SOURCE_LENGTH} characters or fewer.`;
  const deviceLabel = cleanText(draft.deviceLabel, MAX_SOURCE_LENGTH);
  if (draft.deviceLabel.trim().length > MAX_SOURCE_LENGTH) errors.deviceLabel = `Keep the name to ${MAX_SOURCE_LENGTH} characters or fewer.`;
  const date = validateDate(draft.forDate, localDayOfTimestamp(nowISO));
  if (date.error) errors.forDate = date.error;
  for (const metric of WEARABLE_METRICS) {
    const r = validateMetric(metric, draft.values[metric]);
    if (r.error) errors[metric] = r.error;
    else if (r.value !== null) {
      observations.push({
        id: newId(nowISO, metric),
        metric,
        value: r.value,
        unit: METRIC_SPEC[metric].unit,
        source,
        deviceLabel: metric === 'breathing-disturbances' ? deviceLabel : '',
        timestamp: nowISO,
        forDate: date.value,
        entryMethod: 'user-entered',
      });
    }
  }
  if (Object.keys(errors).length === 0 && observations.length === 0) errors.form = WEARABLE_NONE_ENTERED_ERROR;
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, observations };
}

/** Draft that edits one stored observation. */
export function draftFromObservation(o: WearableObservation): WearableDraft {
  return { source: o.source, deviceLabel: o.deviceLabel, forDate: o.forDate ?? '', values: { [o.metric]: String(o.value) } };
}

/** Validates an edit of one observation. The value may not be emptied (delete the entry instead). */
export function validateEdit(existing: WearableObservation, draft: WearableDraft, todayISODate: string): { ok: true; observation: WearableObservation } | { ok: false; errors: WearableErrors } {
  const errors: WearableErrors = {};
  const r = validateMetric(existing.metric, draft.values[existing.metric]);
  if (r.error) errors[existing.metric] = r.error;
  else if (r.value === null) errors[existing.metric] = 'Type a number, or delete this entry.';
  const date = validateDate(draft.forDate, todayISODate);
  if (date.error) errors.forDate = date.error;
  if (draft.source.trim().length > MAX_SOURCE_LENGTH) errors.source = `Keep the device name to ${MAX_SOURCE_LENGTH} characters or fewer.`;
  if (draft.deviceLabel.trim().length > MAX_SOURCE_LENGTH) errors.deviceLabel = `Keep the name to ${MAX_SOURCE_LENGTH} characters or fewer.`;
  if (Object.keys(errors).length > 0 || r.value === null) return { ok: false, errors };
  return {
    ok: true,
    observation: {
      ...existing,
      value: r.value,
      source: cleanText(draft.source, MAX_SOURCE_LENGTH),
      deviceLabel: existing.metric === 'breathing-disturbances' ? cleanText(draft.deviceLabel, MAX_SOURCE_LENGTH) : '',
      forDate: date.value,
    },
  };
}

export const addObservations = (list: readonly WearableObservation[], add: readonly WearableObservation[]): WearableObservation[] => [...list, ...add].slice(-MAX_WEARABLE_ENTRIES);
export const replaceObservation = (list: readonly WearableObservation[], next: WearableObservation): WearableObservation[] => list.map((o) => (o.id === next.id ? next : o));
export const removeObservation = (list: readonly WearableObservation[], id: string): WearableObservation[] => list.filter((o) => o.id !== id);

/** Whitelist and repair stored data. Anything out of range or malformed is dropped. */
export function normalizeWearable(raw: unknown): WearableObservation[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: WearableObservation[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const metric = o.metric as WearableMetric;
    if (!WEARABLE_METRICS.includes(metric) || typeof o.id !== 'string' || seen.has(o.id)) continue;
    const v = validateMetric(metric, typeof o.value === 'number' ? String(o.value) : '');
    if (v.value === null) continue;
    if (typeof o.timestamp !== 'string' || !Number.isFinite(Date.parse(o.timestamp))) continue;
    const forDate = typeof o.forDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.forDate) ? o.forDate : null;
    seen.add(o.id);
    out.push({
      id: o.id,
      metric,
      value: v.value,
      unit: METRIC_SPEC[metric].unit,
      source: cleanText(o.source, MAX_SOURCE_LENGTH),
      deviceLabel: metric === 'breathing-disturbances' ? cleanText(o.deviceLabel, MAX_SOURCE_LENGTH) : '',
      timestamp: o.timestamp,
      forDate,
      entryMethod: 'user-entered',
    });
  }
  return out.slice(-MAX_WEARABLE_ENTRIES);
}

/** One readable line per entry. Numbers are shown as typed, with no judgement. */
export function observationLine(o: WearableObservation): string {
  const unit = o.metric === 'breathing-disturbances' ? '' : o.unit === '%' ? '%' : ` ${o.unit}`;
  const label = o.metric === 'breathing-disturbances' && o.deviceLabel ? ` (device's label: "${o.deviceLabel}")` : '';
  const note = o.metric === 'breathing-disturbances' ? ' (units as shown in the device app)' : '';
  const dev = o.source ? `, device: ${o.source}` : ', device not named';
  const when = o.forDate ? `, for the night of ${o.forDate}` : '';
  return `${WEARABLE_METRIC_LABELS[o.metric]}: ${o.value}${unit}${label}${note}${dev}${when}, entered ${localDayOfTimestamp(o.timestamp)}`;
}

export function wearableSummaryText(list: readonly WearableObservation[] | null | undefined): string {
  if (!list || list.length === 0) return WEARABLE_SUMMARY_NONE;
  return [`Source: ${WEARABLE_SOURCE_LABEL}`, list.map((o) => `- ${observationLine(o)}`).join('\n'), WEARABLE_NEUTRAL_LINE].join('\n');
}

/** Section for the clinician summary. Callers omit it when the list is empty. */
export function wearableSection(list: readonly WearableObservation[]): CareSummarySection {
  return { id: 'wearable', title: WEARABLE_SUMMARY_TITLE, source: 'wearable', text: wearableSummaryText(list) };
}
