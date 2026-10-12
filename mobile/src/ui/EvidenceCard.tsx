import { View } from 'react-native';
import type { EvidenceItem, EvidenceState } from '@core/types/evidence';
import { AppText } from './AppText';
import { SourceBadge, type BadgeKind } from './SourceBadge';
import { Surface } from './Surface';

// Mirrors the web EvidenceCard wording. "absent-unreliable" is explicitly not reassurance. No state is ever shown as success.
const STATE_TEXT: Record<EvidenceState, string> = {
  present: 'Observed or reported',
  'absent-unreliable': 'Not seen here (this does not rule anything out)',
  inconclusive: 'Inconclusive',
  missing: 'Not provided',
  conflict: 'Signals differ',
};

export interface EvidenceCardProps {
  item: EvidenceItem;
  hideLimitations?: readonly string[];
  testID?: string;
}

export function EvidenceCard({ item, hideLimitations = [], testID }: EvidenceCardProps) {
  const limits = item.limitations.filter((l) => !hideLimitations.includes(l));
  const source = item.isSynthetic ? 'sample' : item.source === 'user-reported' ? 'user-reported' : item.source === 'audio-observation' ? 'audio-observation' : item.source === 'missing' ? 'missing' : item.source === 'app-guidance' ? 'app-guidance' : undefined;
  return (
    <Surface source={source} testID={testID}>
      <View
        accessible
        accessibilityLabel={`${item.isSynthetic ? 'Sample data. ' : ''}${item.label}. ${STATE_TEXT[item.state]}. ${item.detail}`}
        style={{ gap: 8 }}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <SourceBadge kind={item.source as BadgeKind} size="compact" />
          {item.isSynthetic ? <SourceBadge kind="sample" size="compact" /> : null}
        </View>
        <AppText variant="caption1" tone="secondary">
          {STATE_TEXT[item.state]}
        </AppText>
        <AppText variant="headline" accessibilityRole="header">
          {item.label}
        </AppText>
        <AppText variant="body">{item.detail}</AppText>
        {limits.length > 0 ? (
          <View style={{ gap: 4 }}>
            {limits.map((l) => (
              <AppText key={l} variant="footnote" tone="secondary">
                {`• ${l}`}
              </AppText>
            ))}
          </View>
        ) : null}
        {item.citation ? (
          <AppText variant="footnote" tone="secondary" selectable>
            {`Source: ${item.citation}`}
          </AppText>
        ) : null}
      </View>
    </Surface>
  );
}
