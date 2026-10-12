import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { audioInputError, type AudioInputErrorCode } from '../audio/decode';

const mockDecode = vi.fn();
vi.mock('../audio/decode', async (orig) => ({ ...(await orig<typeof import('../audio/decode')>()), decodeAudioFile: (...a: unknown[]) => mockDecode(...a) }));

import { AudioInput } from './AudioInput';

const codes: AudioInputErrorCode[] = ['wrong-type', 'too-big', 'too-long', 'too-short', 'silent', 'corrupt'];

afterEach(cleanup);

describe('AudioInput typed errors', () => {
  it('shows the consent gate before the file picker', () => {
    render(<AudioInput onComplete={vi.fn()} onUseLabeledSample={vi.fn()} />);
    expect(screen.getByText(/never uploaded or stored/)).toBeTruthy();
    expect(screen.queryByLabelText('Choose an audio file')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByLabelText('Choose an audio file')).toBeTruthy();
  });
  for (const code of codes) {
    it(`${code} shows an error with a recovery action`, async () => {
      mockDecode.mockRejectedValueOnce(audioInputError(code));
      render(<AudioInput onComplete={vi.fn()} onUseLabeledSample={vi.fn()} />);
      fireEvent.click(screen.getByRole('checkbox'));
      const file = new File(['x'], 'a.wav', { type: 'audio/wav' });
      fireEvent.change(screen.getByLabelText('Choose an audio file'), { target: { files: [file] } });
      const alert = await waitFor(() => screen.getByRole('alert'));
      expect(alert.textContent).toContain(audioInputError(code).message);
      expect(alert.textContent).toContain(audioInputError(code).recovery);
      expect(screen.getByRole('button', { name: 'Try another file' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Use the synthetic example case (Dana)' })).toBeTruthy();
    });
  }
});
