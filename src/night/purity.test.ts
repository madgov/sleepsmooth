import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// src/night must run on Node/Vitest and Hermes: no UI framework, no DOM, no web-only APIs.
const DIR = join(process.cwd(), 'src', 'night');
const files = readdirSync(DIR).filter((f) => /\.ts$/.test(f) && !/\.test\.ts$/.test(f));
const BANNED_GLOBALS = new Set(['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'indexedDB', 'AudioContext', 'OfflineAudioContext', 'Worker', 'SharedArrayBuffer', 'btoa', 'atob', 'require', 'process']);

function scan(path: string): { imports: string[]; globals: string[]; importMeta: boolean } {
  const sf = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
  const imports: string[] = [];
  const globals: string[] = [];
  let importMeta = false;
  const visit = (n: ts.Node) => {
    if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) imports.push(n.moduleSpecifier.text);
    if (ts.isMetaProperty(n)) importMeta = true;
    if (ts.isIdentifier(n) && BANNED_GLOBALS.has(n.text)) {
      const p = n.parent;
      const isMember = (ts.isPropertyAccessExpression(p) && p.name === n) || (ts.isPropertyAssignment(p) && p.name === n) || (ts.isPropertySignature(p) && p.name === n);
      if (!isMember) globals.push(n.text);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return { imports, globals, importMeta };
}

describe('src/night is platform-neutral', () => {
  it('has source files', () => expect(files.length).toBeGreaterThan(8));
  for (const f of files) {
    const r = scan(join(DIR, f));
    it(`${f} imports nothing platform-specific`, () => {
      for (const i of r.imports) {
        expect(i, `${f} imports ${i}`).not.toMatch(/^(react|react-native|expo|react-dom)(\/|$)/);
        expect(i, `${f} imports ${i}`).not.toMatch(/^node:/);
        expect(i, `${f} imports ${i}`).not.toMatch(/\.(tsx|css)$/);
      }
    });
    it(`${f} uses no DOM, worker, web-audio or import.meta`, () => {
      expect(r.globals).toEqual([]);
      expect(r.importMeta).toBe(false);
    });
  }
});
