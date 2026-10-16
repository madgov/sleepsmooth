import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// Static accessibility scan of the iPhone app (no react-native test renderer is installed, so this reads source).
// The dev-lab 'screens' dir is skipped (only reachable from the dev route). Every Pressable, Touchable*, PressScale and Switch opening tag must carry an accessibilityRole (PressScale defaults to
// "button") and an accessibilityLabel, unless the tag spreads a props object that supplies them. Svg art must be hidden.
const MOBILE = join(process.cwd(), 'mobile');
const SKIP_DIRS = new Set(['node_modules', 'dist', 'ios', 'modules', 'plugins', 'web-stubs', 'assets', 'dev', 'screens']);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    if (SKIP_DIRS.has(n)) return [];
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return files(p);
    return /\.tsx$/.test(n) ? [p] : [];
  });
}

interface Tag {
  name: string;
  props: string;
  line: number;
}

/** Extracts JSX opening tags for the given element names, tracking braces so `=>` and nested JSX in props do not end the tag early. */
export function openingTags(src: string, names: string[]): Tag[] {
  const out: Tag[] = [];
  const re = new RegExp(`<(${names.join('|')})(?=[\\s/>])`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length;
    let depth = 0;
    let quote = '';
    for (; i < src.length; i++) {
      const ch = src[i]!;
      if (quote) {
        if (ch === quote && src[i - 1] !== '\\') quote = '';
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') quote = ch;
      else if (ch === '{') depth++;
      else if (ch === '}') depth--;
      else if (ch === '>' && depth === 0 && src[i - 1] !== '=') break;
    }
    out.push({ name: m[1]!, props: src.slice(m.index + m[0].length, i), line: src.slice(0, m.index).split('\n').length });
  }
  return out;
}

const all = [...files(join(MOBILE, 'app')), ...files(join(MOBILE, 'src'))].filter((f) => !/\.test\.tsx?$/.test(f));
const INTERACTIVE = ['Pressable', 'TouchableOpacity', 'TouchableHighlight', 'TouchableWithoutFeedback', 'PressScale', 'Switch'];

describe('a11y static scan (mobile)', () => {
  it('scans a non-trivial number of files', () => {
    expect(all.length).toBeGreaterThan(40);
  });

  it('every interactive element has a role and a label', () => {
    const problems: string[] = [];
    for (const f of all) {
      const src = readFileSync(f, 'utf8');
      for (const t of openingTags(src, INTERACTIVE)) {
        const spread = /\{\s*\.\.\./.test(t.props) || /accessible\s*=\s*\{false\}/.test(t.props);
        const hasRole = /accessibilityRole\s*=/.test(t.props) || t.name === 'PressScale' || t.name === 'Switch';
        const hasLabel = /accessibilityLabel\s*=/.test(t.props);
        if (!spread && !hasRole) problems.push(`${relative(MOBILE, f)}:${t.line} <${t.name}> missing accessibilityRole`);
        if (!spread && !hasLabel) problems.push(`${relative(MOBILE, f)}:${t.line} <${t.name}> missing accessibilityLabel`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('toggle-like roles carry accessibilityState', () => {
    const problems: string[] = [];
    for (const f of all) {
      const src = readFileSync(f, 'utf8');
      for (const t of openingTags(src, INTERACTIVE)) {
        if (/accessibilityRole\s*=\s*["'{]+\s*["']?(checkbox|radio|switch|tab)/.test(t.props) && !/accessibilityState\s*=|checked=|value=/.test(t.props)) {
          problems.push(`${relative(MOBILE, f)}:${t.line} <${t.name}> toggle role without accessibilityState`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('Svg art is hidden from the accessibility tree or sits in a hidden wrapper', () => {
    const problems: string[] = [];
    for (const f of all) {
      const src = readFileSync(f, 'utf8');
      if (!/from 'react-native-svg'/.test(src)) continue;
      const hidden = /accessibilityRole\s*=\s*["']image["']|accessibilityElementsHidden|importantForAccessibility\s*=\s*["']no-hide-descendants["']|aria-hidden/.test(src);
      if (!hidden) problems.push(`${relative(MOBILE, f)} draws Svg without hiding it from VoiceOver`);
    }
    expect(problems).toEqual([]);
  });

  it('no numberOfLines clamp on medical or disclaimer text', () => {
    const problems: string[] = [];
    for (const f of all) {
      const src = readFileSync(f, 'utf8');
      for (const t of openingTags(src, ['AppText', 'Text'])) {
        if (/numberOfLines\s*=/.test(t.props) && /disclaimer|cannotRuleOut|limits|medical|DISCLAIMER|NOT_A_DIAGNOSIS|rule out/i.test(t.props)) {
          problems.push(`${relative(MOBILE, f)}:${t.line} clamps disclaimer text`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
