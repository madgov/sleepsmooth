import { View } from 'react-native';
import { MORNING_PROMPT } from '@core/content/claims';
import { AppText } from './AppText';
import { GlassCard } from './GlassCard';
import { Icon } from './Icon';
import { PrimaryButton } from './PrimaryButton';

/** In-app version of the morning prompt, shown on the recording screen while the morning signal is active. */
export function MorningPrompt({ onStop, onKeep }: { onStop: () => void; onKeep: () => void }) {
  return (
    <GlassCard radius={26} padding={16} testID="morning-prompt">
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon name="sunrise.fill" size={22} color="#34C8E8" weight="semibold" />
          <AppText variant="headline" accessibilityRole="header" accessibilityLiveRegion="polite" style={{ flex: 1 }}>
            {MORNING_PROMPT}
          </AppText>
        </View>
        <AppText variant="footnote" tone="secondary">
          Still listening. This is a guess from phone movement and your wake time, not a measurement.
        </AppText>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <PrimaryButton label="Stop" onPress={onStop} size="medium" testID="morning-stop" />
          </View>
          <View style={{ flex: 1 }}>
            <PrimaryButton label="Keep recording" variant="tinted" onPress={onKeep} size="medium" testID="morning-keep" />
          </View>
        </View>
      </View>
    </GlassCard>
  );
}
