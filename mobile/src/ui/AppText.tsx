import { Platform, Text, type TextProps, type TextStyle } from 'react-native';
import { devFontScale } from '../dev/devParams';
import { useTheme } from '../theme/useTheme';

export type TextVariant = 'display' | 'largeTitle' | 'title1' | 'title2' | 'title3' | 'headline' | 'body' | 'callout' | 'subheadline' | 'footnote' | 'caption1' | 'caption2';
export type TextTone = 'label' | 'secondary' | 'tertiary' | 'accent' | 'destructive' | 'onAccent' | { color: string };

/**
 * Type scale: seven sizes only. 44 numerals (display), 34 screen title, 22 section title, 17 body and card title, 15 supporting text,
 * 13 footnote and labels, 11 tab labels. Weights are 400, 600 and 700 only. Legacy iOS style names alias the nearest size so call sites
 * stay readable: title1 = title2 = 22, title3 = headline = 17/600, callout = subheadline = 15, caption1 = footnote size, caption2 = 11.
 */
const T22 = { fontSize: 22, lineHeight: 28, fontWeight: '700' } as const;
const T17 = { fontSize: 17, lineHeight: 22 } as const;
const T15 = { fontSize: 15, lineHeight: 20, fontWeight: '400' } as const;
const T13 = { fontSize: 13, lineHeight: 18, fontWeight: '400' } as const;
const SIZES: Record<TextVariant, { fontSize: number; lineHeight: number; fontWeight: TextStyle['fontWeight'] }> = {
  display: { fontSize: 44, lineHeight: 48, fontWeight: '700' },
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700' },
  title1: T22,
  title2: T22,
  title3: { ...T17, fontWeight: '600' },
  headline: { ...T17, fontWeight: '600' },
  body: { ...T17, fontWeight: '400' },
  callout: T15,
  subheadline: T15,
  footnote: T13,
  caption1: { ...T13, lineHeight: 16 },
  caption2: { fontSize: 11, lineHeight: 13, fontWeight: '400' },
};

/**
 * Tracking (points) for the web preview only. iOS applies SF Pro's own size-dependent tracking when no letterSpacing is set, so setting
 * it there would double up; browsers do not, so the preview gets values that match what the system font does on the device.
 */
const WEB_TRACKING: Record<number, number> = { 44: -0.9, 34: -0.6, 22: -0.3, 17: -0.3, 15: -0.2, 13: -0.08, 11: 0.06 };

/** Chrome-only variants cap Dynamic Type; body-level content is uncapped and must reflow. */
const CHROME_CAP: Partial<Record<TextVariant, number>> = { caption1: 1.4, caption2: 1.4, display: 1.3 };

/** Only 400, 600 and 700 exist in the scale. */
const normaliseWeight = (w: TextStyle['fontWeight']): TextStyle['fontWeight'] => (w === '500' || w === 500 ? '600' : w === '800' || w === '900' || w === 'bold' ? '700' : w);

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  tone?: TextTone;
  serif?: boolean;
  tabular?: boolean;
  weight?: TextStyle['fontWeight'];
  center?: boolean;
}

/** The only way to render text in the app. System font; tracking comes from the system on iOS and from WEB_TRACKING in the preview. */
export function AppText({ variant = 'body', tone = 'label', serif, tabular, weight, center, style, maxFontSizeMultiplier, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  const base = SIZES[variant];
  const color =
    typeof tone === 'object'
      ? tone.color
      : tone === 'label'
        ? colors.label
        : tone === 'secondary'
          ? colors.labelSecondary
          : tone === 'tertiary'
            ? colors.labelTertiary
            : tone === 'accent'
              ? colors.accent
              : tone === 'destructive'
                ? colors.destructive
                : colors.accentFg;
  const cap = maxFontSizeMultiplier ?? CHROME_CAP[variant] ?? Infinity;
  const scale = Math.min(devFontScale(), cap);
  const s: TextStyle = {
    ...base,
    ...(scale > 1 ? { fontSize: base.fontSize * scale, lineHeight: base.lineHeight * scale } : null),
    color,
    ...(weight ? { fontWeight: normaliseWeight(weight) } : null),
    ...(Platform.OS === 'web' ? { letterSpacing: WEB_TRACKING[base.fontSize] } : null),
    ...(serif ? { fontFamily: 'ui-serif', ...(base.fontSize >= 28 ? { letterSpacing: -0.3 } : null) } : null),
    ...(tabular ? { fontVariant: ['tabular-nums'] } : null),
    ...(center ? { textAlign: 'center' } : null),
  };
  return <Text allowFontScaling maxFontSizeMultiplier={maxFontSizeMultiplier ?? CHROME_CAP[variant]} style={[s, style]} {...rest} />;
}
