import { describe, expect, it } from 'vitest';
import { decodeAudioFile, type AudioBufferLike } from './decode';

const file = (over: Partial<{ name: string; type: string; size: number }> = {}) => ({
  name: 'a.wav',
  type: 'audio/wav',
  size: 1000,
  arrayBuffer: async () => new ArrayBuffer(8),
  ...over,
});
const buf = (secs: number, rate = 8000, channels = 1, fill = 0.1): AudioBufferLike => {
  const data = Array.from({ length: channels }, () => new Float32Array(Math.round(secs * rate)).fill(fill));
  return { sampleRate: rate, length: data[0]!.length, numberOfChannels: channels, getChannelData: (c) => data[c]! };
};
const dec = (b: AudioBufferLike) => ({ decodeAudioData: async () => b });
const code = async (p: Promise<unknown>) => p.then(() => 'ok', (e: { code: string }) => e.code);

describe('decodeAudioFile', () => {
  it('decodes and downmixes stereo', async () => {
    const b = buf(40, 8000, 2);
    b.getChannelData(1).fill(-0.1).fill(0.3, 0, 100);
    const r = await decodeAudioFile(file(), dec(b));
    expect(r.sampleRate).toBe(8000);
    expect(r.samples[0]).toBeCloseTo(0.2, 6);
    expect(r.samples[200]).toBeCloseTo(0, 6);
  });
  it('maps failures to typed errors', async () => {
    expect(await code(decodeAudioFile(file({ name: 'a.pdf', type: 'application/pdf' }), dec(buf(40))))).toBe('wrong-type');
    expect(await code(decodeAudioFile(file({ size: 101 * 1024 * 1024 }), dec(buf(40))))).toBe('too-big');
    expect(await code(decodeAudioFile(file(), dec(buf(31 * 60))))).toBe('too-long');
    expect(await code(decodeAudioFile(file(), dec(buf(10))))).toBe('too-short');
    expect(await code(decodeAudioFile(file(), dec(buf(40, 8000, 1, 0))))).toBe('silent');
    expect(await code(decodeAudioFile(file(), { decodeAudioData: async () => Promise.reject(new Error('x')) }))).toBe('corrupt');
    expect(await code(decodeAudioFile(file({ size: 0 }), dec(buf(40))))).toBe('corrupt');
  });
  it('checks size before decoding', async () => {
    let called = false;
    await code(decodeAudioFile(file({ size: 200 * 1024 * 1024 }), { decodeAudioData: async () => ((called = true), buf(40)) }));
    expect(called).toBe(false);
  });
  it('accepts octet-stream by extension', async () => {
    expect(await code(decodeAudioFile(file({ name: 'x.m4a', type: '' }), dec(buf(40))))).toBe('ok');
  });
});
