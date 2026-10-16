import { useFocusEffect } from 'expo-router';
import { useSafeRouter } from '../../src/nav/useSafeRouter';
import { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { DISCLAIMER_CANNOT_RULE_OUT, NOTE_NO_UNIFIED_SCORE } from '@core/content/claims';
import { useRealNights } from '../../src/data/nightSource';
import { buildChecks } from '../../src/state/checks';
import { overviewSummary } from '../../src/state/evidence';
import { useSettings } from '../../src/state/settings';
import { useTheme } from '../../src/theme/useTheme';
import { AppText } from '../../src/ui/AppText';
import { GlassCard } from '../../src/ui/GlassCard';
import { Icon } from '../../src/ui/Icon';
import { DisclaimerNote } from '../../src/ui/DisclaimerNote';
import { IconTile } from '../../src/ui/IconTile';
import { CHECK_TINT } from '../../src/ui/checkTint';
import { PressScale } from '../../src/ui/Press';
import { Screen, Stagger } from '../../src/ui/Screen';
import { ScreenHeader } from '../../src/ui/ScreenHeader';

export default function Checks() {
  const router = useSafeRouter();
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
    <Screen tab title="Checks" testID="screen-checks" gap={14}>
      <Stagger i={0}>
        <ScreenHeader title="Checks" subtitle="Signals to discuss with a clinician." />
      </Stagger>
      {checks.map((c, i) => (
        <Stagger key={c.id} i={i + 1}>
          <PressScale onPress={() => router.push(`/check/${c.id}`)} accessibilityLabel={`${c.title}. ${c.status}. ${c.kind}.`} accessibilityHint="Opens the evidence, sources and limits" testID={`check-${c.id}`}>
            <GlassCard radius={24} padding={16}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <IconTile name={c.icon} size={48} tint={CHECK_TINT[c.id]} />
                <View style={{ flex: 1, gap: 3 }}>
                  <AppText variant="headline">{c.title}</AppText>
                  <AppText variant="footnote" tone="secondary" numberOfLines={2}>
                    {c.kind}
                  </AppText>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <Icon name={c.status === 'Observed' ? 'waveform' : c.status === 'Not done yet' ? 'circle.dashed' : c.status === 'Not assessed' ? 'questionmark.circle' : 'info.circle'} size={13} color={(c.tone === 'default' ? colors.accent : colors[c.tone].fg)} weight="semibold" />
                    <AppText variant="caption1" weight="600" tone={{ color: (c.tone === 'default' ? colors.accent : colors[c.tone].fg) }}>
                      {c.status}
                    </AppText>
                  </View>
                </View>
                <Icon name="chevron.right" size={15} color={colors.labelTertiary} weight="semibold" />
              </View>
            </GlassCard>
          </PressScale>
        </Stagger>
      ))}
      <Stagger i={6} style={{ paddingHorizontal: 4 }}>
        <DisclaimerNote testID="checks-disclaimer">{`Not a diagnosis. ${DISCLAIMER_CANNOT_RULE_OUT} ${NOTE_NO_UNIFIED_SCORE}`}</DisclaimerNote>
      </Stagger>
    </Screen>
  );
}
