import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// ER-8: forbidden strings in user-facing copy, checked over all string literals in src/**/*.ts(x).
const ROOT = join(process.cwd(), 'src');
const FORBIDDEN: { name: string; re: RegExp; allow: string[] }[] = [
  { name: 'pause', re: /\bpauses?\b/i, allow: ['src/questionnaire/symptomChecklist.ts'] },
  { name: 'apnea event', re: /apnea events?/i, allow: ['src/content/claims.ts'] },
  { name: 'severe apnea / apnea clip', re: /severe apnea|apnea clips?/i, allow: [] },
  { name: 'breathing stopped', re: /breathing stopped/i, allow: [] },
  { name: 'low risk', re: /low[- ]risk/i, allow: [] },
  { name: 'safe', re: /\bsafe\b/i, allow: [] },
  { name: 'all clear', re: /all[- ]clear/i, allow: [] },
  { name: 'probability', re: /\bprobabilit/i, allow: [] },
  { name: 'confidence', re: /\bconfidence\b/i, allow: [] },
  // Overnight mode: the app estimates, it never "detects" sleep or grades it.
  { name: 'sleep detected', re: /sleep (was |is )?detected|detected (your )?sleep/i, allow: [] },
  { name: 'you slept', re: /\byou (slept|were asleep|fell asleep at)\b/i, allow: [] },
  { name: 'sleep score', re: /sleep (score|quality|efficiency)/i, allow: [] },
  { name: 'sleep stage', re: /sleep stages?|\b(deep|rem|light) sleep\b/i, allow: [] },
  { name: 'bare asleep', re: /(?<!(?:estimated|likely|fallen|falling|nearly|fall|fell|stay|staying|stayed|while|drifting off|dozing off)[ -])\basleep\b/i, allow: [] },
  { name: 'diagnos*', re: /diagnos/i, allow: ['src/content/claims.ts', 'src/components/Disclaimer.tsx'] },
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return files(p);
    return /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n) && !n.endsWith('.d.ts') ? [p] : [];
  });
}

function literals(path: string): string[] {
  const src = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: string[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) return;
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n) || ts.isJsxText(n)) {
      // Single-token literals (ids, keys, class names, import-like strings) are not user-facing copy.
      if (/\s/.test(n.text.trim())) out.push(n.text);
    }
    ts.forEachChild(n, visit);
  };
  visit(src);
  return out;
}

describe('ER-8 forbidden phrases', () => {
  const all = files(ROOT).map((f) => ({ rel: relative(process.cwd(), f), lits: literals(f) }));
  it('scans a meaningful number of files', () => expect(all.length).toBeGreaterThan(10));
  for (const rule of FORBIDDEN) {
    it(`no "${rule.name}" outside its allowlist`, () => {
      const hits = all.filter((f) => !rule.allow.includes(f.rel)).flatMap((f) => f.lits.filter((l) => rule.re.test(l)).map((l) => `${f.rel}: ${l.slice(0, 80)}`));
      expect(hits).toEqual([]);
    });
  }
  it('"pauses" appears in the checklist wording (allowlist is exercised)', () => {
    expect(all.find((f) => f.rel === 'src/questionnaire/symptomChecklist.ts')?.lits.some((l) => /pauses/.test(l))).toBe(true);
  });
});

// Native app (mobile/app, mobile/src): the same rules, plus "detector" wording is banned. The only allowed use of
// "diagnos" is the "Not a diagnosis" label; claims-sourced strings reach the app through @core imports, not literals.
const MOBILE_ROOTS = [join(process.cwd(), 'mobile', 'app'), join(process.cwd(), 'mobile', 'src')];
const MOBILE_EXTRA: { name: string; re: RegExp }[] = [
  { name: 'detector', re: /\bdetectors?\b/i },
  { name: 'detected', re: /\bdetected\b/i },
  { name: 'apnea detected', re: /apnea (was )?detected/i },
];

describe('ER-8 forbidden phrases in the native app', () => {
  const all = MOBILE_ROOTS.flatMap((r) => files(r)).map((f) => ({ rel: relative(process.cwd(), f), lits: literals(f) }));
  it('scans the native app sources', () => expect(all.length).toBeGreaterThan(20));
  const clean = (l: string) => l.replace(/not a diagnosis/gi, '');
  const rules = [...FORBIDDEN.filter((r) => r.name !== 'diagnos*').map((r) => ({ name: r.name, re: r.re })), { name: 'diagnos*', re: /diagnos/i }, ...MOBILE_EXTRA];
  for (const rule of rules) {
    it(`no "${rule.name}" in mobile literals`, () => {
      const hits = all.flatMap((f) => f.lits.filter((l) => rule.re.test(clean(l))).map((l) => `${f.rel}: ${l.slice(0, 80)}`));
      expect(hits).toEqual([]);
    });
  }
});
