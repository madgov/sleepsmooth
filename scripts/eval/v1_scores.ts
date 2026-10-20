// Runs the REAL TypeScript night pipeline with the shipped v1 model (src/audio/model/model.json) and NO level gate over a rendered 16 kHz float32 night
// (written by scripts/eval/synthetic_nights.py via NIGHT_DUMP_AUDIO_DIR) and writes one float32 per 0.5 s window: the v1 score, NaN where the window was not scored
// (below the -72 dBFS silence floor). Gates are applied afterwards in Python as masks. SYNTHETIC audio only. Usage:
//   tsx scripts/eval/v1_scores.ts <night.f32> <out.v1.f32>
import { readFileSync, writeFileSync } from 'node:fs';
import type { ModelJson } from '../../src/audio/model/schema';
import { createNightPipeline, type WindowDebug } from '../../src/night';

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) throw new Error('usage: tsx scripts/eval/v1_scores.ts <night.f32> <out.v1.f32>');
const buf = readFileSync(inPath);
const samples = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
const model = JSON.parse(readFileSync(new URL('../../src/audio/model/model.json', import.meta.url), 'utf8')) as ModelJson;
const nwin = Math.floor(samples.length / 8000) - 1;
const out = new Float32Array(nwin).fill(NaN);
const p = createNightPipeline({
  model,
  captureStartMs: 0,
  gate: false,
  onWindow: (w: WindowDebug) => {
    if (w.status === 'scored' && w.score !== undefined && w.k < nwin) out[w.k] = w.score;
  },
});
const slice = 16000 * 10;
for (let i = 0; i < samples.length; i += slice) p.push(samples.subarray(i, Math.min(samples.length, i + slice)), 16000);
p.finish('user-stop');
writeFileSync(outPath, Buffer.from(out.buffer));
console.log(`windows ${nwin}, scored ${out.filter((v) => !Number.isNaN(v)).length}`);
