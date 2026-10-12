// Step 5: choose between v1 (clean-only) and v2 (augmented), write the combined model/metrics.json, and, if a version
// passes its fold-5 gate, write src/audio/model/model.json (schema.ts) plus the parity fixture. Rule: among versions
// whose gate passed, ship the one with the higher cross-validation criterion (mean pooled CV AUC over clean and
// lowpass-4kHz validation); ties/absent v2 data fall back to v1. If none passes, remove model.json (ER-9).
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FRAME_MS, HOP_MS, N_MELS, SAMPLE_RATE, SILENCE_FLOOR_DBFS, WINDOW_HOP_SEC, WINDOW_SEC } from '../src/audio/constants';
import type { ModelJson } from '../src/audio/model/schema';
import { FIXTURE_JSON, MODEL_DIR, MODEL_JSON, PROC_DIR, TEST_FOLD } from './lib/config';
import { loadFeatures, loadManifest } from './lib/data';
import { applyNorm, forward, type Dense } from './lib/nn';

/* eslint-disable @typescript-eslint/no-explicit-any */
const rd = (p: string) => JSON.parse(readFileSync(p, 'utf8')) as any;
const v1 = rd(join(MODEL_DIR, 'metrics.v1.json'));
const v2 = rd(join(MODEL_DIR, 'metrics.v2.json'));
const T1 = rd(join(PROC_DIR, 'trained.v1.json'));
const T2 = rd(join(PROC_DIR, 'trained.v2.json'));

const dropped: Record<string, { kept: number; dropped: number }> = {};
const bySplit: Record<string, { kept: number; dropped: number }> = { 'train/val (folds 1-4)': { kept: 0, dropped: 0 }, 'test (fold 5)': { kept: 0, dropped: 0 } };
for (const c of loadManifest().clips) {
  for (const w of c.windows) {
    const k = w.kept ? 'kept' : 'dropped';
    (dropped[`${c.source}:${c.cls}`] ??= { kept: 0, dropped: 0 })[k]++;
    bySplit[c.fold === TEST_FOLD ? 'test (fold 5)' : 'train/val (folds 1-4)']![k]++;
  }
}
const cv = {
  v1: { cvAucClean: T2.v1Reference.cvAucClean, cvAucLp4k: T2.v1Reference.cvAucLp4k, criterion: T2.v1Reference.cvCriterion },
  v2: T2.grid.find((g: any) => g.name === T2.winner),
};
const crit2 = cv.v2.cvCriterion as number;
const cands = [
  { tag: 'v1', pass: v1.gate.pass as boolean, crit: cv.v1.criterion as number },
  { tag: 'v2', pass: v2.gate.pass as boolean, crit: crit2 },
].filter((c) => c.pass).sort((a, b) => b.crit - a.crit);
const ship = cands[0]?.tag ?? null;
const note = 'Fold 5 was scored twice (v1, v2); v2 changes were decided on cross-validation only, but the test estimate is now mildly optimistic.';
const fullMetrics = { shipped: ship, note, cvSelection: cv, droppedSilentWindows: { floorDbfs: SILENCE_FLOOR_DBFS, bySplit, byClass: dropped }, v1, v2 };
writeFileSync(join(MODEL_DIR, 'metrics.json'), JSON.stringify(fullMetrics, null, 2));
console.log(`shipped: ${ship}; CV criteria v1 ${cv.v1.criterion.toFixed(4)} v2 ${crit2.toFixed(4)}`);

if (!ship) {
  for (const f of [MODEL_JSON, FIXTURE_JSON]) if (existsSync(f)) rmSync(f);
  console.log('no version passed the gate: no model.json written (modelVersion stays null).');
  process.exit(0);
}
const T = ship === 'v2' ? T2 : T1;
const w = T.winner === T.mlp.name ? T.mlp : T.baseline;
const layers = w.layers.map((l: Dense) => ({ type: 'dense', weights: l.W, bias: l.b, activation: l.act }));
const body = { norm: w.norm, layers, threshold: w.threshold };
const weightsHash = createHash('sha256').update(JSON.stringify(body)).digest('hex');
const model: ModelJson = {
  version: `sleepsmooth-snore-${w.kind}-esc50-${ship === 'v2' ? '0.2.0-aug' : '0.1.0'}`,
  featureSpec: { sampleRate: SAMPLE_RATE, frameMs: FRAME_MS, hopMs: HOP_MS, windowSec: WINDOW_SEC, windowHopSec: WINDOW_HOP_SEC, nMels: N_MELS },
  silenceFloorDbfs: SILENCE_FLOOR_DBFS,
  norm: body.norm,
  layers: body.layers,
  threshold: body.threshold,
  weightsHash,
  trainedAt: (ship === 'v2' ? v2 : v1).generatedAt,
};
writeFileSync(MODEL_JSON, JSON.stringify(model));

// Parity fixture: raw 80-d features of 24 fold-5 windows + training-side (scripts/lib/nn.ts) probabilities.
const { rows, X } = loadFeatures();
const idx = rows.map((r, i) => (r.fold === TEST_FOLD ? i : -1)).filter((i) => i >= 0);
const pick = idx.filter((_, k) => k % Math.floor(idx.length / 24) === 0).slice(0, 24);
const fixture = pick.map((i) => ({ features: Array.from(X[i]!), expected: forward({ layers: w.layers }, applyNorm(X[i]!, w.norm)) }));
writeFileSync(FIXTURE_JSON, JSON.stringify(fixture));
console.log(`wrote ${MODEL_JSON} (${model.version}, hash ${weightsHash.slice(0, 12)}) and ${fixture.length} fixtures`);
