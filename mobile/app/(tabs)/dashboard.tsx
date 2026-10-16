import { useFocusEffect } from 'expo-router';
import { useSafeRouter } from '../../src/nav/useSafeRouter';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Platform, View } from 'react-native';
import { COVERAGE_HEADING, DASHBOARD_EMPTY_MESSAGE, ROUGH_ESTIMATE_LABEL, SNORE_NOT_APNEA_LINE } from '@core/content/claims';
import { coverageHeadline, durationText } from '@core/mobileLogic/coverage';
import { formatClock, formatDuration, minutesInBed } from '@core/mobileLogic/index';
import { FIRST_ENTRY_PRIMER_VERSION, shouldOfferAutoRecord, shouldShowFirstEntryPrimer } from '@core/mobileLogic/autoRecord';
import { COPY, EXPO_GO } from '../../src/content/copy';
import { IS_EXPO_GO } from '../../src/native/runtime';
import { AutoRecordCard } from '../../src/ui/AutoRecordCard';
import { nightSource, type NightListItem } from '../../src/data/nightSource';
import { useRealNights } from '../../src/data/nightSource';
import { useRecordAction } from '../../src/hooks/useRecordAction';
import { useOverviewSummary } from '../../src/state/evidence';
import { updateSettings, useSettings } from '../../src/state/settings';
import { useTheme } from '../../src/theme/useTheme';
import { CaptureBanners } from '../../src/ui/CaptureBanners';
import { AppText } from '../../src/ui/AppText';
import { GlassCard } from '../../src/ui/GlassCard';
import { Icon } from '../../src/ui/Icon';
import { IconTile } from '../../src/ui/IconTile';
import { LimitsPanel } from '../../src/ui/LimitsPanel';
import { CoverageTimeline } from '../../src/ui/CoverageTimeline';
import { MetricTile } from '../../src/ui/MetricTile';
import { NightHero } from '../../src/ui/NightHero';
import { PressScale } from '../../src/ui/Press';
import { PrimaryButton } from '../../src/ui/PrimaryButton';
import { Screen, Stagger } from '../../src/ui/Screen';
import { ScreenHeader } from '../../src/ui/ScreenHeader';
import { SectionHeader } from '../../src/ui/Section';
import { Skeleton } from '../../src/ui/Skeleton';
import { StateCard } from '../../src/ui/StateCard';
import { Surface } from '../../src/ui/Surface';
import { RoutineCard } from '../../src/ui/RoutineCardConnected';

const greeting = (): string => {
  const h = new Date().getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export default function Dashboard() {
  const router = useSafeRouter();
  const { colors } = useTheme();
  const s = useSettings();
  const rec = useRecordAction();
  const { status, nights, reload } = useRealNights();
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  // Feature B: the privacy, consent, bystander and microphone primer is shown ONCE, on first arrival here after onboarding.
  // If it is dismissed, the same steps appear again on the next Record tap (start-sheet). It never starts a recording.
  const primerPushed = useRef(false);
  useEffect(() => {
    if (primerPushed.current || IS_EXPO_GO) return;
    if (shouldShowFirstEntryPrimer({ onboardingDone: !!s.onboardingCompletedAt, primerShownVersion: s.primerShownVersion, consentGranted: s.consent.granted })) {
      primerPushed.current = true;
      updateSettings((p) => ({ ...p, primerShownVersion: FIRST_ENTRY_PRIMER_VERSION }));
      router.push('/start-sheet?mode=first-entry');
    }
  }, [s.onboardingCompletedAt, s.primerShownVersion, s.consent.granted, router]);
  const offerAuto = shouldOfferAutoRecord(s.autoRecord, !!s.onboardingCompletedAt, Platform.OS !== 'android' && !IS_EXPO_GO);
  const real = nights.length > 0;
  const sample = useMemo(() => nightSource.getSampleNight(), []);
  const hero: NightListItem | null = real ? (nights[0] as NightListItem) : status === 'loading' ? null : sample;
  const scheduledMin = minutesInBed(s.sleep.bedMin, s.sleep.wakeMin);
  const summary = useOverviewSummary(s, nights);
  const toneFor = summary.conclusion === 'discuss-with-clinician' ? 'discuss' : summary.conclusion === 'inconclusive' ? 'info' : 'missing';
  const iconFor = summary.conclusion === 'discuss-with-clinician' ? 'person.crop.circle.badge.questionmark' : summary.conclusion === 'inconclusive' ? 'questionmark.circle' : 'circle.dashed';
  // The empty state already carries the one primary action; do not show a second "Start tonight" below it.
  const showTonightCta = rec.active || !(status === 'ready' && !real);
  const dateLine = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <Screen tab title="Dashboard" testID="screen-dashboard">
      <Stagger i={0}>
        <ScreenHeader eyebrow={dateLine} title={greeting()} subtitle="What the phone recorded, and what it cannot tell you." />
      </Stagger>

      {status === 'loading' ? (
        <Surface radius="xl">
          <Skeleton lines={5} />
        </Surface>
      ) : null}

      {status === 'error' ? <StateCard tone="error" icon="exclamationmark.triangle" title="Nights could not be loaded" body="Your answers and settings are not affected." actions={[{ label: COPY.C.tryAgain, onPress: reload }]} testID="dash-error" /> : null}

      <CaptureBanners />

      {IS_EXPO_GO ? (
        <StateCard tone="info" icon="iphone" title={EXPO_GO.BANNER} body={EXPO_GO.WHAT_NOT} animated={false} testID="expo-go-banner" />
      ) : null}

      {rec.active ? (
        <Stagger i={1}>
          <PressScale onPress={() => router.push('/recording')} accessibilityLabel="Recording in progress. Open the recording screen.">
            <GlassCard radius={26} padding={16}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Icon name="waveform" size={26} color={colors.accent} />
                <View style={{ flex: 1 }}>
                  <AppText variant="headline">Recording now</AppText>
                  <AppText variant="subheadline" tone="secondary">
                    Tap to see the timer or stop.
                  </AppText>
                </View>
                <Icon name="chevron.right" size={14} color={colors.labelTertiary} weight="semibold" />
              </View>
            </GlassCard>
          </PressScale>
        </Stagger>
      ) : null}

      {status === 'ready' && !real ? (
        <Stagger i={1}>
          <EmptyHero onStart={rec.onPress} />
        </Stagger>
      ) : null}

      {hero ? (
        <>
          <Stagger i={2}>
            <NightHero night={hero} scheduledMin={scheduledMin} />
          </Stagger>

          <Stagger i={3} style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <MetricTile
                icon="clock"
                label="Assessable time"
                value={durationText(hero.coverage.seconds.assessable)}
                caption={`of ${durationText(hero.coverage.seconds.recordedInWindow)} recorded`}
                testID="tile-assessable"
              />
              <MetricTile
                icon="waveform"
                label="Snore-like windows"
                value={hero.snoreWindows ? hero.snoreWindows.snoreLike.toLocaleString('en-US') : '--'}
                unit={hero.snoreWindows ? `of ${hero.snoreWindows.assessable.toLocaleString('en-US')}` : undefined}
                caption={hero.snoreWindows ? 'assessable windows' : 'Not assessed'}
                testID="tile-snore"
              />
            </View>
            <AppText variant="footnote" tone="secondary" style={{ paddingHorizontal: 4 }}>
              {SNORE_NOT_APNEA_LINE}
            </AppText>
          </Stagger>

          <Stagger i={4} style={{ gap: 10 }}>
            <SectionHeader title={COVERAGE_HEADING} />
            <GlassCard radius={26} padding={16}>
              <View style={{ gap: 12 }}>
                <AppText variant="subheadline" testID="dashboard-coverage-headline">{coverageHeadline(hero.coverage)}</AppText>
                <CoverageTimeline coverage={hero.coverage} utc={hero.view.summary.isSynthetic} testID="dashboard-coverage" />
                {hero.estimatedWindow ? (
                  <AppText variant="footnote" tone="secondary" testID="dashboard-rough-estimate">
                    {`${ROUGH_ESTIMATE_LABEL}: ${formatClock(hero.estimatedWindow.startMin)} to ${formatClock(hero.estimatedWindow.endMin)}`}
                  </AppText>
                ) : null}
              </View>
            </GlassCard>
          </Stagger>
        </>
      ) : null}

      <Stagger i={5} style={{ gap: 10 }}>
        <SectionHeader title="What this adds up to" action="See checks" onAction={() => router.navigate('/checks')} />
        <StateCard tone={toneFor} icon={iconFor} title={summary.headline} radius="xl" animated={false} testID="overview-card" />
        <LimitsPanel />
      </Stagger>

      <Stagger i={6} style={{ gap: 10 }}>
        <RoutineCard where="dashboard" />
        <SectionHeader title="Tonight" />
        <GlassCard radius={28} padding={20}>
          <View style={{ gap: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <IconTile name="moon.zzz" tint="violet" />
              <View style={{ flex: 1 }}>
                <AppText variant="title3" tabular>{`${formatClock(s.sleep.bedMin)} to ${formatClock(s.sleep.wakeMin)}`}</AppText>
                <AppText variant="subheadline" tone="secondary">
                  {s.sleep.userSet ? (s.sleep.reminder ? 'Bedtime reminder on' : 'Bedtime reminder off') : 'Suggested hours. Change them in Settings.'}
                </AppText>
              </View>
            </View>
            {showTonightCta ? (
              <PrimaryButton label={rec.active ? 'Open recording' : 'Start tonight'} onPress={rec.active ? () => router.push('/recording') : rec.onPress} testID="tonight-start" />
            ) : null}
            <AppText variant="footnote" tone="secondary" center>
              {COPY.N27_BATTERY_TIP}
            </AppText>
          </View>
        </GlassCard>
      </Stagger>

      {offerAuto ? (
        <Stagger i={7}>
          <AutoRecordCard />
        </Stagger>
      ) : null}

      <Stagger i={7} style={{ gap: 10 }}>
        <SectionHeader title="Past 7 nights" action="All nights" onAction={() => router.navigate('/nights')} />
        <WeekStrip nights={nights} sample={real ? null : sample} scheduledMin={scheduledMin} onOpen={(id) => router.push(`/night/${id}`)} />
      </Stagger>
    </Screen>
  );
}

function EmptyHero({ onStart }: { onStart: () => void }) {
  return (
    <GlassCard radius={30} padding={20}>
      <View style={{ gap: 16 }} testID="dash-empty">
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <IconTile name="moon.stars" size={56} />
          <AppText variant="title3" accessibilityRole="header" style={{ flex: 1 }}>
            Your first night appears here
          </AppText>
        </View>
        <AppText variant="subheadline" tone="secondary">
          {DASHBOARD_EMPTY_MESSAGE}
        </AppText>
        <PrimaryButton label="Start tonight" onPress={onStart} />
      </View>
    </GlassCard>
  );
}

const DAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function WeekStrip({ nights, sample, scheduledMin, onOpen }: { nights: NightListItem[]; sample: NightListItem | null; scheduledMin: number; onOpen: (id: string) => void }) {
  const { colors } = useTheme();
  const days = useMemo(() => {
    const out: { key: string; letter: string; night: NightListItem | null; today: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const n = nights.find((x) => x.dateISO.slice(0, 10) === key) ?? (i === 0 && sample ? sample : null);
      out.push({ key, letter: DAY_LETTER[d.getDay()] as string, night: n, today: i === 0 });
    }
    return out;
  }, [nights, sample]);
  return (
    <GlassCard radius={26} padding={16}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }} testID="week-strip">
        {days.map((d) => {
          const share = d.night ? Math.min(1, d.night.recordedMinutes / Math.max(1, scheduledMin)) : 0;
          const cap = (
            <View style={{ alignItems: 'center', gap: 6, width: 40 }}>
              <View style={{ width: 30, height: 84, borderRadius: 15, borderCurve: 'continuous', borderWidth: 1, borderColor: d.night ? colors.capsule.outline : colors.separatorOpaque, borderStyle: d.night ? 'solid' : 'dashed', overflow: 'hidden', justifyContent: 'flex-end' }}>
                {d.night ? <View style={{ height: `${Math.max(8, share * 100)}%`, backgroundColor: colors.capsule.fill, opacity: d.night.isSample ? 0.55 : 1 }} /> : null}
              </View>
              <AppText variant="caption1" tone={d.today ? 'label' : 'secondary'} weight={d.today ? '700' : '500'} maxFontSizeMultiplier={1.3}>
                {d.letter}
              </AppText>
              <AppText variant="caption2" tone="secondary" tabular maxFontSizeMultiplier={1} numberOfLines={1}>
                {d.night ? (d.night.isSample ? 'Sample' : `${Math.round(d.night.recordedMinutes / 60)}h`) : ' '}
              </AppText>
            </View>
          );
          return d.night ? (
            <PressScale key={d.key} onPress={() => onOpen((d.night as NightListItem).id)} accessibilityLabel={`${d.night.isSample ? 'Sample night' : 'Night'}, ${formatDuration(d.night.recordedMinutes)} recorded`}>
              {cap}
            </PressScale>
          ) : (
            <View key={d.key} accessible accessibilityLabel="No recording">
              {cap}
            </View>
          );
        })}
      </View>
    </GlassCard>
  );
}
