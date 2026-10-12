// Builds the evidence summary from stored answers by calling the shared evidence engine via @core.
// No conclusion, threshold, or score is computed in this file or in any UI component.
import { useMemo } from 'react';
import { nightRulesInput } from '@core/night';
import { evaluate } from '@core/evidence/engine';
import type { EvidenceItem, EvidenceSummary } from '@core/types/evidence';
import type { NightListItem } from '../data/nightSource';
import type { Settings } from './settings';

export const hasAnyAnswers = (s: Settings): boolean => Object.keys(s.answers).length > 0 || Object.keys(s.symptoms).length > 0 || s.redFlag !== null;

const screeningFor = (s: Settings) => ({ answers: s.answers, symptoms: s.symptoms, redFlag: s.redFlag, isSynthetic: false });

/**
 * Overview summary. `realNights` is the list of REAL nights only (sample nights are never passed in, and the core ignores
 * synthetic nights for the conclusion anyway). All logic is in the core's nightRulesInput() and the evidence engine.
 */
export function overviewSummary(s: Settings, realNights: readonly NightListItem[]): EvidenceSummary {
  const { input, context } = nightRulesInput(screeningFor(s), realNights.map((n) => n.view));
  return evaluate(input, context);
}

export function useOverviewSummary(s: Settings, realNights: readonly NightListItem[]): EvidenceSummary {
  return useMemo(() => overviewSummary(s, realNights), [s, realNights]);
}

export interface NightEvidence {
  userItems: EvidenceItem[];
  audioItem: EvidenceItem;
  missingItems: EvidenceItem[];
  notDiagnosis: string[];
  uncertaintyNotes: string[];
  redFlags: string[];
}

/**
 * Evidence for one night: the user's own items and this night's audio item from a single engine evaluation, with the
 * input built by the core's nightRulesInput(). For a sample night the core marks the audio as sample data.
 */
export function nightEvidence(s: Settings, night: NightListItem): NightEvidence {
  const { input, context } = nightRulesInput(screeningFor(s), [night.view]);
  const summary = evaluate(input, context);
  const audioItem = summary.items.find((i) => i.id === 'audio') as EvidenceItem;
  return {
    userItems: summary.items.filter((i) => i.source === 'user-reported'),
    audioItem,
    missingItems: summary.items.filter((i) => i.source === 'missing' && i.id !== 'audio'),
    notDiagnosis: [],
    uncertaintyNotes: summary.uncertaintyNotes,
    redFlags: summary.redFlags,
  };
}

export function useNightEvidence(s: Settings, night: NightListItem | null): NightEvidence | null {
  return useMemo(() => (night ? nightEvidence(s, night) : null), [s, night]);
}
