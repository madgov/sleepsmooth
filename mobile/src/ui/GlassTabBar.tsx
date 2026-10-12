import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { useRecordAction } from '../hooks/useRecordAction';
import { useTheme } from '../theme/useTheme';
import { AppText } from './AppText';
import { HeroRecordButton, type HeroState } from './HeroRecordButton';
import { Icon, type SymbolName } from './Icon';
import { springSnappy } from './motion';

/**
 * Dimensions in points (IOS_DESIGN_V2 section 2). Geometry follows the weather reference tab bar:
 * curved centre hump 258 wide, raised 64pt centre button, side items inset 32 from the edges.
 */
export const TAB_BAR = {
  body: 64, // bar height above the safe-area extension
  lift: 36, // hump rise above the bar top
  hump: 258,
  humpTop: 86, // flat width at the hump crest
  corner: 24,
  button: 64,
  sideInset: 32,
  target: 44,
  tile: 52,
} as const;

const TABS: Record<string, { label: string; icon: SymbolName; iconSelected: SymbolName }> = {
  dashboard: { label: 'Dashboard', icon: 'square.grid.2x2', iconSelected: 'square.grid.2x2.fill' },
  checks: { label: 'Checks', icon: 'checklist', iconSelected: 'checklist' },
  nights: { label: 'Nights', icon: 'bed.double', iconSelected: 'bed.double.fill' },
  settings: { label: 'Settings', icon: 'gearshape', iconSelected: 'gearshape.fill' },
};

/** Outline of the bar with the centre hump. Exported for tests and for the doc. */
export function barPath(w: number, h: number): string {
  const { lift: L, hump, humpTop, corner: R } = TAB_BAR;
  const cx = w / 2;
  const x0 = cx - hump / 2;
  const x1 = cx + hump / 2;
  const t0 = cx - humpTop / 2;
  const t1 = cx + humpTop / 2;
  const k = (t0 - x0) * 0.55;
  return [
    `M0 ${h}`,
    `L0 ${L + R}`,
    `Q0 ${L} ${R} ${L}`,
    `L${x0} ${L}`,
    `C${x0 + k} ${L} ${t0 - k} 0 ${t0} 0`,
    `L${t1} 0`,
    `C${t1 + k} 0 ${x1 - k} ${L} ${x1} ${L}`,
    `L${w - R} ${L}`,
    `Q${w} ${L} ${w} ${L + R}`,
    `L${w} ${h}`,
    'Z',
  ].join(' ');
}

/**
 * Edge-to-edge tab bar with a curved centre hump and a raised centre record button:
 * Dashboard | Checks | Record | Nights | Settings. It sits in the layout flow (not absolute), so screens end above it.
 */
export function GlassTabBar(props: BottomTabBarProps) {
  return <Bar {...props} />;
}

function Bar({ state, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const rec = useRecordAction();

  const heroState: HeroState = rec.status === 'recording' ? 'recording' : rec.status === 'starting' ? 'starting' : rec.status === 'stopping' ? 'stopping' : 'idle';
  const recording = rec.active;
  const total = TAB_BAR.lift + TAB_BAR.body + insets.bottom;
  const cx = width / 2;

  const goTo = (routeName: string, routeKey: string, isFocused: boolean) => {
    const e = navigation.emit({ type: 'tabPress', target: routeKey, canPreventDefault: true });
    if (!isFocused && !e.defaultPrevented) {
      void Haptics.selectionAsync();
      navigation.navigate(routeName);
    }
  };

  const path = barPath(width, total);
  const itemW = 72;
  const itemTop = TAB_BAR.lift + 6;
  // Four items either side of the hump: centres at 11.5 / 34.5 / 65.5 / 88.5 percent of the width.
  const centres = [0.125, 0.3, 0.7, 0.875].map((f) => f * width);

  return (
    <View style={{ height: total, backgroundColor: colors.bg }}>
      <Svg width={width} height={total} style={{ position: 'absolute', top: 0, left: 0 }} aria-hidden>
        <Defs>
          <SvgGradient id="barGlass" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.glassGradient[0]} />
            <Stop offset="1" stopColor={colors.glassGradient[1]} />
          </SvgGradient>
          <SvgGradient id="barEdge" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.glassBorder[0]} />
            <Stop offset="0.6" stopColor={colors.glassBorder[1]} />
          </SvgGradient>
        </Defs>
        <Path d={path} fill={colors.card} />
        <Path d={path} fill="url(#barGlass)" stroke="url(#barEdge)" strokeWidth={1} />
      </Svg>

      <View accessibilityRole="tablist" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="box-none">
        {state.routes.slice(0, 4).map((r, i) => (
          <TabItem
            key={r.key}
            name={r.name}
            focused={state.index === i}
            style={{ left: (centres[i] ?? 0) - itemW / 2, top: itemTop, width: itemW }}
            onPress={() => goTo(r.name, r.key, state.index === i)}
          />
        ))}

        {/* Raised centre action: 64pt button inside the hump; 92pt slot holds the breathing ring. */}
        <View pointerEvents="box-none" style={{ position: 'absolute', left: cx - 46, top: 8 - 14, width: 92, alignItems: 'center' }}>
          <HeroRecordButton
            state={heroState}
            size={TAB_BAR.button}
            onPress={rec.onPress}
            accessibilityLabel={recording ? 'Stop recording' : "Start tonight's recording"}
            accessibilityHint={recording ? 'Asks you to confirm before stopping' : 'Opens a short checklist before recording starts'}
            testID="tab-record"
          />
        </View>
        <View pointerEvents="none" style={{ position: 'absolute', left: cx - 46, width: 92, top: 8 + TAB_BAR.button + 6, alignItems: 'center' }} aria-hidden>
          <AppText variant="caption2" weight="600" tone={recording ? 'accent' : 'secondary'} maxFontSizeMultiplier={1.3}>
            {recording ? 'Stop' : 'Record'}
          </AppText>
        </View>
      </View>
    </View>
  );
}

function TabItem({ name, focused, onPress, style }: { name: string; focused: boolean; onPress: () => void; style: { left: number; top: number; width: number } }) {
  const { colors, reduceMotion } = useTheme();
  const meta = TABS[name];
  const sel = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    sel.set(reduceMotion ? withTiming(focused ? 1 : 0, { duration: 120, reduceMotion: ReduceMotion.System }) : withSpring(focused ? 1 : 0, springSnappy));
  }, [focused, reduceMotion, sel]);
  // Bike-style selected state: a raised, slightly skewed gradient tile that lifts 14pt above the bar with its icon.
  // Reduce Motion: no travel or scale; the tile fades.
  const tileStyle = useAnimatedStyle(() => ({ opacity: sel.get(), transform: reduceMotion ? [{ translateY: -14 }] : [{ translateY: -14 * sel.get() }, { scale: 0.85 + 0.15 * sel.get() }] }));
  const iconLift = useAnimatedStyle(() => ({ transform: reduceMotion ? [{ translateY: focused ? -14 : 0 }] : [{ translateY: -14 * sel.get() }] }));
  if (!meta) return null;
  const color = focused ? colors.accent : colors.labelSecondary;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={meta.label}
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      style={{ position: 'absolute', ...style, height: 56, alignItems: 'center' }}
      testID={`tab-${name}`}
    >
      <View style={{ width: TAB_BAR.tile, height: 40, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
        <Animated.View style={[{ position: 'absolute', width: TAB_BAR.tile, height: TAB_BAR.tile }, tileStyle]}>
          <LinearGradient
            colors={colors.accentGradient}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={{ flex: 1, borderRadius: 16, borderCurve: 'continuous', transform: [{ skewX: '-6deg' }], boxShadow: '0px 10px 18px rgba(26,26,51,0.35)' }}
          />
        </Animated.View>
        <Animated.View style={iconLift}>
          <Icon name={focused ? meta.iconSelected : meta.icon} size={24} color={focused ? '#FFFFFF' : color} weight={focused ? 'semibold' : 'regular'} />
        </Animated.View>
      </View>
      <AppText variant="caption2" weight={focused ? '600' : '500'} style={{ color, marginTop: 2 }} maxFontSizeMultiplier={1.3}>
        {meta.label}
      </AppText>
    </Pressable>
  );
}
