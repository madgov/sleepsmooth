import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ParityView } from './Parity';

afterEach(cleanup);

describe('ParityView', () => {
  it('renders pass and fail rows', () => {
    render(<ParityView rows={[{ name: 'a', diff: 1e-6, pass: true }]} codecRows={[{ name: 'mp3', diff: 0.9, pass: false, note: 'aligned offset 3 samples' }]} />);
    expect(screen.getByTestId('parity-summary').textContent).toContain('FAIL');
    expect(screen.getByText('pass')).toBeTruthy();
    expect(screen.getByText('fail')).toBeTruthy();
    expect(screen.getByText(/aligned offset 3/)).toBeTruthy();
  });
  it('reports overall pass', () => {
    render(<ParityView rows={[{ name: 'a', diff: 0, pass: true }]} codecRows={[]} />);
    expect(screen.getByTestId('parity-summary').textContent).toContain('PASS');
  });
});
