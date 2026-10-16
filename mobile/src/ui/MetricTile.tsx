import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { AppText } from './AppText';
import { GradientBorder } from './GradientBorder';
import { Icon, type SymbolName } from './Icon';

export interface MetricTileProps {
  label: string;
  /** Big numeral or short time. A measured fact, never a score. */
  value: string;
  unit?: string;
  caption?: string;
  icon: SymbolName;
  testID?: string;
}

/** Glass metric tile (weather-file detail tile proportions, flexible width, 164 tall). */
export function MetricTile({ label, value, unit, caption, icon, testID }: MetricTileProps) {
  const { colors, reduceTransparency, scheme } = useTheme();
  return (
    <View testID={testID} accessible accessibilityLabel={`${label}. ${value}${unit ? ` ${unit}` : ''}.${caption ? ` ${caption}` : ''}`} style={{ flex: 1, minHeight: 164 }}>
      <GradientBorder radius={26} fill={colors.card} style={{ flex: 1 }} innerStyle={{ flex: 1 }}>
        {reduceTransparency ? null : (
          <>
            <BlurView pointerEvents="none" intensity={scheme === 'dark' ? 30 : 45} tint={scheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            <LinearGradient pointerEvents="none" colors={colors.glassGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          </>
        )}
        <View style={{ flex: 1, padding: 16, justifyContent: 'space-between', gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name={icon} size={16} color={colors.labelSecondary} />
            <AppText variant="caption1" weight="600" tone="secondary" style={{ flexShrink: 1 }} maxFontSizeMultiplier={1.3}>
              {label}
            </AppText>
          </View>
          <View style={{ gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, flexWrap: 'wrap' }}>
              <AppText variant="largeTitle" tabular weight="700" maxFontSizeMultiplier={1.2}>
                {value}
              </AppText>
              {unit ? (
                <AppText variant="subheadline" tone="secondary" weight="600" maxFontSizeMultiplier={1.3}>
                  {unit}
                </AppText>
              ) : null}
            </View>
            {caption ? (
              <AppText variant="footnote" tone="secondary" maxFontSizeMultiplier={1.4}>
                {caption}
              </AppText>
            ) : null}
          </View>
        </View>
      </GradientBorder>
    </View>
  );
}
