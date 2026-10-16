import { View } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { AppText } from './AppText';
import { Icon } from './Icon';

/**
 * The one disclaimer pattern: a small info mark and a single footnote line. Used once per surface so the
 * safety statement is always present without repeating itself as chip, paragraph and subtitle.
 */
export function DisclaimerNote({ children, testID }: { children: string; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} accessible accessibilityLabel={children} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
      <View style={{ paddingTop: 2 }}>
        <Icon name="info.circle" size={13} color={colors.labelTertiary} weight="medium" />
      </View>
      <AppText variant="footnote" tone="secondary" style={{ flex: 1 }}>
        {children}
      </AppText>
    </View>
  );
}
