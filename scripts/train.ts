// Step 3: model selection by 4-fold grouped CV (folds 1-4; each fold held out in turn = validation), then refit
// the winner on folds 1-4. Fold 5 (test) is never read here. Logistic regression baseline vs 80-32-1 MLP.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROC_DIR, BEDROOM_NEG_WEIGHT, SEED, TRAIN_FOLDS } from './lib/config';
import { loadFeatures } from './lib/data';
import { applyNorm, fitNorm, forward, train, type Net, type TrainOpts } from './lib/nn';
import { pickThreshold, rocAuc } from './lib/metrics';
import { SILENCE_FLOOR_DBFS } from '../src/audio/constants';

export const MAX_BEDROOM_FPR = 0.05;

function sampleWeights(labels: number[], bedroom: boolean[]): number[] {
  const raw = labels.map((l, i) => (l ? 1 : bedroom[i] ? BEDROOM_NEG_WEIGHT : 1));
  const pos = raw.reduce((a, w, i) => a + (labels[i] ? w : 0), 0);
  const neg = raw.reduce((a, w, i) => a + (labels[i] ? 0 : w), 0);
  return raw.map((w, i) => (labels[i] ? w / pos : w / neg)); // balanced class totals
}

function fit(X: Float64Array[], y: number[], bed: boolean[], o: TrainOpts) {
  const norm = fitNorm(X);
  const Xn = X.map((x) => applyNorm(x, norm));
  const net = train(Xn, y, sampleWeights(y, bed), o);
  return { norm, net };
}
const predict = (m: { norm: ReturnType<typeof fitNorm>; net: Net }, X: Float64Array[]) => X.map((x) => forward(m.net, applyNorm(x, m.norm)));

const { rows, X } = loadFeatures();
const trainIdx = rows.map((r, i) => (TRAIN_FOLDS.includes(r.fold) ? i : -1)).filter((i) => i >= 0);
const base = { epochs: 30, lr: 1e-3, batch: 128, seed: SEED };
const grid: { name: string; o: TrainOpts }[] = [];
for (const l2 of [1e-4, 1e-3, 1e-2]) {
  grid.push({ name: `logreg l2=${l2}`, o: { ...base, hidden: 0, l2 } });
  grid.push({ name: `mlp32 l2=${l2}`, o: { ...base, hidden: 32, l2 } });
}

const results: { name: string; kind: 'logreg' | 'mlp'; o: TrainOpts; cvAucPooled: number; cvAucFolds: number[]; oof: number[] }[] = [];
for (const g of grid) {
  const oof = new Array<number>(trainIdx.length).fill(NaN);
  const aucs: number[] = [];
  for (const vf of TRAIN_FOLDS) {
    const tr = trainIdx.filter((i) => rows[i]!.fold !== vf);
    const va = trainIdx.map((i, k) => [i, k] as const).filter(([i]) => rows[i]!.fold === vf);
    const m = fit(tr.map((i) => X[i]!), tr.map((i) => rows[i]!.label), tr.map((i) => rows[i]!.bedroom), g.o);
    const p = predict(m, va.map(([i]) => X[i]!));
    va.forEach(([, k], j) => { oof[k] = p[j]!; });
    aucs.push(rocAuc(p, va.map(([i]) => rows[i]!.label)));
  }
  const pooled = rocAuc(oof, trainIdx.map((i) => rows[i]!.label));
  results.push({ name: g.name, kind: g.o.hidden ? 'mlp' : 'logreg', o: g.o, cvAucPooled: pooled, cvAucFolds: aucs, oof });
  console.log(`${g.name.padEnd(20)} CV AUC pooled ${pooled.toFixed(4)} folds ${aucs.map((a) => a.toFixed(3)).join(' ')}`);
}

const bestOf = (kind: 'logreg' | 'mlp') => results.filter((r) => r.kind === kind).sort((a, b) => b.cvAucPooled - a.cvAucPooled)[0]!;
const bestLr = bestOf('logreg');
const bestMlp = bestOf('mlp');
const winner = bestMlp.cvAucPooled > bestLr.cvAucPooled ? bestMlp : bestLr;

const finalFor = (r: typeof bestLr) => {
  const thr = pickThreshold(r.oof, trainIdx.map((i) => rows[i]!.label), trainIdx.map((i) => rows[i]!.bedroom), MAX_BEDROOM_FPR);
  const m = fit(trainIdx.map((i) => X[i]!), trainIdx.map((i) => rows[i]!.label), trainIdx.map((i) => rows[i]!.bedroom), r.o);
  return { name: r.name, kind: r.kind, opts: r.o, threshold: thr, cvAucPooled: r.cvAucPooled, cvAucFolds: r.cvAucFolds, norm: m.norm, layers: m.net.layers };
};
const out = {
  silenceFloorDbfs: SILENCE_FLOOR_DBFS,
  trainWindows: trainIdx.length,
  trainPositiveWindows: trainIdx.filter((i) => rows[i]!.label).length,
  winner: winner.name,
  baseline: finalFor(bestLr),
  mlp: finalFor(bestMlp),
  grid: results.map(({ name, cvAucPooled, cvAucFolds }) => ({ name, cvAucPooled, cvAucFolds })),
};
writeFileSync(join(PROC_DIR, 'trained.json'), JSON.stringify(out));
console.log(`winner: ${winner.name}; baseline ${bestLr.name} ${bestLr.cvAucPooled.toFixed(4)}; mlp ${bestMlp.name} ${bestMlp.cvAucPooled.toFixed(4)}`);
console.log(`thresholds: baseline ${out.baseline.threshold.toFixed(4)} mlp ${out.mlp.threshold.toFixed(4)}`);
