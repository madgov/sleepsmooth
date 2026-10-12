// Step 2: per-window 80-d features (per-band mean and std of the 100x40 log-mel) for every kept window.
// Output: data/processed/features.bin (Float32, N x 80) + features.index.json (row metadata).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { frameLogMel } from '../src/audio/features';
import { FEATURE_DIM, windowFeatures } from '../src/audio/model/infer';
import { PROC_DIR } from './lib/config';
import { loadManifest } from './lib/data';
import { WIN } from './lib/audio';
import { readWav } from './lib/wav';

export interface Row { clip: string; start: number; label: 0 | 1; fold: number; source: string; cls: string; bedroom: boolean; rmsDbfs: number }

const m = loadManifest();
const rows: Row[] = [];
const chunks: Float32Array[] = [];
for (const c of m.clips) {
  const kept = c.windows.filter((w) => w.kept);
  if (!kept.length) continue;
  const { samples } = readWav(join(PROC_DIR, c.file));
  for (const w of kept) {
    const win = new Float32Array(WIN);
    win.set(samples.subarray(w.start, Math.min(samples.length, w.start + WIN)));
    chunks.push(Float32Array.from(windowFeatures(frameLogMel(win))));
    rows.push({ clip: c.id, start: w.start, label: c.label, fold: c.fold, source: c.source, cls: c.cls, bedroom: c.bedroom, rmsDbfs: w.rmsDbfs });
  }
}
const all = new Float32Array(rows.length * FEATURE_DIM);
chunks.forEach((f, i) => all.set(f, i * FEATURE_DIM));
writeFileSync(join(PROC_DIR, 'features.bin'), Buffer.from(all.buffer));
writeFileSync(join(PROC_DIR, 'features.index.json'), JSON.stringify(rows));
console.log(`features: ${rows.length} windows x ${FEATURE_DIM}`);
