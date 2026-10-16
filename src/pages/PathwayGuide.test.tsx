import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PathwayGuide, FOLLOW_THROUGH_KEY } from './PathwayGuide';
import { SessionProvider, useSession } from '../state/session';
import { QUESTIONS_COST_LINE, TREATMENTS_LABEL, TRACKER_LABEL } from '../content/pathway';

beforeEach(() => sessionStorage.clear());
afterEach(cleanup);

function Granted() {
  const s = useSession();
  if (s.consent?.granted !== true) s.setConsent(true);
  return null;
}
const mount = (consent = false) =>
  render(
    <SessionProvider>
      {consent ? <Granted /> : null}
      <PathwayGuide />
    </SessionProvider>,
  );

describe('PathwayGuide (web)', () => {
  it('renders every section, labels, and the cost line with no US numbers', () => {
    mount();
    for (const h of ['How sleep apnea is usually checked', 'Treatments clinicians may discuss', 'Questions to ask', 'What you could say', 'Follow-through tracker', 'Who this is for', 'Symptoms can look different']) {
      expect(screen.getByText(h)).toBeTruthy();
    }
    expect(screen.getByText(TREATMENTS_LABEL)).toBeTruthy();
    expect(screen.getByText(TRACKER_LABEL)).toBeTruthy();
    expect(screen.getByText(QUESTIONS_COST_LINE)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\$\d/);
  });
  it('shows the script with fewer facts when nothing has been entered', () => {
    mount();
    expect(screen.getByText(/fewer facts/)).toBeTruthy();
    expect(screen.getByTestId('clinician-script').textContent).toMatch(/evaluation for sleep apnea/);
  });
  it('copies the script to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Copy script' }));
    await screen.findByText('Copied');
    expect(writeText.mock.calls[0]?.[0]).toMatch(/home sleep test/);
  });
  it('ticks stay in memory without consent and are stored with it', () => {
    mount();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Talked to a clinician' }));
    expect((screen.getByRole('checkbox', { name: 'Talked to a clinician' }) as HTMLInputElement).checked).toBe(true);
    expect(sessionStorage.getItem(FOLLOW_THROUGH_KEY)).toBeNull();
    cleanup();
    mount(true);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Test booked' }));
    expect(JSON.parse(sessionStorage.getItem(FOLLOW_THROUGH_KEY) ?? '[]')).toEqual(['track-booked']);
  });
});
