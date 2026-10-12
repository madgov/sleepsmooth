import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { demoAudioAnalysis } from '../demo';
import { SAMPLE_AUDIO_LABEL } from '../content/claims';

const start = vi.fn();
let hookState: object = { phase: 'idle', progress: 0, analysis: null, error: null };
vi.mock('../audio/useAnalysis', () => ({
  useAnalysis: () => ({ state: hookState, start, runSamples: vi.fn(), cancel: vi.fn(), reset: vi.fn() }),
}));

import { AudioInput } from './AudioInput';

beforeEach(() => {
  start.mockReset();
  hookState = { phase: 'idle', progress: 0, analysis: null, error: null };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AudioInput sample recording path', () => {
  it('offers both the real sample and the synthetic case', () => {
    render(<AudioInput onComplete={vi.fn()} onUseLabeledSample={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Analyze sample recording' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Use the synthetic example case (Dana)' })).toBeTruthy();
    expect(screen.getAllByText(SAMPLE_AUDIO_LABEL).length).toBeGreaterThan(0);
  });

  it('fetches the ESC-50 sample, sends it to the real pipeline, and labels the result', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['RIFF'], { type: 'audio/wav' }) });
    vi.stubGlobal('fetch', fetchMock);
    const onComplete = vi.fn();
    const { rerender } = render(<AudioInput onComplete={onComplete} onUseLabeledSample={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Analyze sample recording' }));
    await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('sample-audio/esc50-sample.wav');
    const file = start.mock.calls[0]?.[0] as File;
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('esc50-sample.wav');

    hookState = { phase: 'done', progress: 1, analysis: { ...demoAudioAnalysis, isSynthetic: false }, error: null };
    rerender(<AudioInput onComplete={onComplete} onUseLabeledSample={vi.fn()} />);
    expect(screen.getByText(`${SAMPLE_AUDIO_LABEL}`, { selector: 'strong' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continue to results' }));
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ status: 'done' }), { sampleLabel: SAMPLE_AUDIO_LABEL });
  });

  it('shows an announced error when the sample cannot be fetched', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, blob: async () => new Blob() }));
    render(<AudioInput onComplete={vi.fn()} onUseLabeledSample={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Analyze sample recording' }));
    const alert = await waitFor(() => screen.getByRole('alert'));
    expect(alert.textContent).toContain('could not be loaded');
    expect(start).not.toHaveBeenCalled();
  });
});
