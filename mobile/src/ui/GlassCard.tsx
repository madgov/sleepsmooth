import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { GradientBorder } from './GradientBorder';

export interface GlassCardProps {
  radius?: number;
  padding?: number;
  children?: ReactNode;
  style?: ViewStyle;
  testID?: string;
}

/**
 * v2 frosted chrome card: blur, translucent fill, gradient hairline border.
 * Reduce Transparency: solid card colour. NOT for results, evidence, night-detail or summary content (those use Surface).
 */
export function GlassCard({ radius = 24, padding = 16, children, style, testID }: GlassCardProps) {
  const { colors, scheme, reduceTransparency } = useTheme();
  return (
    <View testID={testID} style={style}>
      <GradientBorder radius={radius} fill={reduceTransparency ? colors.card : colors.glassFill}>
        {reduceTransparency ? null : <BlurView pointerEvents="none" intensity={scheme === 'dark' ? 40 : 55} tint={scheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />}
        <View style={{ padding }}>{children}</View>
      </GradientBorder>
    </View>
  );
}
