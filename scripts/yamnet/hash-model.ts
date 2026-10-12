// Fills `weightsHash` of src/audio/model/model.v3.json: sha256 of JSON.stringify({ norm, layers, threshold }) (same recipe as v1's
// export-model.ts, computed in JS so the app-side test can reproduce it byte for byte).
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) throw new Error('usage: tsx hash-model.ts <model.v3.json>');
const m = JSON.parse(readFileSync(file, 'utf8')) as { norm: unknown; layers: unknown; threshold: number; weightsHash: string };
m.weightsHash = createHash('sha256').update(JSON.stringify({ norm: m.norm, layers: m.layers, threshold: m.threshold })).digest('hex');
writeFileSync(file, JSON.stringify(m));
console.log(`weightsHash ${m.weightsHash}`);
