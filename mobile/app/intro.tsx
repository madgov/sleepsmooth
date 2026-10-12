import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import Animated, { interpolate, interpolateColor, runOnJS, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { markIntroSeen } from '../src/state/introFlag';
import { useTheme } from '../src/theme/useTheme';
import { AppText } from '../src/ui/AppText';
import { Backdrop } from '../src/ui/Backdrop';
import { ExampleCard, IdentityArt, ListenArt } from '../src/ui/IntroArt';
import { PressScale } from '../src/ui/Press';
import { PrimaryButton } from '../src/ui/PrimaryButton';
import { springSettle } from '../src/ui/motion';

interface Slide {
  key: string;
  title: string;
  body: string;
  art: ReactNode;
}

// Copy rules: short concrete headlines, no statistics, no privacy claims, nothing that implies a diagnosis.
const SLIDES: Slide[] = [
  { key: 'identity', title: 'SleepSmooth', body: 'Notice what happens while you sleep, and know what to ask about.', art: <IdentityArt /> },
  { key: 'relief', title: 'Tired, and told it is nothing', body: 'Snoring and tiredness get brushed off. SleepSmooth listens overnight and turns it into something you can show a doctor.', art: <ListenArt /> },
  { key: 'payoff', title: 'A night, at a glance', body: 'A plain summary of what was observed, not a verdict. This one is an example.', art: <ExampleCard /> },
];
const LAST = SLIDES.length - 1;
const BODY_MAX = 340;
const CTA = ['Continue', 'Continue', 'Start my first check'] as const;

/** Content rises on a spring as its page arrives (translate, so it cannot stick invisible on web). Driven by the raw scroll offset. */
function SlideContent({ i, x, w, appear, children }: { i: number; x: SharedValue<number>; w: number; appear: SharedValue<number>; children: ReactNode }) {
  const { reduceMotion } = useTheme();
  const st = useAnimatedStyle(() => {
    const near = 1 - Math.min(1, Math.abs(x.get() / w - i));
    const rise = reduceMotion ? 0 : (1 - near) * 36 + (1 - appear.get()) * 28;
    return { opacity: 0.25 + 0.75 * near, transform: [{ translateY: rise }] };
  });
  return <Animated.View style={[{ flex: 1, justifyContent: 'center' }, st]}>{children}</Animated.View>;
}

function Dot({ i, x, w }: { i: number; x: SharedValue<number>; w: number }) {
  const { colors } = useTheme();
  const st = useAnimatedStyle(() => {
    const d = Math.min(1, Math.abs(x.get() / w - i));
    return {
      width: interpolate(d, [0, 1], [22, 8]),
      opacity: interpolate(d, [0, 1], [1, 0.4]),
      backgroundColor: interpolateColor(d, [0, 1], [colors.accent, colors.labelTertiary]),
    };
  });
  return <Animated.View style={[{ height: 8, borderRadius: 4 }, st]} />;
}

function Intro() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { reduceMotion } = useTheme();
  const x = useSharedValue(0);
  const appear = useSharedValue(reduceMotion ? 1 : 0);
  const ref = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const [pageH, setPageH] = useState<number | undefined>(undefined);
  useEffect(() => {
    appear.set(withSpring(1, springSettle));
  }, [appear]);
  const onScroll = useAnimatedScrollHandler((e) => {
    x.set(e.contentOffset.x);
    const p = Math.round(e.contentOffset.x / width);
    runOnJS(setPage)(Math.max(0, Math.min(LAST, p)));
  });
  const done = () => {
    markIntroSeen();
    router.replace('/onboarding');
  };
  const next = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (page >= LAST) return done();
    const n = page + 1;
    setPage(n); // optimistic: onMomentumScrollEnd is unreliable on web
    ref.current?.scrollTo({ x: width * n, animated: !reduceMotion });
  };
  const colW = Math.min(width, 520);
  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="auto" />
      <Backdrop variant="intro" />
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 12, alignItems: 'flex-end', minHeight: 56 }}>
        <PressScale onPress={done} haptic="none" accessibilityLabel="Skip introduction" containerStyle={{ minHeight: 44, minWidth: 64, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 }}>
          <AppText variant="body" tone="secondary" weight="600">
            Skip
          </AppText>
        </PressScale>
      </View>
      <Animated.ScrollView
        ref={ref as never}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
        onLayout={(e) => setPageH(e.nativeEvent.layout.height)}
      >
        {SLIDES.map((sl, i) => (
          <View key={sl.key} style={{ width, height: pageH, alignItems: 'center' }} accessible={false}>
            <View style={{ flex: 1, width: colW, paddingHorizontal: 24 }}>
              <SlideContent i={i} x={x} w={width} appear={appear}>
                <View style={{ alignItems: i === LAST ? 'stretch' : 'center', gap: 22 }}>
                  {sl.art}
                  <View style={{ gap: 10, alignItems: 'center', alignSelf: 'center', maxWidth: BODY_MAX }}>
                    <AppText variant="largeTitle" center accessibilityRole="header" style={{ letterSpacing: -0.8 }}>
                      {sl.title}
                    </AppText>
                    <AppText variant="body" tone="secondary" center>
                      {sl.body}
                    </AppText>
                  </View>
                </View>
              </SlideContent>
            </View>
          </View>
        ))}
      </Animated.ScrollView>
      <View style={{ paddingBottom: insets.bottom + 16, alignItems: 'center', gap: 18 }}>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', height: 8 }} accessible accessibilityLabel={`Page ${page + 1} of ${SLIDES.length}`}>
          {SLIDES.map((s, i) => (
            <Dot key={s.key} i={i} x={x} w={width} />
          ))}
        </View>
        <View style={{ width: '100%', maxWidth: 480, paddingHorizontal: 24 }}>
          <PrimaryButton label={CTA[page] ?? 'Continue'} onPress={next} />
        </View>
      </View>
    </View>
  );
}

export default function IntroScreen() {
  return <Intro />;
}
