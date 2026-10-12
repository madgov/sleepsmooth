import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App, STEPS } from './App';
import * as claims from './content/claims';
import * as c from './audio/constants';
import { computeLogMel, frameLogMel } from './audio/features';
import type { EvidenceSummary } from './types/evidence';
import type { AudioAnalysis } from './types/audio';
import type { ModelJson } from './audio/model/schema';

describe('M0 smoke', () => {
  it('renders banner and six steps', () => {
    render(<App />);
    expect(screen.getByText('Prototype - not a diagnosis')).toBeTruthy();
    expect(STEPS).toHaveLength(6);
    for (const s of STEPS) expect(screen.getByText(s)).toBeTruthy();
  });
  it('claims exports non-empty strings', () => {
    expect(claims.NOSAS_LOWER_SCORE_CAVEAT.length).toBeGreaterThan(0);
    expect(claims.nosasScoreStatement(9)).toContain('9 of 17');
    expect(claims.DISCLAIMER_NOT_DIAGNOSIS).toMatch(/not a diagnosis/);
  });
  it('constants match ER-4', () => {
    expect([c.SAMPLE_RATE, c.FRAME_MS, c.HOP_MS, c.WINDOW_SEC, c.WINDOW_HOP_SEC]).toEqual([16000, 25, 10, 1, 0.5]);
    expect(c.FRAME_SAMPLES).toBe(400);
  });
  it('features API returns arrays of the expected shapes', () => {
    expect(computeLogMel(new Float32Array(400 * 3))).toHaveLength(3 * 40);
    expect(frameLogMel(new Float32Array(16000))).toHaveLength(4000);
  });
  it('contract types compile', () => {
    const a: Pick<AudioAnalysis, 'quietWindowCount' | 'modelVersion'> = { quietWindowCount: 0, modelVersion: null };
    const e: Pick<EvidenceSummary, 'conclusion'> = { conclusion: 'inconclusive' };
    const m: Pick<ModelJson, 'version'> = { version: 'x' };
    expect([a, e, m]).toHaveLength(3);
  });
});
