// Clinician conversation script: a few sentences built from the user's own data. Pure TypeScript, shared by web and iOS.
// Reads only the same inputs the summary reads (symptom answers, red-flag answer, nights). It does not call or change the summary generators.
// Labelled in the UI as a suggested starting point, not validated.
import { FREQUENCY_LABELS, SYMPTOM_ITEMS, type SymptomAnswers } from '../questionnaire/symptomChecklist';

export interface ScriptInput {
  symptoms: SymptomAnswers;
  /** Answer to "fallen asleep, or nearly, while driving"; null = not answered. */
  redFlag: boolean | null;
  /** True when the user answered any NoSAS item. */
  questionnaireAnswered: boolean;
  /** Real recordings only: how many nights, and on how many a snore-like pattern was observed. */
  recordedNights: number;
  snoreLikeNights: number;
  /** True when the data is the labelled synthetic example, not the user's. */
  sample?: boolean;
}

export interface BuiltScript {
  lines: string[];
  /** Number of facts drawn from the user's data (0 = generic opener only). */
  factCount: number;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Symptoms the user marked anything other than "never", in the checklist's own first-person wording. */
export function reportedSymptoms(a: SymptomAnswers): string[] {
  return SYMPTOM_ITEMS.flatMap((i) => {
    const f = a[i.key];
    return f && f !== 'never' ? [`${i.text} (${FREQUENCY_LABELS[f].toLowerCase()})`] : [];
  });
}

export function buildClinicianScript(i: ScriptInput): BuiltScript {
  const lines: string[] = [];
  let facts = 0;
  if (i.sample) lines.push('Sample data (made-up example, not a real person).');
  lines.push('Hello. I would like to talk about my sleep and whether an evaluation for sleep apnea makes sense for me.');

  const sym = reportedSymptoms(i.symptoms);
  if (sym.length > 0) {
    facts += sym.length;
    lines.push(`What I have noticed, in my own words from a checklist: ${sym.join('; ')}.`);
  } else {
    lines.push('I would like to describe what I have noticed myself: ____.');
  }
  if (i.redFlag === true) {
    facts += 1;
    lines.push('I have fallen asleep, or nearly fallen asleep, while driving.');
  }
  if (i.questionnaireAnswered) {
    facts += 1;
    lines.push('I answered a short screening questionnaire (NoSAS) in an app. It cannot confirm or rule out sleep apnea, so I am not relying on it.');
  }
  if (i.recordedNights > 0) {
    facts += 1;
    const seen = i.snoreLikeNights > 0 ? `A snore-like sound pattern was observed on ${plural(i.snoreLikeNights, 'night', 'nights')}.` : 'No snore-like pattern was observed, which does not rule anything out.';
    lines.push(`I used a phone app to record ${plural(i.recordedNights, 'night', 'nights')}. ${seen} The app picks up sound patterns only; it does not measure breathing.`);
  }
  lines.push('Could we talk about whether a home sleep test or a sleep study at a sleep centre fits me, what it would cost, and how long the wait is?');
  return { lines, factCount: facts };
}

export const scriptToText = (b: BuiltScript): string => b.lines.join('\n\n');
