import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, type AccessibilityRole, type AccessibilityState, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useTheme } from '../theme/useTheme';
import { PRESS_IN_MS, springSnappy } from './motion';

export interface PressScaleProps {
  children: ReactNode;
  onPress?: () => void;
  /** Haptic paired with the visual. 'none' for navigation rows that already have their own feedback. */
  haptic?: 'selection' | 'light' | 'none';
  scaleTo?: number;
  disabled?: boolean;
  /** Applied to the pressable (layout: flex, margin, alignSelf). */
  containerStyle?: StyleProp<ViewStyle>;
  /** Applied to the scaling view. */
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  testID?: string;
}

/**
 * Every tappable surface in the app. Press-in is a quick ease; release is a critically damped spring (no overshoot).
 * Scale and opacity only, on the UI thread. Reduce Motion: a small opacity dip instead of travel.
 */
export function PressScale({ children, onPress, haptic = 'selection', scaleTo = 0.97, disabled, containerStyle, style, testID, ...a11y }: PressScaleProps) {
  const { reduceMotion } = useTheme();
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: reduceMotion ? [] : [{ scale: s.get() }], opacity: reduceMotion ? 1 - (1 - s.get()) * 6 : 1 }));
  return (
    <Pressable
      testID={testID}
      accessibilityRole={a11y.accessibilityRole ?? 'button'}
      accessibilityLabel={a11y.accessibilityLabel}
      accessibilityHint={a11y.accessibilityHint}
      accessibilityState={{ disabled: !!disabled, ...a11y.accessibilityState }}
      disabled={disabled}
      style={containerStyle}
      pressRetentionOffset={{ top: 12, bottom: 12, left: 12, right: 12 }}
      onPressIn={() => s.set(withTiming(scaleTo, { duration: PRESS_IN_MS }))}
      onPressOut={() => s.set(withSpring(1, springSnappy))}
      onPress={() => {
        if (haptic === 'selection') void Haptics.selectionAsync();
        else if (haptic === 'light') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
    >
      <Animated.View style={[style, anim]}>{children}</Animated.View>
    </Pressable>
  );
}
