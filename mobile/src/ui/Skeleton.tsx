import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, ReduceMotion, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useTheme } from '../theme/useTheme';

/**
 * Loading placeholder. A slow opacity shimmer (1.1 s each way, UI thread) tells the user something is happening;
 * it is perfectly still under Reduce Motion. Runs only while mounted, so nothing animates once data has loaded.
 */
export function Skeleton({ lines = 3, height = 14 }: { lines?: number; height?: number }) {
  const { colors, reduceMotion } = useTheme();
  const p = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      p.set(0);
      return;
    }
    p.set(withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.System }), -1, true));
    return () => cancelAnimation(p);
  }, [reduceMotion, p]);
  const pulse = useAnimatedStyle(() => ({ opacity: 1 - 0.55 * p.get() }));
  return (
    <View accessible accessibilityLabel="Loading" accessibilityRole="progressbar" style={{ gap: 10 }}>
      {Array.from({ length: lines }, (_, i) => (
        <Animated.View key={i} style={[{ height, width: i === lines - 1 ? '60%' : '100%', borderRadius: 6, borderCurve: 'continuous', backgroundColor: colors.fill }, pulse]} />
      ))}
    </View>
  );
}
