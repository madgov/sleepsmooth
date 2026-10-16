// Optional bed-partner observations. User-reported on behalf of someone else, never scored, never part of NoSAS.
import {
  PARTNER_FREQUENCY_LABELS,
  PARTNER_ITEM_LABELS,
  PARTNER_SOURCE_LABEL,
  PARTNER_SUMMARY_ALONE,
  PARTNER_SUMMARY_CAVEAT,
  PARTNER_SUMMARY_LEAD,
  PARTNER_SUMMARY_NONE,
  PARTNER_SUMMARY_NOTHING,
  PARTNER_SUMMARY_TITLE,
  PARTNER_SUMMARY_UNSURE,
} from '../content/partner';
import type { CareSummarySection } from '../types/report';

export type PartnerPresence = 'yes' | 'alone' | 'unsure';
export type PartnerFrequency = 'rarely' | 'sometimes' | 'often' | 'not-sure';
export type PartnerItemKey = 'loud-snoring' | 'breathing-pauses' | 'gasping-choking' | 'restless-sleep';

export const PARTNER_PRESENCE_VALUES: readonly PartnerPresence[] = ['yes', 'alone', 'unsure'];
export const PARTNER_FREQUENCIES: readonly PartnerFrequency[] = ['rarely', 'sometimes', 'often', 'not-sure'];
export const PARTNER_ITEM_KEYS: readonly PartnerItemKey[] = ['loud-snoring', 'breathing-pauses', 'gasping-choking', 'restless-sleep'];

export interface PartnerObservations {
  /** Always this literal: the data is passed along by the user from someone else. */
  source: typeof PARTNER_SOURCE_LABEL;
  presence: PartnerPresence | null;
  /** Only meaningful when presence is 'yes'. */
  observed: Partial<Record<PartnerItemKey, PartnerFrequency>>;
  /** True when "nothing noticed" was chosen (only valid with presence 'yes' and no observed items). */
  nothingNoticed: boolean;
}

export const emptyPartner = (): PartnerObservations => ({ source: PARTNER_SOURCE_LABEL, presence: null, observed: {}, nothingNoticed: false });

export const isPartnerEmpty = (p: PartnerObservations | null | undefined): boolean => !p || p.presence === null;

/** Whitelist and repair untrusted/stored data. Anything unknown is dropped. */
export function normalizePartner(raw: unknown): PartnerObservations {
  const out = emptyPartner();
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  if (PARTNER_PRESENCE_VALUES.includes(r.presence as PartnerPresence)) out.presence = r.presence as PartnerPresence;
  if (out.presence !== 'yes') return out;
  const obs = r.observed && typeof r.observed === 'object' ? (r.observed as Record<string, unknown>) : {};
  for (const k of PARTNER_ITEM_KEYS) {
    const f = obs[k];
    if (PARTNER_FREQUENCIES.includes(f as PartnerFrequency)) out.observed[k] = f as PartnerFrequency;
  }
  out.nothingNoticed = r.nothingNoticed === true && Object.keys(out.observed).length === 0;
  return out;
}

/** Immutable updaters used by both UIs. */
export function setPartnerPresence(p: PartnerObservations, presence: PartnerPresence): PartnerObservations {
  return normalizePartner({ ...p, presence });
}
export function setPartnerFrequency(p: PartnerObservations, key: PartnerItemKey, f: PartnerFrequency): PartnerObservations {
  return normalizePartner({ ...p, presence: 'yes', observed: { ...p.observed, [key]: f }, nothingNoticed: false });
}
export function setPartnerNothing(p: PartnerObservations): PartnerObservations {
  return normalizePartner({ ...p, presence: 'yes', observed: {}, nothingNoticed: true });
}

/** Plain-text body of the summary section. Wording stays "reported", never "detected" or "events". */
export function partnerSummaryText(p: PartnerObservations | null | undefined): string {
  if (isPartnerEmpty(p)) return PARTNER_SUMMARY_NONE;
  const q = p as PartnerObservations;
  if (q.presence === 'alone') return PARTNER_SUMMARY_ALONE;
  if (q.presence === 'unsure') return PARTNER_SUMMARY_UNSURE;
  const lines = PARTNER_ITEM_KEYS.flatMap((k) => {
    const f = q.observed[k];
    return f ? [`- ${PARTNER_ITEM_LABELS[k]} reported by a bed partner: ${PARTNER_FREQUENCY_LABELS[f].toLowerCase()}`] : [];
  });
  const body = lines.length > 0 ? lines.join('\n') : q.nothingNoticed ? PARTNER_SUMMARY_NOTHING : 'Someone has observed their sleep, but no details were entered.';
  return [PARTNER_SUMMARY_LEAD, body, PARTNER_SUMMARY_CAVEAT].join('\n');
}

/** The section to insert into a care summary. Source tag stays 'user-reported'; the text names the partner source. */
export function partnerSection(p: PartnerObservations | null | undefined): CareSummarySection {
  return { id: 'partner', title: PARTNER_SUMMARY_TITLE, source: 'user-reported', text: partnerSummaryText(p) };
}
