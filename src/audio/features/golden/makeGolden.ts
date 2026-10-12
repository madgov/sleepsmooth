// Generates golden/*.json. Run from the repo root: npx tsx src/audio/features/golden/makeGolden.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GOLDEN_CASES, type GoldenFile } from './goldenCases';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'golden');
mkdirSync(dir, { recursive: true });
for (const c of GOLDEN_CASES) {
  const out = c.compute();
  const file: GoldenFile = { name: c.name, length: out.length, values: Array.from(out, (v) => Number(v.toFixed(7))) };
  writeFileSync(join(dir, `${c.name}.json`), JSON.stringify(file));
  console.log(`wrote ${c.name}.json (${out.length} values)`);
}
