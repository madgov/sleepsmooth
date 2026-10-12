import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { DISCLAIMER_CANNOT_RULE_OUT, NOTE_NO_UNIFIED_SCORE } from '@core/content/claims';
import { useRealNights } from '../../src/data/nightSource';
import { buildChecks } from '../../src/state/checks';
import { overviewSummary } from '../../src/state/evidence';
import { useSettings } from '../../src/state/settings';
import { useTheme } from '../../src/theme/useTheme';
import { AppText } from '../../src/ui/AppText';
import { Chip } from '../../src/ui/Chip';
import { GlassCard } from '../../src/ui/GlassCard';
import { Icon } from '../../src/ui/Icon';
import { IconTile } from '../../src/ui/IconTile';
import { PressScale } from '../../src/ui/Press';
import { Screen, Stagger } from '../../src/ui/Screen';
import { ScreenHeader } from '../../src/ui/ScreenHeader';

export default function Checks() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useSettings();
  const { nights, reload } = useRealNights();
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  const checks = useMemo(() => buildChecks(overviewSummary(s, nights).items, s, nights), [s, nights]);
  return (
    <Screen tab testID="screen-checks" gap={14}>
      <Stagger i={0}>
        <ScreenHeader title="Checks" subtitle="Signals to discuss with a clinician. Not a diagnosis." />
      </Stagger>
      {checks.map((c, i) => (
        <Stagger key={c.id} i={i + 1}>
          <PressScale onPress={() => router.push(`/check/${c.id}`)} accessibilityLabel={`${c.title}. ${c.status}. ${c.kind}.`} accessibilityHint="Opens the evidence, sources and limits" testID={`check-${c.id}`}>
            <GlassCard radius={28} padding={18}>
              <View style={{ gap: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <IconTile name={c.icon} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="headline" style={{ letterSpacing: -0.3 }}>
                      {c.title}
                    </AppText>
                    <AppText variant="subheadline" tone="secondary" numberOfLines={2}>
                      {c.kind}
                    </AppText>
                  </View>
                  <Icon name="chevron.right" size={15} color={colors.labelTertiary} weight="semibold" />
                </View>
                <Chip label={c.status} tone={c.tone} icon={c.status === 'Observed' ? 'waveform' : c.status === 'Not done yet' ? 'circle.dashed' : c.status === 'Not assessed' ? 'questionmark.circle' : 'info.circle'} />
              </View>
            </GlassCard>
          </PressScale>
        </Stagger>
      ))}
      <Stagger i={6} style={{ gap: 6, paddingHorizontal: 4 }}>
        <AppText variant="footnote" tone="secondary">
          {DISCLAIMER_CANNOT_RULE_OUT}
        </AppText>
        <AppText variant="footnote" tone="secondary">
          {NOTE_NO_UNIFIED_SCORE}
        </AppText>
      </Stagger>
    </Screen>
  );
}
