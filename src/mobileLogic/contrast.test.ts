import { appendFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { darkColors, lightColors, nightColors, type Colors } from '../../mobile/src/theme/tokens';

// WCAG 2.x contrast for every text-on-surface pair in both themes (plus the night recording surface).
// Targets: 4.5:1 body text, 3:1 large text and UI components (switch track, focus ring, accent as a graphic).
// Glass surfaces are translucent, so the effective colour is the glass fill composited over the background gradient stops
// (worst case of the three is asserted). The tertiary label token is full-strength: it must never be dimmed with opacity for text.

type RGBA = [number, number, number, number];
function parse(c: string): RGBA {
  const hex = /^#([0-9a-f]{6})$/i.exec(c);
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const m = /^rgba?\(([^)]+)\)$/.exec(c);
  if (!m) throw new Error(`unparseable colour ${c}`);
  const p = m[1]!.split(',').map((s) => parseFloat(s));
  return [p[0]!, p[1]!, p[2]!, p[3] ?? 1];
}
function over(top: string, under: string): string {
  const [r, g, b, a] = parse(top);
  const [ur, ug, ub] = parse(under);
  const mix = (f: number, u: number) => Math.round(f * a + u * (1 - a));
  return `rgb(${mix(r, ur)},${mix(g, ug)},${mix(b, ub)})`;
}
function lum(c: string): number {
  const [r, g, b] = parse(c);
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function ratio(fg: string, bg: string): number {
  const a = lum(over(fg, bg));
  const b = lum(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

interface Pair {
  name: string;
  fg: string;
  bg: string;
  min: number;
}

function pairs(c: Colors): Pair[] {
  const out: Pair[] = [];
  const surfaces: Record<string, string[]> = {
    bg: [c.bg, ...c.bgGradient],
    card: [c.card],
    cardRaised: [c.cardRaised],
    'glass over bg': c.bgGradient.map((s) => over(c.glassFill, s)),
    'glass over card': [over(c.glassFill, c.card)],
    'glassGradient over bg': c.bgGradient.flatMap((s) => c.glassGradient.map((g) => over(g, s))),
    'glassGradient over card': c.glassGradient.map((g) => over(g, c.card)),
  };
  const text: Record<string, string> = { label: c.label, labelSecondary: c.labelSecondary, labelTertiary: c.labelTertiary, accent: c.accent, destructive: c.destructive };
  for (const [sn, list] of Object.entries(surfaces)) {
    for (const [tn, fg] of Object.entries(text)) {
      list.forEach((bg, i) => out.push({ name: `${tn} on ${sn}${list.length > 1 ? ` #${i + 1}` : ''}`, fg, bg, min: 4.5 }));
    }
  }
  // Tones (chips, notes): text on its own fill, and on the fill laid over a card.
  for (const t of ['info', 'discuss', 'missing', 'sample', 'model', 'error'] as const) {
    out.push({ name: `${t}.fg on ${t}.bg`, fg: c[t].fg, bg: c[t].bg, min: 4.5 });
  }
  // Tints: glyph / label colour on the tint fill laid over a card and over the screen.
  for (const [n, t] of Object.entries(c.tint)) {
    out.push({ name: `tint.${n}.fg on tint over card`, fg: t.fg, bg: over(t.bg, c.card), min: 4.5 });
    out.push({ name: `tint.${n}.fg on tint over bg`, fg: t.fg, bg: over(t.bg, c.bg), min: 4.5 });
  }
  // Buttons.
  out.push({ name: 'accentFg on accent (filled button)', fg: c.accentFg, bg: c.accent, min: 4.5 });
  c.accentGradientText.forEach((s, i) => out.push({ name: `white on accentGradientText #${i + 1} (CTA)`, fg: '#FFFFFF', bg: s, min: 4.5 }));
  // Capsule: on-capsule label sits on the page, not on the fill.
  out.push({ name: 'capsule.label on bg', fg: c.capsule.label, bg: c.bg, min: 4.5 });
  out.push({ name: 'capsule.label on card', fg: c.capsule.label, bg: c.card, min: 4.5 });
  out.push({ name: 'label on capsule.fill (hour label)', fg: '#FFFFFF', bg: c.capsule.fill, min: 4.5 });
  // UI components (3:1).
  out.push({ name: 'switchOff track on card (UI)', fg: c.switchOff, bg: c.card, min: 3 });
  out.push({ name: 'switchOff track on bg (UI)', fg: c.switchOff, bg: c.bg, min: 3 });
  out.push({ name: 'focus ring on bg (UI)', fg: c.focus, bg: c.bg, min: 3 });
  out.push({ name: 'focus ring on card (UI)', fg: c.focus, bg: c.card, min: 3 });
  out.push({ name: 'accent on card (UI / large)', fg: c.accent, bg: c.card, min: 3 });
  out.push({ name: 'labelTertiary glyph on card (UI)', fg: c.labelTertiary, bg: c.card, min: 3 });
  return out;
}

const themes: Array<[string, Colors]> = [
  ['light', lightColors],
  ['dark', darkColors],
  ['night', nightColors],
];

describe('WCAG contrast', () => {
  for (const [tname, colors] of themes) {
    describe(tname, () => {
      const list = pairs(colors);
      it('prints the table', () => {
        const rows = list.map((p) => `${tname.padEnd(5)} ${p.name.padEnd(48)} ${ratio(p.fg, p.bg).toFixed(2).padStart(6)} (min ${p.min})${ratio(p.fg, p.bg) < p.min ? '  FAIL' : ''}`);
        if (process.env.CONTRAST_TABLE) appendFileSync(process.env.CONTRAST_TABLE, rows.join('\n') + '\n');
        expect(rows.length).toBeGreaterThan(0);
      });
      for (const p of list) {
        it(`${p.name} >= ${p.min}:1`, () => {
          expect(ratio(p.fg, p.bg)).toBeGreaterThanOrEqual(p.min);
        });
      }
    });
  }

  it('labelTertiary is opaque (never a 30% tint, which fails contrast for text)', () => {
    for (const [, c] of themes) expect(parse(c.labelTertiary)[3]).toBe(1);
  });
});
