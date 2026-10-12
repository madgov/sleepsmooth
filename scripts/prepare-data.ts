// Step 1: decode with ffmpeg to 16 kHz mono float32 WAV, window, compute RMS dBFS, set the silence floor
// (Amendment 2), and flag windows below it as dropped. Output: data/processed/{clips/*.wav,manifest.json}.
// Treats data/raw as untrusted data: files are only ever decoded by ffmpeg, never executed.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join, relative } from 'node:path';
import { SAMPLE_RATE, SILENCE_FLOOR_DBFS } from '../src/audio/constants';
import { CONSTANTS_TS, ESC_DIR, KAGGLE_DIR, PROC_DIR, SEED, TEST_FOLD, type ClipMeta, type Manifest } from './lib/config';
import { readWav } from './lib/wav';
import { rmsDbfs, WIN, windowStarts } from './lib/audio';
import { mulberry32, shuffle } from './lib/rng';

const FFMPEG = process.env.FFMPEG ?? '/usr/local/bin/ffmpeg';
const AUDIO_EXT = new Set(['.wav', '.mp3', '.ogg', '.flac', '.m4a']);

function ffmpegDecode(inFile: string, outFile: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, ['-v', 'error', '-y', '-i', inFile, '-ac', '1', '-ar', String(SAMPLE_RATE), '-c:a', 'pcm_f32le', outFile]);
    let err = '';
    p.stderr.on('data', (d) => (err += String(d)));
    p.on('close', (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg ${c}: ${inFile} ${err}`))));
  });
}

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>): Promise<void> {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++] as T); }));
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.isFile() && AUDIO_EXT.has(extname(e.name).toLowerCase())) out.push(p);
  }
  return out.sort();
}

export function percentile(sorted: number[], q: number): number {
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return (sorted[lo] ?? 0) + ((sorted[hi] ?? 0) - (sorted[lo] ?? 0)) * (i - lo);
}

interface Job { id: string; src: string; meta: Omit<ClipMeta, 'file' | 'nSamples' | 'windows'> }

async function main() {
  mkdirSync(join(PROC_DIR, 'clips'), { recursive: true });
  const jobs: Job[] = [];

  // ESC-50: positives = snoring, negatives = every other class. Folds come from the dataset.
  const csv = readFileSync(join(ESC_DIR, 'meta/esc50.csv'), 'utf8').trim().split('\n').slice(1);
  const { BEDROOM_CLASSES } = await import('./lib/config');
  for (const line of csv) {
    const [filename, fold, , category] = line.split(',') as [string, string, string, string];
    jobs.push({
      id: `esc50/${filename.replace('.wav', '')}`,
      src: join(ESC_DIR, 'audio', filename),
      meta: { id: `esc50/${filename.replace('.wav', '')}`, source: 'esc50', cls: category, label: category === 'snoring' ? 1 : 0, fold: Number(fold), bedroom: BEDROOM_CLASSES.includes(category) },
    });
  }

  // Kaggle (optional): label from the parent folder name ("1"/"snor*" = snore, "0"/"non*" = non-snore).
  const kaggleFiles = existsSync(KAGGLE_DIR) ? walk(KAGGLE_DIR) : [];
  console.log(`ESC-50 clips: ${jobs.length}; Kaggle audio files found: ${kaggleFiles.length}`);
  const kagglePending: { file: string; label: 0 | 1 }[] = [];
  for (const f of kaggleFiles) {
    const rel = relative(KAGGLE_DIR, f).toLowerCase().split('/');
    const dirs = rel.slice(0, -1);
    const isNon = dirs.some((d) => d === '0' || d.startsWith('non') || d.includes('not'));
    const isSnore = dirs.some((d) => d === '1' || d.startsWith('snor'));
    if (isNon === isSnore) { console.warn(`  skip (cannot infer label): ${rel.join('/')}`); continue; }
    kagglePending.push({ file: f, label: isSnore ? 1 : 0 });
  }

  await pool(jobs, 8, async (j) => {
    const out = join(PROC_DIR, 'clips', `${j.id.replace('/', '_')}.wav`);
    if (!existsSync(out) || process.env.FORCE_DECODE) await ffmpegDecode(j.src, out);
  });
  const clips: ClipMeta[] = jobs.map((j) => {
    const file = `clips/${j.id.replace('/', '_')}.wav`;
    return { ...j.meta, file, nSamples: 0, windows: [] };
  });

  // Kaggle: decode, dedupe by exact 16-bit PCM hash (near-duplicates not detected; see MODEL_CARD), assign folds.
  const seen = new Map<string, string>();
  const kClips: ClipMeta[] = [];
  let dupes = 0;
  await pool(kagglePending, 4, async (k) => {
    const id = `kaggle/${basename(k.file, extname(k.file))}-${createHash('sha1').update(k.file).digest('hex').slice(0, 6)}`;
    const file = `clips/${id.replace('/', '_')}.wav`;
    await ffmpegDecode(k.file, join(PROC_DIR, file));
    const { samples } = readWav(join(PROC_DIR, file));
    const q = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) q[i] = Math.round((samples[i] ?? 0) * 32767);
    const h = createHash('sha1').update(Buffer.from(q.buffer)).digest('hex');
    if (seen.has(h)) { dupes++; return; }
    seen.set(h, id);
    kClips.push({ id, source: 'kaggle', cls: k.label ? 'kaggle_snore' : 'kaggle_nonsnore', label: k.label, fold: 0, bedroom: false, file, nSamples: 0, windows: [] });
  });
  kClips.sort((a, b) => a.id.localeCompare(b.id));
  const rnd = mulberry32(SEED);
  for (const lab of [0, 1] as const) {
    const grp = shuffle(kClips.filter((c) => c.label === lab), rnd);
    grp.forEach((c, i) => { c.fold = (i % 5) + 1; }); // stratified over folds 1-5; fold 5 = test
  }
  if (kaggleFiles.length) console.log(`Kaggle: kept ${kClips.length}, exact duplicates dropped ${dupes}`);
  clips.push(...kClips);

  // Window + RMS
  const allDb: number[] = [];
  for (const c of clips) {
    const { sampleRate, samples } = readWav(join(PROC_DIR, c.file));
    if (sampleRate !== SAMPLE_RATE) throw new Error(`unexpected rate ${sampleRate}`);
    c.nSamples = samples.length;
    // 1 s Kaggle clips: ensure exactly one window (pad if slightly short).
    const starts = samples.length < WIN ? [0] : windowStarts(samples.length);
    for (const s of starts) {
      const len = Math.min(WIN, samples.length - s);
      const db = rmsDbfs(samples, s, len);
      c.windows.push({ clip: c.id, start: s, rmsDbfs: db, kept: true });
      if (c.fold !== TEST_FOLD) allDb.push(db); // floor uses train/val folds only (no test leakage)
    }
  }

  // Silence floor from the data. Principle: windows that are digital silence / padding (< -90 dBFS) form a
  // spike far below any real recording; floor = 1st percentile of the *non-silent* (>= -90 dBFS) window
  // RMS distribution of ALL source clips, rounded down to 1 dB. This drops padding and near-silence while
  // keeping genuinely quiet room tone.
  const nonSilent = allDb.filter((d) => d >= -90).sort((a, b) => a - b);
  const p = (q: number) => percentile(nonSilent, q).toFixed(1);
  // KEEP_SILENCE_FLOOR=1 (used by the YAMNet pipeline): keep the already-shipped floor from constants.ts so ESC-50 windows stay identical to
  // v1 when Kaggle clips are added later (otherwise the floor, and with it the app's "too quiet" cut, could shift).
  const keepFloor = process.env.KEEP_SILENCE_FLOOR === '1';
  const floor = keepFloor ? SILENCE_FLOOR_DBFS : Math.floor(percentile(nonSilent, 0.01));
  const method = keepFloor ? `kept from src/audio/constants.ts (KEEP_SILENCE_FLOOR=1); data percentiles p1=${percentile(nonSilent, 0.01).toFixed(1)}` : `1st percentile of window RMS dBFS among non-silent (>= -90 dBFS) train/val-fold windows (folds 1-4 plus Kaggle folds 1-4) (p1=${p(0.01)}, p5=${p(0.05)}, p10=${p(0.1)}, p50=${p(0.5)}), floored to 1 dB`;
  console.log(`window RMS: total ${allDb.length}, digital-silence(<-90) ${allDb.length - nonSilent.length}; floor = ${floor} dBFS (${method})`);

  const dropped: Record<string, { kept: number; dropped: number }> = {};
  for (const c of clips) {
    for (const w of c.windows) {
      w.kept = w.rmsDbfs >= floor;
      const key = `${c.source}:${c.cls}`;
      const d = (dropped[key] ??= { kept: 0, dropped: 0 });
      if (w.kept) d.kept++; else d.dropped++;
    }
  }
  const manifest: Manifest = { silenceFloorDbfs: floor, floorMethod: method, clips };
  writeFileSync(join(PROC_DIR, 'manifest.json'), JSON.stringify(manifest));
  writeFileSync(join(PROC_DIR, 'dropped-by-class.json'), JSON.stringify(dropped, null, 1));

  const tot = Object.values(dropped).reduce((a, d) => ({ kept: a.kept + d.kept, dropped: a.dropped + d.dropped }), { kept: 0, dropped: 0 });
  const snore = dropped['esc50:snoring'];
  console.log(`windows kept ${tot.kept}, dropped ${tot.dropped}; snoring kept ${snore?.kept} dropped ${snore?.dropped}`);

  // Write SILENCE_FLOOR_DBFS into the frozen constants file (the one value Agent C may change).
  const src = readFileSync(CONSTANTS_TS, 'utf8');
  const next = src.replace(/export const SILENCE_FLOOR_DBFS = .*;.*/, `export const SILENCE_FLOOR_DBFS = ${floor}; // set by scripts/prepare-data.ts from data: ${method}`);
  if (next !== src && !keepFloor) writeFileSync(CONSTANTS_TS, next);
  if (!statSync(CONSTANTS_TS).isFile()) throw new Error('constants missing');
}

void main();
