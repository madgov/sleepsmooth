// ER-6: assemble the labeled demo recording from ESC-50 FOLD-5 clips only (held out from training) with ffmpeg.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ESC_DIR, ROOT } from './lib/config';

const FFMPEG = process.env.FFMPEG ?? '/usr/local/bin/ffmpeg';
const OUT_DIR = join(ROOT, 'public/sample-audio');
const GAP = 'GAP';
const rows = readFileSync(join(ESC_DIR, 'meta/esc50.csv'), 'utf8').trim().split('\n').slice(1)
  .map((l) => l.split(',')).filter((c) => c[1] === '5')
  .map((c) => ({ file: c[0]!, cls: c[3]!, src: c[5]! })).sort((a, b) => a.file.localeCompare(b.file));
const pick = (cls: string, n: number) => rows.filter((r) => r.cls === cls).slice(0, n);
const snore = pick('snoring', 4);
const [b1] = pick('breathing', 1), [rain] = pick('rain', 1), [tick] = pick('clock_tick', 1), [wind] = pick('wind', 1), [ins] = pick('insects', 1);
const seq: (typeof rows[number] | typeof GAP)[] = [b1!, GAP, snore[0]!, snore[1]!, GAP, rain!, snore[2]!, tick!, GAP, snore[3]!, wind!, GAP, ins!];

const args = ['-v', 'error', '-y'];
const labels: string[] = [];
const used: typeof rows = [];
seq.forEach((s, i) => {
  if (s === GAP) args.push('-f', 'lavfi', '-t', '2.5', '-i', 'anullsrc=r=16000:cl=mono');
  else { args.push('-i', join(ESC_DIR, 'audio', s.file)); used.push(s); }
  labels.push(`[${i}:a]aformat=sample_fmts=fltp:sample_rates=16000:channel_layouts=mono[a${i}]`);
});
const filter = `${labels.join(';')};${seq.map((_, i) => `[a${i}]`).join('')}concat=n=${seq.length}:v=0:a=1[out]`;
mkdirSync(OUT_DIR, { recursive: true });
const wav = join(OUT_DIR, 'esc50-sample.wav');
args.push('-filter_complex', filter, '-map', '[out]', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav);
const r = spawnSync(FFMPEG, args, { encoding: 'utf8' });
if (r.status !== 0) throw new Error(r.stderr);
const dur = spawnSync(FFMPEG, ['-i', wav, '-f', 'null', '-'], { encoding: 'utf8' }).stderr.match(/time=(\S+)/g)?.pop();

const md = `# Attribution: public/sample-audio/esc50-sample.wav

Label shown in the app: "Sample audio assembled from public ESC-50 clips".

Assembled by \`scripts/build-sample-audio.ts\` (ffmpeg, mono 16 kHz 16-bit) from ESC-50 clips in **fold 5 only**
(held out from model training), with 2.5 s of digital silence between some clips. Order below is playback order
(gaps omitted). Snoring clips are real recordings; the arrangement is artificial and is not an overnight recording.

Dataset: Piczak, K. J. "ESC: Dataset for Environmental Sound Classification", ACM MM 2015,
https://github.com/karolpiczak/ESC-50. Each clip was uploaded to Freesound by its author; the per-clip author
and license are in the ESC-50 \`LICENSE\` file. License of every clip used: **CC BY-NC 3.0**
(https://creativecommons.org/licenses/by-nc/3.0/), non-commercial use only, attribution required.

| ESC-50 file | Class | Freesound src_file id | License |
|---|---|---|---|
${used.map((u) => `| ${u.file} | ${u.cls} | ${u.src} (https://freesound.org/s/${u.src}/) | CC BY-NC 3.0 |`).join('\n')}

The clips were converted to mono 16 kHz and concatenated; no other processing was applied.
`;
writeFileSync(join(OUT_DIR, 'ATTRIBUTION.md'), md);
let t = 0;
const segs = seq.map((x) => { const start = t; t += x === GAP ? 2.5 : 5; return { start, end: t, cls: x === GAP ? 'silence_gap' : x.cls, file: x === GAP ? null : x.file }; });
writeFileSync(join(OUT_DIR, 'esc50-sample.segments.json'), JSON.stringify(segs, null, 1));
console.log(`sample written; last ffmpeg time=${dur}; clips=${used.length}`);
