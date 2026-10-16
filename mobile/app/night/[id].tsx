import * as Haptics from 'expo-haptics';
import { useSafeRouter } from '../../src/nav/useSafeRouter';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { confirmAction } from '../../src/ui/confirm';
import Animated, { FadeIn } from 'react-native-reanimated';
import { formatClock } from '@core/mobileLogic/index';
import {
  AUDIO_DETAIL,
  DISCLAIMER_AUDIO,
  DISCLAIMER_CANNOT_RULE_OUT,
  DISCLAIMER_NOT_DIAGNOSIS,
  ERROR_BOUNDARY_MESSAGE,
  ERROR_BOUNDARY_TITLE,
  MISSING_AUDIO_UNUSABLE,
  MODEL_CARD_HEADING,
  NIGHT_ESTIMATE_CAVEAT,
  NOTE_AUDIO_NEVER_DOWNGRADES,
  NOTE_NO_UNIFIED_SCORE,
  NOTE_SNORE_LIKE,
  ROUGH_ESTIMATE_LABEL,
  ROUGH_ESTIMATE_NOTE,
  RESULTS_DETAILS_HEADING,
  SAMPLE_AUDIO_LABEL,
  SAMPLE_AUDIO_NOT_USED,
  SNORE_NOT_APNEA_LINE,
  modelVersionLine,
} from '@core/content/claims';
import { nightSource, SAMPLE_NIGHT_ID, type NightListItem } from '../../src/data/nightSource';
import { COPY } from '../../src/content/copy';
import { useNightEvidence } from '../../src/state/evidence';
import { useSettings } from '../../src/state/settings';
import { useTheme } from '../../src/theme/useTheme';
import { AppText } from '../../src/ui/AppText';
import { DisclaimerNote } from '../../src/ui/DisclaimerNote';
import { Disclosure } from '../../src/ui/Disclosure';
import { EvidenceCard } from '../../src/ui/EvidenceCard';
import { BackBar } from '../../src/ui/ScreenHeader';
import { Screen } from '../../src/ui/Screen';
import { InsetGroup, ListRow } from '../../src/ui/InsetGroup';
import { nightTitle, presentationFor } from '../../src/ui/NightRow';
import { Skeleton } from '../../src/ui/Skeleton';
import { SourceBadge } from '../../src/ui/SourceBadge';
import { StateCard } from '../../src/ui/StateCard';
import { Surface } from '../../src/ui/Surface';
import { Timeline } from '../../src/ui/Timeline';
import { HealthLineView } from '../../src/ui/HealthParts';
import { healthAvailable, ensureHealthLoaded, useHealthStore } from '../../src/health';
import { healthNightFor, type HealthNight } from '@core/mobileLogic/healthSleep';
import { HourCapsuleRow } from '../../src/ui/HourCapsule';
import { CoverageSection } from '../../src/ui/CoverageSection';
import { DiagnosticsSection } from '../../src/ui/DiagnosticsSection';
import { ClipsSection } from '../../src/ui/ClipsSection';
import { clipPlayer } from '../../src/clips/clipPlayer';

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; night: NightListItem };

function useNight(id: string): [Load, () => void] {
  const [state, setState] = useState<Load>(id === SAMPLE_NIGHT_ID ? { status: 'ready', night: nightSource.getSampleNight() } : { status: 'loading' });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (id === SAMPLE_NIGHT_ID) return;
    let live = true;
    nightSource
      .getNight(id)
      .then((night) => live && setState(night ? { status: 'ready', night } : { status: 'error' }))
      .catch(() => live && setState({ status: 'error' }));
    return () => {
      live = false;
    };
  }, [id, tick]);
  return [state, () => { setState({ status: 'loading' }); setTick((t) => t + 1); }];
}

export default function NightDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [load, retry] = useNight(id ?? '');
  const night = load.status === 'ready' ? load.night : null;
  const title = night ? nightTitle(night) : 'Night';
  return (
    <Screen variant="app" top={<BackBar title={title} />} gap={24}>
      <>
        {load.status === 'loading' ? (
          <Surface>
            <Skeleton lines={5} />
          </Surface>
        ) : null}
        {load.status === 'error' ? <ErrorState retry={retry} /> : null}
        {night ? <NightBody night={night} /> : null}
      </>
    </Screen>
  );
}

/** Labelled sample for the sample night only: a made-up Apple Health record so the layout can be seen. */
const SAMPLE_HEALTH_NIGHT: HealthNight = { key: 0, startMs: new Date(2026, 0, 1, 23, 20).getTime(), endMs: new Date(2026, 0, 2, 6, 50).getTime(), kind: 'asleep', source: 'Apple Watch' };

function ErrorState({ retry, label = COPY.C.tryAgain }: { retry: () => void; label?: string }) {
  return (
    <StateCard
      tone="error"
      icon="exclamationmark.triangle"
      title={ERROR_BOUNDARY_TITLE}
      body={ERROR_BOUNDARY_MESSAGE}
      actions={[{ label, onPress: retry }]}
      testID="night-error"
    />
  );
}

function NightBody({ night }: { night: NightListItem }) {
  const router = useSafeRouter();
  const { reduceMotion } = useTheme();
  const s = useSettings();
  const ev = useNightEvidence(s, night);
  const hs = useHealthStore();
  useEffect(() => ensureHealthLoaded(), []);
  const healthSpan = { startMs: night.view.record.captureStart, endMs: night.view.record.captureEnd ?? night.view.record.captureStart };
  const healthNight = night.isSample ? SAMPLE_HEALTH_NIGHT : healthNightFor(healthSpan, hs.nights);
  const showHealth = night.isSample || (healthAvailable() && !!s.health.requestedAt);
  const p = presentationFor(night.state, night.notAssessedReasons);
  // A clip never keeps playing after the screen is left.
  useEffect(() => () => clipPlayer.stop(), []);
  const notAssessed = night.state === 'not-assessed';
  const confirmDelete = () =>
    confirmAction({
      title: COPY.N65_DELETE_NIGHT,
      message: 'Delete this night from this phone? This cannot be undone.',
      confirmLabel: COPY.C.delete,
      cancelLabel: COPY.C.cancel,
      destructive: true,
      onConfirm: () => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        void nightSource.deleteNight(night.id).finally(() => router.back());
      },
    });
  if (!p || !ev) return <ErrorState retry={() => router.back()} label="Go back" />;

  const w = night.estimatedWindow;
  // M16: calm reveal, opacity only. No bounce, no count-up, no haptic.
  return (
    <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(220)} style={{ gap: 24 }}>
      {night.isSample ? (
        <StateCard tone="sample" icon="testtube.2" title={SAMPLE_AUDIO_LABEL} body={SAMPLE_AUDIO_NOT_USED} source="sample" animated={false} testID="sample-banner" />
      ) : null}

      <StateCard
        tone={p.tone}
        icon={p.icon}
        title={notAssessed ? COPY.N59_NOT_ASSESSED : p.line}
        body={notAssessed ? MISSING_AUDIO_UNUSABLE : undefined}
        source={night.isSample ? 'sample' : p.border === 'missing' ? 'missing' : 'audio-observation'}
        animated={false}
        extra={
          <View style={{ gap: 8 }}>
            {notAssessed && night.notAssessedReasons.length > 0
              ? night.notAssessedReasons.map((r) => (
                  <AppText key={r} variant="subheadline">{`• ${r}`}</AppText>
                ))
              : null}
            {night.state === 'snore-like-observed' ? <AppText variant="subheadline">{NOTE_SNORE_LIKE}</AppText> : null}
            {p.second ? <AppText variant="footnote">{p.second}</AppText> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <SourceBadge kind="audio-observation" size="compact" />
              {night.isSample ? <SourceBadge kind="sample" size="compact" /> : null}
              <SourceBadge kind="not-diagnosis" size="compact" />
            </View>
          </View>
        }
        testID="night-state-card"
      />

      <View style={{ paddingHorizontal: 4 }}>
        <DisclaimerNote testID="night-disclaimer">{DISCLAIMER_NOT_DIAGNOSIS}</DisclaimerNote>
      </View>

      {night.state !== 'not-recorded' ? <CoverageSection night={night} /> : null}

      <View style={{ gap: 8 }}>
        <AppText variant="footnote" tone="secondary" accessibilityRole="header" style={{ paddingHorizontal: 16 }}>
          {ROUGH_ESTIMATE_LABEL}
        </AppText>
        <Surface source={night.isSample ? 'sample' : undefined} padding={0}>
          {w && night.epochs.length > 0 ? (
            <>
              <View style={{ padding: 16, gap: 6 }}>
                <AppText variant="subheadline" tabular testID="rough-estimate-window">{`${formatClock(w.startMin)} to ${formatClock(w.endMin)}`}</AppText>
                <AppText variant="footnote" tone="secondary">{ROUGH_ESTIMATE_NOTE}</AppText>
              </View>
              <Disclosure title="Hour by hour (rough)">
                <Timeline epochs={night.epochs} epochMinutesEach={night.epochMinutes} startMin={w.startMin} endMin={w.endMin} />
                <HourCapsuleRow epochs={night.epochs} epochMinutesEach={night.epochMinutes} startMin={w.startMin} />
                <AppText variant="footnote" tone="secondary">{`${COPY.N61_ESTIMATE_LINE}`}</AppText>
                <AppText variant="footnote" tone="secondary">
                  {COPY.N63_SIGNALS(night.signals.used.join(', ') || 'none', night.signals.used.length, night.signals.total)}
                </AppText>
                <AppText variant="footnote" tone="secondary">{NIGHT_ESTIMATE_CAVEAT}</AppText>
              </Disclosure>
            </>
          ) : (
            <View style={{ padding: 16 }}>
              <AppText variant="subheadline" tone="secondary">{COPY.N68_NO_ESTIMATE}</AppText>
            </View>
          )}
        </Surface>
      </View>

      {showHealth ? <HealthLineView night={healthNight} noRecords={hs.nights.length === 0 && !night.isSample} sample={night.isSample} /> : null}

      <Section title="User-reported" badge="user-reported">
        {ev.userItems.length > 0 ? ev.userItems.map((i) => <EvidenceCard key={i.id} item={i} hideLimitations={SAID_ONCE} />) : <AppText variant="subheadline" tone="secondary">Nothing reported yet.</AppText>}
      </Section>

      <Section title="Audio observation" badge="audio-observation" sample={night.isSample}>
        <EvidenceCard item={ev.audioItem} hideLimitations={SAID_ONCE} />
        <Surface source={night.isSample ? 'sample' : 'audio-observation'} padding={0}>
          <View style={{ padding: 16 }}>
            <AppText variant="subheadline">{SNORE_NOT_APNEA_LINE}</AppText>
          </View>
          <Disclosure title="What the recording showed">
            <AppText variant="subheadline" tone="secondary">{AUDIO_DETAIL[detailKey(night.state)]}</AppText>
          </Disclosure>
        </Surface>
      </Section>

      {night.state !== 'not-recorded' ? <ClipsSection nightId={night.id} isSample={night.isSample} nightStartMs={night.view.record.captureStart} /> : null}

      <Section title="Missing information" badge="missing">
        {[...ev.missingItems].map((i) => <EvidenceCard key={i.id} item={i} hideLimitations={SAID_ONCE} />)}
        {notAssessed ? night.notAssessedReasons.map((r) => (
          <Surface key={r} source="missing">
            <AppText variant="subheadline">{r}</AppText>
          </Surface>
        )) : null}
        {ev.missingItems.length === 0 && !notAssessed ? <AppText variant="subheadline" tone="secondary">Nothing else is flagged as missing.</AppText> : null}
      </Section>

      <InsetGroup>
        <Disclosure title={RESULTS_DETAILS_HEADING}>
          {[DISCLAIMER_AUDIO, DISCLAIMER_CANNOT_RULE_OUT, NOTE_AUDIO_NEVER_DOWNGRADES, NOTE_NO_UNIFIED_SCORE].map((t) => (
            <AppText key={t} variant="subheadline" tone="secondary">{t}</AppText>
          ))}
        </Disclosure>
        <ListRow title={MODEL_CARD_HEADING} subtitle={night.view.summary.modelVersion ? modelVersionLine(night.view.summary.modelVersion) : undefined} trailing="chevron" onPress={() => router.push('/model-card')} />
      </InsetGroup>

      <DiagnosticsSection night={night} />

      {!night.isSample ? (
        <InsetGroup>
          <ListRow title={COPY.N65_DELETE_NIGHT} destructive leading="trash" onPress={confirmDelete} />
        </InsetGroup>
      ) : null}
    </Animated.View>
  );
}

/** The app-wide "not a diagnosis" line is shown once under the result, so the evidence cards do not repeat it. */
const SAID_ONCE = [DISCLAIMER_NOT_DIAGNOSIS] as const;

function detailKey(state: NightListItem['state']): keyof typeof AUDIO_DETAIL {
  switch (state) {
    case 'snore-like-observed': return 'usableSnoreLikeObserved';
    case 'few-observations': return 'usableFewObservations';
    case 'not-assessed': return 'unusable';
    case 'model-not-applicable': return 'modelNotApplicable';
    case 'no-model': return 'noModel';
    case 'not-recorded': return 'notProvided';
  }
}

function Section({ title, badge, sample, children }: { title: string; badge: 'user-reported' | 'audio-observation' | 'missing'; sample?: boolean; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, flexWrap: 'wrap' }}>
        <AppText variant="footnote" tone="secondary" accessibilityRole="header">{title}</AppText>
        <SourceBadge kind={badge} size="compact" />
        {sample ? <SourceBadge kind="sample" size="compact" /> : null}
      </View>
      {children}
    </View>
  );
}
