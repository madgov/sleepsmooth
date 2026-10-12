import { describe, expect, it } from 'vitest';
import { buildSampleNightView } from '../night';
import { buildSummary, summaryToHtml, summaryToPlainText } from './summaryText';

const base = { answers: {}, symptoms: {}, redFlag: null, generatedAtISO: '2026-01-16T08:00:00.000Z' };

describe('clinician summary', () => {
  it('with nothing provided: not a diagnosis, nothing invented', () => {
    const { summary, sampleOnly } = buildSummary({ ...base, realNights: [] });
    const t = summaryToPlainText(summary, sampleOnly);
    expect(t).toMatch(/Not a diagnosis/);
    expect(t).toMatch(/RECORDED NIGHTS/);
    expect(t).toMatch(/No recorded nights/);
    expect(sampleOnly).toBe(false);
    expect(summary.sections.map((s) => s.id)).toEqual(['reported', 'screening', 'audio', 'nights', 'guidance', 'questions', 'limits']);
  });

  it('a sample night is only included on request and is labelled everywhere', () => {
    const sample = buildSampleNightView('snore-episodes');
    const { summary, sampleOnly } = buildSummary({ ...base, realNights: [], sampleNight: sample });
    expect(sampleOnly).toBe(true);
    const t = summaryToPlainText(summary, true);
    expect(t).toMatch(/Sample night \(synthetic\)/);
    expect(t).toMatch(/Sample data\./);
    expect(summaryToHtml(summary, true)).toMatch(/Sample night \(synthetic\)/);
    // The sample never drives the guidance headline.
    const guidance = summary.sections.find((s) => s.id === 'guidance')?.text ?? '';
    expect(guidance).not.toMatch(/snore-like pattern was observed/i);
  });

  it('the sample is ignored when real nights exist', () => {
    const sample = buildSampleNightView('snore-episodes');
    const real = { ...buildSampleNightView('quiet') };
    real.summary = { ...real.summary, isSynthetic: false };
    real.record = { ...real.record, isSynthetic: false, source: 'device-recording' };
    const { sampleOnly, summary } = buildSummary({ ...base, realNights: [real], sampleNight: sample });
    expect(sampleOnly).toBe(false);
    expect(summaryToPlainText(summary, false)).not.toMatch(/Sample night \(synthetic\)/);
  });

  it('never says the person does or does not have sleep apnea', () => {
    const t = summaryToPlainText(buildSummary({ ...base, realNights: [] }).summary, false);
    expect(t).not.toMatch(/you have sleep apnea|you do not have sleep apnea|diagnosed with/i);
  });
});
