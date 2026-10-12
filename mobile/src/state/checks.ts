// Presentation model for the Checks tab. Statuses come straight from the evidence engine's item states (state/evidence.ts);
// nothing here interprets a score or decides a conclusion.
import type { EvidenceItem, EvidenceState } from '@core/types/evidence';
import type { SymbolName } from '../ui/Icon';
import type { ToneName } from '../theme/tokens';
import type { NightListItem } from '../data/nightSource';
import type { Settings } from './settings';

export type CheckId = 'snore' | 'nosas' | 'symptoms' | 'warning';
export type CheckStatus = 'Observed' | 'Not observed (cannot rule out)' | 'Not assessed' | 'Not done yet';

export interface CheckModel {
  id: CheckId;
  title: string;
  kind: string;
  icon: SymbolName;
  status: CheckStatus;
  tone: ToneName;
  item: EvidenceItem | null;
}

export const STATUS_TONE: Record<CheckStatus, ToneName> = {
  Observed: 'discuss',
  'Not observed (cannot rule out)': 'info',
  'Not assessed': 'missing',
  'Not done yet': 'missing',
};

const fromState = (st: EvidenceState): CheckStatus =>
  st === 'present' ? 'Observed' : st === 'absent-unreliable' ? 'Not observed (cannot rule out)' : st === 'inconclusive' || st === 'conflict' ? 'Not assessed' : 'Not done yet';

export function buildChecks(items: readonly EvidenceItem[], s: Settings, realNights: readonly NightListItem[]): CheckModel[] {
  const find = (id: string) => items.find((i) => i.id === id) ?? null;
  const audio = find('audio');
  const audioStatus: CheckStatus = realNights.length === 0 ? 'Not done yet' : audio ? (audio.state === 'missing' ? 'Not assessed' : fromState(audio.state)) : 'Not done yet';
  const nosas = find('noSas');
  const symptoms = find('symptoms');
  const warnStatus: CheckStatus = s.redFlag === null ? 'Not done yet' : s.redFlag ? 'Observed' : 'Not observed (cannot rule out)';
  const mk = (id: CheckId, title: string, kind: string, icon: SymbolName, status: CheckStatus, item: EvidenceItem | null): CheckModel => ({ id, title, kind, icon, status, tone: STATUS_TONE[status], item });
  return [
    mk('snore', 'Snore-pattern check', 'Overnight audio, analysed on this phone', 'waveform', audioStatus, audio),
    mk('nosas', 'NoSAS screening', 'Height, weight, neck, snoring, age, sex', 'list.clipboard', nosas ? fromState(nosas.state) : 'Not done yet', nosas),
    mk('symptoms', 'Symptom checklist', 'How often you notice six symptoms', 'checklist', symptoms ? fromState(symptoms.state) : 'Not done yet', symptoms),
    mk('warning', 'Warning signs', 'One question about drowsy driving', 'exclamationmark.triangle', warnStatus, find('redFlag')),
  ];
}
