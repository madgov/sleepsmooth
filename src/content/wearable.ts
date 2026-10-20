// Copy for manually entered wearable numbers. Neutral on purpose: no scoring, no thresholds, no interpretation.

export const WEARABLE_SOURCE_LABEL = 'User-entered from a wearable. Not checked by SleepSmooth.';
export const WEARABLE_NEUTRAL_LINE = "Consumer wearables can miss or misread breathing problems. These numbers can't confirm or rule out sleep apnea.";
export const WEARABLE_TITLE = 'Wearable readings';
export const WEARABLE_SUMMARY_TITLE = 'Wearable readings (user-entered)';
export const WEARABLE_OPTIONAL_NOTE = 'Optional. Leave any field empty. Type the numbers exactly as your device or its app shows them.';
export const WEARABLE_UNITS_NOTE = 'Units: SpO2 in percent, heart rate in beats per minute, sleep duration in hours (for example 7.5). Breathing disturbances are whatever number your device app shows, so also type the name it uses.';
export const WEARABLE_EMPTY = 'No wearable readings entered yet.';
export const WEARABLE_NONE_ENTERED_ERROR = 'Enter at least one reading, or leave this out.';
export const WEARABLE_SUMMARY_NONE = 'No wearable readings were entered.';
export const WEARABLE_SOURCE_PLACEHOLDER = 'Device or app (optional)';

export const WEARABLE_METRIC_LABELS = {
  'spo2-lowest': 'Lowest overnight SpO2',
  'spo2-average': 'Average overnight SpO2',
  'resting-hr': 'Resting heart rate',
  'breathing-disturbances': 'Breathing disturbances (device app)',
  'sleep-duration': 'Sleep duration (device)',
} as const;
