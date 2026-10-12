import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { AppText } from './AppText';
import { GradientBorder } from './GradientBorder';
import { Icon, type SymbolName } from './Icon';

/** Weather-file detail tile size. */
export const TILE = 164;

export interface GlassTileProps {
  /** Short caps label, for example "ESTIMATED WINDOW". */
  label: string;
  /** Plain value text. Never a gauge, never a score. */
  value: string;
  caption?: string;
  icon: SymbolName;
  testID?: string;
}

/**
 * v2 glass detail tile (164 x 164): dimmed SF Symbol, caps label, value. Solid card under Reduce Transparency.
 * Static, no glow. Wording must be plain facts; it must not read as a score.
 */
export function GlassTile({ label, value, caption, icon, testID }: GlassTileProps) {
  const { colors, reduceTransparency, scheme } = useTheme();
  return (
    <View testID={testID} accessible accessibilityLabel={`${label}. ${value}.${caption ? ` ${caption}` : ''}`} style={{ width: TILE, height: TILE }}>
      <GradientBorder radius={24} fill={reduceTransparency ? colors.card : colors.card} style={{ flex: 1 }} innerStyle={{ flex: 1 }}>
        {reduceTransparency ? null : (
          <>
            <BlurView pointerEvents="none" intensity={scheme === 'dark' ? 30 : 45} tint={scheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            <LinearGradient pointerEvents="none" colors={colors.glassGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          </>
        )}
        <View style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name={icon} size={16} color={colors.labelTertiary} />
            <AppText variant="caption1" weight="600" tone="secondary" style={{ letterSpacing: 0.4 }} maxFontSizeMultiplier={1.3}>
              {label.toUpperCase()}
            </AppText>
          </View>
          <View style={{ gap: 4 }}>
            <AppText variant="title3" tabular maxFontSizeMultiplier={1.4}>
              {value}
            </AppText>
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
