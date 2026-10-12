import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Every SF Symbol the iOS app draws must have a mapping in the web preview (Icon.web.tsx), so the preview never shows a
// placeholder circle and review screenshots match the device. The tab bar must use one base symbol per tab.
const MOBILE = join(process.cwd(), 'mobile');
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    if (n === 'node_modules' || n === 'dist' || n === 'ios') return [];
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return files(p);
    return /\.tsx?$/.test(n) && !/Icon\.web\.tsx$/.test(n) ? [p] : [];
  });
}
const mapped = new Set(
  [...readFileSync(join(MOBILE, 'src/ui/Icon.web.tsx'), 'utf8').matchAll(/^\s*'?([a-z0-9.]+)'?:\s*'[a-z0-9-]+',?$/gim)].map((m) => m[1] as string),
);

function usedSymbols(): Map<string, string> {
  const used = new Map<string, string>();
  const add = (n: string, f: string) => { if (/^[a-z0-9]+(\.[a-z0-9]+)*$/.test(n) && !used.has(n)) used.set(n, f); };
  for (const f of [...files(join(MOBILE, 'app')), ...files(join(MOBILE, 'src'))]) {
    const src = readFileSync(f, 'utf8');
    for (const line of src.split('\n')) {
      if (/<Icon(Tile)?\b/.test(line)) for (const m of line.matchAll(/name=(?:"([^"]+)"|\{'([^']+)'\})/g)) add((m[1] ?? m[2]) as string, f);
      for (const m of line.matchAll(/\b(?:icon|iconSelected|symbol|leadingIcon|trailingIcon)\w*\s*[:=]\s*\{?\s*['"]([a-z0-9.]+)['"]/g)) add(m[1] as string, f);
    }
  }
  return used;
}

describe('web icon map', () => {
  it('scans a sane number of names', () => {
    expect(mapped.size).toBeGreaterThan(50);
    expect(usedSymbols().size).toBeGreaterThan(15);
  });
  it('maps every SF Symbol name the app uses', () => {
    const missing = [...usedSymbols()].filter(([n]) => !mapped.has(n)).map(([n, f]) => `${n} (${f.replace(MOBILE, 'mobile')})`);
    expect(missing).toEqual([]);
  });
  it('tab bar uses one base symbol per tab, selected differs only by .fill', () => {
    const src = readFileSync(join(MOBILE, 'src/ui/GlassTabBar.tsx'), 'utf8');
    const rows = [...src.matchAll(/icon: '([^']+)', iconSelected: '([^']+)'/g)];
    expect(rows.length).toBe(4);
    for (const [, base, sel] of rows) expect([base, `${base}.fill`]).toContain(sel);
    expect(rows.some((r) => /moon/.test(r[1] ?? ''))).toBe(false);
  });
});
