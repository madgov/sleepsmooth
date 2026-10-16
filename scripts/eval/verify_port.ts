// Read-only check that scripts/eval/night_logic.py reproduces the app's night logic. Usage (see verify_port.sh):
//   tsx scripts/eval/verify_port.ts <night.f32> <out.json>
// Runs the REAL NightPipeline (src/night, unmodified) over a rendered 16 kHz float32 night and records, for every 0.5 s window, the status the
// app assigned (scored / belowGate / tooQuiet), its level and the rolling floor; and runs the REAL findEpisodes on seeded random flag sets.
import { readFileSync, writeFileSync } from 'node:fs';
import type { ModelJson } from '../../src/audio/model/schema';
import { createNightPipeline, findEpisodes, type WindowDebug } from '../../src/night';

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) throw new Error('usage: tsx scripts/eval/verify_port.ts <night.f32> <out.json>');
const buf = readFileSync(inPath);
const samples = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
// loadShippedModel() needs Vite's import.meta.glob; under plain Node read the same file directly. Any model works: only the gate is compared.
const model = JSON.parse(readFileSync(new URL('../../src/audio/model/model.json', import.meta.url), 'utf8')) as ModelJson;

const windows: WindowDebug[] = [];
const p = createNightPipeline({ model, captureStartMs: 0, onWindow: (w) => windows.push(w) });
const slice = 16000 * 10;
for (let i = 0; i < samples.length; i += slice) p.push(samples.subarray(i, Math.min(samples.length, i + slice)), 16000);
p.finish('user-stop');

let seed = 12345;
const rnd = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
const episodeCases: { flagged: number[]; episodes: number[][]; flaggedSec: number }[] = [];
for (let c = 0; c < 60; c++) {
  const ks = new Set<number>();
  const bursts = 1 + Math.floor(rnd() * 8);
  for (let b = 0; b < bursts; b++) {
    const start = Math.floor(rnd() * 3000);
    const len = 1 + Math.floor(rnd() * 30);
    for (let j = 0; j < len; j++) if (rnd() < 0.8) ks.add(start + j * (1 + Math.floor(rnd() * 3)));
  }
  const flagged = Array.from(ks);
  const r = findEpisodes(flagged, 0);
  episodeCases.push({ flagged, episodes: r.episodes.map((e) => [e.t0 / 1000, e.t1 / 1000, e.flagged]), flaggedSec: r.flaggedSec });
}
writeFileSync(
  outPath,
  JSON.stringify({
    windows: windows.map((w) => [w.k, w.status, w.levelDb, w.floorDb ?? null]),
    episodeCases,
  }),
);
console.log(`windows ${windows.length}, episode cases ${episodeCases.length}`);
