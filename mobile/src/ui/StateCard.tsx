import type { ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { useTheme } from '../theme/useTheme';
import type { ToneName } from '../theme/tokens';
import { AppText, contentScale } from './AppText';
import { Icon, type SymbolName } from './Icon';
import { EASE_OUT } from './motion';
import { PrimaryButton } from './PrimaryButton';
import { Surface, type EvidenceSource } from './Surface';

export interface StateCardProps {
  tone: Exclude<ToneName, 'default'>;
  icon: SymbolName;
  title: string;
  body?: string;
  extra?: ReactNode;
  actions?: { label: string; onPress: () => void; variant?: 'filled' | 'tinted' | 'plain' | 'destructive' }[];
  source?: EvidenceSource;
  animated?: boolean;
  radius?: 'lg' | 'xl';
  serifTitle?: boolean;
  testID?: string;
}

/** Overview, interruption, permission, night-ended, error. M17 entrance: a short fade up (opacity only under Reduce Motion). */
export function StateCard({ tone, icon, title, body, extra, actions, source, animated = true, radius = 'lg', serifTitle, testID }: StateCardProps) {
  const { colors, reduceMotion } = useTheme();
  const t = colors[tone];
  // At large content sizes the icon stacks above the text so the text gets the full card width.
  const stacked = contentScale() >= 1.6;
  const card = (
    <Surface level="L3" tone={tone} source={source} radius={radius} padding={20} testID={testID}>
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: stacked ? 'column' : 'row', gap: stacked ? 6 : 12, alignItems: 'flex-start' }}>
          <View style={{ paddingTop: serifTitle ? 6 : 2 }}>
            <Icon name={icon} size={22} color={t.fg} />
          </View>
          <View style={{ flex: stacked ? undefined : 1, alignSelf: 'stretch', gap: 6 }}>
            <AppText variant={serifTitle ? 'title1' : 'headline'} serif={serifTitle} tone={{ color: t.fg }} accessibilityRole="header" maxFontSizeMultiplier={1.6}>
              {title}
            </AppText>
            {body ? (
              <AppText variant="subheadline" tone={{ color: t.fg }}>
                {body}
              </AppText>
            ) : null}
          </View>
        </View>
        {extra}
        {actions && actions.length > 0 ? (
          <View style={{ gap: 8, marginTop: 4 }}>
            {actions.map((a) => (
              <PrimaryButton key={a.label} label={a.label} onPress={a.onPress} variant={a.variant ?? 'tinted'} size="medium" />
            ))}
          </View>
        ) : null}
      </View>
    </Surface>
  );
  if (!animated) return card;
  return (
    <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(220).easing(EASE_OUT)} exiting={FadeOut.duration(150)}>
      {card}
    </Animated.View>
  );
}
