import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';
import type { TintName } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { Icon, type SymbolName } from './Icon';

/**
 * Icon tile (decorative).
 * - `tint` set: flat muted tile in one of the restrained tint colours (list rows, cards). Never a status signal.
 * - otherwise: `accent` gradient tile (hero moments, the active tab) or `quiet` accent-wash tile.
 */
export function IconTile({ name, size = 52, tone = 'accent', tint }: { name: SymbolName; size?: number; tone?: 'accent' | 'quiet'; tint?: TintName }) {
  const { colors } = useTheme();
  const r = Math.round(size * 0.34);
  const t = tint ? colors.tint[tint] : undefined;
  const glyph = Math.round(size * 0.48);
  if (t) {
    return (
      <View
        style={{ width: size, height: size, borderRadius: r, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg, borderWidth: 1, borderColor: t.border }}
        accessible={false}
      >
        <Icon name={name} size={glyph} color={t.fg} weight="medium" />
      </View>
    );
  }
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
      <Icon name={name} size={glyph} color={tone === 'accent' ? '#FFFFFF' : colors.accent} weight="medium" />
    </View>
  );
}
