// In-night phone movement, from the accelerometer (expo-sensors; it is part of Expo Go). The arithmetic is in
// src/mobileLogic/motionSeconds.ts (pure, tested). This file only owns the subscription.
//
// Rate: 10 Hz (MOTION_SAMPLE_HZ), chosen to be cheap: the audio session already keeps the app awake overnight, and 10 Hz is
// plenty to see a phone being picked up or the bed moving. Samples are reduced in memory to one number per second; nothing
// is stored. If the sensor is missing or the subscription fails, motionAvailable stays false and epochs report no motion.
// NOT VERIFIED on a device: whether iOS keeps delivering accelerometer samples to JS while the screen is locked and only
// the audio background mode keeps the app alive.
import { Accelerometer } from 'expo-sensors';
import { MOTION_SAMPLE_HZ, MotionAccumulator } from '@core/mobileLogic/motionSeconds';

export class MotionSensor {
  private acc = new MotionAccumulator();
  private sub: { remove(): void } | null = null;
  private running = false;

  /** Resolves true when samples are flowing. Never throws. */
  async start(): Promise<boolean> {
    if (this.running) return true;
    try {
      if (!(await Accelerometer.isAvailableAsync())) return false;
      this.acc.reset();
      Accelerometer.setUpdateInterval(Math.round(1000 / MOTION_SAMPLE_HZ));
      this.sub = Accelerometer.addListener((d) => this.acc.add(d.x, d.y, d.z, Date.now()));
      this.running = true;
      return true;
    } catch {
      this.running = false;
      return false;
    }
  }

  get isRunning(): boolean {
    return this.running;
  }

  /** Seconds of motion since the last call. */
  drain(): number {
    return this.running ? this.acc.drain() : 0;
  }

  stop(): void {
    this.sub?.remove();
    this.sub = null;
    this.running = false;
    this.acc.reset();
  }
}
