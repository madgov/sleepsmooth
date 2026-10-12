import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Switch, View } from 'react-native';
import {
  CLIP_DELETE_ALL,
  CLIP_DELETE_ALL_CONFIRM,
  CLIP_RETENTION_TITLE,
  CLIP_TOGGLE_BODY,
  CLIP_TOGGLE_DETAIL,
  CLIP_TOGGLE_TITLE,
  DELETE_DATA_LABEL,
  FOOTER_TEXT,
  MODEL_CARD_TITLE,
  SOURCES_TITLE,
} from '@core/content/claims';
import { autoRecordRowValue, outcomeNote } from '@core/mobileLogic/autoRecord';
import { RETENTION_OPTIONS, estimateStorageBytes, formatBytes } from '@core/mobileLogic/clips';
import { clearClipTemp, deleteAllClips } from '../../src/clips/clipFiles';
import { IS_EXPO_GO } from '../../src/native/runtime';
import { NeuSegmented } from '../../src/ui/NeuSegmented';
import { captureController } from '../../src/capture/controller';
import { AUTO, clipBackupNote, COPY } from '../../src/content/copy';
import { getNightStore } from '../../src/data/nightStoreInstance';
import { cancelBedtimeReminder } from '../../src/platform/reminder';
import { deleteAllSettings, updateSettings, useSettings } from '../../src/state/settings';
import { useTheme } from '../../src/theme/useTheme';
import { AppText } from '../../src/ui/AppText';
import { Icon, type SymbolName } from '../../src/ui/Icon';
import { IconTile } from '../../src/ui/IconTile';
import { Chip } from '../../src/ui/Chip';
import { GroupHeader, InsetGroup, ListRow } from '../../src/ui/InsetGroup';
import { Screen, Stagger } from '../../src/ui/Screen';
import { ScreenHeader } from '../../src/ui/ScreenHeader';
import { MORNING_ALWAYS_ASK_BODY, MORNING_ALWAYS_ASK_TITLE, MORNING_ROW_FOOTER, MORNING_ROW_TITLE, HEALTH_CONNECT, HEALTH_PURPOSE, HEALTH_UNAVAILABLE_BODY, HEALTH_DISCONNECT_NOTE } from '@core/content/claims';
import { morningRowValue, setPreference } from '@core/mobileLogic/morningLearning';
import { connectHealth, healthStatus } from '../../src/health';
import { HealthRowView } from '../../src/ui/HealthParts';
import { RoutineCard } from '../../src/ui/RoutineCardConnected';
import { SleepHoursEditor } from '../../src/ui/SleepHoursEditor';

const tile = (name: SymbolName) => <IconTile name={name} size={30} />;

export default function Settings() {
  const router = useRouter();
  const s = useSettings();
  const { colors } = useTheme();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const [clipsDeleted, setClipsDeleted] = useState<number | null>(null);

  const doDelete = async () => {
    setDeleting(true);
    setDeleteError(false);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await captureController.discardAll();
    await cancelBedtimeReminder();
    // Every night, epoch log and manifest, then the settings file.
    let storeOk = true;
    try {
      getNightStore().removeAll(); // clips live inside each night's folder, so they go with it
      clearClipTemp();
    } catch {
      storeOk = false;
    }
    const ok = deleteAllSettings() && storeOk;
    setDeleting(false);
    if (!ok) {
      setDeleteError(true);
      return;
    }
    router.dismissAll();
    router.replace('/intro');
  };
  const confirmDelete = () =>
    Alert.alert(DELETE_DATA_LABEL, COPY.N75_DELETE_CONFIRM, [
      { text: COPY.C.cancel, style: 'cancel' },
      { text: COPY.C.delete, style: 'destructive', onPress: () => void doDelete() },
    ]);
  const withdraw = () =>
    Alert.alert(COPY.N74_WITHDRAW, 'Recording stops and no new nights can be started. You can choose to delete your data.', [
      { text: COPY.C.cancel, style: 'cancel' },
      {
        text: COPY.N74_WITHDRAW,
        style: 'destructive',
        onPress: () => {
          void captureController.stop().catch(() => undefined);
          updateSettings((p) => ({ ...p, consent: { ...p.consent, granted: false, at: new Date().toISOString() } }));
        },
      },
    ]);

  const confirmDeleteClips = () =>
    Alert.alert(CLIP_DELETE_ALL, CLIP_DELETE_ALL_CONFIRM, [
      { text: COPY.C.cancel, style: 'cancel' },
      {
        text: COPY.C.delete,
        style: 'destructive',
        onPress: () => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setClipsDeleted(deleteAllClips());
        },
      },
    ]);
  const setClips = (patch: Partial<typeof s.clips>) => updateSettings((p) => ({ ...p, clips: { ...p.clips, ...patch, decidedAt: new Date().toISOString() } }));
  const showAuto = Platform.OS !== 'android' && !IS_EXPO_GO;
  const hStatus = healthStatus(s.health.requestedAt);
  const connectWithPurpose = () =>
    Alert.alert(HEALTH_CONNECT, HEALTH_PURPOSE, [
      { text: COPY.C.cancel, style: 'cancel' },
      { text: HEALTH_CONNECT, onPress: () => void connectHealth() },
    ]);
  const autoNote = outcomeNote(s.autoRecord.lastOutcome);

  return (
    <Screen tab testID="screen-settings" gap={22}>
      <Stagger i={0}>
        <ScreenHeader title="Settings" subtitle="Everything stays on this iPhone." />
      </Stagger>

      <Stagger i={1} style={{ gap: 8 }}>
        <GroupHeader>Sleep hours and reminder</GroupHeader>
        <SleepHoursEditor />
      </Stagger>

      <Stagger i={2}>
        <InsetGroup header="Your answers">
          <ListRow
            title="Retake the questionnaire"
            subtitle="NoSAS, symptoms and warning signs"
            accessibilityLabel={`Retake the questionnaire. NoSAS, symptoms and warning signs. ${s.questionnaireSavedAt ? 'Answered' : 'Not done'}`}
            below={<Chip label={s.questionnaireSavedAt ? 'Answered' : 'Not done'} icon={s.questionnaireSavedAt ? 'checkmark.circle' : 'circle.dashed'} tone={s.questionnaireSavedAt ? 'info' : 'missing'} />}
            leading={tile('list.clipboard')}
            trailing="chevron"
            onPress={() => router.push('/questionnaire?from=settings')}
          />
        </InsetGroup>
      </Stagger>

      <Stagger i={3}>
        <InsetGroup header="For your clinician">
          <ListRow title="Summary to discuss" subtitle="Share as text or PDF. Not a diagnosis." leading={tile('doc.text')} trailing="chevron" onPress={() => router.push('/summary')} />
          <ListRow title="Next steps" subtitle="A checklist for seeking an evaluation" leading={tile('checklist')} trailing="chevron" onPress={() => router.push('/next-steps')} />
        </InsetGroup>
      </Stagger>

      {showAuto ? (
        <Stagger i={3} style={{ gap: 8 }}>
          <InsetGroup header="Morning" footer={MORNING_ROW_FOOTER}>
            <ListRow title={MORNING_ROW_TITLE} value={morningRowValue(s.morning)} leading={tile('sunrise.fill')} testID="row-morning-stop" />
            <ListRow
              title={MORNING_ALWAYS_ASK_TITLE}
              subtitle={MORNING_ALWAYS_ASK_BODY}
              leading={tile('hand.raised')}
              trailing={
                <Switch
                  value={s.morning.preference === 'always-ask'}
                  onValueChange={(on) => updateSettings((p) => ({ ...p, morning: setPreference(p.morning, on ? 'always-ask' : 'learn') }))}
                  accessibilityLabel={MORNING_ALWAYS_ASK_TITLE}
                  testID="switch-always-ask"
                />
              }
            />
          </InsetGroup>
        </Stagger>
      ) : null}

      <Stagger i={3} style={{ gap: 8 }}>
        <RoutineCard where="settings" />
        <InsetGroup header="Apple Health" footer={hStatus === 'connected' ? HEALTH_DISCONNECT_NOTE : hStatus === 'unavailable' ? HEALTH_UNAVAILABLE_BODY : HEALTH_PURPOSE}>
          <HealthRowView status={hStatus} lastReadIso={s.health.lastReadAt} onConnect={connectWithPurpose} />
        </InsetGroup>
      </Stagger>

      {showAuto ? (
        <Stagger i={3} style={{ gap: 8 }}>
          <InsetGroup header="Bedtime" footer={autoNote ?? undefined}>
            <ListRow
              title={AUTO.ROW_TITLE}
              value={autoRecordRowValue(s.autoRecord)}
              leading={tile('moon.stars')}
              trailing="chevron"
              onPress={() => router.push('/auto-record')}
              testID="row-auto-record"
            />
          </InsetGroup>
        </Stagger>
      ) : null}

      <Stagger i={4} style={{ gap: 8 }}>
        <InsetGroup header="Sound clips" footer={[CLIP_TOGGLE_DETAIL, clipBackupNote()].filter(Boolean).join(' ')}>
          <ListRow
            title={CLIP_TOGGLE_TITLE}
            subtitle={CLIP_TOGGLE_BODY}
            leading={tile('waveform')}
            trailing={<Switch value={s.clips.enabled} onValueChange={(v) => setClips({ enabled: v })} trackColor={{ false: colors.switchOff, true: colors.accent }} ios_backgroundColor={colors.switchOff} accessibilityLabel={CLIP_TOGGLE_TITLE} />}
            testID="settings-clips-toggle"
          />
          <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}>
            <AppText variant="subheadline" tone="secondary">{`${CLIP_RETENTION_TITLE} (up to ${formatBytes(estimateStorageBytes(s.clips.retentionDays))} in the worst case)`}</AppText>
            <NeuSegmented
              values={RETENTION_OPTIONS.map((d) => `${d} days`)}
              selectedIndex={Math.max(0, RETENTION_OPTIONS.indexOf(s.clips.retentionDays))}
              onChange={(i) => setClips({ retentionDays: RETENTION_OPTIONS[i] as (typeof RETENTION_OPTIONS)[number] })}
              accessibilityLabel={CLIP_RETENTION_TITLE}
              testID="settings-clips-retention"
            />
          </View>
          <ListRow title={CLIP_DELETE_ALL} destructive leading="trash" onPress={confirmDeleteClips} testID="settings-clips-delete" />
        </InsetGroup>
        {clipsDeleted !== null ? (
          <AppText variant="footnote" tone="secondary" accessibilityLiveRegion="polite" style={{ paddingHorizontal: 16 }}>
            {clipsDeleted === 0 ? 'There were no saved clips.' : 'Saved clips were deleted. The nights are kept.'}
          </AppText>
        ) : null}
      </Stagger>

      <Stagger i={4} style={{ gap: 8 }}>
        <InsetGroup header="Privacy">
          <ListRow title={COPY.N73_CONSENT_ROW} value={s.consent.granted ? COPY.C.on : COPY.C.off} leading={tile('lock.shield')} />
          {s.consent.granted ? <ListRow title={COPY.N74_WITHDRAW} destructive onPress={withdraw} /> : <ListRow title="Review and agree" leading={tile('checkmark.circle')} trailing="chevron" onPress={() => router.push('/consent')} />}
          <ListRow
            title={DELETE_DATA_LABEL}
            destructive
            leading={
              <View style={{ width: 30, height: 30, borderRadius: 10, borderCurve: 'continuous', backgroundColor: colors.error.bg, borderWidth: 1, borderColor: colors.error.border, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="trash" size={15} color={colors.destructive} weight="semibold" />
              </View>
            }
            trailing={deleting ? <ActivityIndicator color={colors.destructive} /> : undefined}
            onPress={deleting ? undefined : confirmDelete}
            testID="delete-data"
          />
        </InsetGroup>
        {deleteError ? (
          <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16 }}>
            <AppText variant="footnote" tone="destructive" accessibilityLiveRegion="polite" style={{ flex: 1 }}>
              {COPY.N76_DELETE_ERROR}
            </AppText>
            <AppText variant="footnote" tone="accent" accessibilityRole="button" onPress={() => void doDelete()}>
              {COPY.C.retry}
            </AppText>
          </View>
        ) : null}
      </Stagger>

      <Stagger i={5}>
        <InsetGroup header="About">
          <ListRow title={SOURCES_TITLE} leading={tile('link')} trailing="chevron" onPress={() => router.push('/sources')} />
          <ListRow title={MODEL_CARD_TITLE} leading={tile('waveform')} trailing="chevron" onPress={() => router.push('/model-card')} />
          <ListRow title="About SleepSmooth" subtitle="Informational only. It cannot confirm or rule out sleep apnea." leading={tile('info.circle')} />
          {__DEV__ || process.env.EXPO_PUBLIC_DEVICE_LAB === '1' ? <ListRow title="Developer: device lab" trailing="chevron" leading={tile('wrench.and.screwdriver')} onPress={() => router.push('/(dev)/lab')} /> : null}
          {__DEV__ ? <ListRow title="Developer: gallery" trailing="chevron" leading={tile('square.grid.2x2')} onPress={() => router.push('/(dev)/gallery')} /> : null}
        </InsetGroup>
      </Stagger>

      <AppText variant="footnote" tone="secondary" center>
        {FOOTER_TEXT}
      </AppText>
    </Screen>
  );
}
