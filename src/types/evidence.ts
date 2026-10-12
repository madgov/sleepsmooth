// FROZEN CONTRACT (ER-4). Do not edit without orchestrator approval.
import type { AudioAnalysis } from './audio';

export type Source = 'user-reported' | 'audio-observation' | 'wearable' | 'missing' | 'app-guidance';
export type EvidenceState = 'present' | 'absent-unreliable' | 'inconclusive' | 'missing' | 'conflict';

export interface EvidenceItem {
  id: string;
  source: Source;
  label: string;
  detail: string;
  state: EvidenceState;
  isSynthetic: boolean;
  limitations: string[];
  citation?: string;
}

// No "low risk" value exists by design.
export type Conclusion = 'discuss-with-clinician' | 'inconclusive' | 'not-enough-information';

export interface EvidenceSummary {
  conclusion: Conclusion;
  headline: string;
  items: EvidenceItem[];
  missing: string[];
  conflicts: string[];
  redFlags: string[];
  uncertaintyNotes: string[];
  // No probability / severity / score field, by type.
}

// ER-3 rules-engine input enums (Agent A implements the rules).
export type NoSasState = 'atOrAbove' | 'below' | 'incompleteBelow' | 'notAnswered';
export type SymptomBurden = 'high' | 'some' | 'none' | 'notAnswered';
export type AudioEvidenceState =
  | 'notProvided'
  | 'unusable'
  | 'usableFewObservations'
  | 'usableSnoreLikeObserved'
  | 'noModel'
  | 'modelNotApplicable';

export interface RulesInput {
  noSas: NoSasState;
  symptoms: SymptomBurden;
  redFlagPresent: boolean;
  audio: AudioEvidenceState;
  /** Optional: the analysis the audio state was derived from. */
  audioAnalysis?: AudioAnalysis;
  isSynthetic: boolean;
}
