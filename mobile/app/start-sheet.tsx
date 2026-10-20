import * as Haptics from 'expo-haptics';
import { useSafeRouter } from '../src/nav/useSafeRouter';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, ScrollView, View } from 'react-native';
import { setOvernightConsent } from '@core/consent/history';
import { bystanderAckIsFresh } from '@core/mobileLogic/index';
import { FIRST_ENTRY_PRIMER_VERSION } from '@core/mobileLogic/autoRecord';
import { CLIP_TOGGLE_BODY, CLIP_TOGGLE_DETAIL, CLIP_TOGGLE_TITLE } from '@core/content/claims';
import { DISCLAIMER_AUDIO } from '@core/content/claims';
import { AUTO, bystanderNotice, clipBackupNote, COPY, privacyRows, privacyTitle } from '../src/content/copy';
import { openSystemSettings, requestMic } from '../src/platform/permissions';
import { useCapture } from '../src/hooks/useCapture';
import { updateSettings, useSettings } from '../src/state/settings';
import { useTheme } from '../src/theme/useTheme';
import { AppText } from '../src/ui/AppText';
import { Icon } from '../src/ui/Icon';
import { InsetGroup, ListRow } from '../src/ui/InsetGroup';
import { PrimaryButton } from '../src/ui/PrimaryButton';
import { SheetHeader } from '../src/ui/SheetHeader';
import { StateCard } from '../src/ui/StateCard';

const COUNTDOWN = 3;

export default function StartSheet() {
  const router = useSafeRouter();
  const { source, mode } = useLocalSearchParams<{ source?: string; mode?: string }>();
  // First-entry primer: the same privacy, consent, bystander and microphone steps, shown once after onboarding. It never records.
  const firstEntry = mode === 'first-entry';
  const { colors } = useTheme();
  const s = useSettings();
  const capture = useCapture();
  const fromNotification = source === 'notification';
  // The countdown only auto-starts when the bystander notice was acknowledged recently. Otherwise the user must tick, then tap.
  const [countdownAllowed] = useState(() => fromNotification && bystanderAckIsFresh(s.bystanderNoticeAckAt, Date.now()));
  const [ack, setAck] = useState(countdownAllowed);
  const [consentAck, setConsentAck] = useState(s.consent.granted);
  const [micDenied, setMicDenied] = useState(false);
  const [clipsOn, setClipsOn] = useState(s.clips.enabled);
  const [agreed, setAgreed] = useState(false);
  const [count, setCount] = useState<number | null>(countdownAllowed ? COUNTDOWN : null);
  const started = useRef(false);

  const go = async () => {
    if (started.current) return;
    started.current = true;
    // Just-in-time: consent, the bystander notice and the microphone are all handled here, on the first Record tap.
    const now = new Date().toISOString();
    updateSettings((p) => ({
      ...setOvernightConsent(p, true, now),
      bystanderNoticeAckAt: now,
      clips: p.consent.granted ? p.clips : { ...p.clips, enabled: clipsOn, decidedAt: now },
    }));
    if ((await requestMic()) !== 'granted') {
      started.current = false;
      setCount(null);
      setMicDenied(true);
      return;
    }
    // D8: the start haptic fires BEFORE capture starts, because iOS can suppress haptics once a recording session is active.
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.back();
    await capture.start(s.sleep.wakeMin);
  };

  // First entry: record the choices, ask for the microphone, and close. No recording starts from here.
  const agree = async () => {
    const now = new Date().toISOString();
    updateSettings((p) => ({
      ...setOvernightConsent(p, true, now),
      bystanderNoticeAckAt: now,
      clips: { ...p.clips, enabled: clipsOn, decidedAt: now },
      primerShownVersion: FIRST_ENTRY_PRIMER_VERSION,
    }));
    setAgreed(true);
    if ((await requestMic()) !== 'granted') {
      setMicDenied(true);
      return;
    }
    router.back();
  };
  const notNow = () => {
    updateSettings((p) => ({ ...p, primerShownVersion: FIRST_ENTRY_PRIMER_VERSION }));
    router.back();
  };

  useEffect(() => {
    if (count === null) return;
    if (count <= 0) {
      // Never start capture while the app is not in the foreground.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- starting is the countdown's purpose; go() may set the mic-denied state
      if (AppState.currentState === 'active') void go();
      return;
    }
    const id = setTimeout(() => setCount((c) => (c === null ? c : c - 1)), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  const label = count !== null && count > 0 ? COPY.N30_STARTING_IN(count) : COPY.C.startRecording;
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 16 }} contentInsetAdjustmentBehavior="automatic">
      <SheetHeader title={firstEntry ? AUTO.FIRST_ENTRY_TITLE : COPY.N28_BEFORE_YOU_START} />
      <AppText variant="body" tone="secondary">
        {bystanderNotice(undefined, clipsOn)}
      </AppText>
      {!s.consent.granted || firstEntry ? (
        <View style={{ gap: 12 }}>
          <AppText variant="title3" accessibilityRole="header">
            {privacyTitle()}
          </AppText>
          <InsetGroup>
            {privacyRows(undefined, clipsOn).map((r) => (
              <ListRow key={r.id} title={r.text} leading={<Icon name={r.symbol} size={22} color={colors.accent} />} />
            ))}
          </InsetGroup>
          <AppText variant="footnote" tone="secondary">
            {DISCLAIMER_AUDIO}
          </AppText>
          <InsetGroup footer={[CLIP_TOGGLE_DETAIL, clipBackupNote()].filter(Boolean).join(' ')}>
            <ListRow
              title={CLIP_TOGGLE_TITLE}
              subtitle={CLIP_TOGGLE_BODY}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: clipsOn }}
              leading={<Icon name={clipsOn ? 'checkmark.circle.fill' : 'circle'} size={24} color={colors.accent} />}
              onPress={() => {
                void Haptics.selectionAsync();
                setCount(null);
                setClipsOn((a) => !a);
              }}
              testID="primer-clips-toggle"
            />
          </InsetGroup>
          <InsetGroup>
            <ListRow
              title={COPY.N08_CONSENT}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consentAck }}
              leading={<Icon name={consentAck ? 'checkmark.circle.fill' : 'circle'} size={24} color={colors.accent} />}
              onPress={() => {
                void Haptics.selectionAsync();
                setCount(null);
                setConsentAck((a) => !a);
              }}
            />
          </InsetGroup>
        </View>
      ) : null}
      <InsetGroup>
        <ListRow
          title={COPY.N22_BYSTANDER_ACK}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: ack }}
          leading={<Icon name={ack ? 'checkmark.circle.fill' : 'circle'} size={24} color={colors.accent} />}
          onPress={() => {
            void Haptics.selectionAsync();
            setCount(null);
            setAck((a) => !a);
          }}
        />
      </InsetGroup>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <View style={{ paddingTop: 4 }}>
          <Icon name="circle.fill" size={12} color="#FF9F0A" />
        </View>
        <AppText variant="footnote" tone="secondary" style={{ flex: 1 }}>
          {COPY.N10_ORANGE_DOT}
        </AppText>
      </View>
      {micDenied ? (
        <StateCard tone="missing" icon="mic.slash" title={COPY.N48_MIC_OFF_TITLE} body={COPY.N49_MIC_OFF_BODY} actions={[{ label: COPY.C.openSettings, onPress: openSystemSettings, variant: 'filled' }]} testID="card-mic-denied" />
      ) : null}
      {firstEntry ? (
        <View style={{ gap: 4 }}>
          <PrimaryButton
            label={agreed ? AUTO.FIRST_ENTRY_DONE : AUTO.FIRST_ENTRY_AGREE}
            onPress={() => (agreed ? router.back() : void agree())}
            disabled={!agreed && (!ack || !consentAck)}
            disabledReason="Tick the boxes above to continue."
          />
          {!agreed ? <PrimaryButton label={AUTO.FIRST_ENTRY_NOT_NOW} variant="plain" onPress={notNow} /> : null}
        </View>
      ) : (
      <View style={{ gap: 4 }}>
        <PrimaryButton label={label} onPress={() => void go()} disabled={!ack || !consentAck} disabledReason="Tick the boxes above to enable recording." />
        <PrimaryButton
          label={COPY.C.cancel}
          variant="plain"
          onPress={() => {
            setCount(null);
            router.back();
          }}
        />
      </View>
      )}
    </ScrollView>
  );
}
