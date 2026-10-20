import { useFocusEffect } from 'expo-router';
import { useSafeRouter } from '../../src/nav/useSafeRouter';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { DISCLAIMER_CANNOT_RULE_OUT, ERROR_BOUNDARY_ACTION, ERROR_BOUNDARY_MESSAGE, ERROR_BOUNDARY_TITLE } from '@core/content/claims';
import { selectTrendRows, type TrendWindow } from '@core/mobileLogic/nightTrend';
import { COPY } from '../../src/content/copy';
import { useRealNights } from '../../src/data/nightSource';
import { useRecordAction } from '../../src/hooks/useRecordAction';
import { AppText } from '../../src/ui/AppText';
import { GlassCard } from '../../src/ui/GlassCard';
import { IconTile } from '../../src/ui/IconTile';
import { NightRow } from '../../src/ui/NightRow';
import { NightTrend } from '../../src/ui/NightTrend';
import { PrimaryButton } from '../../src/ui/PrimaryButton';
import { SampleRow } from '../../src/ui/SampleRow';
import { Screen, Stagger } from '../../src/ui/Screen';
import { ScreenHeader } from '../../src/ui/ScreenHeader';
import { SectionHeader } from '../../src/ui/Section';
import { DisclaimerNote } from '../../src/ui/DisclaimerNote';
import { Skeleton } from '../../src/ui/Skeleton';
import { StateCard } from '../../src/ui/StateCard';
import { Surface } from '../../src/ui/Surface';

export default function Nights() {
  const router = useSafeRouter();
  const rec = useRecordAction();
  const { status, nights, reload } = useRealNights();
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  const [win, setWin] = useState<TrendWindow>(7);
  const rows = useMemo(() => selectTrendRows(nights, win), [nights, win]);
  // Nights outside the chosen window stay reachable as full cards below the list.
  const shown = new Set(rows.map((r) => r.id));
  const earlier = nights.filter((n) => !shown.has(n.id));
  return (
    <Screen tab title="Nights" testID="screen-nights" gap={14}>
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

      {status === 'ready' && rows.length > 0 ? (
        <Stagger i={1}>
          <NightTrend rows={rows} window={win} onWindowChange={setWin} onOpen={(id) => router.push(`/night/${id}`)} />
        </Stagger>
      ) : null}

      {earlier.length > 0 && rows.length > 0 ? <SectionHeader title="Earlier nights" /> : null}
      {earlier.map((n, i) => (
        <Stagger key={n.id} i={i + 2}>
          <NightRow night={n} onPress={() => router.push(`/night/${n.id}`)} testID={`night-${n.id}`} />
        </Stagger>
      ))}

      {status !== 'loading' ? (
        <Stagger i={nights.length + 2} style={{ gap: 10 }}>
          <SectionHeader title="Sample" />
          <SampleRow onPress={() => router.push('/night/sample')} />
          <View style={{ paddingHorizontal: 4 }}>
            <DisclaimerNote testID="nights-disclaimer">{`Not a diagnosis. ${DISCLAIMER_CANNOT_RULE_OUT}`}</DisclaimerNote>
          </View>
        </Stagger>
      ) : null}
    </Screen>
  );
}
