// Web build of the YAMNet loader: there is no TFLite runtime on web, so the web preview always uses the v1 model.
// Kept as a platform file so the web bundle never pulls in react-native-fast-tflite or the 16 MB model asset.
import type { WindowScorer } from '@core/audio/yamnet/scorer';
import type { FallbackReason, ScorerLoad } from './yamnetScorer';

export type { FallbackReason, ScorerLoad };
export const YAMNET_RUNTIME_LABEL = 'YAMNet float32 (TFLite)';

const WEB: ScorerLoad = { scorer: null as WindowScorer | null, fallbackReason: 'web', detail: null };

export function loadYamnetScorer(): Promise<ScorerLoad> {
  return Promise.resolve(WEB);
}
