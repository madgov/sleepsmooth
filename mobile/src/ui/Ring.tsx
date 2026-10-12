import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '../theme/useTheme';
import { EASE_OUT } from './motion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface RingProps {
  size?: number;
  stroke?: number;
  /** 0..1 share of the arc that is filled. A plain proportion of hours, never a score. */
  progress: number;
  children?: ReactNode;
  accessibilityLabel: string;
  id?: string;
}

/** Progress ring: soft track plus a bike-gradient arc with round caps. Fills once on mount (ease-out), static under Reduce Motion. */
export function Ring({ size = 132, stroke = 12, progress, children, accessibilityLabel, id = 'ring' }: RingProps) {
  const { colors, reduceMotion } = useTheme();
  const p = useSharedValue(reduceMotion ? progress : 0);
  useEffect(() => {
    p.set(reduceMotion ? progress : withTiming(Math.max(0, Math.min(1, progress)), { duration: 900, easing: EASE_OUT }));
  }, [progress, reduceMotion, p]);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const props = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - p.get()) }));
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.accentGradient[0]} />
            <Stop offset="1" stopColor={colors.accentGradient[1]} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.fill} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${c} ${c}`}
          animatedProps={props}
        />
      </Svg>
      {children}
    </View>
  );
}
