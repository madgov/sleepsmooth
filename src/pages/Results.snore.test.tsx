import { cleanup, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AudioAnalysis } from '../types/audio';
import { SNORE_NOT_APNEA_LINE, NO_MODEL_LINE, MODEL_NOT_APPLICABLE_RESULT } from '../content/claims';
import { SessionProvider, useSession } from '../state/session';

const shipped = vi.hoisted(() => ({ model: null as unknown }));
vi.mock('../audio/model/infer', async (orig) => ({ ...(await orig<typeof import('../audio/model/infer')>()), loadShippedModel: () => shipped.model }));

import { Results } from './Results';

const base: AudioAnalysis = {
  status: 'done',
  quality: { durationSec: 600, clippingPct: 0, noiseFloorDb: -50, silenceRatio: 0.1, verdict: 'usable', reasons: [] },
  loudness: [-30, -31, -30],
  windows: [
    { t0: 0, t1: 1, snoreLike: true, score: 0.9 },
    { t0: 0.5, t1: 1.5, snoreLike: false, score: 0.1 },
    { t0: 1, t1: 2, snoreLike: false, score: 0.2 },
  ],
  snoreLikeFraction: 1 / 3,
  quietWindowCount: 4,
  quietGaps: [],
  modelVersion: 'test-model-1',
  modelApplicable: true,
  isSynthetic: false,
  limitations: [],
};

function Seed({ a }: { a: AudioAnalysis }) {
  const { setAudio } = useSession();
  useEffect(() => setAudio(a), [a, setAudio]);
  return null;
}
const setup = (a: AudioAnalysis) =>
  render(
    <SessionProvider>
      <Seed a={a} />
      <Results onBack={() => {}} onNext={() => {}} />
    </SessionProvider>,
  );

beforeEach(() => sessionStorage.clear());
afterEach(cleanup);

describe('Results snore section', () => {
  it('shows counts, too-quiet count, version and the not-apnea line; no scores or percentages', () => {
    shipped.model = { version: 'test-model-1' };
    const { container } = setup(base);
    const el = screen.getByTestId('snore-results');
    expect(el.textContent).toContain('1 of 3 assessable');
    expect(el.textContent).toContain('4 windows were too quiet to assess');
    expect(el.textContent).toContain('test-model-1');
    expect(el.textContent).toContain(SNORE_NOT_APNEA_LINE);
    expect(el.textContent).toContain('phone-call-quality');
    expect((el.textContent ?? '').replace('95%', '')).not.toMatch(/%|0\.9\b|confidence/);
    expect(container.textContent).not.toContain('0.9');
  });
  it('band-limited recording: not assessed wording, no counts', () => {
    shipped.model = { version: 'test-model-1' };
    setup({ ...base, windows: [], snoreLikeFraction: 0, modelApplicable: false });
    const el = screen.getByTestId('snore-results');
    expect(el.textContent).toContain(MODEL_NOT_APPLICABLE_RESULT);
    expect(el.textContent).not.toContain('assessable');
  });
  it('ER-9: no shipped model shows the no-model line', () => {
    shipped.model = null;
    setup({ ...base, windows: [], modelVersion: null });
    const el = screen.getByTestId('snore-results');
    expect(el.textContent).toContain(NO_MODEL_LINE);
    expect(el.textContent).toContain(SNORE_NOT_APNEA_LINE);
    expect(el.textContent).not.toContain('assessable');
  });
});
