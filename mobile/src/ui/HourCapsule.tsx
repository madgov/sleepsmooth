import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, View } from 'react-native';
import { formatClock, spokenDuration } from '@core/mobileLogic/index';
import type { EpochState } from '../data/nightSource';
import { useTheme } from '../theme/useTheme';
import { AppText } from './AppText';
import { hourBuckets, type HourBucket } from './hourBuckets';

/** Weather-file hourly capsule size. */
export const CAPSULE = { width: 60, height: 146 } as const;

/**
 * v2 hourly capsule (60 x 146). Inactive = glass outline. Observed = calm purple fill rising from the bottom
 * (no glow, no gradient animation, no neon). The fill is minutes estimated asleep in that hour; a lighter band above it
 * is minutes marked uncertain. The numbers are also printed under each capsule, so colour is never the only signal.
 */
export function HourCapsule({ bucket }: { bucket: HourBucket }) {
  const { colors } = useTheme();
  const c = colors.capsule;
  const asleep = Math.min(1, bucket.asleepMin / Math.max(1, bucket.minutes));
  const uncertain = Math.min(1 - asleep, bucket.uncertainMin / Math.max(1, bucket.minutes));
  const label = formatClock(bucket.hour * 60).replace(':00', '');
  const spoken = `${label}. Estimated asleep ${spokenDuration(bucket.asleepMin)}, uncertain ${spokenDuration(bucket.uncertainMin)}, of ${spokenDuration(bucket.minutes)}.`;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={spoken} style={{ width: CAPSULE.width, alignItems: 'center', gap: 6 }}>
      <View style={{ width: CAPSULE.width, height: CAPSULE.height, borderRadius: CAPSULE.width / 2, borderCurve: 'continuous', borderWidth: 1, borderColor: c.outline, overflow: 'hidden', justifyContent: 'flex-end' }}>
        {uncertain > 0 ? <View style={{ height: `${uncertain * 100}%`, backgroundColor: c.fill, opacity: 0.35 }} /> : null}
        {asleep > 0 ? (
          <LinearGradient colors={[c.fill, c.fillEnd]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={{ height: `${asleep * 100}%` }} />
        ) : null}
      </View>
      <AppText variant="caption2" tone="secondary" tabular maxFontSizeMultiplier={1.3} center>
        {label}
      </AppText>
      <AppText variant="caption2" tone="secondary" tabular maxFontSizeMultiplier={1.3} center>
        {`${Math.round(bucket.asleepMin)}m`}
      </AppText>
    </View>
  );
}

export function HourCapsuleRow({ epochs, epochMinutesEach, startMin }: { epochs: readonly EpochState[]; epochMinutesEach: number; startMin: number }) {
  const buckets = hourBuckets(epochs, epochMinutesEach, startMin);
  if (buckets.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
      {buckets.map((b) => (
        <HourCapsule key={b.startMin} bucket={b} />
      ))}
    </ScrollView>
  );
}
