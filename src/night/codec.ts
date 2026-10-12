// Small pure encoders for the compact epoch fields: base64 (no btoa/Buffer, so it runs on Hermes and
// Node alike), bitsets and quantizers.
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_REV: Record<string, number> = {};
for (let i = 0; i < B64.length; i++) B64_REV[B64.charAt(i)] = i;

export function bytesToBase64(bytes: ArrayLike<number>): string {
  let out = '';
  const n = bytes.length;
  for (let i = 0; i < n; i += 3) {
    const a = (bytes[i] as number) & 255;
    const b = i + 1 < n ? (bytes[i + 1] as number) & 255 : 0;
    const c = i + 2 < n ? (bytes[i + 2] as number) & 255 : 0;
    const v = (a << 16) | (b << 8) | c;
    out += B64.charAt((v >> 18) & 63) + B64.charAt((v >> 12) & 63) + (i + 1 < n ? B64.charAt((v >> 6) & 63) : '=') + (i + 2 < n ? B64.charAt(v & 63) : '=');
  }
  return out;
}

export function base64ToBytes(s: string): Uint8Array {
  const clean = s.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let acc = 0;
  let bits = 0;
  let o = 0;
  for (let i = 0; i < clean.length; i++) {
    const v = B64_REV[clean.charAt(i)];
    if (v === undefined) throw new Error('invalid base64');
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 255;
    }
  }
  return out.subarray(0, o);
}

/** Pack booleans into a base64 bitset (bit i of byte i>>3, least-significant first). */
export function encodeBits(flags: ArrayLike<boolean>): string {
  const bytes = new Uint8Array(Math.ceil(flags.length / 8));
  for (let i = 0; i < flags.length; i++) if (flags[i]) bytes[i >> 3] = (bytes[i >> 3] as number) | (1 << (i & 7));
  return bytesToBase64(bytes);
}

export function decodeBits(s: string | undefined, n: number): boolean[] {
  const out: boolean[] = new Array<boolean>(n).fill(false);
  if (!s) return out;
  const bytes = base64ToBytes(s);
  for (let i = 0; i < n; i++) out[i] = (((bytes[i >> 3] ?? 0) >> (i & 7)) & 1) === 1;
  return out;
}

/** Internal score in [0, 1] -> byte. Never displayed. */
export function quantizeScore(score: number): number {
  return Math.max(0, Math.min(255, Math.round(score * 255)));
}
export function dequantizeScore(q: number): number {
  return q / 255;
}

export function encodeScores(q: ArrayLike<number>): string {
  return bytesToBase64(q);
}
export function decodeScores(s: string | undefined): number[] {
  return s ? Array.from(base64ToBytes(s)).map(dequantizeScore) : [];
}

/**
 * int8 quantization of the 80-d window feature vector (ER-1). Means (log-mel, about -23..+20) use a step
 * of 1/4; standard deviations (>= 0) use a step of 1/8 and clamp at 15.9. Round-trip error is at most one
 * half step except where clamped.
 */
const MEAN_SCALE = 4;
const STD_SCALE = 8;
export function quantizeFeatures(f: ArrayLike<number>): Int8Array {
  const half = f.length / 2;
  const q = new Int8Array(f.length);
  for (let i = 0; i < f.length; i++) {
    const scale = i < half ? MEAN_SCALE : STD_SCALE;
    q[i] = Math.max(-128, Math.min(127, Math.round((f[i] as number) * scale)));
  }
  return q;
}
export function dequantizeFeatures(q: ArrayLike<number>): number[] {
  const half = q.length / 2;
  return Array.from(q, (v, i) => v / (i < half ? MEAN_SCALE : STD_SCALE));
}
export function int8ToBase64(q: Int8Array): string {
  return bytesToBase64(new Uint8Array(q.buffer, q.byteOffset, q.byteLength));
}
export function base64ToInt8(s: string): Int8Array {
  const b = base64ToBytes(s);
  return new Int8Array(b.buffer, b.byteOffset, b.byteLength);
}
