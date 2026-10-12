// Generates fixtures/parity.{wav,mp3,m4a} and fixtures/expected.json using ffmpeg.
// Run from repo root: npx tsx src/audio/features/golden/makeFixtures.ts
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CODEC_TOLERANCE, FIXTURE_RATE, codecFeatures, fixtureSignal, type CodecExpected } from './codecParity';

const FFMPEG = process.env.FFMPEG ?? '/usr/local/bin/ffmpeg';
const dir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
mkdirSync(dir, { recursive: true });

const f32 = fixtureSignal();
writeFileSync(join(dir, 'parity.f32'), Buffer.from(f32.buffer));
const run = (args: string[]) => execFileSync(FFMPEG, ['-y', '-loglevel', 'error', ...args]);
run(['-f', 'f32le', '-ar', String(FIXTURE_RATE), '-ac', '1', '-i', join(dir, 'parity.f32'), join(dir, 'parity.wav')]);
run(['-i', join(dir, 'parity.wav'), '-b:a', '128k', join(dir, 'parity.mp3')]);
run(['-i', join(dir, 'parity.wav'), '-c:a', 'aac', '-b:a', '128k', join(dir, 'parity.m4a')]);

const expected: CodecExpected[] = [];
for (const format of ['mp3', 'm4a'] as const) {
  run(['-i', join(dir, `parity.${format}`), '-f', 'f32le', '-ar', String(FIXTURE_RATE), '-ac', '1', join(dir, 'decoded.f32')]);
  const b = readFileSync(join(dir, 'decoded.f32'));
  const decoded = new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  const { lag, values } = codecFeatures(decoded, FIXTURE_RATE);
  expected.push({ format, lag, values: Array.from(values, (v) => Number(v.toFixed(5))) });
  console.log(format, 'lag', lag);
}
writeFileSync(join(dir, 'expected.json'), JSON.stringify({ tolerance: CODEC_TOLERANCE, expected }));
execFileSync('rm', ['-f', join(dir, 'parity.f32'), join(dir, 'decoded.f32')]);
