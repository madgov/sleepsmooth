import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DISCLAIMER_NOT_DIAGNOSIS, NOSAS_CITATION, SUMMARY_EDITED_MARKER, SUMMARY_PRINT_NOT_DIAGNOSIS, SUMMARY_PRINT_SOURCES } from '../content/claims';
import { buildSampleNightView } from '../night';
import {
  applyEdits,
  checkEditText,
  emptySummaryEdits,
  isLockedLine,
  normalizeSummaryEdits,
  resetAllEdits,
  resetSectionEdit,
  saveSectionEdit,
  splitSectionText,
  MAX_EDIT_CHARS,
} from './summaryEdits';
import { buildSummary, summaryToHtml, summaryToPlainText } from './summaryText';

const base = { answers: {}, symptoms: {}, redFlag: null, generatedAtISO: '2026-01-16T08:00:00.000Z', realNights: [] };
const built = () => buildSummary(base);
const text = (id: string) => built().summary.sections.find((s) => s.id === id)?.text ?? '';

describe('summary edits', () => {
  it('an edit replaces the editable lines only and is marked "Edited by you" in text and PDF html', () => {
    const b = built();
    const edits = saveSectionEdit(emptySummaryEdits(), 'reported', 'My own words about my symptoms.', text('reported'));
    const a = applyEdits(b.summary, edits);
    expect(a.editedIds).toEqual(['reported']);
    expect(a.summary.userEdited).toBe(true);
    const plain = summaryToPlainText(a.summary, false);
    expect(plain).toContain('My own words about my symptoms.');
    expect(plain).toContain(`WHAT I REPORTED (${SUMMARY_EDITED_MARKER.toUpperCase()})`);
    expect(summaryToHtml(a.summary, false)).toContain(`(${SUMMARY_EDITED_MARKER})`);
    // untouched sections are not marked
    expect(plain).not.toContain(`QUESTIONS FOR MY CLINICIAN (${SUMMARY_EDITED_MARKER.toUpperCase()})`);
  });

  it('source lines inside a section are locked and survive any edit', () => {
    const gen = text('screening');
    const sp = splitSectionText(gen);
    expect(sp.tail.some((l) => l.startsWith('Source: '))).toBe(true);
    const edits = saveSectionEdit(emptySummaryEdits(), 'screening', 'Totally rewritten.', gen);
    const out = applyEdits(built().summary, edits).summary.sections.find((s) => s.id === 'screening')?.text ?? '';
    expect(out).toContain(`Source: ${NOSAS_CITATION}`);
    expect(out).toContain('Totally rewritten.');
    // pasting a fake source line into the edit does not change which lines are locked
    expect(isLockedLine('Source: anything')).toBe(true);
  });

  it('the disclaimer header, sources line and footer are not sections, so no edit can remove them', () => {
    const b = built();
    let edits = emptySummaryEdits();
    for (const s of b.summary.sections) edits = saveSectionEdit(edits, s.id, 'x', s.text);
    const a = applyEdits(b.summary, edits);
    expect(a.editedIds.length).toBe(b.summary.sections.length);
    const plain = summaryToPlainText(a.summary, false);
    expect(plain.split('\n').slice(0, 3).join('\n')).toContain(SUMMARY_PRINT_NOT_DIAGNOSIS);
    expect(plain).toContain(`${SUMMARY_PRINT_SOURCES}: ${NOSAS_CITATION}`);
    expect(plain.trimEnd().endsWith(DISCLAIMER_NOT_DIAGNOSIS)).toBe(true);
    expect(summaryToHtml(a.summary, false)).toContain(SUMMARY_PRINT_NOT_DIAGNOSIS);
    // no section id can carry the header or footer
    expect(b.summary.sections.map((s) => s.id)).not.toContain('disclaimer');
  });

  it('the sample-data label in the nights section is locked', () => {
    const sample = buildSampleNightView('snore-episodes');
    const b = buildSummary({ ...base, sampleNight: sample });
    const gen = b.summary.sections.find((s) => s.id === 'nights')?.text ?? '';
    const edits = saveSectionEdit(emptySummaryEdits(), 'nights', 'my note', gen);
    const out = applyEdits(b.summary, edits).summary.sections.find((s) => s.id === 'nights')?.text ?? '';
    expect(out).toMatch(/^Sample night \(synthetic\)/);
  });

  it('empty or oversized text is rejected and changes nothing', () => {
    expect(checkEditText('   ').ok).toBe(false);
    expect(checkEditText('x'.repeat(MAX_EDIT_CHARS + 1)).ok).toBe(false);
    const e = emptySummaryEdits();
    expect(saveSectionEdit(e, 'reported', '  ', text('reported'))).toBe(e);
  });

  it('saving the generated text again is not an edit; Reset removes one', () => {
    const gen = text('questions');
    const body = splitSectionText(gen).body;
    const e1 = saveSectionEdit(emptySummaryEdits(), 'questions', 'changed', gen);
    expect(Object.keys(e1.sections)).toEqual(['questions']);
    expect(Object.keys(saveSectionEdit(e1, 'questions', body, gen).sections)).toEqual([]);
    expect(Object.keys(resetSectionEdit(e1, 'questions').sections)).toEqual([]);
    expect(resetAllEdits()).toEqual(emptySummaryEdits());
  });

  it('edits survive a save and reload (JSON round trip through the settings merge) and malformed data is dropped', () => {
    const e = saveSectionEdit(emptySummaryEdits(), 'reported', 'kept across launches', text('reported'));
    const reloaded = normalizeSummaryEdits(JSON.parse(JSON.stringify({ summaryEdits: e })).summaryEdits);
    expect(reloaded).toEqual(e);
    expect(normalizeSummaryEdits({ sections: { a: { text: 5, base: 'x' }, b: 'nope', c: { text: '', base: '' } } })).toEqual(emptySummaryEdits());
    expect(normalizeSummaryEdits(null)).toEqual(emptySummaryEdits());
  });

  it('an edit is flagged when the generated text later changes, and is never silently dropped', () => {
    const e = saveSectionEdit(emptySummaryEdits(), 'reported', 'mine', text('reported'));
    const changed = buildSummary({ ...base, symptoms: { snoring: 'every-night' } as never, redFlag: true });
    const a = applyEdits(changed.summary, e);
    expect(a.editedIds).toEqual(['reported']);
    expect(a.staleIds).toEqual(['reported']);
    expect(applyEdits(built().summary, e).staleIds).toEqual([]);
  });

  it('settings persist the edits and "Delete my data" resets them (source check; the native file store is not testable here)', () => {
    const src = readFileSync(join(process.cwd(), 'mobile/src/state/settings.ts'), 'utf8');
    expect(src).toMatch(/summaryEdits: emptySummaryEdits\(\)/);
    expect(src).toMatch(/summaryEdits: normalizeSummaryEdits\(r\.summaryEdits\)/);
    // deleteAllSettings removes the file and resets the snapshot to defaultSettings(), which holds empty edits
    expect(src).toMatch(/export function deleteAllSettings[\s\S]*settings: defaultSettings\(\)/);
  });
});
