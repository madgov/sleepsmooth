import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SessionProvider } from '../state/session';
import { Summary } from './Summary';

beforeEach(() => sessionStorage.clear());
afterEach(cleanup);

const setup = () =>
  render(
    <SessionProvider>
      <Summary onBack={() => {}} onNext={() => {}} />
    </SessionProvider>,
  );

describe('Summary regenerate-confirm', () => {
  it('regenerates immediately when nothing was edited', () => {
    setup();
    fireEvent.click(screen.getByText('Regenerate summary'));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
  it('asks for confirmation when edited; keep preserves, replace discards', () => {
    setup();
    const box = screen.getByLabelText('Questions for my clinician') as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: 'my own words' } });
    expect(screen.getByText('Edited by you')).toBeTruthy();
    fireEvent.click(screen.getByText('Regenerate summary'));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    fireEvent.click(screen.getByText('Keep my edits'));
    expect((screen.getByLabelText('Questions for my clinician') as HTMLTextAreaElement).value).toBe('my own words');
    fireEvent.click(screen.getByText('Regenerate summary'));
    fireEvent.click(screen.getByText('Replace my edits'));
    expect((screen.getByLabelText('Questions for my clinician') as HTMLTextAreaElement).value).not.toBe('my own words');
    expect(screen.queryByText('Edited by you')).toBeNull();
  });
  it('cancel leaves edits alone', () => {
    setup();
    fireEvent.change(screen.getByLabelText('Questions for my clinician'), { target: { value: 'x' } });
    fireEvent.click(screen.getByText('Regenerate summary'));
    fireEvent.click(screen.getByText('Cancel'));
    expect((screen.getByLabelText('Questions for my clinician') as HTMLTextAreaElement).value).toBe('x');
  });
});
