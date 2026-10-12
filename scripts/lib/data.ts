import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROC_DIR, type Manifest } from './config';
import type { Row } from '../extract-features';

export function loadManifest(): Manifest {
  return JSON.parse(readFileSync(join(PROC_DIR, 'manifest.json'), 'utf8')) as Manifest;
}

export interface Dataset { rows: Row[]; X: Float64Array[] }

export function loadFeatures(): Dataset {
  const rows = JSON.parse(readFileSync(join(PROC_DIR, 'features.index.json'), 'utf8')) as Row[];
  const buf = readFileSync(join(PROC_DIR, 'features.bin'));
  const f = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  const dim = f.length / rows.length;
  const X = rows.map((_, i) => Float64Array.from(f.subarray(i * dim, (i + 1) * dim)));
  return { rows, X };
}
