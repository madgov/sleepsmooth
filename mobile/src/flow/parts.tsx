import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, type ReactNode } from 'react';
import { TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';
import { AppText } from '../ui/AppText';
import { Icon, type SymbolName } from '../ui/Icon';
import { PressScale } from '../ui/Press';
import { PrimaryButton } from '../ui/PrimaryButton';
import { springSettle } from '../ui/motion';
import { Screen } from '../ui/Screen';

/** Thin top progress bar: a bike-gradient fill that grows with a critically damped spring (scaleX, UI thread). */
export function ProgressBar({ value }: { value: number }) {
  const { colors, reduceMotion } = useTheme();
  const p = useSharedValue(value);
  useEffect(() => {
    p.set(reduceMotion ? withTiming(value, { duration: 150 }) : withSpring(value, springSettle));
  }, [value, reduceMotion, p]);
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.max(0.02, p.get()) }] }));
  return (
    <View accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }} accessibilityLabel="Setup progress" style={{ height: 6, borderRadius: 3, backgroundColor: colors.fill, overflow: 'hidden' }}>
      <Animated.View style={[{ height: 6, borderRadius: 3, overflow: 'hidden', transformOrigin: 'left' }, fill]}>
        <LinearGradient colors={colors.accentGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
      </Animated.View>
    </View>
  );
}

/**
 * Large tappable choice. Selection is a spring pop on the card and the check, paired with a selection haptic.
 * Selected state is carried by the border, the check glyph and the filled check circle, never by colour alone.
 */
export function ChoiceCard({ label, caption, icon, selected, onPress, accessibilityRole = 'radio', testID }: { label: string; caption?: string; icon?: SymbolName; selected: boolean; onPress: () => void; accessibilityRole?: 'radio' | 'checkbox' | 'button'; testID?: string }) {
  const { colors, reduceMotion } = useTheme();
  const pop = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    pop.set(reduceMotion ? withTiming(selected ? 1 : 0, { duration: 120 }) : withSpring(selected ? 1 : 0, { duration: 320, dampingRatio: 0.7 }));
  }, [selected, reduceMotion, pop]);
  const check = useAnimatedStyle(() => ({ opacity: Math.min(1, pop.get() * 1.4), transform: reduceMotion ? [] : [{ scale: 0.6 + 0.4 * pop.get() }] }));
  return (
    <PressScale
      onPress={() => onPress()}
      haptic="selection"
      scaleTo={0.98}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={caption ? `${label}. ${caption}` : label}
      accessibilityState={{ checked: selected, selected }}
      testID={testID}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          minHeight: 68,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 22,
          borderCurve: 'continuous',
          backgroundColor: selected ? colors.accentFill : colors.glassFill,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? colors.accent : colors.separatorOpaque,
        }}
      >
        {icon ? (
          <View style={{ width: 42, height: 42, borderRadius: 14, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? colors.accent : colors.fill }}>
            <Icon name={icon} size={22} color={selected ? colors.accentFg : colors.labelSecondary} weight="medium" />
          </View>
        ) : null}
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="headline" style={{ letterSpacing: -0.3 }}>
            {label}
          </AppText>
          {caption ? (
            <AppText variant="subheadline" tone="secondary">
              {caption}
            </AppText>
          ) : null}
        </View>
        <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: selected ? colors.accent : colors.labelTertiary, backgroundColor: selected ? colors.accent : 'transparent' }}>
          <Animated.View style={check}>
            <Icon name="checkmark" size={13} color={colors.accentFg} weight="bold" />
          </Animated.View>
        </View>
      </View>
    </PressScale>
  );
}

/** One question per screen: large title, optional helper text, content, and a pinned footer for the actions. */
export function StepFrame({ title, subtitle, children, footer, hero }: { title: string; subtitle?: string; children?: ReactNode; footer?: ReactNode; hero?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1 }}>
      <Screen backdrop={false} gap={18} contentStyle={{ paddingTop: 8 }} bottom={footer ? <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: insets.bottom + 12, gap: 4 }}>{footer}</View> : undefined}>
        {hero}
        <View style={{ gap: 8 }}>
          <AppText variant="title1" accessibilityRole="header" style={{ letterSpacing: -0.4 }}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="body" tone="secondary">
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {children}
      </Screen>
    </View>
  );
}

/** Big numeric entry: 56pt numerals centred over a glass pill, with the unit beside it. */
export function BigNumberField({ value, onChange, unit, label, invalid, autoFocus }: { value: string; onChange: (t: string) => void; unit: string; label: string; invalid?: boolean; autoFocus?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'center',
          gap: 8,
          minHeight: 96,
          paddingVertical: 16,
          paddingHorizontal: 20,
          borderRadius: 28,
          borderCurve: 'continuous',
          backgroundColor: colors.glassFill,
          borderWidth: invalid ? 2 : 1,
          borderColor: invalid ? colors.error.border : colors.separatorOpaque,
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          autoFocus={autoFocus}
          accessibilityLabel={`${label}, ${unit}`}
          placeholder="0"
          placeholderTextColor={colors.labelTertiary}
          selectionColor={colors.accent}
          style={{ minWidth: 100, fontSize: 56, lineHeight: 64, fontWeight: '700', color: colors.label, textAlign: 'center', padding: 0 }}
        />
        <AppText variant="title3" tone="secondary">
          {unit}
        </AppText>
      </View>
    </View>
  );
}

/** Primary footer button + optional plain secondary. Both 44pt+. */
export function FooterActions({ primary, onPrimary, disabled, secondary, onSecondary, loading }: { primary: string; onPrimary: () => void; disabled?: boolean; secondary?: string; onSecondary?: () => void; loading?: boolean }) {
  return (
    <>
      <PrimaryButton label={primary} onPress={() => { void Haptics.selectionAsync(); onPrimary(); }} disabled={disabled} loading={loading} />
      {secondary && onSecondary ? <PrimaryButton label={secondary} variant="plain" onPress={onSecondary} /> : null}
    </>
  );
}
