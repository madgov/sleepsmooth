// Per-section edits to the iPhone clinician summary. Pure (no React); the screen stores the result in settings.
//
// Model (matches the web summary, src/pages/Summary.tsx): only the sections the user edited are stored. Every other
// section is rebuilt from the current answers and recordings, so a saved summary never shows stale guidance.
//
// Safety:
//  - The disclaimer header ("Not a diagnosis"), the sources line and the footer disclaimer are NOT sections. They are added by
//    summaryToPlainText / summaryToHtml around the sections, so no edit can remove them.
//  - Inside a section, the "Source:" lines, the wearable neutral line and the sample-data label are locked. Only the lines between them can be edited.
//  - An edited section is marked "Edited by you" in its title, which flows into the shared text and the PDF.
import { WEARABLE_NEUTRAL_LINE } from '../content/wearable';
import { DISCUSS_SOURCE_LINE, NIGHT_SAMPLE_LABEL, SUMMARY_EDITED_MARKER } from '../content/claims';
import type { CareSummary, CareSummarySection } from '../types/report';

export const MAX_EDIT_CHARS = 4000;

export interface SectionEdit {
  /** The user's text for the editable part of the section. */
  text: string;
  /** The generated editable text at the time of the edit, to tell the user if the generated version has since changed. */
  base: string;
}

export interface SummaryEdits {
  v: 1;
  sections: Record<string, SectionEdit>;
}

export const emptySummaryEdits = (): SummaryEdits => ({ v: 1, sections: {} });

/** Lines the user cannot change: source citations and the sample-data label. */
export function isLockedLine(line: string): boolean {
  return line.startsWith('Source: ') || line === DISCUSS_SOURCE_LINE || line === WEARABLE_NEUTRAL_LINE || line.startsWith(NIGHT_SAMPLE_LABEL);
}

export interface SplitText {
  /** Locked lines before the editable part. */
  head: string[];
  /** The editable lines. */
  body: string;
  /** Locked lines after the editable part. */
  tail: string[];
}

export function splitSectionText(text: string): SplitText {
  const lines = text.split('\n');
  let a = 0;
  while (a < lines.length && isLockedLine(lines[a] as string)) a++;
  let b = lines.length;
  while (b > a && isLockedLine(lines[b - 1] as string)) b--;
  return { head: lines.slice(0, a), body: lines.slice(a, b).join('\n'), tail: lines.slice(b) };
}

/** Normalizes stored data. Anything malformed is dropped rather than shown. */
export function normalizeSummaryEdits(raw: unknown): SummaryEdits {
  const out = emptySummaryEdits();
  if (!raw || typeof raw !== 'object') return out;
  const s = (raw as { sections?: unknown }).sections;
  if (!s || typeof s !== 'object') return out;
  for (const [id, v] of Object.entries(s as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue;
    const { text, base } = v as { text?: unknown; base?: unknown };
    if (typeof text !== 'string' || typeof base !== 'string' || text.trim() === '' || text.length > MAX_EDIT_CHARS) continue;
    out.sections[id] = { text, base };
  }
  return out;
}

export type EditCheck = { ok: true } | { ok: false; reason: string };

export function checkEditText(text: string): EditCheck {
  if (text.trim() === '') return { ok: false, reason: "A section can't be empty. Use Reset to generated to go back to the original." };
  if (text.length > MAX_EDIT_CHARS) return { ok: false, reason: `That is longer than ${MAX_EDIT_CHARS} characters. Please shorten it.` };
  return { ok: true };
}

/** Saves an edit. Text identical to the generated text is not an edit, so it clears any stored one. Invalid text changes nothing. */
export function saveSectionEdit(edits: SummaryEdits, id: string, text: string, generatedFullText: string): SummaryEdits {
  if (!checkEditText(text).ok) return edits;
  const base = splitSectionText(generatedFullText).body;
  if (text === base) return resetSectionEdit(edits, id);
  return { v: 1, sections: { ...edits.sections, [id]: { text, base } } };
}

export function resetSectionEdit(edits: SummaryEdits, id: string): SummaryEdits {
  if (!(id in edits.sections)) return edits;
  const { [id]: _removed, ...rest } = edits.sections;
  void _removed;
  return { v: 1, sections: rest };
}

export const resetAllEdits = (): SummaryEdits => emptySummaryEdits();

export interface AppliedSummary {
  /** The summary to display, share and print. Edited sections carry "(Edited by you)" in the title. */
  summary: CareSummary;
  editedIds: string[];
  /** Edited sections whose generated text has changed since the edit (inputs changed). */
  staleIds: string[];
}

export const editedTitle = (title: string): string => `${title} (${SUMMARY_EDITED_MARKER})`;

export function applyEdits(generated: CareSummary, edits: SummaryEdits): AppliedSummary {
  const editedIds: string[] = [];
  const staleIds: string[] = [];
  const sections: CareSummarySection[] = generated.sections.map((sec) => {
    const e = edits.sections[sec.id];
    if (!e) return sec;
    const parts = splitSectionText(sec.text);
    editedIds.push(sec.id);
    if (parts.body !== e.base) staleIds.push(sec.id);
    return { ...sec, title: editedTitle(sec.title), text: [...parts.head, e.text, ...parts.tail].join('\n') };
  });
  return { summary: { ...generated, sections, userEdited: editedIds.length > 0 || generated.userEdited }, editedIds, staleIds };
}
