// In-night phone movement: converts raw accelerometer samples into "seconds of motion", which the night pipeline takes
// through addMotionSeconds(). Pure TypeScript, so the arithmetic is unit tested; the sensor subscription is in
// mobile/src/capture/motion.ts.
//
// PROVISIONAL and UNVALIDATED. Method: a slow low-pass estimate of gravity is subtracted from each sample (a high-pass
// filter). A sample counts as movement when the remaining magnitude is above MOTION_THRESHOLD_G. Each such sample adds the
// time since the previous sample (capped, so a sensor stall cannot add minutes). The phone's movement is not the sleeper's
// movement: a phone on a nightstand mostly feels the bed through the furniture, or nothing.
export const MOTION_SAMPLE_HZ = 10;
/** Remaining acceleration magnitude (g) above which a sample counts as movement. PROVISIONAL. */
export const MOTION_THRESHOLD_G = 0.03;
/** Gravity estimate smoothing per sample at 10 Hz: time constant about 2 s. */
export const GRAVITY_ALPHA = 0.05;
/** One sample contributes at most this many seconds. */
export const MOTION_MAX_DT_SEC = 0.5;

export class MotionAccumulator {
  private g: [number, number, number] | null = null;
  private lastMs: number | null = null;
  private pending = 0;

  /** x, y, z in g. `tMs` is a monotonic or wall clock in milliseconds. */
  add(x: number, y: number, z: number, tMs: number): void {
    if (![x, y, z, tMs].every(Number.isFinite)) return;
    if (this.g === null) {
      this.g = [x, y, z];
      this.lastMs = tMs;
      return;
    }
    const dt = this.lastMs === null ? 0 : Math.min(MOTION_MAX_DT_SEC, Math.max(0, (tMs - this.lastMs) / 1000));
    this.lastMs = tMs;
    const [gx, gy, gz] = this.g;
    const mag = Math.hypot(x - gx, y - gy, z - gz);
    this.g = [gx + GRAVITY_ALPHA * (x - gx), gy + GRAVITY_ALPHA * (y - gy), gz + GRAVITY_ALPHA * (z - gz)];
    if (mag > MOTION_THRESHOLD_G) this.pending += dt;
  }

  /** Seconds of motion since the last drain. */
  drain(): number {
    const v = this.pending;
    this.pending = 0;
    return Math.round(v * 1000) / 1000;
  }

  reset(): void {
    this.g = null;
    this.lastMs = null;
    this.pending = 0;
  }
}
