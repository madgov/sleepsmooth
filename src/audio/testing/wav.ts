// Test helper: minimal PCM WAV parser (16-bit int or 32-bit float, any channel count -> mono). Node only.
export function parseWav(buf: Uint8Array): { samples: Float32Array; sampleRate: number } {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const tag = (o: number) => String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('not a WAV file');
  let fmt = { format: 1, channels: 1, rate: 16000, bits: 16 };
  let off = 12;
  while (off + 8 <= buf.byteLength) {
    const id = tag(off);
    const size = dv.getUint32(off + 4, true);
    const body = off + 8;
    if (id === 'fmt ') fmt = { format: dv.getUint16(body, true), channels: dv.getUint16(body + 2, true), rate: dv.getUint32(body + 4, true), bits: dv.getUint16(body + 14, true) };
    else if (id === 'data') {
      const bytes = fmt.bits / 8;
      const n = Math.floor(Math.min(size, buf.byteLength - body) / (bytes * fmt.channels));
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        let s = 0;
        for (let c = 0; c < fmt.channels; c++) {
          const p = body + (i * fmt.channels + c) * bytes;
          s += fmt.format === 3 ? dv.getFloat32(p, true) : fmt.bits === 16 ? dv.getInt16(p, true) / 32768 : dv.getInt32(p, true) / 2147483648;
        }
        out[i] = s / fmt.channels;
      }
      return { samples: out, sampleRate: fmt.rate };
    }
    off = body + size + (size % 2);
  }
  throw new Error('no data chunk');
}
