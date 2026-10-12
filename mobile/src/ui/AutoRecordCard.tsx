import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { AUTO } from '../content/copy';
import { updateSettings } from '../state/settings';
import { AppText } from './AppText';
import { GlassCard } from './GlassCard';
import { IconTile } from './IconTile';
import { PrimaryButton } from './PrimaryButton';

/** One-time offer on the Dashboard. "Not now" stores the decision so it is never shown again. */
export function AutoRecordCard() {
  const router = useRouter();
  return (
    <GlassCard radius={28} padding={20} testID="auto-record-card">
      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <IconTile name="moon.stars" size={48} />
          <AppText variant="title3" accessibilityRole="header" style={{ flex: 1 }}>
            {AUTO.CARD_TITLE}
          </AppText>
        </View>
        <AppText variant="subheadline" tone="secondary">
          {AUTO.CARD_BODY}
        </AppText>
        <View style={{ gap: 4 }}>
          <PrimaryButton label={AUTO.CARD_SET_UP} onPress={() => router.push('/auto-record')} testID="auto-set-up" />
          <PrimaryButton
            label={AUTO.CARD_NOT_NOW}
            variant="plain"
            onPress={() => updateSettings((p) => ({ ...p, autoRecord: { ...p.autoRecord, decision: 'declined', decidedAt: new Date().toISOString() } }))}
            testID="auto-not-now"
          />
        </View>
      </View>
    </GlassCard>
  );
}
