import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LIMITS_PANEL_ITEMS, LIMITS_PANEL_SOURCES, LIMITS_PANEL_TITLE, LIMITS_PANEL_WATCH_LINE } from '../content/claims';
import { LimitsPanel } from './LimitsPanel';
import { ModelCardNumbers } from './ModelCardNumbers';

describe('LimitsPanel', () => {
  it('shows the title, every limit, the watch figures with sources, and no reassurance', () => {
    render(<LimitsPanel />);
    expect(screen.getByText(LIMITS_PANEL_TITLE)).toBeTruthy();
    for (const t of LIMITS_PANEL_ITEMS) expect(screen.getByText(t)).toBeTruthy();
    expect(screen.getByText(LIMITS_PANEL_WATCH_LINE)).toBeTruthy();
    expect(screen.getByText(LIMITS_PANEL_SOURCES)).toBeTruthy();
    expect(LIMITS_PANEL_WATCH_LINE).toMatch(/82\.7%/);
    expect(LIMITS_PANEL_WATCH_LINE).toMatch(/secondary summary/);
    expect(LIMITS_PANEL_ITEMS.join(' ')).toMatch(/not a diagnosis/i);
  });
});

describe('ModelCardNumbers', () => {
  it('states the v1 numbers, the small test, no real-phone data, and that v3 runs only in the iPhone app, not on this website', () => {
    const { container } = render(<ModelCardNumbers />);
    const text = container.textContent ?? '';
    expect(text).toContain('0.919');
    expect(text).toContain('0.620');
    expect(text).toContain('0.230');
    expect(text).toMatch(/only 8 snoring clips/);
    expect(text).toMatch(/not been tested on recordings made overnight on real phones/);
    expect(text).toMatch(/recall was 0\.00/);
    expect(text).toMatch(/runs in the iPhone app, not on this website/);
    expect(text).toMatch(/This website always uses v1/);
    expect(text).toMatch(/NOT VERIFIED/);
  });
});
