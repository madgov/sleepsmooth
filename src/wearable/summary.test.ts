import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluate } from '../evidence/engine';
import { buildRulesInput } from '../evidence/input';
import { generateCareSummary, type ReportInput } from '../report/generate';
import { buildSampleNightView } from '../night';
import { buildSummary, summaryToPlainText } from '../mobileLogic/summaryText';
import { buildTestLog } from '../mobileLogic/exportLog';
import { WEARABLE_NEUTRAL_LINE, WEARABLE_SOURCE_LABEL } from '../content/wearable';
import { emptyWearableDraft, validateDraft } from './entries';

const NOW = '2026-06-10T07:00:00.000Z';
const readings = (() => {
  const r = validateDraft({ ...emptyWearableDraft(), source: 'Example ring', forDate: '2026-06-09', values: { 'spo2-lowest': '89', 'resting-hr': '57' } }, NOW);
  if (!r.ok) throw new Error('invalid');
  return r.observations;
})();

function reportInput(wearable?: ReportInput['wearable']): ReportInput {
  const screening = { answers: {}, symptoms: {}, redFlag: null, isSynthetic: false };
  const { input, context } = buildRulesInput(screening, null);
  return { ...screening, wearable, evidence: evaluate(input, context), audio: null, isSynthetic: false, generatedAt: NOW };
}

describe('clinician summary: wearable section', () => {
  it('is omitted when there are no readings, so existing summaries do not change', () => {
    expect(generateCareSummary(reportInput()).sections.map((s) => s.id)).not.toContain('wearable');
    expect(generateCareSummary(reportInput([])).sections.map((s) => s.id)).not.toContain('wearable');
  });
  it('is added with the user-entered title and the wearable source tag, before screening', () => {
    const s = generateCareSummary(reportInput(readings));
    const ids = s.sections.map((x) => x.id);
    expect(ids.indexOf('wearable')).toBeGreaterThan(ids.indexOf('reported'));
    expect(ids.indexOf('wearable')).toBeLessThan(ids.indexOf('screening'));
    const sec = s.sections.find((x) => x.id === 'wearable')!;
    expect(sec.title).toBe('Wearable readings (user-entered)');
    expect(sec.source).toBe('wearable');
    expect(sec.isSynthetic).toBeUndefined();
    expect(sec.text).toContain('Lowest overnight SpO2: 89%');
    expect(sec.text).toContain('Resting heart rate: 57 bpm');
  });
  it('flows through the iPhone summary and its share text', () => {
    const built = buildSummary({ answers: {}, symptoms: {}, redFlag: null, wearable: readings, realNights: [], sampleNight: buildSampleNightView('snore-episodes'), generatedAtISO: NOW });
    const text = summaryToPlainText(built.summary, built.sampleOnly);
    expect(text).toContain('WEARABLE READINGS (USER-ENTERED)');
    expect(text).toContain(WEARABLE_SOURCE_LABEL);
    expect(text).toContain(WEARABLE_NEUTRAL_LINE);
    const without = buildSummary({ answers: {}, symptoms: {}, redFlag: null, realNights: [], generatedAtISO: NOW });
    expect(without.summary.sections.map((s) => s.id)).not.toContain('wearable');
  });
});

describe('export test log', () => {
  const base = { exportedAtMs: 0, app: { version: '1', deviceModel: 'x', os: '1' }, nights: [] };
  it('includes the readings with the not-checked label, and omits the key when empty', () => {
    const log = buildTestLog({ ...base, wearable: readings }) as { wearableReadings?: { note: string; entries: unknown[] } };
    expect(log.wearableReadings?.note).toBe(WEARABLE_SOURCE_LABEL);
    expect(log.wearableReadings?.entries).toHaveLength(2);
    expect('wearableReadings' in buildTestLog({ ...base, wearable: [] })).toBe(false);
    expect('wearableReadings' in buildTestLog(base)).toBe(false);
  });
});

describe('iPhone wiring (source checks; the settings module needs expo-file-system)', () => {
  const read = (p: string) => readFileSync(p, 'utf8');
  const settings = read('mobile/src/state/settings.ts');
  it('settings defaults hold no readings and no consent history, and "Delete my data" resets to the defaults', () => {
    expect(settings).toMatch(/wearable: \[\],\n\}\);/);
    expect(settings).toMatch(/consentHistory: \[\]/);
    expect(settings).toMatch(/export function deleteAllSettings[\s\S]*?settings: defaultSettings\(\)/);
    expect(settings).toMatch(/wearable: normalizeWearable\(r\.wearable\)/);
    expect(settings).toMatch(/mergeConsentFields\(r, CONSENT_PURPOSE, CONSENT_VERSION\)/);
  });
  it('the delete flow calls deleteAllSettings and the confirm text names the new data', () => {
    expect(read('mobile/app/(tabs)/settings.tsx')).toMatch(/deleteAllSettings\(\) && storeOk/);
    expect(read('mobile/src/content/copy.ts')).toMatch(/N75_DELETE_CONFIRM: '[^']*wearable readings[^']*consent history/);
  });
  it('every place that changes the overnight consent goes through setOvernightConsent', () => {
    for (const f of ['mobile/app/consent.tsx', 'mobile/app/start-sheet.tsx', 'mobile/app/(tabs)/settings.tsx']) {
      expect(read(f), f).toMatch(/setOvernightConsent\(/);
      expect(read(f), f).not.toMatch(/consent: \{ \.\.\.p\.consent/);
    }
  });
  it('the test-log export passes the readings', () => {
    expect(read('mobile/src/diagnostics/exportTestLog.ts')).toMatch(/wearable: getSettings\(\)\.wearable/);
  });
});

import { applyEdits, emptySummaryEdits, saveSectionEdit, splitSectionText } from '../mobileLogic/summaryEdits';

describe('summary editor and the wearable section', () => {
  const built = () => buildSummary({ answers: {}, symptoms: {}, redFlag: null, wearable: readings, realNights: [], generatedAtISO: NOW }).summary;
  const sec = () => built().sections.find((s) => s.id === 'wearable')!;
  it('locks the label line and the neutral line, and leaves the readings editable', () => {
    const p = splitSectionText(sec().text);
    expect(p.head).toEqual([`Source: ${WEARABLE_SOURCE_LABEL}`]);
    expect(p.tail).toEqual([WEARABLE_NEUTRAL_LINE]);
    expect(p.body).toContain('Lowest overnight SpO2: 89%');
    expect(p.body).not.toContain(WEARABLE_SOURCE_LABEL);
  });
  it('an edit keeps both lines and marks the section as edited', () => {
    const edits = saveSectionEdit(emptySummaryEdits(), 'wearable', '- Lowest overnight SpO2: 89% (my own note)', sec().text);
    const applied = applyEdits(built(), edits);
    const out = applied.summary.sections.find((s) => s.id === 'wearable')!;
    expect(applied.editedIds).toEqual(['wearable']);
    expect(out.title).toMatch(/Edited by you/);
    expect(out.text).toContain('my own note');
    expect(out.text.startsWith(`Source: ${WEARABLE_SOURCE_LABEL}`)).toBe(true);
    expect(out.text.endsWith(WEARABLE_NEUTRAL_LINE)).toBe(true);
  });
  it('is stale-flagged when the readings change after an edit', () => {
    const edits = saveSectionEdit(emptySummaryEdits(), 'wearable', 'my text', sec().text);
    const r = validateDraft({ ...emptyWearableDraft(), values: { 'resting-hr': '70' } }, NOW);
    if (!r.ok) throw new Error('x');
    const changed = buildSummary({ answers: {}, symptoms: {}, redFlag: null, wearable: r.observations, realNights: [], generatedAtISO: NOW }).summary;
    expect(applyEdits(changed, edits).staleIds).toEqual(['wearable']);
  });
});
