import { describe, expect, it } from 'vitest';
import { SAMPLE_NIGHT_LABEL, SAMPLE_NIGHT_MODEL_VERSION, buildSampleNight, buildSampleNightView } from './sample';

describe('sample night', () => {
  it('is fully deterministic', () => {
    for (const v of ['snore-episodes', 'quiet'] as const) {
      expect(JSON.stringify(buildSampleNight(v))).toBe(JSON.stringify(buildSampleNight(v)));
      expect(JSON.stringify(buildSampleNightView(v).summary)).toBe(JSON.stringify(buildSampleNightView(v).summary));
    }
  });
  it('is labeled synthetic everywhere', () => {
    const n = buildSampleNight();
    expect(n.record.isSynthetic).toBe(true);
    expect(n.record.source).toBe('sample-assembled');
    expect(n.record.modelVersion).toBe(SAMPLE_NIGHT_MODEL_VERSION);
    expect(n.record.modelVersion).toMatch(/synthetic|not a trained model/);
    expect(SAMPLE_NIGHT_LABEL).toMatch(/synthetic/i);
    expect(buildSampleNightView().summary.isSynthetic).toBe(true);
  });
  it('the two variants show the two relevant states, never anything reassuring', () => {
    expect(buildSampleNightView('snore-episodes').summary.nightState).toBe('snore-like-observed');
    expect(buildSampleNightView('quiet').summary.nightState).toBe('few-observations');
  });
  it('variants differ, and the quiet variant has no episodes', () => {
    expect(buildSampleNightView('quiet').summary.episodes).toHaveLength(0);
    expect(buildSampleNightView('snore-episodes').summary.episodes.length).toBe(5);
  });
  it('covers 8 hours with a mid-night wake and phone use at both ends', () => {
    const v = buildSampleNightView();
    expect(v.summary.recordedSec).toBe(28800);
    expect(v.estimates.filter((e) => e.state === 'likely-awake').length).toBeGreaterThan(0);
    expect(v.estimates.filter((e) => e.state === 'likely-asleep').length).toBeGreaterThan(500);
  });
});
