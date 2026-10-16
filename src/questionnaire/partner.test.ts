import { describe, expect, it } from 'vitest';
import { PARTNER_SOURCE_LABEL } from '../content/partner';
import { generateCareSummary, type ReportInput } from '../report/generate';
import { activeInstrument } from './registry';
import {
  emptyPartner,
  isPartnerEmpty,
  normalizePartner,
  partnerSection,
  partnerSummaryText,
  setPartnerFrequency,
  setPartnerNothing,
  setPartnerPresence,
} from './partner';

const answers = { units: 'metric', height: 175, weight: 80, neck: 40, snoring: true, age: 50, sex: 'male' } as const;

describe('partner observations schema', () => {
  it('starts empty and tagged as user-reported (partner)', () => {
    const p = emptyPartner();
    expect(p.source).toBe('user-reported (partner)');
    expect(p.source).toBe(PARTNER_SOURCE_LABEL);
    expect(isPartnerEmpty(p)).toBe(true);
  });

  it('drops unknown presence, items and frequencies, and ignores details when not "yes"', () => {
    expect(normalizePartner(null).presence).toBeNull();
    expect(normalizePartner({ presence: 'maybe' }).presence).toBeNull();
    const n = normalizePartner({ presence: 'yes', source: 'forged', observed: { 'loud-snoring': 'often', bogus: 'often', 'breathing-pauses': 'daily' } });
    expect(n.source).toBe(PARTNER_SOURCE_LABEL);
    expect(n.observed).toEqual({ 'loud-snoring': 'often' });
    const alone = normalizePartner({ presence: 'alone', observed: { 'loud-snoring': 'often' }, nothingNoticed: true });
    expect(alone.observed).toEqual({});
    expect(alone.nothingNoticed).toBe(false);
  });

  it('"nothing noticed" and item answers are mutually exclusive', () => {
    let p = setPartnerPresence(emptyPartner(), 'yes');
    p = setPartnerFrequency(p, 'breathing-pauses', 'sometimes');
    expect(p.nothingNoticed).toBe(false);
    p = setPartnerNothing(p);
    expect(p.observed).toEqual({});
    expect(p.nothingNoticed).toBe(true);
    p = setPartnerFrequency(p, 'loud-snoring', 'rarely');
    expect(p.nothingNoticed).toBe(false);
  });

  it('switching to "alone" clears details', () => {
    const p = setPartnerPresence(setPartnerFrequency(setPartnerPresence(emptyPartner(), 'yes'), 'loud-snoring', 'often'), 'alone');
    expect(p.observed).toEqual({});
  });
});

describe('partner summary section', () => {
  const yes = setPartnerFrequency(setPartnerFrequency(setPartnerPresence(emptyPartner(), 'yes'), 'breathing-pauses', 'sometimes'), 'loud-snoring', 'often');

  it('words reports as reported, with source, and never as apnea events', () => {
    const t = partnerSummaryText(yes);
    expect(t).toContain('Pauses in breathing reported by a bed partner: sometimes');
    expect(t).toContain('Loud snoring reported by a bed partner: often');
    expect(t).toContain('user-reported (partner)');
    expect(t).toContain('not scored');
    expect(t).toContain('cannot confirm or rule out sleep apnea');
    expect(t.toLowerCase()).not.toMatch(/apnea events|apnea detected|diagnos(is|ed) /);
  });

  it('handles alone, unsure, nothing noticed and empty', () => {
    expect(partnerSummaryText(setPartnerPresence(emptyPartner(), 'alone'))).toContain('does not rule anything out');
    expect(partnerSummaryText(setPartnerPresence(emptyPartner(), 'unsure'))).toContain('not sure');
    expect(partnerSummaryText(setPartnerNothing(setPartnerPresence(emptyPartner(), 'yes')))).toContain('none of the listed items');
    expect(partnerSummaryText(null)).toContain('No partner observations');
  });

  it('is a user-reported section titled "Reported by a bed partner"', () => {
    const s = partnerSection(yes);
    expect(s.title).toBe('Reported by a bed partner');
    expect(s.source).toBe('user-reported');
  });

  const base = (partner?: ReportInput['partner']): ReportInput => ({
    answers: { ...answers },
    symptoms: {},
    redFlag: null,
    partner,
    evidence: { headline: 'h', items: [], missing: [], conflicts: [], redFlags: [], uncertaintyNotes: ['u'] } as unknown as ReportInput['evidence'],
    audio: null,
    isSynthetic: false,
    generatedAt: '2026-01-01T00:00:00Z',
  });

  it('is inserted after "What I reported" only when answered, and leaves the NoSAS section unchanged', () => {
    const without = generateCareSummary(base());
    const withP = generateCareSummary(base(yes));
    expect(without.sections.some((x) => x.id === 'partner')).toBe(false);
    expect(generateCareSummary(base(emptyPartner())).sections.some((x) => x.id === 'partner')).toBe(false);
    const ids = withP.sections.map((x) => x.id);
    expect(ids.indexOf('partner')).toBe(ids.indexOf('reported') + 1);
    expect(withP.sections.find((x) => x.id === 'screening')?.text).toBe(without.sections.find((x) => x.id === 'screening')?.text);
  });

  it('does not change the NoSAS score', () => {
    expect(activeInstrument.score({ ...answers, partner: 'yes' } as never).total).toBe(activeInstrument.score({ ...answers }).total);
  });
});
