
import type { ReactNode } from 'react';
import { useSafeRouter } from '../nav/useSafeRouter';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';
import { AppText } from './AppText';
import { GradientBorder } from './GradientBorder';
import { Icon } from './Icon';
import { PressScale } from './Press';
import Animated, { interpolate, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { COLLAPSE_TO, useScrollY } from './CollapsingBar';

/** Large title block for tab screens: 34pt bold, optional eyebrow and subtitle, optional trailing control. */
export function ScreenHeader({ title, subtitle, eyebrow, right }: { title: string; subtitle?: string; eyebrow?: string; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const ctx = useScrollY();
  const fallback = useSharedValue(0);
  const y = ctx ?? fallback;
  // The large title keeps its place and fades as the bar title takes over; the subtitle goes first.
  const titleStyle = useAnimatedStyle(() => ({ opacity: interpolate(y.get(), [8, COLLAPSE_TO], [1, 0], 'clamp') }));
  return (
    <View style={{ paddingTop: insets.top + 10, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          {eyebrow ? (
            <AppText variant="subheadline" tone="secondary" weight="600">
              {eyebrow}
            </AppText>
          ) : null}
          <Animated.View style={ctx ? titleStyle : undefined}>
            <AppText variant="largeTitle" accessibilityRole="header">
              {title}
            </AppText>
          </Animated.View>
        </View>
        {right}
      </View>
      {subtitle ? (
        <AppText variant="callout" tone="secondary">
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}

/** Glass back button: 44pt tile with a gradient hairline. */
export function BackButton({ onPress, label = 'Back', icon = 'chevron.left' }: { onPress?: () => void; label?: string; icon?: 'chevron.left' | 'xmark' }) {
  const router = useSafeRouter();
  const { colors, reduceTransparency } = useTheme();
  return (
    <PressScale onPress={onPress ?? (() => router.back())} accessibilityLabel={label} haptic="light">
      <GradientBorder radius={16} fill={reduceTransparency ? colors.card : colors.glassFill} style={{ width: 44, height: 44 }} innerStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={icon === 'xmark' ? 16 : 18} color={colors.label} weight="semibold" />
      </GradientBorder>
    </PressScale>
  );
}

/** Top bar for pushed screens: back tile, centred small title, optional trailing slot. Sits above the scroll view. */
export function BackBar({ title, right, onBack, icon }: { title?: string; right?: ReactNode; onBack?: () => void; icon?: 'chevron.left' | 'xmark' }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 20, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <BackButton onPress={onBack} icon={icon} />
      <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 4 }}>
        {title ? (
          <AppText variant="headline" numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={1.6} accessibilityRole="header" center>
            {title}
          </AppText>
        ) : null}
      </View>
      <View style={{ minWidth: 44, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}
