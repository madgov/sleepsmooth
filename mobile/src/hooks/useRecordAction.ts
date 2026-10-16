import * as Haptics from 'expo-haptics';
import { useSafeRouter } from '../nav/useSafeRouter';

import { confirmAction } from '../ui/confirm';
import { MORNING_PROMPT } from '@core/content/claims';
import { captureController } from '../capture/controller';
import { COPY } from '../content/copy';
import { IS_EXPO_GO } from '../native/runtime';
import { useCapture } from './useCapture';

/**
 * The one place that decides what "record" means, shared by the Audio screen hero and the tab bar centre button.
 * Idle: open the existing consent or start sheet (recording never starts from this tap alone).
 * Recording: confirm, then stop through the capture controller.
 */
export function useRecordAction() {
  const router = useSafeRouter();
  const capture = useCapture();
  const active = capture.status === 'recording' || capture.status === 'starting' || capture.status === 'stopping';

  // Expo Go preview: there is no microphone path, so say so instead of opening the start sheet. Nothing is faked.
  const openStart = () => router.push(IS_EXPO_GO ? '/expo-go-recording' : '/start-sheet');
  const confirmStop = () =>
    confirmAction({
      title: capture.morning === 'prompt' ? MORNING_PROMPT : COPY.N35_STOP_TITLE,
      message: COPY.N36_STOP_BODY,
      // During the morning prompt, Keep recording also tells morning learning that the user did not want to stop.
      cancelLabel: COPY.C.keepRecording,
      onCancel: () => captureController.keepRecording(),
      confirmLabel: COPY.C.stopAndSummarize,
      onConfirm: () => {
        // D8: the stop haptic fires AFTER capture has stopped and the audio session is released.
        void capture.stop().then(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
      },
    });

  return { status: capture.status, active, openStart, confirmStop, onPress: active ? confirmStop : openStart };
}
