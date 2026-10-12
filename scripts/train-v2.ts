// v2 training: augmentation + selection on 4-fold grouped CV over folds 1-4. Every CV validation fold is scored in a
// clean AND a lowpass-4kHz condition. Selection criterion = mean of pooled out-of-fold AUC (clean, lp4k).
// Threshold rule: maximize Youden J (TPR-FPR) over the pooled clean+lp4k out-of-fold scores (equal weight to both
// conditions), subject to bedroom-negative window FPR <= 5% in the pooled set when feasible. Fold 5 is never read.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SILENCE_FLOOR_DBFS } from '../src/audio/constants';
import { BEDROOM_NEG_WEIGHT, PROC_DIR, SEED, TRAIN_FOLDS } from './lib/config';
import { loadFeatures } from './lib/data';
import { FEATURE_DIM } from '../src/audio/model/infer';
import { applyNorm, fitNorm, forward, train, type TrainOpts } from './lib/nn';
import { pickThreshold, rocAuc } from './lib/metrics';

const { rows, X } = loadFeatures();
const aIdx = JSON.parse(readFileSync(join(PROC_DIR, 'aug.index.json'), 'utf8')) as { clip: string; start: number; kind: string }[];
const ab = readFileSync(join(PROC_DIR, 'aug.bin'));
const af = new Float32Array(ab.buffer, ab.byteOffset, ab.byteLength / 4);
const key = new Map(rows.map((r, i) => [`${r.clip}|${r.start}`, i]));
interface Item { x: Float64Array; label: number; fold: number; bedroom: boolean; clean?: number }
const cleanItems: Item[] = rows.map((r, i) => ({ x: X[i]!, label: r.label, fold: r.fold, bedroom: r.bedroom, clean: i })).filter((it) => TRAIN_FOLDS.includes(it.fold));
const augItems: Item[] = [], lpItems: Item[] = [];
aIdx.forEach((a, j) => {
  const r = rows[key.get(`${a.clip}|${a.start}`)!]!;
  const it = { x: Float64Array.from(af.subarray(j * FEATURE_DIM, (j + 1) * FEATURE_DIM)), label: r.label, fold: r.fold, bedroom: r.bedroom };
  (a.kind === 'lp4k' ? lpItems : augItems).push(it);
});

function weights(items: Item[]): number[] {
  const raw = items.map((it) => (it.label ? 1 : it.bedroom ? BEDROOM_NEG_WEIGHT : 1));
  const pos = raw.reduce((a, w, i) => a + (items[i]!.label ? w : 0), 0);
  const neg = raw.reduce((a, w, i) => a + (items[i]!.label ? 0 : w), 0);
  return raw.map((w, i) => (items[i]!.label ? w / pos : w / neg));
}
function fit(items: Item[], o: TrainOpts) {
  const norm = fitNorm(items.map((i) => i.x));
  const net = train(items.map((i) => applyNorm(i.x, norm)), items.map((i) => i.label), weights(items), o);
  return { norm, net };
}
const base = { epochs: 12, lr: 1e-3, batch: 128, seed: SEED };
const grid: { name: string; o: TrainOpts; augment: boolean }[] = [];
for (const l2 of [1e-4, 1e-3]) {
  grid.push({ name: `logreg+aug l2=${l2}`, o: { ...base, hidden: 0, l2 }, augment: true });
  grid.push({ name: `mlp32+aug l2=${l2}`, o: { ...base, hidden: 32, l2 }, augment: true });
}
// v1 reference under the same CV criteria: clean-only training, v1's chosen config (30 epochs).
grid.push({ name: 'v1 reference: mlp32 clean-only l2=0.0001', o: { ...base, epochs: 30, hidden: 32, l2: 1e-4 }, augment: false });

interface R { name: string; o: TrainOpts; augment: boolean; aucClean: number; aucLp: number; crit: number; folds: { clean: number; lp: number }[]; oofClean: number[]; oofLp: number[] }
const results: R[] = [];
const lab = cleanItems.map((i) => i.label), bedr = cleanItems.map((i) => i.bedroom);
for (const g of grid) {
  const oofC = new Array<number>(cleanItems.length).fill(NaN), oofL = new Array<number>(cleanItems.length).fill(NaN);
  const folds: R['folds'] = [];
  const lpByKey = new Map<string, Item>();
  void lpByKey;
  for (const vf of TRAIN_FOLDS) {
    const tr = [...cleanItems.filter((i) => i.fold !== vf), ...(g.augment ? augItems.filter((i) => i.fold !== vf) : [])];
    const m = fit(tr, g.o);
    const sc = (it: Item) => forward(m.net, applyNorm(it.x, m.norm));
    const cv = cleanItems.map((it, k) => [it, k] as const).filter(([it]) => it.fold === vf);
    const lv = lpItems.filter((i) => i.fold === vf);
    cv.forEach(([it, k]) => { oofC[k] = sc(it); });
    // lp items were generated in the same order as the clean kept windows within each clip -> align by fold order
    const lpScores = lv.map(sc);
    cv.forEach(([, k], j) => { oofL[k] = lpScores[j]!; });
    folds.push({ clean: rocAuc(cv.map(([, k]) => oofC[k]!), cv.map(([it]) => it.label)), lp: rocAuc(lpScores, lv.map((i) => i.label)) });
  }
  const aucClean = rocAuc(oofC, lab), aucLp = rocAuc(oofL, lab);
  results.push({ ...g, aucClean, aucLp, crit: (aucClean + aucLp) / 2, folds, oofClean: oofC, oofLp: oofL });
  console.log(`${g.name.padEnd(44)} CV AUC clean ${aucClean.toFixed(4)} lp4k ${aucLp.toFixed(4)} mean ${((aucClean + aucLp) / 2).toFixed(4)}`);
}
const cand = results.filter((r) => r.augment);
const best = (h: boolean) => cand.filter((r) => !!r.o.hidden === h).sort((a, b) => b.crit - a.crit)[0]!;
const bestLr = best(false), bestMlp = best(true);
const winner = bestMlp.crit > bestLr.crit ? bestMlp : bestLr;

const finalFor = (r: R) => {
  const thr = pickThreshold([...r.oofClean, ...r.oofLp], [...lab, ...lab], [...bedr, ...bedr], 0.05);
  const m = fit([...cleanItems, ...augItems], r.o);
  return { name: r.name, kind: r.o.hidden ? 'mlp' : 'logreg', opts: r.o, threshold: thr, cvAucPooled: r.crit, cvAucFolds: r.folds.map((f) => (f.clean + f.lp) / 2), norm: m.norm, layers: m.net.layers };
};
const ref = results.find((r) => !r.augment)!;
writeFileSync(join(PROC_DIR, 'trained.v2.json'), JSON.stringify({
  silenceFloorDbfs: SILENCE_FLOOR_DBFS, trainWindows: cleanItems.length + augItems.length, trainPositiveWindows: [...cleanItems, ...augItems].filter((i) => i.label).length,
  augmentation: { copiesPerWindow: 3, lowpassProb: 0.7, lowpassCutoffKHz: [3.5, 8], noiseProb: 0.7, snrDb: [10, 30], gainDb: [-6, 6] },
  winner: winner.name, baseline: finalFor(bestLr), mlp: finalFor(bestMlp),
  grid: results.map(({ name, aucClean, aucLp, crit, folds }) => ({ name, cvAucClean: aucClean, cvAucLp4k: aucLp, cvCriterion: crit, folds })),
  v1Reference: { name: ref.name, cvAucClean: ref.aucClean, cvAucLp4k: ref.aucLp, cvCriterion: ref.crit },
}));
console.log(`winner ${winner.name}; v1 reference criterion ${ref.crit.toFixed(4)} vs v2 ${winner.crit.toFixed(4)}`);
