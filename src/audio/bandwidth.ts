// Effective-bandwidth estimate for the "is the snore model applicable?" check (M6).
//
// The shipped model's features depend on energy above 4 kHz, so on band-limited audio (phone-call
// quality, 8 kHz sampling) it flags nothing. That silence must never read as "no snoring", so such
// recordings are marked model-not-applicable instead.
//
// Method: Hann-windowed 512-point power spectra (31.25 Hz bins) of non-overlapping frames at 16 kHz,
// skipping frames below the silence floor, summed over the recording. The effective bandwidth is the
// frequency below which BANDWIDTH_ENERGY_FRACTION of that long-term spectral energy lies. A very high
// fraction (not 99%) is used because snoring is strongly low-frequency: a full-band snore recording
// can still keep 99% of its energy below 5 kHz, whereas a band-limited one has essentially nothing above.
import { MODEL_NOT_APPLICABLE } from '../content/claims';
import { SAMPLE_RATE, SILENCE_FLOOR_DBFS } from './constants';
import { fft, hannWindow } from './features/fft';
import { rmsDbfs } from './model/infer';

export const BANDWIDTH_FFT = 512;
export const BANDWIDTH_ENERGY_FRACTION = 0.99999;
/** Below this effective bandwidth the model is not applicable (Hz). */
export const MIN_EFFECTIVE_BANDWIDTH_HZ = 5000;
/** Below this source sampling rate the model is not applicable (Hz). */
export const MIN_SOURCE_RATE_HZ = 16000;

export const MODEL_NOT_APPLICABLE_REASON = MODEL_NOT_APPLICABLE;

export class BandwidthEstimator {
  private readonly power = new Float64Array(BANDWIDTH_FFT / 2 + 1);
  private readonly win = hannWindow(BANDWIDTH_FFT);
  private readonly re = new Float64Array(BANDWIDTH_FFT);
  private readonly im = new Float64Array(BANDWIDTH_FFT);
  frames = 0;

  /** Add mono 16 kHz samples in [start, end) (default all). */
  add(x: Float32Array, start = 0, end = x.length): void {
    for (let i = start; i + BANDWIDTH_FFT <= end; i += BANDWIDTH_FFT) {
      if (rmsDbfs(x, i, BANDWIDTH_FFT) < SILENCE_FLOOR_DBFS) continue;
      for (let k = 0; k < BANDWIDTH_FFT; k++) {
        this.re[k] = (x[i + k] as number) * (this.win[k] as number);
        this.im[k] = 0;
      }
      fft(this.re, this.im);
      for (let k = 0; k <= BANDWIDTH_FFT / 2; k++) this.power[k] = (this.power[k] as number) + (this.re[k] as number) ** 2 + (this.im[k] as number) ** 2;
      this.frames++;
    }
  }

  /** Effective bandwidth in Hz, or null when no non-silent frame was seen. */
  bandwidthHz(): number | null {
    if (this.frames === 0) return null;
    let total = 0;
    for (let k = 0; k < this.power.length; k++) total += this.power[k] as number;
    if (total <= 0) return null;
    let acc = 0;
    for (let k = 0; k < this.power.length; k++) {
      acc += this.power[k] as number;
      if (acc >= BANDWIDTH_ENERGY_FRACTION * total) return (k * SAMPLE_RATE) / BANDWIDTH_FFT;
    }
    return SAMPLE_RATE / 2;
  }
}

export interface ModelApplicability {
  applicable: boolean;
  effectiveBandwidthHz: number | null;
  reason?: string;
}

export function assessModelApplicability(sourceRate: number, effectiveBandwidthHz: number | null): ModelApplicability {
  const limited = sourceRate < MIN_SOURCE_RATE_HZ || (effectiveBandwidthHz !== null && effectiveBandwidthHz < MIN_EFFECTIVE_BANDWIDTH_HZ);
  return limited
    ? { applicable: false, effectiveBandwidthHz, reason: MODEL_NOT_APPLICABLE_REASON }
    : { applicable: true, effectiveBandwidthHz };
}
