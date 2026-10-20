// Clinician summary for the phone: built from the shared report generator, never from new rules.
// Pure TypeScript. The screens only display and share what this returns.
import {
  AUDIO_DETAIL,
  DISCLAIMER_NOT_DIAGNOSIS,
  MODEL_NOT_APPLICABLE,
  NIGHT_SAMPLE_LABEL,
  SAMPLE_AUDIO_NOT_USED,
  SUMMARY_GENERATED_NOTE,
  SUMMARY_PRINT_NOT_DIAGNOSIS,
  SUMMARY_PRINT_SOURCES,
  SUMMARY_PRINT_TITLE,
  NOSAS_CITATION,
} from '../content/claims';
import { evaluate } from '../evidence/engine';
import { nightRulesInput } from '../night';
import type { NightAudioState, NightView } from '../night';
import { generateCareSummary } from '../report/generate';
import type { PartnerObservations } from '../questionnaire/partner';
import type { WearableObservation } from '../types/wearable';
import type { SymptomAnswers } from '../questionnaire/symptomChecklist';
import type { CareSummary, CareSummarySection } from '../types/report';
import type { AnswerValue } from '../types/questionnaire';
import { formatClock, formatDuration } from './index';

export interface SummaryArgs {
  answers: Record<string, AnswerValue>;
  symptoms: SymptomAnswers;
  redFlag: boolean | null;
  /** Optional bed-partner observations (user-reported, not scored). */
  partner?: PartnerObservations | null;
  /** Optional user-entered wearable readings (not scored). */
  wearable?: readonly WearableObservation[] | null;
  /** Real nights, newest first. */
  realNights: readonly NightView[];
  /** A sample night, included only when the user asks to preview with it. It is labelled everywhere it appears. */
  sampleNight?: NightView | null;
  generatedAtISO: string;
}

export interface BuiltSummary {
  summary: CareSummary;
  /** True when the only night in the summary is the labelled sample. */
  sampleOnly: boolean;
}

function stateLine(s: NightAudioState): string {
  switch (s) {
    case 'snore-like-observed': return AUDIO_DETAIL.usableSnoreLikeObserved;
    case 'few-observations': return AUDIO_DETAIL.usableFewObservations;
    case 'not-assessed': return 'Not assessed (recording quality or length)';
    case 'model-not-applicable': return MODEL_NOT_APPLICABLE;
    case 'no-model': return AUDIO_DETAIL.noModel;
    case 'not-recorded': return AUDIO_DETAIL.notProvided;
  }
}

const minutes = (sec: number) => Math.round(sec / 60);

/** One line per night. The estimate is the unvalidated sleep-window estimate, labelled as such. */
export function nightLine(v: NightView): string {
  const s = v.summary;
  const utc = s.isSynthetic;
  const d = new Date(v.record.captureStart);
  const date = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', ...(utc ? { timeZone: 'UTC' } : {}) });
  const mod = (ms: number) => {
    const x = new Date(ms);
    return utc ? x.getUTCHours() * 60 + x.getUTCMinutes() : x.getHours() * 60 + x.getMinutes();
  };
  const win = s.estimatedWindow ? `estimated sleep window (unvalidated) ${formatClock(mod(s.estimatedWindow.start))} to ${formatClock(mod(s.estimatedWindow.end))}` : 'no sleep-window estimate';
  const assessed = `assessed ${formatDuration(minutes(s.assessedSec))}`;
  return `${s.isSynthetic ? 'Sample data. ' : ''}${date}: recorded ${formatDuration(minutes(s.recordedSec))}, ${win}, ${assessed}. ${stateLine(s.nightState)}`;
}

export function buildSummary(a: SummaryArgs): BuiltSummary {
  const views = a.realNights.length > 0 ? [...a.realNights] : a.sampleNight ? [a.sampleNight] : [];
  const sampleOnly = a.realNights.length === 0 && !!a.sampleNight;
  const screening = { answers: a.answers, symptoms: a.symptoms, redFlag: a.redFlag, isSynthetic: false };
  const { input, context, analysis } = nightRulesInput(screening, views);
  const evidence = evaluate(input, context);
  const base = generateCareSummary({
    answers: a.answers,
    symptoms: a.symptoms,
    redFlag: a.redFlag,
    partner: a.partner,
    wearable: a.wearable,
    evidence,
    audio: analysis,
    isSynthetic: sampleOnly,
    audioSampleLabel: sampleOnly ? NIGHT_SAMPLE_LABEL : null,
    generatedAt: a.generatedAtISO,
  });
  const nightsText = views.length === 0 ? 'No recorded nights. Not provided.' : views.map((v) => `- ${nightLine(v)}`).join('\n');
  const nights: CareSummarySection = {
    id: 'nights',
    title: 'Recorded nights',
    source: views.length === 0 ? 'missing' : 'audio-observation',
    text: sampleOnly ? `${NIGHT_SAMPLE_LABEL} ${SAMPLE_AUDIO_NOT_USED}\n${nightsText}` : nightsText,
    ...(sampleOnly ? { isSynthetic: true } : {}),
  };
  const at = base.sections.findIndex((s) => s.id === 'audio');
  const sections = [...base.sections.slice(0, at + 1), nights, ...base.sections.slice(at + 1)];
  return { summary: { ...base, sections }, sampleOnly };
}

/** Plain text for the iOS share sheet. Always starts with the not-a-diagnosis statement. */
export function summaryToPlainText(s: CareSummary, sampleOnly: boolean, extraLabels: readonly string[] = []): string {
  const head = [SUMMARY_PRINT_TITLE, SUMMARY_PRINT_NOT_DIAGNOSIS, ...(sampleOnly ? [NIGHT_SAMPLE_LABEL] : []), ...extraLabels, SUMMARY_GENERATED_NOTE, `Generated: ${s.generatedAt}`];
  const body = s.sections.map((x) => `${x.title.toUpperCase()}\n${x.text}`);
  return [...head, '', body.join('\n\n'), '', `${SUMMARY_PRINT_SOURCES}: ${NOSAS_CITATION}`, '', DISCLAIMER_NOT_DIAGNOSIS].join('\n');
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** HTML for expo-print (PDF). Same content as the text version. */
export function summaryToHtml(s: CareSummary, sampleOnly: boolean): string {
  const sec = s.sections
    .map((x) => `<h2>${esc(x.title)}</h2>${x.text.split('\n').map((l) => `<p>${esc(l)}</p>`).join('')}`)
    .join('');
  return `<html><head><meta charset="utf-8"><style>body{font-family:-apple-system,Helvetica,sans-serif;padding:24px;color:#1a2230}h1{font-size:20px}h2{font-size:15px;margin-top:20px}p{font-size:12px;line-height:1.45;margin:4px 0}.nd{border:1px solid #888;padding:8px;font-weight:600}</style></head><body><h1>${esc(SUMMARY_PRINT_TITLE)}</h1><p class="nd">${esc(SUMMARY_PRINT_NOT_DIAGNOSIS)}</p>${sampleOnly ? `<p class="nd">${esc(NIGHT_SAMPLE_LABEL)}</p>` : ''}<p>${esc(SUMMARY_GENERATED_NOTE)}</p>${sec}<p>${esc(SUMMARY_PRINT_SOURCES)}: ${esc(NOSAS_CITATION)}</p><p>${esc(DISCLAIMER_NOT_DIAGNOSIS)}</p></body></html>`;
}
