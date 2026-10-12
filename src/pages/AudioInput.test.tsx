import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const cancel = vi.fn();
let hookState: object = { phase: 'idle', progress: 0, analysis: null, error: null };
vi.mock('../audio/useAnalysis', () => ({
  useAnalysis: () => ({ state: hookState, start: vi.fn(), runSamples: vi.fn(), cancel, reset: vi.fn() }),
}));

import { AudioInput } from './AudioInput';

afterEach(cleanup);

describe('AudioInput', () => {
  it('shows progress and cancel while analyzing', () => {
    hookState = { phase: 'analyzing', progress: 0.4, analysis: null, error: null };
    render(<AudioInput onComplete={vi.fn()} onUseLabeledSample={vi.fn()} />);
    expect(screen.getByRole('status').textContent).toContain('40%');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(cancel).toHaveBeenCalled();
  });
  it('fires onUseLabeledSample', () => {
    hookState = { phase: 'idle', progress: 0, analysis: null, error: null };
    const onSample = vi.fn();
    render(<AudioInput onComplete={vi.fn()} onUseLabeledSample={onSample} />);
    fireEvent.click(screen.getByRole('button', { name: 'Use the synthetic example case (Dana)' }));
    expect(onSample).toHaveBeenCalledTimes(1);
  });
});
