import { useCallback, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import Animated, {
  interpolate,
  ReduceMotion,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { pageLabel, skipTarget } from '@core/mobileLogic/index';
import { COPY } from '../content/copy';
import { useTheme } from '../theme/useTheme';
import { AppText } from '../ui/AppText';
import { Icon, type SymbolName } from '../ui/Icon';
import { EASE_OUT } from '../ui/motion';

export interface OnboardingCtx {
  progress: SharedValue<number>;
  index: number;
  next(): void;
  back(): void;
  skipToEnd(): void;
  width: number;
}

export interface OnboardingPage {
  key: string;
  symbol: SymbolName;
  title: string;
  skippable: boolean;
  /** Pages that have a safety role or a gate hide the header Back on page 1 only. */
  render: (ctx: OnboardingCtx) => ReactNode;
}

/** M4: three parallax layers per page. Under Reduce Motion: opacity crossfade only. */
function Illustration({ symbol, progress, index, width, small }: { symbol: SymbolName; progress: SharedValue<number>; index: number; width: number; small: boolean }) {
  const { colors, reduceMotion, reduceTransparency } = useTheme();
  const tile = small ? 96 : 160;
  const halo = useAnimatedStyle(() => {
    const d = progress.get() - index;
    return reduceMotion ? { opacity: 1 - Math.min(1, Math.abs(d)) } : { transform: [{ translateX: -d * width * 0.3 }], opacity: interpolate(Math.abs(d), [0, 1], [1, 0], 'clamp') };
  });
  const sym = useAnimatedStyle(() => {
    const d = progress.get() - index;
    const a = Math.abs(d);
    const opacity = interpolate(a, [0, 0.6, 1], [1, 0.6, 0], 'clamp');
    return reduceMotion ? { opacity } : { transform: [{ translateX: -d * width * 0.15 }, { scale: interpolate(a, [0, 1], [1, 0.92], 'clamp') }], opacity };
  });
  return (
    <View style={{ height: tile + 56, alignItems: 'center', justifyContent: 'center' }} accessible={false} importantForAccessibility="no-hide-descendants">
      <Animated.View
        style={[
          { position: 'absolute', width: tile + 120, height: tile + 120, borderRadius: (tile + 120) / 2, backgroundColor: reduceTransparency ? colors.accentFill : colors.accentFill, opacity: 1 },
          halo,
        ]}
      />
      <Animated.View
        style={[
          {
            width: tile,
            height: tile,
            borderRadius: 28,
            borderCurve: 'continuous',
            backgroundColor: colors.card,
            borderWidth: 0.5,
            borderColor: colors.separatorOpaque,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: colors.shadow,
            shadowOpacity: 0.08,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
          },
          sym,
        ]}
      >
        <Icon name={symbol} size={small ? 48 : 88} color={colors.accent} weight="light" />
      </Animated.View>
    </View>
  );
}

export function PagedOnboarding({ pages, onFinish }: { pages: OnboardingPage[]; onFinish?: () => void }) {
  const { colors, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const ref = useRef<ScrollView>(null);
  const progress = useSharedValue(0);
  const fade = useSharedValue(1);
  const [index, setIndex] = useState(0);
  const total = pages.length;

  const onScroll = useAnimatedScrollHandler((e) => {
    progress.set(e.contentOffset.x / width);
  });

  const goTo = useCallback(
    (i: number) => {
      const clamped = Math.max(0, Math.min(total - 1, i));
      if (reduceMotion) {
        // M3 Reduce Motion: no travel. Hide, jump, fade in (200 ms).
        fade.set(0);
        ref.current?.scrollTo({ x: clamped * width, animated: false });
        fade.set(withTiming(1, { duration: 200, easing: EASE_OUT, reduceMotion: ReduceMotion.System }));
      } else {
        ref.current?.scrollTo({ x: clamped * width, animated: true });
      }
      setIndex(clamped);
      const page = pages[clamped];
      if (page) AccessibilityInfo.announceForAccessibility(pageLabel({ index: clamped, total }, page.title));
    },
    [fade, pages, reduceMotion, total, width],
  );

  const pagerStyle = useAnimatedStyle(() => ({ opacity: fade.get() }));
  const current = pages[index];
  const showBack = index > 0;
  const showSkip = !!current?.skippable;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Animated.View style={[{ flex: 1 }, pagerStyle]}>
        <Animated.ScrollView
          ref={ref as never}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / width);
            if (i !== index) {
              setIndex(i);
              const page = pages[i];
              if (page) AccessibilityInfo.announceForAccessibility(pageLabel({ index: i, total }, page.title));
            }
          }}
          style={{ flex: 1 }}
        >
          {/* eslint-disable-next-line react-hooks/refs -- goTo touches the ref only when invoked from a press, never during render */}
          {pages.map((p, i) => {
            const ctx: OnboardingCtx = { progress, index: i, width, next: () => (i === total - 1 ? onFinish?.() : goTo(i + 1)), back: () => goTo(i - 1), skipToEnd: () => goTo(skipTarget(i, total)), }
            return (
              <View key={p.key} style={{ width, flex: 1 }} accessible={false} accessibilityLabel={pageLabel({ index: i, total }, p.title)}>
                <Illustration symbol={p.symbol} progress={progress} index={i} width={width} small={fontScale >= 1.5} />
                {p.render(ctx)}
              </View>
            );
          })}
        </Animated.ScrollView>
      </Animated.View>

      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`Page ${index + 1} of ${total}`}
        style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12) + 8 }}
      >
        {pages.map((p, i) => (
          <Dot key={p.key} progress={progress} index={i} />
        ))}
      </View>

      <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 4, left: 8, right: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
        {showBack ? (
          <Pressable accessibilityRole="button" accessibilityLabel={COPY.C.back} onPress={() => goTo(index - 1)} hitSlop={8} style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' }}>
            <Icon name="chevron.left" size={20} color={colors.accent} weight="semibold" />
          </Pressable>
        ) : (
          <View />
        )}
        {showSkip ? (
          <Pressable accessibilityRole="button" accessibilityLabel={COPY.C.skip} onPress={() => goTo(skipTarget(index, total))} hitSlop={8} style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 }}>
            <AppText variant="body" tone="accent">
              {COPY.C.skip}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** M5: active dot widens 8 to 20, inactive at 35%. Reduce Motion: width fixed, colour only. */
function Dot({ progress, index }: { progress: SharedValue<number>; index: number }) {
  const { colors, reduceMotion } = useTheme();
  const style = useAnimatedStyle(() => {
    const a = Math.abs(progress.get() - index);
    return { width: reduceMotion ? 8 : interpolate(a, [0, 1], [20, 8], 'clamp'), opacity: interpolate(a, [0, 1], [1, 0.35], 'clamp') };
  });
  return <Animated.View style={[{ height: 8, borderRadius: 4, borderCurve: 'continuous', backgroundColor: colors.accent }, style]} />;
}
