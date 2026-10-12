import { Text, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';

export type TextVariant = 'largeTitle' | 'title1' | 'title2' | 'title3' | 'headline' | 'body' | 'callout' | 'subheadline' | 'footnote' | 'caption1' | 'caption2';
export type TextTone = 'label' | 'secondary' | 'tertiary' | 'accent' | 'destructive' | 'onAccent' | { color: string };

const SIZES: Record<TextVariant, { fontSize: number; lineHeight: number; fontWeight: TextStyle['fontWeight'] }> = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700' },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '600' },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400' },
  subheadline: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption1: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  caption2: { fontSize: 11, lineHeight: 13, fontWeight: '400' },
};

/** Chrome-only variants cap Dynamic Type; body-level content is uncapped and must reflow. */
const CHROME_CAP: Partial<Record<TextVariant, number>> = { caption1: 1.4, caption2: 1.4 };

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  tone?: TextTone;
  serif?: boolean;
  tabular?: boolean;
  weight?: TextStyle['fontWeight'];
  center?: boolean;
}

/** The only way to render text in the app. System font (no letterSpacing: UIKit tracks by size). */
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
  const s: TextStyle = {
    ...base,
    color,
    ...(weight ? { fontWeight: weight } : null),
    ...(serif ? { fontFamily: 'ui-serif', ...(base.fontSize >= 28 ? { letterSpacing: -0.3 } : null) } : null),
    ...(tabular ? { fontVariant: ['tabular-nums'] } : null),
    ...(center ? { textAlign: 'center' } : null),
  };
  return <Text allowFontScaling maxFontSizeMultiplier={maxFontSizeMultiplier ?? CHROME_CAP[variant]} style={[s, style]} {...rest} />;
}
