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

describe('Summary download', () => {
  it('offers Download as text beside print, with a note, and builds a Blob file', () => {
    const created: Blob[] = [];
    const names: string[] = [];
    URL.createObjectURL = ((b: Blob) => {
      created.push(b);
      return 'blob:x';
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = () => {};
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      names.push(this.download);
    };
    try {
      setup();
      expect(screen.getByText('Print / Save as PDF')).toBeTruthy();
      fireEvent.change(screen.getByLabelText('Questions for my clinician'), { target: { value: 'edited words' } });
      fireEvent.click(screen.getByText('Download as text'));
      expect(names[0]).toMatch(/^sleepsmooth-summary-\d{4}-\d{2}-\d{2}\.txt$/);
      expect(created).toHaveLength(1);
      expect(created[0]!.type).toContain('text/plain');
      expect(screen.getByText(/not uploaded/)).toBeTruthy();
    } finally {
      HTMLAnchorElement.prototype.click = click;
    }
  });
});
