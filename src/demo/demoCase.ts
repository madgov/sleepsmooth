// SYNTHETIC / ILLUSTRATIVE demo case ("Dana"). Nothing here is real user data or real model output.
// Every exported object carries isSynthetic: true (Amendment 4).
import type { AudioAnalysis, QuietGap, WindowObs } from '../types/audio';
import type { RulesInput } from '../types/evidence';
import type { AnswerValue, ScreeningResponse, SymptomEntry } from '../types/questionnaire';
import { WINDOW_HOP_SEC, WINDOW_SEC } from '../audio/constants';

export const DEMO_PERSON = 'Dana';
export const DEMO_LABEL = 'Synthetic / illustrative';
export const DEMO_AUDIO_LABEL = 'Sample audio assembled from public ESC-50 clips';

/** NoSAS items. Neck circumference is "I don't know" (null), so the score is incomplete. */
export const demoNoSasAnswers: Record<string, AnswerValue> = {
  age: 48,
  sex: 'female',
  bmi: 27,
  snoring: true,
  neck: null,
};

export const demoScreeningResponse: ScreeningResponse & { isSynthetic: true } = {
  instrumentId: 'nosas',
  version: '1',
  answers: demoNoSasAnswers,
  completedAt: '2026-01-01T00:00:00.000Z',
  isSynthetic: true,
};

/** Team-written symptom checklist entries (user-reported). Two core items rated often => symptoms "high". */
export const demoSymptoms: (SymptomEntry & { isSynthetic: true })[] = [
  { key: 'daytime-sleepiness', frequency: 'often', userReported: true, isSynthetic: true },
  { key: 'unrefreshing-sleep', frequency: 'often', userReported: true, isSynthetic: true },
  { key: 'loud-snoring', frequency: 'sometimes', userReported: true, isSynthetic: true },
  { key: 'choking-gasping', frequency: 'never', userReported: true, isSynthetic: true },
  { key: 'noticed-breathing-pauses', frequency: 'never', userReported: true, isSynthetic: true },
  { key: 'morning-headaches', frequency: 'never', userReported: true, isSynthetic: true },
];

// Deterministic synthetic audio summary: 120 s, no randomness.
const DURATION = 120;
const loudness: number[] = Array.from({ length: DURATION }, (_, i) => {
  const base = -38 + 4 * Math.sin(i / 7) + 2 * Math.sin(i / 2.3);
  return Math.round(base * 10) / 10;
});

const quietGaps: QuietGap[] = [
  { t0: 31, t1: 42, durSec: 11 },
  { t0: 88, t1: 97, durSec: 9 },
];
for (const g of quietGaps) for (let t = g.t0; t < g.t1; t++) loudness[t] = -66 + (t % 3);

const SNORE_STARTS = new Set([14, 15, 63]);
const windows: WindowObs[] = [];
for (let t0 = 0; t0 + WINDOW_SEC <= DURATION; t0 += WINDOW_HOP_SEC) {
  const quiet = quietGaps.some((g) => t0 >= g.t0 && t0 + WINDOW_SEC <= g.t1);
  const snoreLike = !quiet && SNORE_STARTS.has(Math.floor(t0)) && t0 % 1 === 0;
  windows.push({ t0, t1: t0 + WINDOW_SEC, snoreLike, score: snoreLike ? 0.8 : quiet ? 0 : 0.1 });
}
const quietWindowCount = windows.filter((w) => w.score === 0).length;
const assessable = windows.length - quietWindowCount;
const snoreCount = windows.filter((w) => w.snoreLike).length;

export const demoAudioAnalysis: AudioAnalysis = {
  status: 'done',
  quality: {
    durationSec: DURATION,
    clippingPct: 0,
    noiseFloorDb: -62,
    silenceRatio: 0.17,
    verdict: 'usable',
    reasons: ['Synthetic example values for illustration only.'],
  },
  loudness,
  windows,
  snoreLikeFraction: snoreCount / assessable,
  modelApplicable: true,
  quietWindowCount,
  quietGaps,
  modelVersion: 'synthetic-demo-0 (illustrative, not a trained model)',
  isSynthetic: true,
  limitations: [
    DEMO_LABEL + ': this analysis was precomputed for the demo, not produced from a real recording.',
    'Audio analysis looks at sound patterns only. It does not measure airflow.',
    'A quiet recording cannot rule out sleep apnea.',
  ],
};

/** Inputs the rules engine should receive for the demo (ER-3). */
export const demoRulesInput: RulesInput = {
  noSas: 'incompleteBelow',
  symptoms: 'high',
  redFlagPresent: false,
  audio: 'usableFewObservations',
  audioAnalysis: demoAudioAnalysis,
  isSynthetic: true,
};

export const demoCase = {
  person: DEMO_PERSON,
  isSynthetic: true as const,
  screening: demoScreeningResponse,
  symptoms: demoSymptoms,
  audio: demoAudioAnalysis,
  rulesInput: demoRulesInput,
};

