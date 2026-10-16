import { View } from 'react-native';
import {
  CLIP_FOOTNOTE,
  CLIP_NONE_BODY,
  CLIP_NONE_TITLE,
  CLIP_OFF_ACTION,
  CLIP_OFF_BODY,
  CLIP_OFF_BODY_ENABLED_LATER,
  CLIP_OFF_TITLE,
  CLIP_OTHER_HEADING,
  CLIP_PLAYBACK_BLOCKED_WHILE_RECORDING,
  CLIP_SAMPLE_NOTE,
  CLIP_SECTION_HEADING,
  CLIP_SNORE_HEADING,
  FEEDBACK_NOTE,
  FEEDBACK_NOTE_NO_UPLOAD,
  feedbackCountLine,
  partnerClipsLine,
} from '@core/content/claims';
import { partnerTaggedCount, reviewedCount } from '@core/mobileLogic/clipFeedback';
import { clipSections } from '@core/mobileLogic/clips';
import { CLAIMS_VERIFIED } from '../content/flags';
import { clipPlayer } from '../clips/clipPlayer';
import { usePlayerState } from '../clips/playerStore';
import { useClipFeedback } from '../clips/useClipFeedback';
import { loadClipSamples, useNightClips } from '../clips/useNightClips';
import { useCapture } from '../hooks/useCapture';
import { updateSettings, useSettings } from '../state/settings';
import { useTheme } from '../theme/useTheme';
import { AppText } from './AppText';
import { ClipAdaptNote } from './ClipAdaptNote';
import { ClipPlayerRow } from './ClipPlayerRow';
import { Skeleton } from './Skeleton';
import { SourceBadge } from './SourceBadge';
import { StateCard } from './StateCard';
import { Surface } from './Surface';

export interface ClipsSectionProps {
  nightId: string;
  isSample: boolean;
  nightStartMs: number;
}

/** "Clips to listen to" on the night detail. Three honest states: saving off, none picked, and the clips themselves. */
export function ClipsSection({ nightId, isSample, nightStartMs }: ClipsSectionProps) {
  const load = useNightClips(nightId, isSample, nightStartMs);
  const fb = useClipFeedback(nightId, isSample);
  const settings = useSettings();
  const player = usePlayerState(clipPlayer);
  const capture = useCapture();
  const recording = capture.status === 'recording' || capture.status === 'starting' || capture.status === 'stopping';
  const { colors } = useTheme();

  const body = () => {
    if (load.status === 'loading') {
      return (
        <Surface>
          <Skeleton lines={3} />
        </Surface>
      );
    }
    if (load.state === 'saving-off') {
      const enabledNow = settings.clips.enabled;
      return (
        <StateCard
          tone="info"
          icon="waveform.slash"
          title={CLIP_OFF_TITLE}
          body={enabledNow ? CLIP_OFF_BODY_ENABLED_LATER : CLIP_OFF_BODY}
          actions={enabledNow ? undefined : [{ label: CLIP_OFF_ACTION, variant: 'tinted', onPress: () => updateSettings((s) => ({ ...s, clips: { ...s.clips, enabled: true, decidedAt: new Date().toISOString() } })) }]}
          animated={false}
          testID="clips-off"
        />
      );
    }
    if (load.state === 'none-picked') {
      return (
        <View style={{ gap: 8 }}>
          <StateCard tone="info" icon="waveform" title={CLIP_NONE_TITLE} body={CLIP_NONE_BODY} animated={false} testID="clips-none" />
          {isSample ? null : <ClipAdaptNote refreshKey={fb.file.entries.length} padded />}
        </View>
      );
    }
    const { snore, other } = clipSections(load.clips);
    const row = (c: (typeof load.clips)[number]) => (
      <ClipPlayerRow
        key={c.id}
        clip={c}
        sample={load.sample}
        playing={player.id === c.id && player.status === 'playing'}
        loading={player.id === c.id && player.status === 'loading'}
        progress={player.id === c.id ? player.progress : 0}
        error={player.id === c.id && player.status === 'error' ? player.message : null}
        disabledReason={recording ? CLIP_PLAYBACK_BLOCKED_WHILE_RECORDING : undefined}
        onToggle={() => void clipPlayer.toggle(c.id, () => loadClipSamples(nightId, c, load.sample))}
        feedback={fb.file.entries.find((e) => e.clipId === c.id) ?? null}
        onVerdict={(v) => fb.verdict(c.id, v)}
        onKind={(k) => fb.kind(c.id, k)}
      />
    );
    return (
      <View style={{ gap: 16 }}>
        {snore.length > 0 ? (
          <View style={{ gap: 8 }}>
            <AppText variant="subheadline" weight="600" accessibilityRole="header">
              {CLIP_SNORE_HEADING}
            </AppText>
            {snore.map(row)}
          </View>
        ) : null}
        {other.length > 0 ? (
          <View style={{ gap: 8 }}>
            <AppText variant="subheadline" weight="600" accessibilityRole="header">
              {CLIP_OTHER_HEADING}
            </AppText>
            {other.map(row)}
          </View>
        ) : null}
        {load.sample ? <AppText variant="footnote" tone="secondary">{CLIP_SAMPLE_NOTE}</AppText> : null}
        <View style={{ gap: 4 }}>
          <AppText variant="footnote" tone="secondary" testID="clips-feedback-note">{CLAIMS_VERIFIED.noUploadNoTrackingVerified ? `${FEEDBACK_NOTE} ${FEEDBACK_NOTE_NO_UPLOAD}` : FEEDBACK_NOTE}</AppText>
          {reviewedCount(fb.file, load.clips.map((c) => c.id)) > 0 ? (
            <AppText variant="footnote" weight="600" testID="clips-reviewed-count">{feedbackCountLine(reviewedCount(fb.file, load.clips.map((c) => c.id)))}</AppText>
          ) : null}
          {partnerTaggedCount(fb.file, load.clips.map((c) => c.id)) > 0 ? (
            <AppText variant="footnote" weight="600" testID="clips-partner-count">{partnerClipsLine(partnerTaggedCount(fb.file, load.clips.map((c) => c.id)))}</AppText>
          ) : null}
          {!fb.saved ? <AppText variant="footnote" tone="secondary">Your choice could not be saved on this phone.</AppText> : null}
          {load.sample ? null : <ClipAdaptNote refreshKey={fb.file.entries.length} />}
        </View>
        <AppText variant="footnote" tone={{ color: colors.labelSecondary }}>
          {CLIP_FOOTNOTE}
        </AppText>
      </View>
    );
  };

  return (
    <View style={{ gap: 8 }} testID="clips-section">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, flexWrap: 'wrap' }}>
        <AppText variant="footnote" tone="secondary" accessibilityRole="header">
          {CLIP_SECTION_HEADING}
        </AppText>
        <SourceBadge kind="audio-observation" size="compact" />
        {isSample ? <SourceBadge kind="sample" size="compact" /> : null}
      </View>
      {body()}
    </View>
  );
}
