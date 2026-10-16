import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatClock, formatElapsed, spokenElapsed, type MeterBand } from '@core/mobileLogic/index';
import { COPY, lockNote } from '../content/copy';
import { ThemedNight, useTheme } from '../theme/useTheme';
import { AppText } from './AppText';
import { Backdrop } from './Backdrop';
import { GlassCard } from './GlassCard';
import { HeroRecordButton, type HeroState } from './HeroRecordButton';
import { LevelMeter } from './LevelMeter';
import { MorningPrompt } from './MorningPrompt';
import { PrimaryButton } from './PrimaryButton';

export interface RecordingViewProps {
  state: HeroState;
  elapsedSec: number;
  endAtMs: number | null;
  levels: SharedValue<number[]>;
  band: MeterBand;
  stale: boolean;
  onStop: () => void;
  onHide: () => void;
  /** Dev-only previews label themselves. */
  simulatedLabel?: string;
  /** The morning prompt: shown above the level meter when set. */
  morning?: { onStop: () => void; onKeep: () => void };
}

/** Full-screen recording state on the night surface. Pure view: all state comes in as props. */
export function RecordingView(props: RecordingViewProps) {
  return (
    <ThemedNight active>
      <Inner {...props} />
    </ThemedNight>
  );
}

function Inner({ state, elapsedSec, endAtMs, levels, band, stale, onStop, onHide, simulatedLabel, morning }: RecordingViewProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      <Backdrop variant="app" />
      <View style={{ flex: 1, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20, paddingHorizontal: 20, justifyContent: 'space-between' }}>
        <View style={{ alignItems: 'center', gap: 6 }}>
          {simulatedLabel ? (
            <View style={{ paddingVertical: 4, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.sample.border, backgroundColor: colors.sample.bg, maxWidth: '100%' }}>
              <AppText variant="caption1" weight="600" numberOfLines={1} style={{ color: colors.sample.fg }}>
                {simulatedLabel}
              </AppText>
            </View>
          ) : (
            <AppText variant="subheadline" tone="secondary" weight="600" style={{ textAlign: 'center' }}>
              Tonight
            </AppText>
          )}
          <AppText variant="headline" accessibilityLiveRegion="polite">
            Recording
          </AppText>
        </View>
        <View style={{ alignItems: 'center', gap: 22 }}>
          <HeroRecordButton
            state={state}
            onPress={onStop}
            size={188}
            accessibilityLabel={COPY.C.stopRecording}
            accessibilityValueText={spokenElapsed(elapsedSec)}
            testID="hero"
          />
          <AppText variant="display" tabular accessibilityLabel={`Recording for ${spokenElapsed(elapsedSec)}`}>
            {formatElapsed(elapsedSec)}
          </AppText>
          {endAtMs !== null ? (
            <AppText variant="subheadline" tone="secondary" center>
              {COPY.N34_ENDS_AT(formatClock(new Date(endAtMs).getHours() * 60 + new Date(endAtMs).getMinutes()))}
            </AppText>
          ) : null}
        </View>
        <View style={{ gap: 14 }}>
          {morning ? <MorningPrompt onStop={morning.onStop} onKeep={morning.onKeep} /> : null}
          <GlassCard radius={26} padding={16}>
            <View style={{ gap: 10 }}>
              <AppText variant="footnote" tone="secondary" weight="600">
                {COPY.N32_ROOM_LEVEL}
              </AppText>
              <LevelMeter levels={levels} stale={stale} band={band} label={COPY.N32_ROOM_LEVEL} />
              <AppText variant="footnote" tone="secondary" accessibilityLiveRegion="polite">
                {stale ? COPY.N37_NO_AUDIO : COPY.N33_METER_CAPTION}
              </AppText>
            </View>
          </GlassCard>
          {lockNote() ? (
            <AppText variant="footnote" tone="secondary" center>
              {lockNote()}
            </AppText>
          ) : null}
          <PrimaryButton label={COPY.C.stopRecording} variant="tinted" onPress={onStop} />
          <PrimaryButton label="Hide" variant="plain" onPress={onHide} />
        </View>
      </View>
    </View>
  );
}
