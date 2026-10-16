import { BlurView } from 'expo-blur';
import { createContext, useContext } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';
import { AppText } from './AppText';

/** Scroll offset of the enclosing tab Screen (UI-thread shared value). Null outside a titled Screen. */
export const ScrollYContext = createContext<SharedValue<number> | null>(null);
export const useScrollY = () => useContext(ScrollYContext);

/** Offsets (pt of scroll) over which the large title hands over to the bar title. */
export const COLLAPSE_FROM = 26;
export const COLLAPSE_TO = 58;
const BAR_HEIGHT = 44;

/**
 * Blurred top bar for tab screens. Transparent at rest; once the large title scrolls away it fades in a blur, a hairline
 * and a small centred title (the native large-title collapse, rebuilt on the UI thread). Solid under Reduce Transparency.
 */
export function CollapsingBar({ title, y }: { title: string; y: SharedValue<number> }) {
  const insets = useSafeAreaInsets();
  const { colors, scheme, reduceTransparency } = useTheme();
  const total = insets.top + BAR_HEIGHT;
  const bg = useAnimatedStyle(() => ({ opacity: interpolate(y.get(), [COLLAPSE_FROM, COLLAPSE_TO], [0, 1], 'clamp') }));
  const label = useAnimatedStyle(() => ({
    opacity: interpolate(y.get(), [COLLAPSE_FROM + 6, COLLAPSE_TO], [0, 1], 'clamp'),
    transform: [{ translateY: interpolate(y.get(), [COLLAPSE_FROM, COLLAPSE_TO], [6, 0], 'clamp') }],
  }));
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: total, zIndex: 10 }}>
      <Animated.View style={[StyleSheet.absoluteFill, bg]}>
        {reduceTransparency ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]} />
        ) : (
          <BlurView intensity={scheme === 'dark' ? 50 : 70} tint={scheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        )}
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.separator }} />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', left: 60, right: 60, bottom: 0, height: BAR_HEIGHT, justifyContent: 'center' }, label]}>
        <AppText variant="headline" numberOfLines={1} center accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {title}
        </AppText>
      </Animated.View>
    </View>
  );
}
