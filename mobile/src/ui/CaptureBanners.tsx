
import { View } from 'react-native';
import { useSafeRouter } from '../nav/useSafeRouter';
import { formatClock } from '@core/mobileLogic/index';
import type { CaptureEndReason } from '@core/mobileLogic/capture';
import { captureController } from '../capture/controller';
import { COPY } from '../content/copy';
import { useCapture } from '../hooks/useCapture';
import { useRecordAction } from '../hooks/useRecordAction';
import { StateCard } from './StateCard';

const REASON_TEXT: Record<Exclude<CaptureEndReason, 'user-stop'>, string> = {
  'scheduled-end': COPY.N41_REASON_SCHEDULED,
  'interrupted-call-or-alarm': COPY.N42_REASON_INTERRUPTED,
  'os-killed-or-crash-recovered': COPY.N43_REASON_KILLED,
  'low-battery': COPY.N44_REASON_BATTERY,
  'mic-lost': COPY.N45_REASON_MIC,
  'storage-error': COPY.N46_REASON_STORAGE,
};

/** Capture outcomes (interrupted, error, ended early, summarizing, ready, failed). Same states and copy as before; shown on the Dashboard. */
export function CaptureBanners() {
  const router = useSafeRouter();
  const capture = useCapture();
  const { openStart } = useRecordAction();
  const endReason = capture.status === 'stopped' ? capture.endReason : null;
  const endedUnexpectedly = endReason !== null && endReason !== 'user-stop';
  const sessionEnd = captureController.getSession()?.lastActivityMs;
  return (
    <View style={{ gap: 16 }}>
      {capture.status === 'error' && capture.error ? (
        <StateCard tone="discuss" icon="exclamationmark.circle" title={COPY.N45_REASON_MIC} body={COPY.N54_NOT_AFFECTED} actions={[{ label: COPY.C.tryAgain, onPress: openStart }]} testID="banner-error" />
      ) : null}
      {endedUnexpectedly && endReason ? (
        <StateCard
          tone="discuss"
          icon="exclamationmark.circle"
          title={COPY.N40_ENDED_AT(sessionEnd ? formatClock(new Date(sessionEnd).getHours() * 60 + new Date(sessionEnd).getMinutes()) : '')}
          body={`${REASON_TEXT[endReason as Exclude<CaptureEndReason, 'user-stop'>]}${endReason === 'scheduled-end' ? '' : ` ${COPY.N47_PART_NOT_CAPTURED}`}`}
          actions={endReason === 'scheduled-end' ? undefined : [{ label: COPY.C.startAgain, onPress: openStart }]}
          testID="banner-ended"
        />
      ) : null}
      {capture.summary === 'summarizing' ? <StateCard tone="info" icon="hourglass" title={COPY.N50_SUMMARIZING} body={COPY.N51_ON_PHONE} testID="card-summarizing" /> : null}
      {capture.summary === 'ready' && capture.nightId ? (
        <StateCard tone="info" icon="checkmark.circle" title={COPY.N52_READY} body={COPY.N01_NOT_A_DIAGNOSIS} actions={[{ label: COPY.C.viewThisNight, onPress: () => router.push(`/night/${capture.nightId}`), variant: 'filled' }]} testID="card-night-ready" />
      ) : null}
      {capture.summary === 'failed' ? (
        <StateCard tone="missing" icon="circle.dashed" title={COPY.N53_FAILED} body={COPY.N54_NOT_AFFECTED} actions={[{ label: COPY.N55_LOOK_AT_SAMPLE, onPress: () => router.push('/night/sample') }]} testID="card-night-failed" />
      ) : null}
    </View>
  );
}
