import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  ConflictCard, ConsentGate, DemoBanner, Disclaimer, EmptyState, ErrorState, EvidenceCard, LoadingState,
  LoudnessChart, QualityPanel, SourceBadge, Stepper,
} from './index';
import { demoAudioAnalysis } from '../demo/demoCase';
import type { EvidenceItem } from '../types/evidence';

const item: EvidenceItem = {
  id: 'x', source: 'user-reported', label: 'Daytime sleepiness', detail: 'Reported often.', state: 'present',
  isSynthetic: true, limitations: ['Self-reported.'],
};

afterEach(cleanup);

describe('components', () => {
  it('DemoBanner renders when synthetic and not otherwise', () => {
    const { rerender } = render(<DemoBanner isSynthetic />);
    expect(screen.getByRole('note').textContent).toContain('Synthetic / illustrative');
    rerender(<DemoBanner isSynthetic={false} />);
    expect(screen.queryByRole('note')).toBeNull();
  });
  it('Disclaimer shows prototype text', () => {
    render(<Disclaimer />);
    expect(screen.getByRole('complementary', { name: 'Important information' })).toBeTruthy();
    expect(screen.getAllByText('Prototype - not a diagnosis').length).toBeGreaterThan(0);
  });
  it('EvidenceCard is labelled and shows sample badge when synthetic', () => {
    render(<EvidenceCard item={item} />);
    expect(screen.getByRole('article', { name: 'Daytime sleepiness' })).toBeTruthy();
    expect(screen.getByText('Sample data')).toBeTruthy();
    expect(screen.getByText('User-reported')).toBeTruthy();
  });
  it('SourceBadge distinguishes model from simple measure', () => {
    render(<><SourceBadge kind="audio-observation" /><SourceBadge kind="audio-model" /></>);
    expect(screen.getByText('Audio observation (simple measure)')).toBeTruthy();
    expect(screen.getByText('Audio observation (model)')).toBeTruthy();
  });
  it('ConsentGate hides children until granted and has a labelled checkbox', () => {
    const onChange = vi.fn();
    const { rerender } = render(<ConsentGate title="Audio" description="d" checkboxLabel="I agree" granted={false} onChange={onChange}><p>inner</p></ConsentGate>);
    expect(screen.queryByText('inner')).toBeNull();
    fireEvent.click(screen.getByLabelText('I agree'));
    expect(onChange).toHaveBeenCalledWith(true);
    rerender(<ConsentGate title="Audio" description="d" checkboxLabel="I agree" granted onChange={onChange}><p>inner</p></ConsentGate>);
    expect(screen.getByText('inner')).toBeTruthy();
  });
  it('Stepper marks the current step', () => {
    render(<Stepper steps={['A', 'B', 'C', 'D', 'E', 'F']} current={2} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
    expect(screen.getByText('C').closest('li')?.getAttribute('aria-current')).toBe('step');
  });
  it('ErrorState is an alert with a working recovery action', () => {
    const fn = vi.fn();
    render(<ErrorState title="Oops" message="Could not read file." actionLabel="Try again" onAction={fn} />);
    expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(fn).toHaveBeenCalled();
  });
  it('LoadingState exposes status and progress', () => {
    render(<LoadingState label="Analyzing" progress={0.4} />);
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Analyzing' }).getAttribute('value')).toBe('40');
  });
  it('EmptyState renders its action', () => {
    render(<EmptyState title="Nothing yet" message="m" actionLabel="Add" onAction={() => {}} />);
    expect(screen.getByRole('button', { name: 'Add' })).toBeTruthy();
  });
  it('QualityPanel renders report', () => {
    render(<QualityPanel quality={demoAudioAnalysis.quality} />);
    expect(screen.getByRole('region', { name: 'Recording quality' })).toBeTruthy();
    expect(screen.getByText('Usable for simple measures')).toBeTruthy();
  });
  it('ConflictCard renders text', () => {
    render(<ConflictCard text="Worth discussing." />);
    expect(screen.getByRole('region', { name: 'Worth discussing' })).toBeTruthy();
  });
  it('LoudnessChart has accessible summary, quiet periods wording, and no percentages', () => {
    const a = demoAudioAnalysis;
    const { container } = render(<LoudnessChart loudness={a.loudness} quietGaps={a.quietGaps} windows={a.windows} />);
    expect(screen.getByRole('img', { name: 'Loudness timeline' })).toBeTruthy();
    const text = container.textContent ?? '';
    expect(text).toContain('quiet periods');
    expect(text).not.toMatch(/%|confidence|probab|pause/i);
  });
  it('badges, banners and cards draw SVG icons (decorative) instead of text glyphs', () => {
    const { container } = render(
      <>
        <SourceBadge kind="user-reported" />
        <SourceBadge kind="audio-model" />
        <SourceBadge kind="missing" />
        <DemoBanner isSynthetic />
        <ConflictCard text="Worth discussing." />
        <QualityPanel quality={demoAudioAnalysis.quality} />
      </>,
    );
    const icons = container.querySelectorAll('svg.icon');
    expect(icons.length).toBeGreaterThanOrEqual(6);
    icons.forEach((n) => expect(n.getAttribute('aria-hidden')).toBe('true'));
    expect(container.textContent).not.toMatch(/[\u25A0-\u25FF\u2205\u24D8]/); // no geometric-shape or info glyphs left
  });
  it('LoudnessChart key explains each mark by shape and pattern, with readable axis text outside the SVG', () => {
    const a = demoAudioAnalysis;
    const { container } = render(<LoudnessChart loudness={a.loudness} quietGaps={a.quietGaps} windows={a.windows} />);
    expect(screen.getByRole('list', { name: 'Chart key' }).textContent).toContain('Hatched band: quiet period');
    expect(container.querySelector('svg[role="img"] text')).toBeNull();
    expect(container.querySelector('.chart-xaxis')?.textContent).toContain('0 s');
    expect(container.querySelector('pattern')).not.toBeNull();
  });
});
