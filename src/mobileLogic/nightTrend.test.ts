import { describe, expect, it } from 'vitest';
import type { NightAudioState } from '../night';
import { TREND_FIXED_NOTE, modelTag, recordedShare, rowAccessibilityLabel, selectTrendRows, trendAccessibilityLabel, trendSentence, trendStateFor, type TrendNightInput } from './nightTrend';

let k = 0;
function night(state: NightAudioState, over: Partial<TrendNightInput> = {}): TrendNightInput {
  k++;
  return {
    id: `n${k}`,
    dateISO: new Date(Date.UTC(2026, 0, 30 - k)).toISOString(),
    isSample: false,
    state,
    coverage: { seconds: { scheduled: 8 * 3600, recordedInWindow: 6 * 3600 } },
    view: { summary: { modelVersion: 'sleepsmooth-snore-yamnet-v3' } },
    ...over,
  };
}

describe('state mapping', () => {
  it('maps every night state to one of four shown states, text plus a distinct shape', () => {
    expect(trendStateFor('snore-like-observed')?.label).toBe('Snore-like sound observed');
    expect(trendStateFor('few-observations')?.label).toBe('Few observations');
    expect(trendStateFor('not-assessed')?.label).toBe('Not assessed');
    expect(trendStateFor('model-not-applicable')?.label).toBe('Inconclusive');
    expect(trendStateFor('no-model')?.label).toBe('Inconclusive');
    expect(trendStateFor('not-recorded')).toBeNull();
    const icons = (['snore-like-observed', 'few-observations', 'not-assessed', 'model-not-applicable'] as const).map((s) => trendStateFor(s)?.icon);
    expect(new Set(icons).size).toBe(4);
  });
  it('names the model by family', () => {
    expect(modelTag('sleepsmooth-snore-yamnet-v3.1')).toBe('v3');
    expect(modelTag('sleepsmooth-snore-mlp-v1')).toBe('v1');
    expect(modelTag('synthetic-sample-night-0 (illustrative)')).toBe('Sample');
    expect(modelTag(null)).toBe('No model');
  });
  it('coverage share is clamped and null without a schedule', () => {
    expect(recordedShare({ seconds: { scheduled: 100, recordedInWindow: 150 } })).toBe(1);
    expect(recordedShare({ seconds: { scheduled: 0, recordedInWindow: 10 } })).toBeNull();
  });
});

describe('selectTrendRows', () => {
  it('newest first, limited to the window, skipping nights with no recording', () => {
    const ns = [night('few-observations'), night('not-recorded'), ...Array.from({ length: 10 }, () => night('snore-like-observed'))];
    const rows = selectTrendRows(ns, 7);
    expect(rows).toHaveLength(7);
    expect(rows.every((r) => r.state.state !== undefined)).toBe(true);
    const times = rows.map((r) => Date.parse(r.dateISO));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    expect(selectTrendRows(ns, 30)).toHaveLength(11);
  });
});

describe('summary sentence', () => {
  it('matches the example wording', () => {
    const ns = [
      ...Array.from({ length: 3 }, () => night('snore-like-observed')),
      night('not-assessed'),
      night('not-assessed'),
      night('few-observations'),
      night('few-observations'),
    ];
    expect(trendSentence(selectTrendRows(ns, 7), 7)).toBe('Snore-like sound was observed on 3 of the last 7 recorded nights. 2 nights could not be assessed.');
  });
  it('0 nights', () => {
    expect(trendSentence([], 7)).toBe('No recorded nights yet.');
  });
  it('1 night does not pretend to be a pattern', () => {
    const t = trendSentence(selectTrendRows([night('snore-like-observed')], 7), 7);
    expect(t).toBe("Only 1 recorded night so far (snore-like sound observed). One night can't show a pattern.");
  });
  it('fewer nights than the window say how many', () => {
    const t = trendSentence(selectTrendRows([night('few-observations'), night('few-observations'), night('model-not-applicable')], 30), 30);
    expect(t).toBe('Snore-like sound was observed on 0 of the 3 recorded nights. 1 night was inconclusive.');
  });
  it('sample nights are shown but never counted', () => {
    const rows = selectTrendRows([night('snore-like-observed', { isSample: true }), night('few-observations'), night('few-observations')], 7);
    expect(rows).toHaveLength(3);
    const t = trendSentence(rows, 7);
    expect(t).toMatch(/observed on 0 of the 2 recorded nights/);
    expect(t).toMatch(/1 sample night is shown for layout only and not counted/);
    expect(trendSentence(selectTrendRows([night('snore-like-observed', { isSample: true })], 7), 7)).toMatch(/^No recorded nights yet\. 1 sample night is shown/);
  });
  it('never uses direction, score or reassurance wording', () => {
    const ns = Array.from({ length: 30 }, (_, i) => night(i % 3 === 0 ? 'snore-like-observed' : i % 3 === 1 ? 'few-observations' : 'not-assessed'));
    const all = [trendSentence(selectTrendRows(ns, 30), 30), TREND_FIXED_NOTE, trendAccessibilityLabel(selectTrendRows(ns, 30), 30)].join(' ');
    expect(all).not.toMatch(/improv|worse|better|trend|increas|decreas|average|score|normal|fine|healthy|clear|safe|low risk|[↑↓▲▼]/i);
  });
});

describe('accessibility text', () => {
  it('rows and the strip have a full text alternative, sample data first, and the fixed note', () => {
    const rows = selectTrendRows([night('snore-like-observed', { isSample: true }), night('few-observations')], 7);
    const sample = rows.find((r) => r.isSample);
    expect(sample && rowAccessibilityLabel(sample)).toMatch(/^Sample data\. /);
    const label = trendAccessibilityLabel(rows, 7);
    expect(label).toMatch(/Few observations\. recorded 75 percent of scheduled hours\. Model v3\./);
    expect(label.endsWith(TREND_FIXED_NOTE)).toBe(true);
  });
  it('fixed note is the required wording', () => {
    expect(TREND_FIXED_NOTE).toBe("Nights aren't comparable to a clinical result, and a quiet night doesn't rule anything out.");
  });
});
