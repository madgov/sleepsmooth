import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useEffect } from 'react';
import { App } from './App';
import { SessionProvider, useSession } from './state/session';
import { Summary } from './pages/Summary';
import { Results } from './pages/Results';
import { demoAudioAnalysis } from './demo';
import { FOOTER_TEXT, SAMPLE_AUDIO_LABEL, WELCOME_VALUE_PROP } from './content/claims';
import { NEXT_STEPS_KEY } from './pages/NextSteps';

beforeEach(() => {
  sessionStorage.clear();
  window.location.hash = '';
  window.scrollTo = vi.fn();
  window.print = vi.fn();
});
afterEach(cleanup);

const active = () => document.activeElement as HTMLElement | null;
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

describe('Welcome', () => {
  it('shows the value prop, limits before any input, both paths, and the footer', () => {
    render(<App />);
    expect(screen.getByText(WELCOME_VALUE_PROP)).toBeTruthy();
    expect(screen.getByText(/It cannot tell you whether you have sleep apnea/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try the illustrative example (synthetic data)' })).toBeTruthy();
    expect(screen.getByText(FOOTER_TEXT)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sources' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Model card' })).toBeTruthy();
    const own = screen.getByRole('button', { name: 'Start my own check' }) as HTMLButtonElement;
    expect(own.disabled).toBe(true);
    fireEvent.click(screen.getAllByRole('checkbox')[0] as HTMLElement);
    expect(own.disabled).toBe(false);
  });
});

describe('step navigation and focus', () => {
  it('moves focus to the page heading on every step change, with a stepper throughout', () => {
    render(<App />);
    fireEvent.click(screen.getAllByRole('checkbox')[0] as HTMLElement);
    click('Start my own check');
    expect(active()?.id).toBe('q-h');
    expect(screen.getByRole('navigation', { name: 'Progress' })).toBeTruthy();
    click('Next: symptoms');
    expect(active()?.id).toBe('sym-h');
    click(/Next: bed partner/);
    expect(active()?.id).toBe('partner-h');
    click('Skip this step');
    expect(active()?.id).toBe('rev-h');
    click(/Continue to the recording step/);
    expect(active()?.id).toBe('audio-h');
    click('Skip the recording');
    expect(active()?.id).toBe('res-h');
    expect(screen.getByRole('navigation', { name: 'Progress' })).toBeTruthy();
    click('Back');
    expect(active()?.id).toBe('audio-h');
  });

  it('blocks the questionnaire with an announced error on an invalid number', () => {
    render(<App />);
    fireEvent.click(screen.getAllByRole('checkbox')[0] as HTMLElement);
    click('Start my own check');
    const age = screen.getByLabelText(/^Age in years/);
    fireEvent.change(age, { target: { value: '-3' } });
    expect(screen.queryAllByRole('alert')).toHaveLength(0); // not while typing
    fireEvent.blur(age);
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0); // once the person leaves the field
    expect(age.getAttribute('aria-invalid')).toBe('true');
    click('Next: symptoms');
    expect(screen.getByRole('heading', { level: 2 }).id).toBe('q-h');
  });

  it('moves focus to the first invalid field when continuing is blocked', () => {
    render(<App />);
    fireEvent.click(screen.getAllByRole('checkbox')[0] as HTMLElement);
    click('Start my own check');
    fireEvent.change(screen.getByLabelText(/^Weight/), { target: { value: '-1' } });
    fireEvent.change(screen.getByLabelText(/^Age in years/), { target: { value: '-3' } });
    click('Next: symptoms');
    expect(active()?.id).toBe('q-weight');
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(1);
  });

  it('asks before deleting: Cancel and Escape keep the data, confirming removes it', () => {
    render(<App />);
    click('Try the illustrative example (synthetic data)');
    const trigger = screen.getByRole('button', { name: 'Delete my data' });
    fireEvent.click(trigger);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog.textContent).toContain('It cannot be undone');
    expect(active()?.textContent).toBe('Cancel'); // focus starts on the safe choice
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(active()).toBe(trigger);
    expect(active()?.id).not.toBe('welcome-h');
    expect(document.getElementById('res-h')).not.toBeNull(); // nothing was deleted
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(document.getElementById('res-h')).not.toBeNull();
    fireEvent.click(trigger);
    click('Yes, delete my data');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(active()?.id).toBe('welcome-h');
    expect(screen.getByText('Your data was deleted from this browser tab.')).toBeTruthy();
  });

  it('moves focus to the heading of a lazily loaded information view', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('link', { name: 'Sources' }));
    window.location.hash = '#/sources';
    fireEvent(window, new HashChangeEvent('hashchange'));
    await waitFor(() => expect(active()?.id).toBe('src-h'));
  });

  it('example path reaches results with the synthetic label, summary print block, and print button', () => {
    render(<App />);
    click('Try the illustrative example (synthetic data)');
    expect(active()?.id).toBe('res-h');
    expect(screen.getByText(/cannot rule out sleep apnea/, { selector: '.headline-text, .card p' })).toBeTruthy();
    click('Create my summary');
    expect(active()?.id).toBe('sum-h');
    const print = screen.getByRole('button', { name: 'Print / Save as PDF' });
    fireEvent.click(print);
    expect(window.print).toHaveBeenCalledTimes(1);
    const block = screen.getByTestId('print-summary');
    expect(block.textContent).toContain('Not a diagnosis');
    expect(block.textContent).toContain('Synthetic / illustrative');
    expect(within(block).getAllByText(/Source:/).length).toBeGreaterThan(3);
    expect(block.textContent).toContain('Questions for my clinician');
  });
});

describe('next steps tracking and delete', () => {
  it('without storage consent, ticks stay in memory and nothing is stored', () => {
    render(<App />);
    click('Try the illustrative example (synthetic data)');
    click('Create my summary');
    click('Next steps');
    expect(active()?.id).toBe('ns-h');
    expect(screen.getByText(/CDC advises getting off the road/)).toBeTruthy();
    expect(screen.getByText(/home sleep apnea test or an in-lab sleep study/)).toBeTruthy();
    const boxes = screen.getAllByRole('checkbox');
    fireEvent.click(boxes[0] as HTMLElement);
    expect((boxes[0] as HTMLInputElement).checked).toBe(true);
    expect(sessionStorage.getItem(NEXT_STEPS_KEY)).toBeNull(); // no storage consent: memory only
    click('Delete my data');
    click('Yes, delete my data');
    expect(sessionStorage.getItem(NEXT_STEPS_KEY)).toBeNull();
    expect(active()?.id).toBe('welcome-h');
    expect(screen.getByText('Your data was deleted from this browser tab.')).toBeTruthy();
  });
});

describe('next steps with storage consent', () => {
  it('stores ticks in sessionStorage only, and Delete my data clears them', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('checkbox', { name: /I understand these limits/ }));
    click('Try the illustrative example (synthetic data)');
    click('Create my summary');
    click('Next steps');
    fireEvent.click(screen.getAllByRole('checkbox')[0] as HTMLElement);
    expect(JSON.parse(sessionStorage.getItem(NEXT_STEPS_KEY) ?? '[]')).toHaveLength(1);
    expect(localStorage.length).toBe(0);
    click('Delete my data');
    click('Yes, delete my data');
    expect(sessionStorage.getItem(NEXT_STEPS_KEY)).toBeNull();
  });
});

describe('sample audio labeling (Amendment 4)', () => {
  function Seed() {
    const { setAudio } = useSession();
    useEffect(() => setAudio({ ...demoAudioAnalysis, isSynthetic: false }, SAMPLE_AUDIO_LABEL), [setAudio]);
    return null;
  }
  it('carries the label into Results and the summary (screen and print)', () => {
    render(
      <SessionProvider>
        <Seed />
        <Results onBack={() => {}} onNext={() => {}} />
        <Summary onBack={() => {}} onNext={() => {}} />
      </SessionProvider>,
    );
    expect(screen.getAllByText(new RegExp(SAMPLE_AUDIO_LABEL)).length).toBeGreaterThanOrEqual(3);
    expect(screen.getByTestId('print-summary').textContent).toContain(SAMPLE_AUDIO_LABEL);
    expect((screen.getByLabelText('Recording observations') as HTMLTextAreaElement).value).toContain(SAMPLE_AUDIO_LABEL);
  });
});

describe('information views', () => {
  it('renders Sources and Model card from the footer links without network', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    render(<App />);
    window.location.hash = '#/sources';
    fireEvent(window, new HashChangeEvent('hashchange'));
    expect(await screen.findByRole('heading', { name: 'Sources and claims' })).toBeTruthy();
    window.location.hash = '#/model-card';
    fireEvent(window, new HashChangeEvent('hashchange'));
    expect(await screen.findByRole('heading', { name: 'Model card (summary)' })).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('questionnaire progress across information views', () => {
  it('keeps the questionnaire sub-stage after visiting Sources', async () => {
    render(<App />);
    fireEvent.click(screen.getAllByRole('checkbox')[0] as HTMLElement);
    click('Start my own check');
    click('Next: symptoms');
    expect(screen.getByRole('button', { name: 'Next: bed partner (optional)' })).toBeTruthy();
    window.location.hash = '#/sources';
    fireEvent(window, new HashChangeEvent('hashchange'));
    expect(await screen.findByRole('heading', { name: 'Sources and claims' })).toBeTruthy();
    window.location.hash = '';
    fireEvent(window, new HashChangeEvent('hashchange'));
    expect(screen.getByRole('button', { name: 'Next: bed partner (optional)' })).toBeTruthy();
  });
});
