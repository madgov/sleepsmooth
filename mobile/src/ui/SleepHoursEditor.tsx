import { useState } from 'react';
import { Switch, View } from 'react-native';
import { formatClock, formatDuration, minutesInBed } from '@core/mobileLogic/index';
import { COPY } from '../content/copy';
import { requestNotifs } from '../platform/permissions';
import { cancelBedtimeReminder, scheduleBedtimeReminder } from '../platform/reminder';
import { updateSettings, useSettings } from '../state/settings';
import { useTheme } from '../theme/useTheme';
import { AppText } from './AppText';
import { InsetGroup, ListRow } from './InsetGroup';
import { TimeWheel } from './TimeWheel';

/** Bedtime, wake time (native time wheel, inline) and the optional bedtime reminder. Shared by onboarding and Settings. */
export function SleepHoursEditor() {
  const s = useSettings();
  const { colors } = useTheme();
  const [open, setOpen] = useState<'bed' | 'wake' | null>(null);
  const [notifNote, setNotifNote] = useState(false);
  const [saveErr, setSaveErr] = useState(false);
  const { bedMin, wakeMin, userSet, reminder } = s.sleep;
  const setMinutes = (kind: 'bed' | 'wake', m: number) => {
    updateSettings((p) => ({ ...p, sleep: { ...p.sleep, [kind === 'bed' ? 'bedMin' : 'wakeMin']: m, userSet: true } }));
    if (kind === 'bed' && reminder) void scheduleBedtimeReminder(m).then((ok) => setSaveErr(!ok));
  };
  const toggleReminder = async (on: boolean) => {
    setNotifNote(false);
    if (!on) {
      updateSettings((p) => ({ ...p, sleep: { ...p.sleep, reminder: false } }));
      await cancelBedtimeReminder();
      return;
    }
    const st = await requestNotifs();
    if (st !== 'granted') {
      setNotifNote(true);
      updateSettings((p) => ({ ...p, sleep: { ...p.sleep, reminder: false } }));
      return;
    }
    const ok = await scheduleBedtimeReminder(bedMin);
    setSaveErr(!ok);
    updateSettings((p) => ({ ...p, sleep: { ...p.sleep, reminder: ok } }));
  };
  const suggested = userSet ? undefined : COPY.C.suggested;
  return (
    <View style={{ gap: 16 }}>
      <InsetGroup footer={COPY.N14_IN_BED(formatDuration(minutesInBed(bedMin, wakeMin)))}>
        <ListRow title="Bedtime" subtitle={suggested} value={formatClock(bedMin)} accessibilityLabel={`Bedtime, ${formatClock(bedMin)}`} accessibilityHint="Shows a time picker" accessibilityState={{ expanded: open === 'bed' }} onPress={() => setOpen(open === 'bed' ? null : 'bed')} trailing="chevronUpDown" />
        {open === 'bed' ? (
          <TimeWheel label="Bedtime" minutes={bedMin} onChange={(m) => setMinutes('bed', m)} />
        ) : null}
        <ListRow title="Wake time" subtitle={suggested} value={formatClock(wakeMin)} accessibilityLabel={`Wake time, ${formatClock(wakeMin)}`} accessibilityHint="Shows a time picker" accessibilityState={{ expanded: open === 'wake' }} onPress={() => setOpen(open === 'wake' ? null : 'wake')} trailing="chevronUpDown" />
        {open === 'wake' ? (
          <TimeWheel label="Wake time" minutes={wakeMin} onChange={(m) => setMinutes('wake', m)} />
        ) : null}
      </InsetGroup>
      <InsetGroup footer={notifNote ? COPY.N16_NOTIFS_OFF : COPY.N15_REMINDER_NOTE}>
        <ListRow
          title="Remind me at bedtime"
          leading="bell"
          trailing={<Switch value={reminder} onValueChange={(v) => void toggleReminder(v)} trackColor={{ false: colors.switchOff, true: colors.accent }} ios_backgroundColor={colors.switchOff} accessibilityLabel="Remind me at bedtime" />}
        />
      </InsetGroup>
      {saveErr ? (
        <AppText variant="footnote" tone="destructive" accessibilityLiveRegion="polite">
          {COPY.C.couldNotSave}
        </AppText>
      ) : null}
    </View>
  );
}

