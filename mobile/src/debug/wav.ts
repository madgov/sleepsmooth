// Minimal PCM16 mono WAV parser for the bundled test clip. Not a general decoder.
export interface ParsedWav {
  sampleRate: number;
  samples: Float32Array;
}

export function parseWavPcm16Mono(buf: ArrayBuffer): ParsedWav {
  const v = new DataView(buf);
  const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('Not a WAV file');
  let o = 12;
  let rate = 0;
  let channels = 0;
  let bits = 0;
  while (o + 8 <= v.byteLength) {
    const id = tag(o);
    const size = v.getUint32(o + 4, true);
    if (id === 'fmt ') {
      if (v.getUint16(o + 8, true) !== 1) throw new Error('WAV is not PCM');
      channels = v.getUint16(o + 10, true);
      rate = v.getUint32(o + 12, true);
      bits = v.getUint16(o + 22, true);
    } else if (id === 'data') {
      if (channels !== 1 || bits !== 16) throw new Error(`Unsupported WAV layout (${channels} ch, ${bits} bit)`);
      const n = Math.floor(Math.min(size, v.byteLength - o - 8) / 2);
      const samples = new Float32Array(n);
      for (let i = 0; i < n; i++) samples[i] = v.getInt16(o + 8 + i * 2, true) / 32768;
      return { sampleRate: rate, samples };
    }
    o += 8 + size + (size % 2);
  }
  throw new Error('WAV has no data chunk');
}
