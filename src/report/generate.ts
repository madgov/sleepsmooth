import {
  CLINICIAN_QUESTIONS,
  DISCLAIMER_AUDIO,
  DISCLAIMER_CANNOT_RULE_OUT,
  DISCLAIMER_NOT_DIAGNOSIS,
  NOSAS_CITATION,
  NOSAS_OUTSIDE_VALIDATION_NOTE,
  SUMMARY_NOT_PROVIDED,
  SUMMARY_SECTION_TITLES,
  SYMPTOM_NOT_VALIDATED,
  SYNTHETIC_PREFIX,
  RED_FLAG_QUESTION,
  NO_MODEL_LINE,
  SUMMARY_REGENERATE_CONFIRM,
  SAMPLE_AUDIO_NOT_USED,
} from '../content/claims';
import { activeInstrument } from '../questionnaire/registry';
import { FREQUENCY_LABELS, SYMPTOM_ITEMS, type SymptomAnswers } from '../questionnaire/symptomChecklist';
import type { AudioAnalysis } from '../types/audio';
import type { EvidenceSummary } from '../types/evidence';
import type { CareSummary, CareSummarySection } from '../types/report';
import type { AnswerValue } from '../types/questionnaire';

export interface ReportInput {
  answers: Record<string, AnswerValue>;
  symptoms: SymptomAnswers;
  redFlag: boolean | null;
  evidence: EvidenceSummary;
  audio: AudioAnalysis | null;
  isSynthetic: boolean;
  /** Set when the audio is the public sample recording rather than the user's own (Amendment 4). */
  audioSampleLabel?: string | null;
  /** ISO timestamp; passed in so the generator is deterministic. */
  generatedAt: string;
}

const bullets = (xs: string[]) => xs.map((x) => `- ${x}`).join('\n');

function reportedText(i: ReportInput): string {
  const lines = SYMPTOM_ITEMS.map((s) => {
    const f = i.symptoms[s.key];
    return `${s.text}: ${f ? FREQUENCY_LABELS[f].toLowerCase() : 'not answered'}`;
  });
  lines.push(`${RED_FLAG_QUESTION} ${i.redFlag === null ? 'not answered' : i.redFlag ? 'yes' : 'no'}`);
  return `Symptoms I reported (team-written checklist, ${SYMPTOM_NOT_VALIDATED.toLowerCase()}):\n${bullets(lines)}`;
}

function screeningText(i: ReportInput): string {
  const s = activeInstrument.score(i.answers);
  const head = s.total === null ? `${activeInstrument.title}: ${s.band}.` : `${activeInstrument.title}: ${s.total} of 17. ${s.band}.`;
  const note = s.explanation.includes(NOSAS_OUTSIDE_VALIDATION_NOTE) ? [] : [NOSAS_OUTSIDE_VALIDATION_NOTE];
  return [head, s.explanation, ...note, `Source: ${NOSAS_CITATION}`].join('\n');
}

function audioText(a: AudioAnalysis | null): string {
  if (!a || a.status !== 'done') return `${SUMMARY_NOT_PROVIDED} No recording was analyzed.\n${DISCLAIMER_CANNOT_RULE_OUT}`;
  const snore = a.windows.filter((w) => w.snoreLike).length;
  const lines = [
    `Recording length: ${Math.floor(a.quality.durationSec / 60)} min ${Math.round(a.quality.durationSec % 60)} s. Quality: ${a.quality.verdict}.`,
    ...a.quality.reasons,
  ];
  if (a.modelVersion === null) lines.push(NO_MODEL_LINE);
  else if (a.modelApplicable === false) lines.push('Snore-pattern model: not assessed - sound quality too limited for this model (e.g. phone-call quality)');
  else if (a.windows.length === 0) lines.push('Snore-pattern model: not assessed - no windows loud enough to assess');
  else lines.push(`Snore-like pattern observed in ${snore} of ${a.windows.length} analyzed windows.`);
  lines.push(`Windows too quiet to assess: ${a.quietWindowCount}.`);
  lines.push(`Quiet periods found by a loudness threshold: ${a.quietGaps.length}.`);
  return `${bullets(lines)}\n${DISCLAIMER_AUDIO}\n${DISCLAIMER_CANNOT_RULE_OUT}`;
}

function sampleLead(i: ReportInput): string {
  return i.audioSampleLabel && i.audio && !i.isSynthetic ? `${i.audioSampleLabel}. This is not the user's own recording. ${SAMPLE_AUDIO_NOT_USED}\n` : '';
}

function guidanceText(e: EvidenceSummary): string {
  const parts = [e.headline];
  if (e.redFlags.length) parts.push(e.redFlags.join(' '));
  if (e.conflicts.length) parts.push(e.conflicts.join(' '));
  if (e.missing.length) parts.push(`Missing information:\n${bullets(e.missing)}`);
  parts.push(`Uncertainty:\n${bullets(e.uncertaintyNotes)}`);
  return parts.join('\n');
}

/** Deterministic: same input, same output. Sections are separated by source. */
export function generateCareSummary(i: ReportInput): CareSummary {
  const syn = i.isSynthetic;
  const mk = (id: string, title: string, source: CareSummarySection['source'], text: string, synthetic: boolean): CareSummarySection => ({
    id,
    title,
    source,
    text: synthetic ? `${text.startsWith('- ') ? SYNTHETIC_PREFIX.trimEnd() + '\n' : SYNTHETIC_PREFIX}${text}` : text,
    ...(synthetic ? { isSynthetic: true } : {}),
  });
  const sections: CareSummarySection[] = [
    mk('reported', SUMMARY_SECTION_TITLES.reported, 'user-reported', reportedText(i), syn),
    mk('screening', SUMMARY_SECTION_TITLES.screening, 'user-reported', screeningText(i), syn),
    mk('audio', SUMMARY_SECTION_TITLES.audio, i.audio && i.audio.status === 'done' ? 'audio-observation' : 'missing', sampleLead(i) + audioText(i.audio), syn && !!i.audio),
    mk('guidance', SUMMARY_SECTION_TITLES.guidance, 'app-guidance', guidanceText(i.evidence), syn),
    mk('questions', SUMMARY_SECTION_TITLES.questions, 'app-guidance', bullets(CLINICIAN_QUESTIONS), false),
    mk('limits', SUMMARY_SECTION_TITLES.limits, 'app-guidance', [DISCLAIMER_NOT_DIAGNOSIS, DISCLAIMER_AUDIO, DISCLAIMER_CANNOT_RULE_OUT].join('\n'), false),
  ];
  return { sections, generatedAt: i.generatedAt, userEdited: false };
}

/**
 * Regenerate while respecting edits. `editedIds` are sections the user changed.
 * - No edits: the fresh summary is used.
 * - Edits and `overwriteEdited` false: edited sections keep their text, others refresh.
 * - Edits and `overwriteEdited` true: everything is replaced.
 * The UI must obtain confirmation (SUMMARY_REGENERATE_CONFIRM) before passing `overwriteEdited` true.
 */
export function regenerateSummary(
  current: CareSummary,
  fresh: CareSummary,
  editedIds: string[],
  overwriteEdited: boolean,
): { summary: CareSummary; editedIds: string[] } {
  if (editedIds.length === 0 || overwriteEdited) return { summary: fresh, editedIds: [] };
  const keep = new Map(current.sections.filter((s) => editedIds.includes(s.id)).map((s) => [s.id, s]));
  return {
    summary: { ...fresh, userEdited: true, sections: fresh.sections.map((s) => keep.get(s.id) ?? s) },
    editedIds,
  };
}

export { SUMMARY_REGENERATE_CONFIRM };
