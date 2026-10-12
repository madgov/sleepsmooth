import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { AppState, Pressable, View } from 'react-native';
import Animated, {
  cancelAnimation,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme/useTheme';
import { Icon } from './Icon';
import { EASE_OUT, EASE_SINE, springSnappy } from './motion';

export type HeroState = 'idle' | 'recording' | 'starting' | 'stopping' | 'disabled';

export interface HeroRecordButtonProps {
  state: HeroState;
  onPress: () => void;
  size?: number;
  accessibilityLabel: string;
  accessibilityHint?: string;
  accessibilityValueText?: string;
  testID?: string;
}

/**
 * M8-M10. An accent-gradient circle (idle, exact bike-file gradient, white glyph at 3:1 or better) that crossfades to a night-surface card with a stop glyph (recording).
 * All motion runs on the UI thread from shared values. Under Reduce Motion: no scale, no pulse; opacity crossfades only.
 * The recording state is carried by the glyph, the word "Recording" and the elapsed time (rendered by the parent), never by motion alone.
 */
export function HeroRecordButton({ state, onPress, size = 176, accessibilityLabel, accessibilityHint, accessibilityValueText, testID }: HeroRecordButtonProps) {
  const { colors, reduceMotion } = useTheme();
  const recording = state === 'recording' || state === 'stopping';
  const rec = useSharedValue(recording ? 1 : 0);
  const press = useSharedValue(1);
  const breath = useSharedValue(0);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAppActive(s === 'active'));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    rec.set(withTiming(recording ? 1 : 0, { duration: recording ? 250 : 200, easing: EASE_OUT, reduceMotion: ReduceMotion.System }));
  }, [recording, rec]);

  // M10: breathing ring. 8 s cycle, 5% amplitude. Not run under Reduce Motion or when the app is not active.
  useEffect(() => {
    if (state === 'recording' && appActive && !reduceMotion) {
      breath.set(withRepeat(withSequence(withTiming(1, { duration: 4000, easing: EASE_SINE }), withTiming(0, { duration: 4000, easing: EASE_SINE })), -1));
    } else {
      cancelAnimation(breath);
      breath.set(0);
    }
    return () => cancelAnimation(breath);
  }, [state, appActive, reduceMotion, breath]);

  const idleFill = useAnimatedStyle(() => ({ opacity: 1 - rec.get() }));
  const recFill = useAnimatedStyle(() => ({ opacity: rec.get() }));
  const idleGlyph = useAnimatedStyle(() => ({ opacity: 1 - rec.get(), transform: reduceMotion ? [] : [{ scale: 1 - 0.1 * rec.get() }] }));
  const recGlyph = useAnimatedStyle(() => ({ opacity: rec.get(), transform: reduceMotion ? [] : [{ scale: 0.9 + 0.1 * rec.get() }] }));
  const ring = useAnimatedStyle(() => {
    const on = rec.get();
    if (reduceMotion) return { opacity: 0.22 * on };
    const b = breath.get();
    return { opacity: on * (0.28 - 0.14 * b), transform: [{ scale: 1 + 0.05 * b }] };
  });
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.get() }] }));

  const disabled = state === 'disabled' || state === 'starting' || state === 'stopping';
  const ringSize = size + 28;

  return (
    <View style={{ width: ringSize, height: ringSize, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', width: ringSize, height: ringSize, borderRadius: ringSize / 2, borderWidth: 2, borderColor: colors.accent }, ring]}
      />
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityValue={accessibilityValueText ? { text: accessibilityValueText } : undefined}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => press.set(reduceMotion ? withTiming(0.98, { duration: 100 }) : withSpring(0.96, springSnappy))}
        onPressOut={() => press.set(reduceMotion ? withTiming(1, { duration: 100 }) : withSpring(1, springSnappy))}
        pressRetentionOffset={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Animated.View
          style={[
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              shadowColor: '#000',
              shadowOpacity: 0.18,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 10 },
            },
            pressStyle,
          ]}
        >
          <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', borderWidth: 0.5, borderColor: colors.separator }}>
            <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, idleFill]}>
              <LinearGradient colors={colors.accentGradient} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={{ flex: 1 }} />
            </Animated.View>
            <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.card }, recFill]} />
            <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }, idleGlyph]}>
              <Icon name="moon.zzz" size={size * 0.42} color="#FFFFFF" weight="regular" />
            </Animated.View>
            <Animated.View style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }, recGlyph]}>
              <Icon name="stop.fill" size={size * 0.3} color={colors.accent} />
            </Animated.View>
            <View pointerEvents="none" style={{ position: 'absolute', top: 0.5, left: 0.5, right: 0.5, bottom: 0.5, borderRadius: size / 2, borderWidth: 0.5, borderColor: colors.cardHighlight }} />
          </View>
        </Animated.View>
      </Pressable>
    </View>
  );
}
