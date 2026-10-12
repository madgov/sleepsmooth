// Step 4: ONE evaluation on the fold-5 test set. Refuses to overwrite model/metrics.json unless EVAL_FORCE=1.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { frameLogMel } from '../src/audio/features';
import { SILENCE_FLOOR_DBFS } from '../src/audio/constants';
import { windowFeatures } from '../src/audio/model/infer';
import { MODEL_DIR, PROC_DIR, ROOT, SEED, TEST_FOLD, TRAIN_FOLDS } from './lib/config';
import { loadFeatures, loadManifest } from './lib/data';
import { WIN, rmsDbfs, windowStarts } from './lib/audio';
import { applyNorm, forward, fitNorm, train, type Dense } from './lib/nn';
import { bootstrapCi, confusion, prf, rocAuc } from './lib/metrics';
import { mulberry32, randn } from './lib/rng';
import { readWav } from './lib/wav';

const FFMPEG = process.env.FFMPEG ?? '/usr/local/bin/ffmpeg';
const METRICS = join(MODEL_DIR, process.env.METRICS_FILE ?? 'metrics.json');
if (existsSync(METRICS) && !process.env.EVAL_FORCE) throw new Error('metrics.json exists: the test set is evaluated once. Set EVAL_FORCE=1 to re-run deliberately.');

interface Trained { kind: string; name: string; opts: unknown; threshold: number; cvAucPooled: number; cvAucFolds: number[]; norm: { mean: number[]; std: number[] }; layers: Dense[] }
const T = JSON.parse(readFileSync(join(PROC_DIR, process.env.TRAINED_FILE ?? 'trained.json'), 'utf8')) as { winner: string; baseline: Trained; mlp: Trained; grid: unknown; trainWindows: number; trainPositiveWindows: number };
const winner = T.winner === T.mlp.name ? T.mlp : T.baseline;
const score = (m: Trained, x: ArrayLike<number>) => forward({ layers: m.layers }, applyNorm(x, m.norm));

const { rows, X } = loadFeatures();
const manifest = loadManifest();
const testIdx = rows.map((r, i) => (r.fold === TEST_FOLD ? i : -1)).filter((i) => i >= 0);
const y = testIdx.map((i) => rows[i]!.label);
const clip = testIdx.map((i) => rows[i]!.clip);
const bed = testIdx.map((i) => rows[i]!.bedroom && !rows[i]!.label);
const src = testIdx.map((i) => rows[i]!.source);

function summarize(m: Trained, s: number[], labels: number[], clips: string[], ci = true) {
  const c = confusion(s, labels, m.threshold);
  const base = prf(c);
  const auc = rocAuc(s, labels);
  const out: Record<string, unknown> = { n: labels.length, positives: labels.filter(Boolean).length, auc, ...base, confusion: c };
  if (ci) {
    const stat = (f: (p: ReturnType<typeof prf>, a: number) => number) => (sel: number[]) =>
      f(prf(confusion(sel.map((k) => s[k]!), sel.map((k) => labels[k]!), m.threshold)), rocAuc(sel.map((k) => s[k]!), sel.map((k) => labels[k]!)));
    out.ci95 = {
      auc: bootstrapCi(clips, stat((_, a) => a)), accuracy: bootstrapCi(clips, stat((p) => p.accuracy)),
      precision: bootstrapCi(clips, stat((p) => p.precision)), recall: bootstrapCi(clips, stat((p) => p.recall)),
      f1: bootstrapCi(clips, stat((p) => p.f1)), fpr: bootstrapCi(clips, stat((p) => p.fpr)),
    };
  }
  return out;
}
function bedroomFpr(m: Trained, s: number[], labels: number[], isBed: boolean[], clips: string[]) {
  const sel = s.map((_, k) => k).filter((k) => isBed[k] && !labels[k]);
  const fpr = (idx: number[]) => idx.filter((k) => s[k]! >= m.threshold).length / idx.length;
  const byClip = new Map<string, number[]>();
  sel.forEach((k) => (byClip.get(clips[k]!) ?? byClip.set(clips[k]!, []).get(clips[k]!)!).push(k));
  const ids = [...byClip.keys()]; const r = mulberry32(11); const vs: number[] = [];
  for (let b = 0; b < 1000; b++) { const idx: number[] = []; for (let j = 0; j < ids.length; j++) idx.push(...byClip.get(ids[Math.floor(r() * ids.length)]!)!); vs.push(fpr(idx)); }
  vs.sort((a, b) => a - b);
  return { windows: sel.length, fpr: fpr(sel), ci95: [vs[24]!, vs[974]!] };
}

const results: Record<string, unknown> = {};
for (const [tag, m] of [['baseline', T.baseline], ['mlp', T.mlp]] as const) {
  const s = testIdx.map((i) => score(m, X[i]!));
  results[tag] = { model: m.name, threshold: m.threshold, cvAuc: m.cvAucPooled, overall: summarize(m, s, y, clip), bedroomNegatives: bedroomFpr(m, s, y, bed, clip) };
}
const sW = testIdx.map((i) => score(winner, X[i]!));
const perClass: Record<string, { windows: number; fpr: number }> = {};
for (const k of testIdx.keys()) {
  if (y[k]) continue;
  const c = rows[testIdx[k]!]!.cls;
  const e = (perClass[c] ??= { windows: 0, fpr: 0 });
  e.windows++; if (sW[k]! >= winner.threshold) e.fpr++;
}
for (const e of Object.values(perClass)) e.fpr = e.fpr / e.windows;
const worstClasses = Object.entries(perClass).sort((a, b) => b[1].fpr - a[1].fpr).slice(0, 8).map(([cls, e]) => ({ cls, ...e }));

// Per-source (ER-2)
const perSource: Record<string, unknown> = {};
for (const so of ['esc50', 'kaggle']) {
  const sel = testIdx.map((_, k) => k).filter((k) => src[k] === so);
  if (!sel.length) { perSource[so] = { note: 'no test windows from this source in this build' }; continue; }
  perSource[so] = summarize(winner, sel.map((k) => sW[k]!), sel.map((k) => y[k]!), sel.map((k) => clip[k]!));
}
const kaggleIn = rows.some((r) => r.source === 'kaggle');
let confound: Record<string, unknown>;
if (!kaggleIn) {
  confound = { applicable: false, note: 'No Kaggle data in this build. Positives and negatives are all ESC-50, so the ER-2 source confound does not apply. Within-Kaggle AUC and source-classifier check not run.' };
} else {
  const ksel = testIdx.map((_, k) => k).filter((k) => src[k] === 'kaggle');
  const within = rocAuc(ksel.map((k) => sW[k]!), ksel.map((k) => y[k]!));
  // source classifier on negatives only: LR (esc50 vs kaggle) trained on folds 1-4, tested on fold 5.
  const neg = rows.map((r, i) => (r.label === 0 ? i : -1)).filter((i) => i >= 0);
  const tr = neg.filter((i) => TRAIN_FOLDS.includes(rows[i]!.fold)); const te = neg.filter((i) => rows[i]!.fold === TEST_FOLD);
  const nrm = fitNorm(tr.map((i) => X[i]!));
  const ys = tr.map((i) => (rows[i]!.source === 'kaggle' ? 1 : 0));
  const wts = ys.map((l) => (l ? 0.5 / ys.filter(Boolean).length : 0.5 / ys.filter((v) => !v).length));
  const net = train(tr.map((i) => applyNorm(X[i]!, nrm)), ys, wts, { hidden: 0, l2: 1e-3, epochs: 20, lr: 1e-3, batch: 128, seed: SEED });
  const srcAuc = rocAuc(te.map((i) => forward(net, applyNorm(X[i]!, nrm))), te.map((i) => (rows[i]!.source === 'kaggle' ? 1 : 0)));
  confound = { applicable: true, withinKaggleAuc: within, sourceClassifierAucOnNegatives: srcAuc, sourceClassifierNote: 'AUC near 0.5 = sources indistinguishable on negatives; near 1 = strong source signal (confound risk)' };
}

// Robustness on fold-5 kept windows (same windows as clean)
function pinkNoise(n: number, r: () => number): Float32Array {
  const o = new Float32Array(n); let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = randn(r);
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    o[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926;
  }
  return o;
}
const tmp = join(PROC_DIR, 'robust'); mkdirSync(tmp, { recursive: true });
function lowpass8k(file: string): Float32Array {
  const a = join(tmp, 'n8.wav'), b = join(tmp, 'n16.wav');
  spawnSync(FFMPEG, ['-v', 'error', '-y', '-i', join(PROC_DIR, file), '-ar', '8000', a]);
  spawnSync(FFMPEG, ['-v', 'error', '-y', '-i', a, '-ar', '16000', '-c:a', 'pcm_f32le', b]);
  return readWav(b).samples;
}
const conditions = [
  { name: 'clean', kind: 'clean' }, { name: 'white noise SNR 20 dB', kind: 'white', snr: 20 }, { name: 'white noise SNR 10 dB', kind: 'white', snr: 10 },
  { name: 'pink noise SNR 20 dB', kind: 'pink', snr: 20 }, { name: 'pink noise SNR 10 dB', kind: 'pink', snr: 10 },
  { name: '8 kHz sampling rate (4 kHz bandwidth, phone proxy)', kind: 'lp8k' },
] as const;
const testClips = manifest.clips.filter((c) => c.fold === TEST_FOLD);
const robust: Record<string, unknown> = {};
for (const cd of conditions) {
  const sc: number[] = [], lb: number[] = [], cl: string[] = [], bd: boolean[] = [];
  const r = mulberry32(SEED + 99);
  for (const c of testClips) {
    const kept = c.windows.filter((w) => w.kept);
    if (!kept.length) continue;
    let x = readWav(join(PROC_DIR, c.file)).samples;
    if (cd.kind === 'lp8k') x = lowpass8k(c.file);
    else if (cd.kind !== 'clean') {
      let e = 0, n = 0; for (const w of kept) { for (let i = w.start; i < w.start + WIN; i++) e += x[i]! ** 2; n += WIN; }
      const sig = Math.sqrt(e / n); const noise = cd.kind === 'white' ? Float32Array.from({ length: x.length }, () => randn(r)) : pinkNoise(x.length, r);
      let ne = 0; for (const v of noise) ne += v * v; const g = (sig / 10 ** (cd.snr / 20)) / Math.sqrt(ne / noise.length);
      x = Float32Array.from(x, (v, i) => v + g * noise[i]!);
    }
    for (const w of kept) {
      const win = new Float32Array(WIN); win.set(x.subarray(w.start, w.start + WIN));
      sc.push(score(winner, windowFeatures(frameLogMel(win)))); lb.push(c.label); cl.push(c.id); bd.push(c.bedroom && !c.label);
    }
  }
  const conf = confusion(sc, lb, winner.threshold); const p = prf(conf);
  robust[cd.name] = { auc: rocAuc(sc, lb), recall: p.recall, fpr: p.fpr, bedroomFpr: bedroomFpr(winner, sc, lb, bd, cl).fpr, precision: p.precision };
}

// ER-2(d)-style sanity check on the assembled demo recording (fold-5 clips only), for manual review.
let sample: unknown = null;
const samplePath = join(ROOT, 'public/sample-audio/esc50-sample.wav');
if (existsSync(samplePath)) {
  const segs = JSON.parse(readFileSync(join(ROOT, 'public/sample-audio/esc50-sample.segments.json'), 'utf8')) as { start: number; end: number; cls: string }[];
  const x = readWav(samplePath).samples;
  const per: Record<string, { windows: number; tooQuiet: number; snoreLike: number }> = {};
  for (const s of windowStarts(x.length)) {
    const mid = (s + WIN / 2) / 16000; const seg = segs.find((g) => mid >= g.start && mid < g.end);
    const e = (per[seg?.cls ?? '?'] ??= { windows: 0, tooQuiet: 0, snoreLike: 0 });
    e.windows++;
    if (rmsDbfs(x, s, WIN) < SILENCE_FLOOR_DBFS) { e.tooQuiet++; continue; }
    if (score(winner, windowFeatures(frameLogMel(x.slice(s, s + WIN)))) >= winner.threshold) e.snoreLike++;
  }
  sample = { note: 'windows labeled by the segment containing their midpoint; fold-5 clips; for manual review, not a performance claim', durationSec: x.length / 16000, perClass: per };
}

const ci = (winner === T.mlp ? (results.mlp as { overall: { auc: number } }) : (results.baseline as { overall: { auc: number } })).overall;
const bedFpr = (winner === T.mlp ? results.mlp : results.baseline) as { bedroomNegatives: { fpr: number } };
const mlpAuc = (results.mlp as { overall: { auc: number } }).overall.auc, lrAuc = (results.baseline as { overall: { auc: number } }).overall.auc;
const gate = {
  aucAtLeast085: ci.auc >= 0.85,
  beatsBaseline: winner === T.mlp ? mlpAuc > lrAuc : true,
  beatsBaselineNote: winner === T.mlp ? `MLP test AUC ${mlpAuc.toFixed(3)} vs logistic regression ${lrAuc.toFixed(3)}` : 'selected model IS the logistic-regression baseline (MLP did not beat it in CV)',
  ambientFpAcceptable: bedFpr.bedroomNegatives.fpr <= 0.1,
  ambientFpCriterion: 'window-level FPR on bedroom-relevant negatives <= 0.10 at the validation-chosen threshold',
  confoundGate: kaggleIn ? ((confound as { withinKaggleAuc: number }).withinKaggleAuc >= 0.85 && (confound as { sourceClassifierAucOnNegatives: number }).sourceClassifierAucOnNegatives < 0.95) : 'not applicable (ESC-50-only build)',
  pass: false,
};
gate.pass = gate.aucAtLeast085 && gate.beatsBaseline && gate.ambientFpAcceptable && (gate.confoundGate === true || typeof gate.confoundGate === 'string');

const metrics = {
  generatedAt: new Date().toISOString(), silenceFloorDbfs: SILENCE_FLOOR_DBFS, testFold: TEST_FOLD, trainFolds: TRAIN_FOLDS,
  selection: { method: '4-fold grouped CV over folds 1-4 (each fold held out in turn)', grid: T.grid, winner: T.winner },
  trainWindows: T.trainWindows, trainPositiveWindows: T.trainPositiveWindows,
  test: results, winnerPerSource: perSource, winnerWorstNegativeClasses: worstClasses, confound, robustnessWinner: robust, sampleRecordingCheck: sample, gate,
};
mkdirSync(MODEL_DIR, { recursive: true });
writeFileSync(METRICS, JSON.stringify(metrics, null, 2));
console.log(JSON.stringify({ winner: T.winner, gate, mlp: (results.mlp as { overall: unknown }).overall, baselineAuc: lrAuc, robust }, null, 1));
