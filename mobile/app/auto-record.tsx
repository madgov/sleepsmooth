import * as Haptics from 'expo-haptics';
import { useSafeRouter } from '../src/nav/useSafeRouter';

import { useState } from 'react';
import { Linking, Platform, ScrollView, View } from 'react-native';
import { autoRecordRowValue, outcomeNote } from '@core/mobileLogic/autoRecord';
import { AUTO } from '../src/content/copy';
import { updateSettings, useSettings } from '../src/state/settings';
import { useTheme } from '../src/theme/useTheme';
import { AppText } from '../src/ui/AppText';
import { Icon } from '../src/ui/Icon';
import { InsetGroup, ListRow } from '../src/ui/InsetGroup';
import { PrimaryButton } from '../src/ui/PrimaryButton';
import { SheetHeader } from '../src/ui/SheetHeader';
import { ShortcutsMock } from '../src/ui/ShortcutsMock';
import { SourceBadge } from '../src/ui/SourceBadge';
import { Surface } from '../src/ui/Surface';

const STEPS = [
  { n: 1 as const, title: AUTO.STEP1_TITLE, body: AUTO.STEP1_BODY },
  { n: 2 as const, title: AUTO.STEP2_TITLE, body: AUTO.STEP2_BODY },
  { n: 3 as const, title: AUTO.STEP3_TITLE, body: AUTO.STEP3_BODY },
];

/** The 3-step guide for making the Shortcuts automation. iOS only lets the user create it, so this app cannot. */
export default function AutoRecordGuide() {
  const router = useSafeRouter();
  const { colors } = useTheme();
  const s = useSettings();
  const [ack, setAck] = useState(s.autoRecord.standingAckAt !== null);
  const [stopDone, setStopDone] = useState(s.autoRecord.stopMarkedDone);
  const [openFailed, setOpenFailed] = useState(false);
  const note = outcomeNote(s.autoRecord.lastOutcome);

  const openShortcuts = async () => {
    setOpenFailed(false);
    if (Platform.OS === 'web') {
      // A browser cannot open the iOS Shortcuts app; say so instead of doing nothing.
      setOpenFailed(true);
      return;
    }
    try {
      await Linking.openURL('shortcuts://');
    } catch {
      setOpenFailed(true);
    }
  };
  const done = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const now = new Date().toISOString();
    updateSettings((p) => ({
      ...p,
      autoRecord: { ...p.autoRecord, decision: 'setup-marked', decidedAt: p.autoRecord.decidedAt ?? now, markedDoneAt: now, stopMarkedDone: stopDone, standingAckAt: p.autoRecord.standingAckAt ?? now },
    }));
    router.back();
  };
  const notUsing = () => {
    updateSettings((p) => ({ ...p, autoRecord: { ...p.autoRecord, decision: 'declined', decidedAt: new Date().toISOString(), markedDoneAt: null, standingAckAt: null } }));
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28, gap: 16 }} contentInsetAdjustmentBehavior="automatic" testID="auto-record-guide">
      <SheetHeader title={AUTO.GUIDE_TITLE} onClose={() => router.back()} />
      <AppText variant="body" tone="secondary">
        {AUTO.GUIDE_INTRO}
      </AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <AppText variant="subheadline" weight="600">{autoRecordRowValue(s.autoRecord)}</AppText>
      </View>
      {note ? (
        <AppText variant="footnote" tone="secondary" accessibilityLiveRegion="polite">
          {note}
        </AppText>
      ) : null}

      {STEPS.map((st) => (
        <Surface key={st.n} radius="xl" padding={16} testID={`auto-step-${st.n}`}>
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accentFill, alignItems: 'center', justifyContent: 'center' }}>
                <AppText variant="subheadline" weight="700" tone="accent" tabular>{String(st.n)}</AppText>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <AppText variant="headline" accessibilityRole="header">{st.title}</AppText>
                <AppText variant="subheadline" tone="secondary">{st.body}</AppText>
              </View>
            </View>
            <ShortcutsMock step={st.n} />
          </View>
        </Surface>
      ))}
      <AppText variant="caption1" tone="secondary">
        The pictures are simple illustrations, not screenshots. Menu names can differ a little between iOS versions.
      </AppText>

      <PrimaryButton label={AUTO.OPEN_SHORTCUTS} variant="tinted" onPress={() => void openShortcuts()} testID="open-shortcuts" />
      {openFailed ? (
        <AppText variant="footnote" tone="destructive" accessibilityLiveRegion="polite">
          Shortcuts could not be opened from here. Open the Shortcuts app yourself.
        </AppText>
      ) : null}

      <InsetGroup header={AUTO.STOP_TITLE} footer={AUTO.STOP_BODY}>
        <ListRow
          title="I also made a stop automation"
          accessibilityRole="checkbox"
          accessibilityState={{ checked: stopDone }}
          leading={<Icon name={stopDone ? 'checkmark.circle.fill' : 'circle'} size={24} color={colors.accent} />}
          onPress={() => {
            void Haptics.selectionAsync();
            setStopDone((v) => !v);
          }}
        />
      </InsetGroup>

      <InsetGroup>
        <ListRow
          title={AUTO.STANDING_ACK}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: ack }}
          leading={<Icon name={ack ? 'checkmark.circle.fill' : 'circle'} size={24} color={colors.accent} />}
          onPress={() => {
            void Haptics.selectionAsync();
            setAck((v) => !v);
          }}
          testID="auto-ack"
        />
      </InsetGroup>

      <View style={{ gap: 6 }}>
        <SourceBadge kind="app-guidance" size="compact" />
        <AppText variant="footnote" tone="secondary">{AUTO.NOT_SEEN}</AppText>
        <AppText variant="footnote" tone="secondary">{AUTO.BACKGROUND_LIMIT}</AppText>
        {!s.consent.granted ? <AppText variant="footnote" tone="secondary">{AUTO.RECORD_NEEDS_CONSENT}</AppText> : null}
      </View>

      <View style={{ gap: 4 }}>
        <PrimaryButton label={AUTO.DONE} onPress={done} disabled={!ack} disabledReason="Tick the box above first." testID="auto-done" />
        {s.autoRecord.decision === 'setup-marked' ? <PrimaryButton label="I removed the automation" variant="plain" onPress={notUsing} /> : <PrimaryButton label={AUTO.CARD_NOT_NOW} variant="plain" onPress={() => router.back()} />}
      </View>
    </ScrollView>
  );
}
