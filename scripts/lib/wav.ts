// Minimal WAV helpers (mono). Reads PCM16 / float32 and writes float32 or PCM16.
import { readFileSync, writeFileSync } from 'node:fs';

export function readWav(path: string): { sampleRate: number; samples: Float32Array } {
  const b = readFileSync(path);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`not a WAV: ${path}`);
  }
  let pos = 12;
  let fmt = 1;
  let ch = 1;
  let rate = 16000;
  let bits = 16;
  while (pos + 8 <= b.length) {
    const id = b.toString('ascii', pos, pos + 4);
    const size = b.readUInt32LE(pos + 4);
    const body = pos + 8;
    if (id === 'fmt ') {
      fmt = b.readUInt16LE(body);
      ch = b.readUInt16LE(body + 2);
      rate = b.readUInt32LE(body + 4);
      bits = b.readUInt16LE(body + 14);
    } else if (id === 'data') {
      const end = Math.min(body + size, b.length);
      const bytes = bits / 8;
      const n = Math.floor((end - body) / (bytes * ch));
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const o = body + i * bytes * ch; // first channel only (inputs are mono)
        if (fmt === 3 && bits === 32) out[i] = b.readFloatLE(o);
        else if (fmt === 1 && bits === 16) out[i] = b.readInt16LE(o) / 32768;
        else throw new Error(`unsupported WAV format ${fmt}/${bits}`);
      }
      return { sampleRate: rate, samples: out };
    }
    pos = body + size + (size % 2);
  }
  throw new Error(`no data chunk: ${path}`);
}

export function writeWavFloat32(path: string, samples: Float32Array, rate: number): void {
  const dataBytes = samples.length * 4;
  const b = Buffer.alloc(44 + dataBytes);
  b.write('RIFF', 0, 'ascii');
  b.writeUInt32LE(36 + dataBytes, 4);
  b.write('WAVEfmt ', 8, 'ascii');
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(3, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 4, 28);
  b.writeUInt16LE(4, 32);
  b.writeUInt16LE(32, 34);
  b.write('data', 36, 'ascii');
  b.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < samples.length; i++) b.writeFloatLE(samples[i] ?? 0, 44 + i * 4);
  writeFileSync(path, b);
}
