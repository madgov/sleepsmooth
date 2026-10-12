import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { CLIP_CATEGORY_META, CLIP_TAG_LABEL, type ClipMeta } from '@core/mobileLogic/clips';
import { useTheme } from '../theme/useTheme';
import { AppText } from './AppText';
import { ClipWaveform } from './ClipWaveform';
import { Icon } from './Icon';
import { PressScale } from './Press';
import { SourceBadge } from './SourceBadge';

export interface ClipPlayerRowProps {
  clip: ClipMeta;
  /** Show the "Sample data" badge and use UTC for the clock. */
  sample?: boolean;
  playing: boolean;
  loading: boolean;
  progress: number;
  /** Why playback is unavailable right now (for example while recording). Shown as the accessibility hint. */
  disabledReason?: string;
  error?: string | null;
  onToggle: () => void;
}

const pad = (n: number) => String(n).padStart(2, '0');
export function clockFromMs(ms: number, utc: boolean): string {
  const d = new Date(ms);
  const h = utc ? d.getUTCHours() : d.getHours();
  const m = utc ? d.getUTCMinutes() : d.getMinutes();
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${h < 12 ? 'am' : 'pm'}`;
}
export const spokenSeconds = (s: number) => `${Math.max(1, Math.round(s))} seconds`;

/** One premium player row: category chip, time, duration, mini waveform, play/stop, progress bar. Calm, no glow. */
export function ClipPlayerRow({ clip, sample, playing, loading, progress, disabledReason, error, onToggle }: ClipPlayerRowProps) {
  const { colors } = useTheme();
  const [w, setW] = useState(0);
  const meta = CLIP_CATEGORY_META[clip.category];
  const time = clockFromMs(clip.startMs, !!sample);
  const label = `${meta.chip} clip, ${time}, ${spokenSeconds(clip.durationSec)}${clip.tag ? `, ${CLIP_TAG_LABEL[clip.tag]}` : ''}${sample ? ', sample data' : ''}`;
  const disabled = !!disabledReason;
  return (
    <View
      style={{ backgroundColor: colors.card, borderRadius: 16, borderCurve: 'continuous', padding: 14, gap: 10, borderWidth: 1, borderColor: sample ? colors.sample.border : colors.separatorOpaque, borderStyle: sample ? 'dashed' : 'solid' }}
      testID={`clip-${clip.id}`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <View style={{ paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999, backgroundColor: colors.accentFill }}>
              <AppText variant="caption1" weight="600" tone="accent" maxFontSizeMultiplier={1.4}>
                {meta.chip}
              </AppText>
            </View>
            {sample ? <SourceBadge kind="sample" size="compact" /> : null}
          </View>
          <AppText variant="subheadline" tone="secondary" tabular>
            {`${time}  ·  ${Math.max(1, Math.round(clip.durationSec))} s`}
          </AppText>
          {clip.tag ? (
            <AppText variant="footnote" tone="secondary">
              {CLIP_TAG_LABEL[clip.tag]}
            </AppText>
          ) : null}
        </View>
        <PressScale
          onPress={onToggle}
          disabled={disabled}
          haptic="light"
          accessibilityLabel={`${playing ? 'Stop' : 'Play'} ${label}`}
          accessibilityHint={disabledReason}
          testID={`clip-play-${clip.id}`}
        >
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: disabled ? colors.fill : colors.accentFill, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={playing ? 'stop.fill' : loading ? 'ellipsis' : 'play.fill'} size={18} color={disabled ? colors.labelTertiary : colors.accent} />
          </View>
        </PressScale>
      </View>
      <Pressable accessible={false} onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: 36 }}>
        {w > 0 ? <ClipWaveform peaks={clip.peaks} progress={playing ? progress : 0} width={w} height={36} playedColor={colors.accent} idleColor={colors.labelTertiary} /> : null}
      </Pressable>
      <View accessibilityRole="progressbar" accessibilityLabel="Playback progress" accessibilityValue={{ min: 0, max: 100, now: Math.round((playing ? progress : 0) * 100) }} style={{ height: 3, borderRadius: 2, backgroundColor: colors.fill, overflow: 'hidden' }}>
        <View style={{ width: `${Math.round((playing ? progress : 0) * 100)}%`, height: 3, backgroundColor: colors.accent }} />
      </View>
      {error ? (
        <AppText variant="footnote" tone="secondary">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
