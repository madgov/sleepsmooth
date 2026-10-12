import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';
import { useTheme } from '../theme/useTheme';

const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

/**
 * v2 screen background (IOS_DESIGN_V2 section 4). Static: nothing here animates, so there is nothing to pause under
 * Reduce Motion. Solid colour under Reduce Transparency.
 * - 'plain' (Results, summary, next steps): the three-stop gradient only. No glow, no panel.
 * - 'audio' (Tonight, onboarding): the gradient plus one angled panel and one soft accent halo. Chrome only.
 */
export function ScreenBackdrop({ variant = 'plain' }: { variant?: 'audio' | 'plain' }) {
  const { colors, reduceTransparency, night } = useTheme();
  if (reduceTransparency) return <View pointerEvents="none" style={[FILL, { backgroundColor: colors.bg }]} />;
  return (
    <View pointerEvents="none" style={[FILL, { backgroundColor: colors.bg, overflow: 'hidden' }]} aria-hidden>
      <LinearGradient colors={colors.bgGradient} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={FILL} />
      {variant === 'audio' ? (
        <>
          {/* Angled panel: a large rounded slab tilted -14 degrees, 5 percent white. Decorative. */}
          <View
            style={{
              position: 'absolute',
              top: 120,
              left: -60,
              width: 520,
              height: 300,
              borderRadius: 44,
              borderCurve: 'continuous',
              backgroundColor: night ? 'rgba(89,54,180,0.06)' : 'rgba(78,74,242,0.05)',
              transform: [{ rotate: '-14deg' }],
            }}
          />
          <LinearGradient
            colors={[colors.glow, 'rgba(0,0,0,0)']}
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 1, y: 1 }}
            style={{ position: 'absolute', top: -80, right: -120, width: 380, height: 380, borderRadius: 190 }}
          />
        </>
      ) : null}
    </View>
  );
}
