import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';

export interface GradientBorderProps {
  radius: number;
  /** Border width in points. Default 1. */
  width?: number;
  /** Fill inside the border. */
  fill: string;
  children?: ReactNode;
  style?: ViewStyle;
  innerStyle?: ViewStyle;
}

/**
 * A 1pt gradient border drawn as a gradient behind an inset fill (v2 chrome only: tab bar, hero cards).
 * Under Reduce Transparency or Increase Contrast it becomes a plain solid border. Never use on result or evidence cards.
 */
export function GradientBorder({ radius, width = 1, fill, children, style, innerStyle }: GradientBorderProps) {
  const { colors, reduceTransparency, increasedContrast } = useTheme();
  const solid = reduceTransparency || increasedContrast;
  return (
    <View style={[{ borderRadius: radius, borderCurve: 'continuous', overflow: 'hidden' }, style]}>
      {solid ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.separatorOpaque }]} />
      ) : (
        <LinearGradient colors={colors.glassBorder} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      )}
      <View style={[{ margin: width, borderRadius: Math.max(0, radius - width), borderCurve: 'continuous', overflow: 'hidden', backgroundColor: fill }, innerStyle]}>{children}</View>
    </View>
  );
}
