import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import Animated from 'react-native-reanimated';
import { useTheme } from '../theme/useTheme';
import { AppText } from './AppText';
import { CSS_EASE_OUT, PRESS_IN_MS, PRESS_OUT_MS } from './motion';

export interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'filled' | 'tinted' | 'plain' | 'destructive';
  shape?: 'capsule' | 'rounded';
  size?: 'large' | 'medium';
  loading?: boolean;
  disabled?: boolean;
  /** Spoken when disabled, so the reason is not lost. */
  disabledReason?: string;
  accessibilityHint?: string;
  /** Haptic on press. Default: light impact for filled and tinted, none for plain and destructive (dismissals and confirmations carry their own). */
  haptic?: 'light' | 'selection' | 'none';
  testID?: string;
}

/** v2: the filled variant is the gradient CTA (cyan end darkened so white text is at least 4.5:1). Primary actions only. */
/** M1: press feedback is a scale on the UI thread (CSS transition), 100 ms in and 160 ms out. */
export function PrimaryButton({ label, onPress, variant = 'filled', shape = 'capsule', size = 'large', loading, disabled, disabledReason, accessibilityHint, haptic, testID }: PrimaryButtonProps) {
  const { colors, radius, reduceMotion } = useTheme();
  const { fontScale } = useWindowDimensions();
  const [pressed, setPressed] = useState(false);
  const inactive = disabled || loading;

  const bg = variant === 'filled' ? 'transparent' : variant === 'tinted' ? colors.accentFill : 'transparent';
  const fg = variant === 'filled' ? '#FFFFFF' : variant === 'destructive' ? colors.destructive : colors.accent;
  const height = size === 'large' ? 50 : 40;
  const pressedScale = reduceMotion ? 0.98 : 0.97;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={disabled && disabledReason ? disabledReason : accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={() => {
        const h = haptic ?? (variant === 'filled' || variant === 'tinted' ? 'light' : 'none');
        if (h === 'light') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        else if (h === 'selection') void Haptics.selectionAsync();
        onPress();
      }}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      pressRetentionOffset={{ top: 12, bottom: 12, left: 12, right: 12 }}
      hitSlop={size === 'medium' ? { top: 2, bottom: 2 } : undefined}
    >
      <Animated.View
        style={{
          minHeight: Math.max(height, 44),
          paddingVertical: 12,
          paddingHorizontal: 20,
          borderRadius: shape === 'capsule' ? radius.pill : radius.md,
          borderCurve: 'continuous',
          overflow: 'hidden',
          backgroundColor: bg,
          opacity: disabled ? 0.4 : 1,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          transform: reduceMotion ? [] : [{ scale: pressed ? pressedScale : 1 }],
          ...(reduceMotion && pressed ? { opacity: disabled ? 0.4 : 0.7 } : null),
          transitionProperty: 'transform',
          transitionDuration: reduceMotion ? 0 : pressed ? PRESS_IN_MS : PRESS_OUT_MS,
          transitionTimingFunction: CSS_EASE_OUT,
        }}
      >
        {variant === 'filled' ? <LinearGradient pointerEvents="none" colors={colors.accentGradientText} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} /> : null}
        {loading ? <ActivityIndicator color={fg} /> : null}
        <View style={{ flexShrink: 1 }}>
          <AppText variant="headline" center tone={{ color: fg }} maxFontSizeMultiplier={fontScale > 2 ? 2 : undefined}>
            {label}
          </AppText>
        </View>
      </Animated.View>
    </Pressable>
  );
}
