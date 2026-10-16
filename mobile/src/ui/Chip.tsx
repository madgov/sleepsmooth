import { View } from 'react-native';
import { useTheme } from '../theme/useTheme';
import type { ToneName } from '../theme/tokens';
import { AppText } from './AppText';
import { Icon, type SymbolName } from './Icon';

export interface ChipProps {
  label: string;
  icon?: SymbolName;
  tone?: ToneName;
  testID?: string;
}

/** Status chip. Neutral by default; tones come from the existing semantic tokens (never green). Text is always present. */
export function Chip({ label, icon, tone = 'default', testID }: ChipProps) {
  const { colors } = useTheme();
  const t = tone === 'default' ? { bg: colors.accentFill, fg: colors.accent, border: 'transparent' } : colors[tone];
  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 6,
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 8,
        borderCurve: 'continuous',
        backgroundColor: t.bg,
        borderWidth: tone === 'default' ? 0 : 1,
        borderColor: t.border,
      }}
    >
      {icon ? <Icon name={icon} size={13} color={t.fg} weight="semibold" /> : null}
      <AppText variant="caption1" weight="600" tone={{ color: t.fg }} maxFontSizeMultiplier={2}>
        {label}
      </AppText>
    </View>
  );
}
