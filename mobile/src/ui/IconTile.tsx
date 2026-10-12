import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { Icon, type SymbolName } from './Icon';

/** Raised gradient tile with a white SF Symbol (bike-file active-tab treatment, reused for list cards). Decorative. */
export function IconTile({ name, size = 52, tone = 'accent' }: { name: SymbolName; size?: number; tone?: 'accent' | 'quiet' }) {
  const { colors } = useTheme();
  const r = Math.round(size * 0.34);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: r,
        borderCurve: 'continuous',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: tone === 'accent' ? '0px 8px 16px rgba(26,26,51,0.28)' : undefined,
        backgroundColor: tone === 'quiet' ? colors.accentFill : undefined,
      }}
      accessible={false}
    >
      {tone === 'accent' ? <LinearGradient pointerEvents="none" colors={colors.accentGradientText} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} /> : null}
      <Icon name={name} size={Math.round(size * 0.48)} color={tone === 'accent' ? '#FFFFFF' : colors.accent} weight="medium" />
    </View>
  );
}
