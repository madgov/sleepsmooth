import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { ScrollView } from 'react-native';
import {
  DISCLAIMER_AUDIO,
  DISCLAIMER_NOT_DIAGNOSIS,
  NOSAS_SCREENING_NOT_DIAGNOSIS,
  SYMPTOM_NOT_VALIDATED,
  WELCOME_CAN,
  WELCOME_CANNOT,
  WELCOME_LIMITS_HEADING,
  WELCOME_TITLE,
  WELCOME_VALUE_PROP,
} from '@core/content/claims';
import { formatClock } from '@core/mobileLogic/index';
import { bystanderNotice, COPY, privacyRows, privacyTitle } from '../content/copy';
import { openSystemSettings, requestMic, useMicPermission } from '../platform/permissions';
import { updateSettings, useSettings } from '../state/settings';
import { useTheme } from '../theme/useTheme';
import { AppText } from '../ui/AppText';
import { Disclosure } from '../ui/Disclosure';
import { Icon } from '../ui/Icon';
import { InsetGroup, ListRow } from '../ui/InsetGroup';
import { PrimaryButton } from '../ui/PrimaryButton';
import { SourceBadge } from '../ui/SourceBadge';
import { SleepHoursEditor } from '../ui/SleepHoursEditor';
import { Surface } from '../ui/Surface';
import type { OnboardingCtx, OnboardingPage } from './PagedOnboarding';

function Body({ title, children, footer }: { title: string; children: ReactNode; footer: ReactNode }) {
  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 16, gap: 16 }} showsVerticalScrollIndicator={false}>
        <AppText variant="title1" serif accessibilityRole="header">
          {title}
        </AppText>
        {children}
      </ScrollView>
      <View style={{ paddingHorizontal: 24, paddingTop: 8, gap: 4 }}>{footer}</View>
    </View>
  );
}

function Welcome({ ctx }: { ctx: OnboardingCtx }) {
  const { colors } = useTheme();
  return (
    <Body title={WELCOME_TITLE} footer={<PrimaryButton label={COPY.C.continue} onPress={ctx.next} />}>
      <AppText variant="body" tone="secondary">
        {WELCOME_VALUE_PROP}
      </AppText>
      <SourceBadge kind="not-diagnosis" />
      <Surface level="L3" tone="info" radius="lg" padding={20}>
        <View style={{ gap: 10 }}>
          <AppText variant="headline" tone={{ color: colors.info.fg }} accessibilityRole="header">
            {WELCOME_LIMITS_HEADING}
          </AppText>
          <AppText variant="subheadline" tone={{ color: colors.info.fg }}>
            {DISCLAIMER_NOT_DIAGNOSIS}
          </AppText>
          {WELCOME_CANNOT.map((t) => (
            <AppText key={t} variant="subheadline" tone={{ color: colors.info.fg }}>
              {`• ${t}`}
            </AppText>
          ))}
        </View>
      </Surface>
      <Surface radius="md" padding={0}>
        <Disclosure title={COPY.N02_WHAT_IT_CAN_DO}>
          {WELCOME_CAN.map((t) => (
            <AppText key={t} variant="subheadline" tone="secondary">
              {`• ${t}`}
            </AppText>
          ))}
        </Disclosure>
      </Surface>
    </Body>
  );
}

function Privacy({ ctx }: { ctx: OnboardingCtx }) {
  const { colors } = useTheme();
  const agree = (granted: boolean) => {
    updateSettings((s) => ({ ...s, consent: { ...s.consent, granted, at: new Date().toISOString() } }));
    ctx.next();
  };
  return (
    <Body
      title={privacyTitle()}
      footer={
        <>
          <AppText variant="footnote" tone="secondary" style={{ paddingBottom: 8 }}>
            {COPY.N08_CONSENT}
          </AppText>
          <PrimaryButton label={COPY.C.agree} onPress={() => agree(true)} accessibilityHint={COPY.N08_CONSENT} />
          <PrimaryButton label={COPY.C.notNow} variant="plain" onPress={() => agree(false)} />
        </>
      }
    >
      <InsetGroup>
        {privacyRows().map((r) => (
          <ListRow key={r.id} title={r.text} leading={<Icon name={r.symbol} size={22} color={colors.accent} />} />
        ))}
      </InsetGroup>
      <AppText variant="footnote" tone="secondary">
        {DISCLAIMER_AUDIO}
      </AppText>
    </Body>
  );
}

function Microphone({ ctx }: { ctx: OnboardingCtx }) {
  const { colors } = useTheme();
  const { mic, refresh } = useMicPermission();
  const [asked, setAsked] = useState(false);
  const allow = async () => {
    await requestMic();
    await refresh();
    setAsked(true);
  };
  const granted = mic === 'granted';
  const denied = mic === 'denied' || (asked && !granted);
  return (
    <Body
      title={COPY.N09_MIC_TITLE}
      footer={
        granted ? (
          <PrimaryButton label={COPY.C.continue} onPress={ctx.next} />
        ) : denied ? (
          <>
            <PrimaryButton label={COPY.C.openSettings} variant="tinted" onPress={openSystemSettings} />
            <PrimaryButton label={COPY.C.continue} onPress={ctx.next} />
          </>
        ) : (
          <>
            <PrimaryButton label={COPY.C.allowMic} onPress={allow} />
            <PrimaryButton label={COPY.C.notNow} variant="plain" onPress={ctx.next} />
          </>
        )
      }
    >
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <View style={{ paddingTop: 5 }}>
          <Icon name="circle.fill" size={14} color="#FF9F0A" />
        </View>
        <AppText variant="body" tone="secondary" style={{ flex: 1 }}>
          {COPY.N10_ORANGE_DOT}
        </AppText>
      </View>
      {granted ? (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)}>
          <InsetGroup>
            <ListRow title={COPY.N10B_MIC_ALLOWED} leading={<Icon name="checkmark" size={20} color={colors.accent} weight="semibold" />} />
          </InsetGroup>
        </Animated.View>
      ) : denied ? (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)}>
          <Surface source="missing" radius="lg" padding={16}>
            <AppText variant="subheadline" tone={{ color: colors.missing.fg }}>
              {COPY.N11_MIC_OFF}
            </AppText>
          </Surface>
        </Animated.View>
      ) : null}
    </Body>
  );
}

function SleepHours({ ctx }: { ctx: OnboardingCtx }) {
  return (
    <Body title={COPY.N12_SLEEP_TITLE} footer={<PrimaryButton label={COPY.C.continue} onPress={ctx.next} />}>
      <AppText variant="body" tone="secondary">
        {COPY.N13_SLEEP_BODY}
      </AppText>
      <SleepHoursEditor />
    </Body>
  );
}

function AboutYou({ ctx }: { ctx: OnboardingCtx }) {
  const router = useRouter();
  const s = useSettings();
  const added = s.questionnaireSavedAt !== null;
  return (
    <Body
      title={COPY.N17_ABOUT_TITLE}
      footer={
        <>
          <PrimaryButton label={COPY.C.answerNow} onPress={() => router.push('/questionnaire?from=onboarding')} />
          <PrimaryButton label={COPY.C.later} variant="plain" onPress={ctx.next} />
        </>
      }
    >
      <AppText variant="body" tone="secondary">
        {COPY.N18_ABOUT_BODY}
      </AppText>
      <InsetGroup footer={NOSAS_SCREENING_NOT_DIAGNOSIS}>
        <ListRow title="NoSAS screening score" value={added ? COPY.C.added : COPY.C.notAnswered} subtitle={undefined} />
        <ListRow title="Symptom checklist" subtitle={SYMPTOM_NOT_VALIDATED} value={added ? COPY.C.added : COPY.C.notAnswered} />
      </InsetGroup>
      <AppText variant="footnote" tone="secondary">
        {COPY.N19_ABOUT_LOCAL}
      </AppText>
    </Body>
  );
}

function Ready({ ctx }: { ctx: OnboardingCtx }) {
  const s = useSettings();
  const { colors } = useTheme();
  const { mic } = useMicPermission();
  const [ack, setAck] = useState(s.bystanderNoticeAckAt !== null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- mirror persisted setting into local checkbox state
  useEffect(() => setAck(s.bystanderNoticeAckAt !== null), [s.bystanderNoticeAckAt]);
  const finish = () => {
    updateSettings((p) => ({ ...p, onboardingCompletedAt: new Date().toISOString() }));
    ctx.next();
  };
  const toggle = () => {
    const next = !ack;
    setAck(next);
    void Haptics.selectionAsync();
    updateSettings((p) => ({ ...p, bystanderNoticeAckAt: next ? new Date().toISOString() : null }));
  };
  const tick = <Icon name="checkmark" size={18} color={colors.accent} weight="semibold" />;
  return (
    <Body title={COPY.N20_FIRST_NIGHT_TITLE} footer={<PrimaryButton label={COPY.C.goToAudio} onPress={finish} />}>
      <AppText variant="body" tone="secondary">
        {bystanderNotice()}
      </AppText>
      <InsetGroup>
        <ListRow title={COPY.N22_BYSTANDER_ACK} onPress={toggle} accessibilityRole="checkbox" accessibilityState={{ checked: ack }} leading={<Icon name={ack ? 'checkmark.circle.fill' : 'circle'} size={24} color={colors.accent} />} />
      </InsetGroup>
      <AppText variant="title3" accessibilityRole="header">
        {COPY.N23_YOURE_SET}
      </AppText>
      <InsetGroup>
        <ListRow title="Sleep hours" value={`${formatClock(s.sleep.bedMin)} to ${formatClock(s.sleep.wakeMin)}`} trailing={tick} />
        <ListRow title="Reminder" value={s.sleep.reminder ? COPY.C.on : COPY.C.off} />
        <ListRow title="Microphone" value={mic === 'granted' ? COPY.C.allowed : COPY.C.off} />
        <ListRow title="Your answers" value={s.questionnaireSavedAt ? COPY.C.added : COPY.C.later} />
      </InsetGroup>
      {mic !== 'granted' ? (
        <PrimaryButton label={COPY.C.openSettings} variant="tinted" size="medium" onPress={openSystemSettings} />
      ) : null}
    </Body>
  );
}

export function buildOnboardingPages(): OnboardingPage[] {
  return [
    { key: 'welcome', symbol: 'moon.zzz', title: WELCOME_TITLE, skippable: false, render: (ctx) => <Welcome ctx={ctx} /> },
    { key: 'privacy', symbol: 'lock.shield', title: privacyTitle(), skippable: false, render: (ctx) => <Privacy ctx={ctx} /> },
    { key: 'mic', symbol: 'mic', title: COPY.N09_MIC_TITLE, skippable: true, render: (ctx) => <Microphone ctx={ctx} /> },
    { key: 'hours', symbol: 'clock', title: COPY.N12_SLEEP_TITLE, skippable: true, render: (ctx) => <SleepHours ctx={ctx} /> },
    { key: 'about', symbol: 'list.clipboard', title: COPY.N17_ABOUT_TITLE, skippable: true, render: (ctx) => <AboutYou ctx={ctx} /> },
    { key: 'ready', symbol: 'person.2', title: COPY.N20_FIRST_NIGHT_TITLE, skippable: false, render: (ctx) => <Ready ctx={ctx} /> },
  ];
}
