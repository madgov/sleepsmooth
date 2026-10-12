// FROZEN CONTRACT (ER-4). Do not edit without orchestrator approval.

export interface Item {
  id: string;
  text: string;
  type: 'yesno' | 'number' | 'choice';
  options?: string[];
  required: boolean;
}

export type AnswerValue = string | number | boolean | null;

export interface InstrumentScore {
  /** null when incomplete (e.g. NoSAS without neck circumference). */
  total: number | null;
  complete: boolean;
  band: string;
  explanation: string;
}

export interface Instrument {
  id: string;
  version: string;
  title: string;
  citation: { text: string; url: string; verified: boolean };
  items: Item[];
  score(answers: Record<string, AnswerValue>): InstrumentScore;
  notDiagnostic: true;
}

export interface ScreeningResponse {
  instrumentId: string;
  version: string;
  answers: Record<string, AnswerValue>;
  completedAt?: string;
}

export type SymptomFrequency = 'never' | 'sometimes' | 'often' | 'nightly';

export interface SymptomEntry {
  key: string;
  frequency: SymptomFrequency;
  userReported: true;
}

export interface ConsentRecord {
  purpose: 'audio-local-analysis' | 'session-storage';
  granted: boolean;
  at: string;
}
