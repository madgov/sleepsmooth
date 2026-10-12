import { View } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { AppText } from './AppText';
import { Icon, type SymbolName } from './Icon';
import { COPY } from '../content/copy';

export type BadgeKind = 'wearable' | 'user-reported' | 'audio-observation' | 'missing' | 'sample' | 'not-diagnosis' | 'app-guidance';

const LABELS: Record<BadgeKind, string> = {
  wearable: 'Wearable reading',
  'user-reported': 'User-reported',
  'audio-observation': 'Audio observation',
  missing: 'Missing',
  sample: 'Sample data',
  'not-diagnosis': COPY.N01_NOT_A_DIAGNOSIS,
  'app-guidance': 'App guidance',
};
const SYMBOLS: Record<BadgeKind, SymbolName> = {
  wearable: 'applewatch',
  'user-reported': 'person.text.rectangle',
  'audio-observation': 'waveform',
  missing: 'circle.dashed',
  sample: 'testtube.2',
  'not-diagnosis': 'info.circle',
  'app-guidance': 'info.circle',
};

/** Label + icon + tint: meaning never depends on colour alone. */
export function SourceBadge({ kind, size = 'regular' }: { kind: BadgeKind; size?: 'regular' | 'compact' }) {
  const { colors } = useTheme();
  const tone =
    kind === 'user-reported' || kind === 'wearable' || kind === 'not-diagnosis' || kind === 'app-guidance' ? colors.info : kind === 'audio-observation' ? colors.model : kind === 'missing' ? colors.missing : colors.sample;
  const compact = size === 'compact';
  return (
    <View
      accessible
      accessibilityLabel={LABELS[kind]}
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: compact ? 2 : 4,
        paddingHorizontal: compact ? 8 : 10,
        borderRadius: 999,
        borderCurve: 'continuous',
        backgroundColor: tone.bg,
        borderWidth: 1,
        borderColor: tone.border,
        borderStyle: kind === 'missing' || kind === 'sample' ? 'dashed' : 'solid',
      }}
    >
      <Icon name={SYMBOLS[kind]} size={compact ? 11 : 13} color={tone.fg} />
      <AppText variant="caption1" weight="600" tone={{ color: tone.fg }}>
        {LABELS[kind]}
      </AppText>
    </View>
  );
}
