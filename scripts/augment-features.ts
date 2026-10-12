// v2: augmented training features for folds 1-4 (K random copies per window) plus a deterministic lowpass-4kHz copy
// used to score every CV validation fold in the band-limited condition. Test fold 5 is never touched here.
// Augmentation per copy: lowpass w.p. 0.7 (cutoff U(3.5, 8) kHz; >=7.5 kHz skipped), white/pink noise w.p. 0.7 at
// SNR U(10, 30) dB, gain U(-6, +6) dB. Output: data/processed/aug.bin + aug.index.json.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { frameLogMel } from '../src/audio/features';
import { FEATURE_DIM, windowFeatures } from '../src/audio/model/infer';
import { PROC_DIR, SEED, TRAIN_FOLDS } from './lib/config';
import { loadManifest } from './lib/data';
import { WIN } from './lib/audio';
import { addNoise, lowpass, pinkNoise, whiteNoise } from './lib/dsp';
import { mulberry32 } from './lib/rng';
import { readWav } from './lib/wav';

const K = 3;
const m = loadManifest();
const r = mulberry32(SEED + 5);
const idx: { clip: string; start: number; kind: string }[] = [];
const feats: Float32Array[] = [];
const featurize = (x: Float32Array, c: (typeof m.clips)[number], kind: string) => {
  for (const w of c.windows) {
    if (!w.kept) continue;
    const win = new Float32Array(WIN);
    win.set(x.subarray(w.start, w.start + WIN));
    feats.push(Float32Array.from(windowFeatures(frameLogMel(win))));
    idx.push({ clip: c.id, start: w.start, kind });
  }
};
for (const c of m.clips) {
  if (!TRAIN_FOLDS.includes(c.fold) || !c.windows.some((w) => w.kept)) continue;
  const x = readWav(join(PROC_DIR, c.file)).samples;
  featurize(lowpass(x, 4000), c, 'lp4k');
  let e = 0, n = 0;
  for (const w of c.windows) if (w.kept) { for (let i = w.start; i < w.start + WIN; i++) e += x[i]! ** 2; n += WIN; }
  const sig = Math.sqrt(e / n);
  for (let k = 0; k < K; k++) {
    let y = x;
    if (r() < 0.7) { const fc = 3500 + r() * 4500; if (fc < 7500) y = lowpass(y, fc); }
    if (r() < 0.7) y = addNoise(y, r() < 0.5 ? whiteNoise(y.length, r) : pinkNoise(y.length, r), sig, 10 + r() * 20);
    const g = 10 ** ((r() * 12 - 6) / 20);
    featurize(Float32Array.from(y, (v) => v * g), c, `aug${k}`);
  }
}
const all = new Float32Array(feats.length * FEATURE_DIM);
feats.forEach((f, i) => all.set(f, i * FEATURE_DIM));
writeFileSync(join(PROC_DIR, 'aug.bin'), Buffer.from(all.buffer));
writeFileSync(join(PROC_DIR, 'aug.index.json'), JSON.stringify(idx));
console.log(`aug features: ${feats.length}`);
