import { View } from 'react-native';
import { SAMPLE_AUDIO_LABEL } from '@core/content/claims';
import { COPY } from '../content/copy';
import { useTheme } from '../theme/useTheme';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { PressScale } from './Press';
import { SourceBadge } from './SourceBadge';
import { Surface } from './Surface';

/** Entry to the labelled sample night. Dashed purple border + Sample badge; never mixed into real results. */
export function SampleRow({ onPress, title = COPY.N55_LOOK_AT_SAMPLE }: { onPress: () => void; title?: string }) {
  const { colors } = useTheme();
  return (
    <PressScale accessibilityLabel={`Sample data. ${title}. ${SAMPLE_AUDIO_LABEL}`} onPress={onPress}>
      <Surface source="sample" radius="md" padding={0}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, minHeight: 44 }}>
          <Icon name="testtube.2" size={22} color={colors.sample.fg} />
          <View style={{ flex: 1, gap: 4 }}>
            <SourceBadge kind="sample" size="compact" />
            <AppText variant="body" tone={{ color: colors.sample.fg }}>
              {title}
            </AppText>
            <AppText variant="footnote" tone={{ color: colors.sample.fg }}>
              {SAMPLE_AUDIO_LABEL}
            </AppText>
          </View>
          <Icon name="chevron.right" size={14} color={colors.sample.fg} weight="semibold" />
        </View>
      </Surface>
    </PressScale>
  );
}
