import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Mask, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../theme/useTheme';
import { AppText } from './AppText';
import { Icon } from './Icon';

/** Slow vertical drift. Static under Reduce Motion. Decorative only. */
function Float({ children, amp = 8, ms = 3600, delay = 0, style }: { children: React.ReactNode; amp?: number; ms?: number; delay?: number; style?: object }) {
  const { reduceMotion } = useTheme();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    const t = setTimeout(() => {
      y.set(withRepeat(withSequence(withTiming(-amp, { duration: ms, easing: Easing.inOut(Easing.sin) }), withTiming(amp, { duration: ms, easing: Easing.inOut(Easing.sin) })), -1, true));
    }, delay);
    return () => clearTimeout(t);
  }, [reduceMotion, amp, ms, delay, y]);
  const s = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return <Animated.View style={[style, s]}>{children}</Animated.View>;
}

const BARS = [0.25, 0.5, 0.8, 0.45, 1, 0.6, 0.9, 0.35, 0.7, 0.4, 0.55, 0.3];

function Moon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
          <Stop offset="0.35" stopColor="#34C8E8" stopOpacity={0.5} />
          <Stop offset="1" stopColor="#4E4AF2" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="disc" cx="35%" cy="30%" r="80%">
          <Stop offset="0" stopColor="#8EE3F5" />
          <Stop offset="0.55" stopColor="#4E4AF2" />
          <Stop offset="1" stopColor="#362A84" />
        </RadialGradient>
      </Defs>
      <Circle cx={100} cy={100} r={98} fill="url(#halo)" />
      <Defs>
        <Mask id="cut">
          <Rect x={0} y={0} width={200} height={200} fill="#FFFFFF" />
          <Circle cx={128} cy={82} r={52} fill="#000000" />
        </Mask>
      </Defs>
      <Circle cx={100} cy={100} r={58} fill="url(#disc)" mask="url(#cut)" />
    </Svg>
  );
}

function Panel({ w, h, rotate, children, strong }: { w: number; h: number; rotate: string; children?: React.ReactNode; strong?: boolean }) {
  const { reduceTransparency } = useTheme();
  return (
    <View style={{ width: w, height: h, borderRadius: 30, borderCurve: 'continuous', overflow: 'hidden', transform: [{ rotate }], borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', boxShadow: '0 24px 40px rgba(8,6,30,0.45)' }}>
      <LinearGradient colors={reduceTransparency ? ['#3A2D8F', '#2B2468'] : strong ? ['rgba(105,70,205,0.78)', 'rgba(54,42,132,0.78)'] : ['rgba(89,54,180,0.5)', 'rgba(54,42,132,0.5)']} style={{ flex: 1, padding: 18 }}>
        {children}
      </LinearGradient>
    </View>
  );
}

/** Page 1: a moon, a sound waveform and a tilted glass card. All built from shapes; no stock images. */
export function ListenArt() {
  return (
    <View style={{ height: 320, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }} aria-hidden>
      <Float amp={10} ms={4200} style={{ position: 'absolute', top: 0, right: 0 }}>
        <Moon size={200} />
      </Float>
      <Float amp={6} ms={3400} delay={400} style={{ position: 'absolute', bottom: 10, left: 0 }}>
        <Panel w={290} h={150} rotate="-6deg" strong>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="waveform" size={16} color="#8EE3F5" />
            <AppText variant="footnote" weight="600" tone={{ color: '#E8E6FF' }}>
              Snore-like pattern
            </AppText>
          </View>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6 }}>
            {BARS.map((b, i) => (
              <View key={i} style={{ width: 8, height: 14 + b * 62, borderRadius: 4, overflow: 'hidden' }}>
                <LinearGradient colors={['#34C8E8', '#4E4AF2']} style={{ flex: 1 }} />
              </View>
            ))}
          </View>
        </Panel>
      </Float>
    </View>
  );
}

/** Page 2: a tilted summary sheet with placeholder lines, and a small "Not a diagnosis" chip. */
export function SummaryArt() {
  const line = (w: number, o = 0.5) => <View style={{ width: w, height: 9, borderRadius: 5, backgroundColor: `rgba(255,255,255,${o})` }} />;
  return (
    <View style={{ height: 380, alignItems: 'center', justifyContent: 'center' }} aria-hidden>
      <Float amp={6} ms={3800} style={{ position: 'absolute', top: 10, left: 6 }}>
        <Panel w={190} h={230} rotate="-9deg">
          <View style={{ gap: 12 }}>
            {line(90, 0.7)}
            {line(140, 0.3)}
            {line(120, 0.3)}
            {line(150, 0.3)}
          </View>
        </Panel>
      </Float>
      <Float amp={9} ms={3200} delay={300} style={{ position: 'absolute', top: 60, right: 0 }}>
        <Panel w={230} h={232} rotate="7deg" strong>
          <View style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 36, height: 36, borderRadius: 12, overflow: 'hidden' }}>
                <LinearGradient colors={['#34C8E8', '#4E4AF2']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="list.clipboard" size={18} color="#FFFFFF" />
                </LinearGradient>
              </View>
              <AppText variant="subheadline" weight="700" tone={{ color: '#FFFFFF' }}>
                Summary
              </AppText>
            </View>
            {line(160, 0.55)}
            {line(120, 0.3)}
            {line(170, 0.3)}
            {line(100, 0.3)}
            <View style={{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)' }}>
              <AppText variant="caption1" weight="600" tone={{ color: '#E8E6FF' }}>
                Not a diagnosis
              </AppText>
            </View>
          </View>
        </Panel>
      </Float>
    </View>
  );
}

/** Slide 1: the app mark, built from a gradient tile, a moon and a waveform. */
export function LogoMark({ size = 112 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.28, borderCurve: 'continuous', overflow: 'hidden', boxShadow: '0 18px 36px rgba(48,104,227,0.45)' }} accessibilityRole="image" accessibilityLabel="SleepSmooth logo">
      <LinearGradient colors={['#3068E3', '#4E4AF2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size * 0.62} height={size * 0.62} viewBox="0 0 100 100">
          <Defs>
            <Mask id="logoCut">
              <Rect x={0} y={0} width={100} height={100} fill="#FFFFFF" />
              <Circle cx={63} cy={30} r={24} fill="#000000" />
            </Mask>
          </Defs>
          <Circle cx={50} cy={38} r={27} fill="#FFFFFF" mask="url(#logoCut)" />
          {[28, 39, 50, 61, 72].map((x, i) => {
            const h = [6, 12, 18, 12, 6][i] as number;
            return <Rect key={x} x={x - 2.5} y={88 - h} width={5} height={h} rx={2.5} fill="#FFFFFF" opacity={0.92} />;
          })}
        </Svg>
      </LinearGradient>
    </View>
  );
}

/** Slide 1: the mark inside a soft halo and two orbit rings, so the logo, name and promise read as one centred block. */
export function IdentityArt() {
  const D = 264;
  return (
    <View style={{ height: D, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }} aria-hidden>
      <Svg width={D} height={D} viewBox="0 0 264 264" style={{ position: 'absolute' }}>
        <Defs>
          <RadialGradient id="idHalo" cx="50%" cy="50%" r="50%">
            <Stop offset="0.3" stopColor="#4E4AF2" stopOpacity={0.35} />
            <Stop offset="1" stopColor="#3068E3" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={132} cy={132} r={130} fill="url(#idHalo)" />
        <Circle cx={132} cy={132} r={92} fill="none" stroke="#4E4AF2" strokeOpacity={0.28} strokeWidth={1.5} />
        <Circle cx={132} cy={132} r={122} fill="none" stroke="#4E4AF2" strokeOpacity={0.14} strokeWidth={1.5} />
      </Svg>
      <Float amp={6} ms={3600}>
        <LogoMark size={128} />
      </Float>
    </View>
  );
}

// Hard-coded example data. No network. Clearly badged "Example". There is no score and no all-clear anywhere on it.
const EXAMPLE_HOURS = [
  { label: '11p', fill: 0.15 },
  { label: '12a', fill: 0.4 },
  { label: '1a', fill: 0.65 },
  { label: '2a', fill: 0.3 },
  { label: '3a', fill: 0.5 },
  { label: '4a', fill: 0.2 },
  { label: '5a', fill: 0.35 },
] as const;

/** Slide 3: a static, hand-built mini night summary. Calm surface, no gradient on the result itself. */
export function ExampleCard() {
  const { colors } = useTheme();
  const fact = (label: string, value: string, flex = 1) => (
    <View style={{ flex, gap: 3 }}>
      <AppText variant="caption1" tone="secondary" weight="600" style={{ textTransform: 'uppercase' }}>
        {label}
      </AppText>
      <AppText variant="headline" tabular>
        {value}
      </AppText>
    </View>
  );
  return (
    <View
      accessible
      accessibilityLabel="Example night summary. Snore-like episodes 42. Estimated window 11:20 pm to 6:45 am. Recording quality 4 of 5 signals usable. Discuss with a clinician. Not a diagnosis."
      style={{ alignSelf: 'stretch', borderRadius: 26, borderCurve: 'continuous', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.separatorOpaque, padding: 18, gap: 16, boxShadow: '0 18px 34px rgba(5,4,24,0.4)' }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <AppText variant="headline">A night, summarised</AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.sample.border, backgroundColor: colors.sample.bg }}>
          <Icon name="testtube.2" size={12} color={colors.sample.fg} />
          <AppText variant="caption1" weight="700" tone={{ color: colors.sample.fg }}>
            Example
          </AppText>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 96 }}>
        {EXAMPLE_HOURS.map((h) => (
          <View key={h.label} style={{ alignItems: 'center', gap: 6 }}>
            <View style={{ width: 28, height: 70, borderRadius: 14, borderWidth: 1, borderColor: colors.capsule.outline, justifyContent: 'flex-end', overflow: 'hidden' }}>
              <View style={{ height: 70 * h.fill, backgroundColor: colors.capsule.fill }} />
            </View>
            <AppText variant="caption2" tone="secondary">
              {h.label}
            </AppText>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {fact('Snore-like episodes', '42')}
        {fact('Quality', '4 of 5 signals', 1.2)}
      </View>
      {fact('Estimated sleep window', '11:20 pm to 6:45 am')}
      <View style={{ height: 1, backgroundColor: colors.separatorOpaque }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Icon name="person.crop.circle.badge.questionmark" size={22} color={colors.discuss.fg} />
        <View style={{ flex: 1 }}>
          <AppText variant="headline" tone={{ color: colors.discuss.fg }}>
            Discuss with a clinician
          </AppText>
          <AppText variant="footnote" tone="secondary">
            Not a diagnosis. It cannot rule out sleep apnea.
          </AppText>
        </View>
      </View>
    </View>
  );
}
