import { View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useDerivedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import type { MeterBand } from '@core/mobileLogic/index';
import { useTheme } from '../theme/useTheme';
import { springLevel } from './motion';

const BARS = 24;
const BAR_H = 40;
const MIN_SCALE = 0.06;

function Bar({ index, levels, reduce, color }: { index: number; levels: SharedValue<number[]>; reduce: boolean; color: string }) {
  const target = useDerivedValue(() => {
    const v = levels.get()[index] ?? 0;
    return reduce ? withTiming(v, { duration: 120, reduceMotion: ReduceMotion.System }) : withSpring(v, springLevel);
  });
  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: Math.max(MIN_SCALE, Math.min(1, target.get())) }] }));
  return <Animated.View style={[{ width: 3, height: BAR_H, borderRadius: 1.5, backgroundColor: color, transformOrigin: 'bottom' }, style]} />;
}

/**
 * M11. Decorative room-sound meter. One accessible element; the value text is a coarse band that changes rarely.
 * Always the accent colour: loudness is never red or amber. It shows that the microphone is hearing sound; it measures nothing else.
 */
export function LevelMeter({ levels, stale, band, label }: { levels: SharedValue<number[]>; stale: boolean; band: MeterBand; label: string }) {
  const { colors, reduceMotion } = useTheme();
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} accessibilityValue={{ text: stale ? 'no audio' : band }} style={{ opacity: stale ? 0.4 : 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 3, height: BAR_H }}>
        {Array.from({ length: BARS }, (_, i) => (
          <Bar key={i} index={i} levels={levels} reduce={reduceMotion} color={colors.accent} />
        ))}
      </View>
    </View>
  );
}
