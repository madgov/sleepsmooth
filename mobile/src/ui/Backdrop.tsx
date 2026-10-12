import { LinearGradient } from 'expo-linear-gradient';
import { View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from '../theme/useTheme';

const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

/**
 * v3 screen backdrop, built in code: the three-stop gradient, two soft radial orbs and one or two angled glass slabs.
 * Static (nothing animates). Solid colour under Reduce Transparency. Chrome only; never behind evidence as a signal.
 * - 'app': subtle, for tab screens.  - 'intro': vivid, for the slideshow and the finish step.  - 'plain': gradient only.
 */
export function Backdrop({ variant = 'app' }: { variant?: 'app' | 'intro' | 'plain' }) {
  const { colors, scheme, reduceTransparency, night } = useTheme();
  const { width, height } = useWindowDimensions();
  if (reduceTransparency) return <View pointerEvents="none" style={[FILL, { backgroundColor: colors.bg }]} />;
  const dark = scheme === 'dark';
  const k = variant === 'intro' ? 1 : 0.55;
  const indigoA = (dark ? 0.62 : 0.34) * k;
  const cyanA = (dark ? 0.34 : 0.26) * k;
  const slab = dark ? 'rgba(255,255,255,0.045)' : 'rgba(78,74,242,0.05)';
  return (
    <View pointerEvents="none" style={[FILL, { backgroundColor: colors.bg, overflow: 'hidden' }]} aria-hidden>
      <LinearGradient colors={colors.bgGradient} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={FILL} />
      {variant === 'plain' || night ? null : (
        <>
          <Svg width={width} height={height} style={FILL}>
            <Defs>
              <RadialGradient id="orbA" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#5936B4" stopOpacity={indigoA} />
                <Stop offset="1" stopColor="#5936B4" stopOpacity={0} />
              </RadialGradient>
              <RadialGradient id="orbB" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#34C8E8" stopOpacity={cyanA} />
                <Stop offset="1" stopColor="#34C8E8" stopOpacity={0} />
              </RadialGradient>
              <RadialGradient id="orbC" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#4E4AF2" stopOpacity={indigoA * 0.8} />
                <Stop offset="1" stopColor="#4E4AF2" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={width * 0.92} cy={variant === 'intro' ? height * 0.16 : 40} r={variant === 'intro' ? 300 : 250} fill="url(#orbA)" />
            <Circle cx={width * 0.02} cy={variant === 'intro' ? height * 0.52 : height * 0.34} r={variant === 'intro' ? 280 : 200} fill="url(#orbB)" />
            {variant === 'intro' ? <Circle cx={width * 0.8} cy={height * 0.86} r={300} fill="url(#orbC)" /> : null}
          </Svg>
          <View style={{ position: 'absolute', top: variant === 'intro' ? height * 0.1 : 90, left: -80, width: 560, height: 280, borderRadius: 48, borderCurve: 'continuous', backgroundColor: slab, transform: [{ rotate: '-16deg' }] }} />
          {variant === 'intro' ? (
            <View style={{ position: 'absolute', top: height * 0.5, left: -140, width: 620, height: 240, borderRadius: 48, borderCurve: 'continuous', backgroundColor: slab, transform: [{ rotate: '-16deg' }] }} />
          ) : null}
        </>
      )}
    </View>
  );
}
