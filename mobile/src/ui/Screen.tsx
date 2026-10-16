import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';
import { Backdrop } from './Backdrop';
import { TAB_BAR } from './GlassTabBar';
import { CollapsingBar, ScrollYContext } from './CollapsingBar';
import { EASE_OUT } from './motion';

export interface ScreenProps {
  children: ReactNode;
  variant?: 'app' | 'intro' | 'plain';
  /** Rendered above the scroll area (pushed screens: a BackBar). */
  top?: ReactNode;
  /** Rendered below the scroll area, pinned (primary action bars). */
  bottom?: ReactNode;
  /** Tab screens end above the in-flow tab bar, so they need no bottom safe-area padding. */
  tab?: boolean;
  /** Tab screens: the title shown in the blurred bar once the large title scrolls away. */
  title?: string;
  gap?: number;
  contentStyle?: ViewStyle;
  /** False when a parent already draws the backdrop (steppers), so it does not re-mount between steps. */
  backdrop?: boolean;
  testID?: string;
}

/** Tab screens: the glass bar is in layout flow (it already includes the safe-area inset), so only the 36pt hump plus 24pt of air is needed for the last item to scroll fully clear. */
const TAB_CLEARANCE = TAB_BAR.lift + 24;

/** Screen shell: backdrop, 20pt gutters, scroll. The one place that decides page padding. */
export function Screen({ children, variant = 'app', top, bottom, tab, title, gap = 20, contentStyle, backdrop = true, testID }: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    y.set(e.contentOffset.y);
  });
  return (
    <ScrollYContext.Provider value={title ? y : null}>
    <View testID={testID} style={{ flex: 1, backgroundColor: backdrop ? colors.bg : 'transparent' }}>
      {backdrop ? <Backdrop variant={variant} /> : null}
      {top}
      {title ? <CollapsingBar title={title} y={y} /> : null}
      <Animated.ScrollView
        onScroll={title ? onScroll : undefined}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
        contentContainerStyle={[{ paddingHorizontal: 20, paddingBottom: bottom ? 16 : tab ? TAB_CLEARANCE : insets.bottom + 28, gap }, contentStyle]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </Animated.ScrollView>
      {bottom}
    </View>
    </ScrollYContext.Provider>
  );
}

/** Staggered entrance for dashboard blocks: fade and rise 14pt, 70 ms apart. Opacity only under Reduce Motion. Mount-only. */
export function Stagger({ i = 0, children, style }: { i?: number; children: ReactNode; style?: ViewStyle }) {
  const { reduceMotion } = useTheme();
  return (
    <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(40 + i * 70).duration(420).easing(EASE_OUT)} style={style}>
      {children}
    </Animated.View>
  );
}
