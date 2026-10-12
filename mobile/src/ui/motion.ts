import { Easing, ReduceMotion, cubicBezier } from 'react-native-reanimated';

// Worklet-thread easing (withTiming) and CSS-transition easing (cubicBezier) for the same curves.
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
export const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);
export const EASE_SINE = Easing.inOut(Easing.sin);
export const CSS_EASE_OUT = cubicBezier(0.23, 1, 0.32, 1);

// Named springs (Apple damping ratio + response). No overshoot anywhere in v1 (dampingRatio 1) except
// springMomentum, which is reserved for a finger flick (P1 timeline scrub, not built yet).
export const springSettle = { duration: 400, dampingRatio: 1, reduceMotion: ReduceMotion.System } as const;
export const springSnappy = { duration: 250, dampingRatio: 1, reduceMotion: ReduceMotion.System } as const;
export const springLevel = { duration: 180, dampingRatio: 1, reduceMotion: ReduceMotion.System } as const;

export const PRESS_IN_MS = 100;
export const PRESS_OUT_MS = 160;
