import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';
import type { Radius, ToneName } from '../theme/tokens';

export type SurfaceLevel = 'L2' | 'L3' | 'L5';
export type EvidenceSource = 'user-reported' | 'audio-observation' | 'missing' | 'sample' | 'app-guidance';

export interface SurfaceProps {
  level?: SurfaceLevel;
  tone?: ToneName;
  radius?: keyof Radius;
  /** Selects the source-coded L4 border. */
  source?: EvidenceSource;
  padding?: number;
  children?: ReactNode;
  style?: ViewStyle;
  testID?: string;
}

/**
 * Card surface. Owns the shadow wrapper (never clipped), an inner clipping view, and the 0.5pt inner highlight.
 * `borderCurve: 'continuous'` everywhere. Dashed borders (missing, sample) are a device-check item (IOS_DESIGN 2.4).
 */
export function Surface({ level = 'L2', tone = 'default', radius: r = 'lg', source, padding = 16, children, style, testID }: SurfaceProps) {
  const { colors, radius, scheme, increasedContrast } = useTheme();
  const rad = radius[r];
  const toned = tone === 'default' ? null : colors[tone];

  let borderColor: string = colors.separatorOpaque;
  let borderWidth = StyleSheet.hairlineWidth * 2; // 0.5 on 2x/3x screens is rendered as a crisp hairline-plus
  let borderStyle: 'solid' | 'dashed' = 'solid';
  let fill: string = toned ? toned.bg : colors.card;

  if (level === 'L3' && toned) {
    borderColor = toned.border;
    borderWidth = 1;
  }
  if (source === 'user-reported') {
    borderColor = colors.info.border;
    borderWidth = 1;
  } else if (source === 'audio-observation') {
    borderColor = colors.model.border;
    borderWidth = 1;
  } else if (source === 'missing') {
    borderColor = colors.missing.border;
    borderWidth = 1;
    borderStyle = 'dashed';
    fill = colors.missing.bg;
  } else if (source === 'sample') {
    borderColor = colors.sample.border;
    borderWidth = 1.5;
    borderStyle = 'dashed';
    fill = colors.sample.bg;
  } else if (source === 'app-guidance') {
    fill = colors.info.bg;
  }
  if (increasedContrast) borderWidth += 0.5;

  const floating = level === 'L5';
  const shadow: ViewStyle =
    scheme === 'dark'
      ? floating
        ? { shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } }
        : {}
      : floating
        ? { shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } }
        : { shadowColor: colors.shadow, shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } };

  return (
    <View testID={testID} style={[{ borderRadius: rad, borderCurve: 'continuous' }, shadow, style]}>
      <View style={{ borderRadius: rad, borderCurve: 'continuous', backgroundColor: fill, borderColor, borderWidth, borderStyle, overflow: 'hidden', padding }}>
        {children}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: borderWidth,
            left: borderWidth,
            right: borderWidth,
            bottom: borderWidth,
            borderRadius: Math.max(0, rad - borderWidth),
            borderCurve: 'continuous',
            borderWidth: 0.5,
            borderColor: colors.cardHighlight,
          }}
        />
      </View>
    </View>
  );
}
