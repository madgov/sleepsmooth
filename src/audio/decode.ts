// Main-thread decode (ER-1): AudioContext/decodeAudioData is unavailable in workers.
// Order: type check -> file-size pre-check (before decode) -> decodeAudioData -> duration caps
// -> downmix to mono -> silent check. Errors are typed with friendly messages and recovery text.
import { MAX_DURATION_SEC, MAX_FILE_BYTES, MIN_DURATION_SEC } from './constants';

export type AudioInputErrorCode = 'wrong-type' | 'too-big' | 'too-long' | 'too-short' | 'silent' | 'corrupt';

export class AudioInputError extends Error {
  readonly code: AudioInputErrorCode;
  readonly recovery: string;
  constructor(code: AudioInputErrorCode, message: string, recovery: string) {
    super(message);
    this.name = 'AudioInputError';
    this.code = code;
    this.recovery = recovery;
  }
}

const ERRORS: Record<AudioInputErrorCode, [string, string]> = {
  'wrong-type': ['That file does not look like an audio file.', 'Choose a WAV, MP3, M4A, OGG, FLAC or WebM audio file, or use the labeled sample.'],
  'too-big': ['That file is larger than 100 MB.', 'Choose a shorter recording (10 to 20 minutes works well) or a smaller file, or use the labeled sample.'],
  'too-long': ['That recording is longer than 20 minutes.', 'Trim it to 10 to 20 minutes and try again, or use the labeled sample.'],
  'too-short': ['That recording is shorter than 30 seconds.', 'Record at least 30 seconds (10 to 20 minutes is better), or use the labeled sample.'],
  silent: ['That recording appears to be completely silent.', 'Check the microphone and room, record again, or use the labeled sample.'],
  corrupt: ['This browser could not read that audio file.', 'The file may be damaged or in an unsupported format. Try converting it to WAV or MP3, or use the labeled sample.'],
};

export function audioInputError(code: AudioInputErrorCode): AudioInputError {
  const [m, r] = ERRORS[code];
  return new AudioInputError(code, m, r);
}

export interface AudioBufferLike {
  sampleRate: number;
  length: number;
  numberOfChannels: number;
  getChannelData(channel: number): Float32Array;
}

export interface DecodeDeps {
  /** Decodes an encoded file; default uses a browser AudioContext. */
  decodeAudioData?: (data: ArrayBuffer) => Promise<AudioBufferLike>;
}

export interface DecodedAudio {
  samples: Float32Array; // mono
  sampleRate: number;
  durationSec: number;
  name: string;
}

const EXTENSIONS = ['wav', 'wave', 'mp3', 'm4a', 'aac', 'mp4', 'ogg', 'oga', 'opus', 'flac', 'webm', 'caf'];

export function looksLikeAudio(file: { name: string; type: string }): boolean {
  if (file.type.startsWith('audio/')) return true;
  if (file.type === 'video/mp4' || file.type === 'video/webm') return true;
  if (file.type && file.type !== 'application/octet-stream') return false;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSIONS.includes(ext);
}

/** Average all channels into one new Float32Array. */
export function downmixToMono(channels: Float32Array[]): Float32Array {
  const first = channels[0];
  if (!first) return new Float32Array(0);
  const out = new Float32Array(first.length);
  if (channels.length === 1) {
    out.set(first);
    return out;
  }
  for (const ch of channels) for (let i = 0; i < out.length; i++) out[i] = (out[i] as number) + (ch[i] as number);
  const k = 1 / channels.length;
  for (let i = 0; i < out.length; i++) out[i] = (out[i] as number) * k;
  return out;
}

async function browserDecode(data: ArrayBuffer): Promise<AudioBufferLike> {
  const w = globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) throw new Error('no AudioContext');
  const ctx = new Ctor();
  try {
    return await ctx.decodeAudioData(data);
  } finally {
    void ctx.close();
  }
}

export async function decodeAudioFile(
  file: Pick<File, 'name' | 'type' | 'size' | 'arrayBuffer'>,
  deps: DecodeDeps = {},
): Promise<DecodedAudio> {
  if (!looksLikeAudio(file)) throw audioInputError('wrong-type');
  if (file.size > MAX_FILE_BYTES) throw audioInputError('too-big');
  if (file.size === 0) throw audioInputError('corrupt');
  // Peak memory (20 min, 48 kHz stereo): encoded file <= 100 MB, released once decoding returns; decoded
  // AudioBuffer ~460 MB; downmix is done in place in channel 0 (no extra copy). Peak is roughly 0.6 GB; only the ~230 MB mono
  // array survives once the AudioBuffer reference is dropped.
  let buf: AudioBufferLike | null;
  try {
    let bytes: ArrayBuffer | null = await file.arrayBuffer();
    buf = await (deps.decodeAudioData ?? browserDecode)(bytes);
    bytes = null; // drop the encoded bytes
  } catch {
    throw audioInputError('corrupt');
  }
  const durationSec = buf.length / buf.sampleRate;
  if (durationSec > MAX_DURATION_SEC) throw audioInputError('too-long');
  if (durationSec < MIN_DURATION_SEC) throw audioInputError('too-short');
  if (buf.numberOfChannels < 1) throw audioInputError('corrupt');
  const sampleRate = buf.sampleRate;
  const first = buf.getChannelData(0);
  for (let c = 1; c < buf.numberOfChannels; c++) {
    // In place: accumulate into channel 0 so no second full-length array is allocated.
    const ch = buf.getChannelData(c);
    for (let i = 0; i < first.length; i++) first[i] = (first[i] as number) + (ch[i] as number);
  }
  if (buf.numberOfChannels > 1) {
    const k = 1 / buf.numberOfChannels;
    for (let i = 0; i < first.length; i++) first[i] = (first[i] as number) * k;
  }
  const samples = first;
  // eslint-disable-next-line no-useless-assignment -- intentional: release the AudioBuffer early
  buf = null; // drop the AudioBuffer before the mono array is handed on
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i] as number));
  if (peak < 1e-4) throw audioInputError('silent');
  // Note: decodeAudioData resamples to the context rate, so the spectral bandwidth check in analyze.ts is the browser's only band-limit detector.
  return { samples, sampleRate, durationSec, name: file.name };
}
