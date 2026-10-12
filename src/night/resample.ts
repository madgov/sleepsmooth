// Streaming-safe wrapper over the existing windowed-sinc resampler (audio/features/resample.ts).
//
// The existing resampler works on a whole buffer: output sample n is centered at n * ratio source
// samples and reads +/- halfWidth source samples, treating samples outside the buffer as zero.
// This wrapper emits an output sample only once all the source samples it needs have arrived, so the
// concatenated stream equals resampleAll() over the whole signal. Edge effects, documented:
//  - Start of a segment: zero extension, identical to the one-shot call.
//  - End of a segment (flush): zero extension, identical to the one-shot call.
//  - Output is held back by about halfWidth (about 8 source samples at 48 kHz, under 1 ms) until more
//    audio arrives; flush() releases it.
//  - The buffer is trimmed on whole-second source boundaries so the shifted window maps to an integer
//    output offset. Centers then differ from the one-shot values only by floating-point rounding
//    (observed below 1e-9 of full scale; asserted in tests).
// 16 kHz input bypasses resampling (exact copy), as in the existing code.
import { SAMPLE_RATE } from '../audio/constants';
import { resampleRange, resampledLength } from '../audio/features/resample';

// Mirrors the private kernel constants in audio/features/resample.ts (ZERO_CROSSINGS 8, CUTOFF 0.97).
// A parity test against resampleAll() fails if they ever drift.
const ZERO_CROSSINGS = 8;
const CUTOFF_FRACTION = 0.97;

function halfWidthFor(ratio: number): number {
  const fc = 0.5 * CUTOFF_FRACTION * Math.min(1, 1 / ratio);
  return ZERO_CROSSINGS / (2 * fc);
}

export class StreamingResampler {
  readonly sourceRate: number;
  private readonly ratio: number;
  private readonly hw: number;
  private buf = new Float32Array(0);
  private base = 0; // absolute source index of buf[0]; always a multiple of sourceRate
  private total = 0; // absolute source samples received in this segment
  private outDone = 0; // absolute output samples emitted in this segment

  constructor(sourceRate: number) {
    if (!(sourceRate > 0) || !Number.isInteger(sourceRate)) throw new Error(`Unsupported sample rate ${sourceRate}`);
    this.sourceRate = sourceRate;
    this.ratio = sourceRate / SAMPLE_RATE;
    this.hw = halfWidthFor(this.ratio);
  }

  /** Append source samples; returns the newly final 16 kHz samples. */
  push(samples: Float32Array): Float32Array {
    if (this.sourceRate === SAMPLE_RATE) {
      this.total += samples.length;
      this.outDone += samples.length;
      return samples.slice();
    }
    const joined = new Float32Array(this.buf.length + samples.length);
    joined.set(this.buf, 0);
    joined.set(samples, this.buf.length);
    this.buf = joined;
    this.total += samples.length;
    // Output n needs source index floor(n * ratio + hw) <= total - 1.
    const ready = Math.max(0, Math.ceil((this.total - this.hw) / this.ratio));
    return this.emit(ready);
  }

  /** Release the held-back tail (zero extension at the end) and start a fresh segment. */
  flush(): Float32Array {
    if (this.sourceRate === SAMPLE_RATE) {
      this.reset();
      return new Float32Array(0);
    }
    const out = this.emit(resampledLength(this.total, this.sourceRate));
    this.reset();
    return out;
  }

  private reset(): void {
    this.buf = new Float32Array(0);
    this.base = 0;
    this.total = 0;
    this.outDone = 0;
  }

  private emit(upTo: number): Float32Array {
    if (upTo <= this.outDone) return new Float32Array(0);
    const baseOut = (this.base * SAMPLE_RATE) / this.sourceRate; // integer: base is a multiple of sourceRate
    const out = resampleRange(this.buf, this.sourceRate, this.outDone - baseOut, upTo - baseOut);
    this.outDone = upTo;
    // Trim source samples no longer needed (keep whole-second alignment and a safety margin).
    const needFrom = Math.floor(this.outDone * this.ratio - this.hw) - 2;
    const newBase = Math.max(this.base, Math.floor(needFrom / this.sourceRate) * this.sourceRate);
    if (newBase > this.base) {
      this.buf = this.buf.slice(newBase - this.base);
      this.base = newBase;
    }
    return out;
  }
}
