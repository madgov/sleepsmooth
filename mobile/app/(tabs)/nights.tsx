import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';
import { DISCLAIMER_CANNOT_RULE_OUT, ERROR_BOUNDARY_ACTION, ERROR_BOUNDARY_MESSAGE, ERROR_BOUNDARY_TITLE } from '@core/content/claims';
import { aggregateNights } from '@core/night';
import { COPY } from '../../src/content/copy';
import { useRealNights } from '../../src/data/nightSource';
import { useRecordAction } from '../../src/hooks/useRecordAction';
import { AppText } from '../../src/ui/AppText';
import { GlassCard } from '../../src/ui/GlassCard';
import { IconTile } from '../../src/ui/IconTile';
import { NightRow } from '../../src/ui/NightRow';
import { PrimaryButton } from '../../src/ui/PrimaryButton';
import { SampleRow } from '../../src/ui/SampleRow';
import { Screen, Stagger } from '../../src/ui/Screen';
import { ScreenHeader } from '../../src/ui/ScreenHeader';
import { SectionHeader } from '../../src/ui/Section';
import { Skeleton } from '../../src/ui/Skeleton';
import { StateCard } from '../../src/ui/StateCard';
import { Surface } from '../../src/ui/Surface';

export default function Nights() {
  const router = useRouter();
  const rec = useRecordAction();
  const { status, nights, reload } = useRealNights();
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  const agg = aggregateNights(nights.map((n) => ({ nightState: n.state, isSynthetic: n.isSample })));
  return (
    <Screen tab testID="screen-nights" gap={14}>
      <Stagger i={0}>
        <ScreenHeader title="Nights" subtitle="Every night recorded on this phone. Nothing leaves it." />
      </Stagger>

      {status === 'loading' ? (
        <Surface radius="xl">
          <Skeleton lines={4} />
        </Surface>
      ) : null}
      {status === 'error' ? <StateCard tone="error" icon="exclamationmark.triangle" title={ERROR_BOUNDARY_TITLE} body={ERROR_BOUNDARY_MESSAGE} actions={[{ label: ERROR_BOUNDARY_ACTION, onPress: reload }]} testID="nights-error" /> : null}

      {status === 'ready' && nights.length === 0 ? (
        <Stagger i={1}>
          <GlassCard radius={30} padding={24}>
            <View style={{ alignItems: 'center', gap: 12 }} testID="nights-empty">
              <IconTile name="moon.stars" size={76} />
              <AppText variant="title2" center accessibilityRole="header">
                Your nights appear here
              </AppText>
              <AppText variant="body" tone="secondary" center>
                {COPY.BUILD_NOTE_SAMPLE_ONLY}
              </AppText>
              <View style={{ alignSelf: 'stretch' }}>
                <PrimaryButton label="Start tonight" onPress={rec.onPress} />
              </View>
            </View>
          </GlassCard>
        </Stagger>
      ) : null}

      {nights.map((n, i) => (
        <Stagger key={n.id} i={i + 1}>
          <NightRow night={n} onPress={() => router.push(`/night/${n.id}`)} testID={`night-${n.id}`} />
        </Stagger>
      ))}
      {agg.assessedNights >= 2 ? (
        <AppText variant="subheadline" tone="secondary" style={{ paddingHorizontal: 4 }}>
          {agg.observedNights > 0 && agg.observedNights < agg.assessedNights ? COPY.N57_VARIED : COPY.N56_OBSERVED_ON(agg.observedNights, agg.assessedNights)}
        </AppText>
      ) : null}

      {status !== 'loading' ? (
        <Stagger i={nights.length + 2} style={{ gap: 10 }}>
          <SectionHeader title="Sample" />
          <SampleRow onPress={() => router.push('/night/sample')} />
          <AppText variant="footnote" tone="secondary" style={{ paddingHorizontal: 4 }}>
            {DISCLAIMER_CANNOT_RULE_OUT}
          </AppText>
        </Stagger>
      ) : null}
    </Screen>
  );
}
