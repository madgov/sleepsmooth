import { describe, expect, it } from 'vitest';
import { WEARABLE_NEUTRAL_LINE, WEARABLE_SOURCE_LABEL } from '../content/wearable';
import {
  METRIC_SPEC,
  WEARABLE_METRICS,
  addObservations,
  draftFromObservation,
  emptyWearableDraft,
  normalizeWearable,
  observationLine,
  parseNumber,
  removeObservation,
  replaceObservation,
  validateDate,
  validateDraft,
  validateEdit,
  validateMetric,
  wearableSection,
  wearableSummaryText,
} from './entries';

const NOW = '2026-06-10T07:30:00.000Z';
const draft = (values: Record<string, string>, extra = {}) => ({ ...emptyWearableDraft(), source: 'Example watch', ...extra, values });
const ok = (d: ReturnType<typeof draft>) => {
  const r = validateDraft(d, NOW);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.observations;
};

describe('WearableObservation schema', () => {
  it('has the five metrics with fixed units and always entryMethod user-entered', () => {
    expect(WEARABLE_METRICS).toEqual(['spo2-lowest', 'spo2-average', 'resting-hr', 'breathing-disturbances', 'sleep-duration']);
    const obs = ok(draft({ 'spo2-lowest': '88', 'spo2-average': '95', 'resting-hr': '58', 'breathing-disturbances': '4', 'sleep-duration': '6.5' }, { deviceLabel: 'Breathing Disturbances' }));
    expect(obs).toHaveLength(5);
    for (const o of obs) {
      expect(o.entryMethod).toBe('user-entered');
      expect(o.unit).toBe(METRIC_SPEC[o.metric].unit);
      expect(o.timestamp).toBe(NOW);
      expect(o.source).toBe('Example watch');
    }
    expect(obs.find((o) => o.metric === 'breathing-disturbances')?.deviceLabel).toBe('Breathing Disturbances');
    expect(obs.find((o) => o.metric === 'spo2-lowest')?.deviceLabel).toBe('');
    expect(new Set(obs.map((o) => o.id)).size).toBe(5);
  });
  it('has no score, status or colour field', () => {
    const o = ok(draft({ 'spo2-lowest': '90' }))[0]!;
    expect(Object.keys(o).sort()).toEqual(['deviceLabel', 'entryMethod', 'forDate', 'id', 'metric', 'source', 'timestamp', 'unit', 'value']);
  });
});

describe('validation', () => {
  it('allows empty fields but needs at least one reading', () => {
    expect(ok(draft({ 'resting-hr': '60' }))).toHaveLength(1);
    const r = validateDraft(draft({}), NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.form).toMatch(/at least one reading/i);
  });
  it('allows an empty device name and date', () => {
    const o = ok({ ...emptyWearableDraft(), values: { 'spo2-average': '94' } })[0]!;
    expect(o.source).toBe('');
    expect(o.forDate).toBeNull();
  });
  it('parses numbers, accepting a decimal comma', () => {
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('  ')).toBeNull();
    expect(parseNumber('7,5')).toBe(7.5);
    expect(parseNumber('abc')).toBeNaN();
    expect(parseNumber('9 4')).toBeNaN();
  });
  it('rejects implausible values with a friendly message', () => {
    expect(validateMetric('spo2-lowest', '40').error).toMatch(/percent from 50 to 100/);
    expect(validateMetric('spo2-lowest', '101').error).toBeTruthy();
    expect(validateMetric('spo2-average', '94.5').value).toBe(94.5);
    expect(validateMetric('resting-hr', '300').error).toMatch(/beats per minute/);
    expect(validateMetric('resting-hr', '58.5').error).toMatch(/whole number/);
    expect(validateMetric('sleep-duration', '30').error).toMatch(/hours/);
    expect(validateMetric('sleep-duration', '0').error).toBeTruthy();
    expect(validateMetric('breathing-disturbances', '-1').error).toBeTruthy();
    expect(validateMetric('resting-hr', 'sixty').error).toMatch(/type a number/i);
  });
  it('reports errors per field and stores nothing when any field is invalid', () => {
    const r = validateDraft(draft({ 'spo2-lowest': '12', 'resting-hr': '60' }), NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors)).toEqual(['spo2-lowest']);
  });
  it('validates dates: real, not in the future, empty allowed', () => {
    expect(validateDate('', '2026-06-10').value).toBeNull();
    expect(validateDate('2026-06-09', '2026-06-10').value).toBe('2026-06-09');
    expect(validateDate('2026-02-30', '2026-06-10').error).toMatch(/YYYY-MM-DD/);
    expect(validateDate('9 June', '2026-06-10').error).toBeTruthy();
    expect(validateDate('2026-06-11', '2026-06-10').error).toMatch(/future/);
  });
  it('cleans the device name and caps its length', () => {
    expect(ok(draft({ 'resting-hr': '60' }, { source: '  Ring\u0007   X  ' }))[0]!.source).toBe('Ring X');
    const r = validateDraft(draft({ 'resting-hr': '60' }, { source: 'x'.repeat(61) }), NOW);
    expect(r.ok).toBe(false);
  });
});

describe('list updaters and edit', () => {
  const [a, b] = ok(draft({ 'spo2-lowest': '91', 'resting-hr': '60' }));
  it('adds, replaces and removes without mutating', () => {
    const list = addObservations([], [a!, b!]);
    expect(list).toHaveLength(2);
    const e = validateEdit(a!, { ...draftFromObservation(a!), values: { 'spo2-lowest': '92' } }, '2026-06-10');
    expect(e.ok && e.observation.value).toBe(92);
    if (e.ok) {
      const next = replaceObservation(list, e.observation);
      expect(next.find((o) => o.id === a!.id)?.value).toBe(92);
      expect(list.find((o) => o.id === a!.id)?.value).toBe(91);
      expect(e.observation.entryMethod).toBe('user-entered');
      expect(e.observation.timestamp).toBe(a!.timestamp);
    }
    expect(removeObservation(list, a!.id).map((o) => o.id)).toEqual([b!.id]);
  });
  it('an edit cannot empty the value or break the range', () => {
    const e1 = validateEdit(a!, { ...draftFromObservation(a!), values: { 'spo2-lowest': '' } }, '2026-06-10');
    expect(e1.ok).toBe(false);
    const e2 = validateEdit(a!, { ...draftFromObservation(a!), values: { 'spo2-lowest': '500' } }, '2026-06-10');
    expect(e2.ok).toBe(false);
  });
});

describe('normalizeWearable (stored data)', () => {
  it('keeps valid entries and drops bad ones', () => {
    const good = ok(draft({ 'resting-hr': '60' }))[0]!;
    const out = normalizeWearable([good, good, { ...good, id: 'x', metric: 'bogus' }, { ...good, id: 'y', value: 9999 }, { ...good, id: 'z', timestamp: 'nope' }, null, 'str']);
    expect(out).toEqual([good]);
    expect(normalizeWearable(undefined)).toEqual([]);
    expect(normalizeWearable({})).toEqual([]);
  });
  it('forces entryMethod and unit back to the allowed values', () => {
    const good = ok(draft({ 'resting-hr': '60' }))[0]!;
    const [o] = normalizeWearable([{ ...good, entryMethod: 'imported', unit: 'furlongs', extra: 'x' }]);
    expect(o).toEqual(good);
  });
});

describe('summary section', () => {
  const obs = ok(draft({ 'spo2-lowest': '88', 'breathing-disturbances': '4', 'sleep-duration': '6.5' }, { deviceLabel: 'Breathing Disturbances', forDate: '2026-06-09' }));
  it('is labelled, lists the numbers as typed and ends with the neutral line', () => {
    const sec = wearableSection(obs);
    expect(sec.id).toBe('wearable');
    expect(sec.title).toBe('Wearable readings (user-entered)');
    expect(sec.source).toBe('wearable');
    expect(sec.text).toContain(WEARABLE_SOURCE_LABEL);
    expect(sec.text).toContain('Lowest overnight SpO2: 88%');
    expect(sec.text).toContain('Sleep duration (device): 6.5 h');
    expect(sec.text).toContain('device\'s label: "Breathing Disturbances"');
    expect(sec.text).toContain('for the night of 2026-06-09');
    expect(sec.text.trim().endsWith(WEARABLE_NEUTRAL_LINE)).toBe(true);
  });
  it('contains no interpretation words', () => {
    const t = wearableSummaryText(obs);
    expect(t).not.toMatch(/\b(normal|abnormal|low|high|good|poor|healthy|concerning|severe|risk|safe|diagnos\w*)\b/i);
  });
  it('says when nothing was entered and names an unnamed device', () => {
    expect(wearableSummaryText([])).toMatch(/No wearable readings/);
    expect(observationLine({ ...obs[0]!, source: '' })).toMatch(/device not named/);
  });
});
