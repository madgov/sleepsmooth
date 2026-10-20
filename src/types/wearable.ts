// WearableObservation: a number the user typed in from a consumer wearable or its app.
// SleepSmooth does not read, check, score or interpret it. Entry method is always 'user-entered'.

export type WearableMetric = 'spo2-lowest' | 'spo2-average' | 'resting-hr' | 'breathing-disturbances' | 'sleep-duration';

export interface WearableObservation {
  id: string;
  metric: WearableMetric;
  value: number;
  /** Display unit. Fixed per metric. */
  unit: string;
  /** Device or app name, free text typed by the user. Empty string when left blank. */
  source: string;
  /** The device app's own name for the number, used for 'breathing-disturbances' only. Empty when blank. */
  deviceLabel: string;
  /** When the person entered it (ISO). */
  timestamp: string;
  /** Night the reading is about, 'YYYY-MM-DD', or null when not given. */
  forDate: string | null;
  entryMethod: 'user-entered';
}
