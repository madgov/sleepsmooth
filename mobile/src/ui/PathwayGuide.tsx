import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Linking, Platform, Pressable, Share, View } from 'react-native';
import {
  DIFFERENT_HEADING,
  DIFFERENT_INTRO,
  DIFFERENT_POINTS,
  DIFFERENT_SOURCES,
  PATHWAY_HEADING,
  PATHWAY_INTRO,
  PATHWAY_STEPS,
  QUESTIONS_COST_LINE,
  QUESTIONS_HEADING,
  QUESTIONS_LIST,
  QUESTIONS_SOURCE_NOTE,
  REMINDER_DENIED,
  REMINDER_FAILED,
  REMINDER_HEADING,
  REMINDER_NOTE,
  REMINDER_NOTIF_BODY,
  REMINDER_NOTIF_TITLE,
  REMINDER_OFF,
  REMINDER_WEB_NOTE,
  SCOPE_ADULTS,
  SCOPE_CHILDREN,
  SCOPE_HEADING,
  SCOPE_PREGNANCY,
  SCOPE_SOURCES,
  SCRIPT_BASIS_NOTE,
  SCRIPT_BUILT_NOTE,
  SCRIPT_EMPTY_NOTE,
  SCRIPT_HEADING,
  SCRIPT_LABEL,
  SCRIPT_SHARE,
  TRACKER_HEADING,
  TRACKER_ITEMS,
  TRACKER_LABEL,
  TRACKER_NOTE,
  TRACKER_SOURCE,
  TREATMENTS_HEADING,
  TREATMENTS_LABEL,
  TREATMENTS_NOTE,
  TREATMENT_OPTIONS,
  type PathwaySource,
} from '@core/content/pathway';
import { REMINDER_CHOICES, activeReminder, reminderDate, toggleTick } from '@core/mobileLogic/followThrough';
import { buildClinicianScript, scriptToText } from '@core/mobileLogic/pathwayScript';
import { useRealNights } from '../data/nightSource';
import { cancelFollowUpReminder, scheduleFollowUpReminder } from '../platform/reminder';
import { requestNotifs } from '../platform/permissions';
import { updateSettings, useSettings } from '../state/settings';
import { useTheme } from '../theme/useTheme';
import { AppText } from './AppText';
import { Disclosure } from './Disclosure';
import { Icon } from './Icon';
import { InsetGroup, ListRow } from './InsetGroup';
import { PrimaryButton } from './PrimaryButton';
import { Surface } from './Surface';

function Sources({ list }: { list: PathwaySource[] }) {
  return (
    <View style={{ gap: 2 }}>
      {list.map((s) => (
        <Pressable key={s.url} accessibilityRole="link" accessibilityLabel={`Source: ${s.label}`} onPress={() => void Linking.openURL(s.url).catch(() => undefined)} accessibilityHint="Opens in your browser" hitSlop={{ top: 8, bottom: 8 }} style={{ minHeight: 44, justifyContent: 'center' }}>
          <AppText variant="footnote" tone="accent">
            Source: {s.label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

/** Small label shown first inside a section, so "not advice" and "not validated" are read before the detail. */
function Label({ children }: { children: string }) {
  return (
    <AppText variant="subheadline" weight="600">
      {children}
    </AppText>
  );
}

function Para({ children }: { children: string }) {
  return <AppText variant="subheadline">{children}</AppText>;
}

function ScriptSection() {
  const s = useSettings();
  const { status, nights } = useRealNights();
  const [note, setNote] = useState<string | null>(null);
  const built = useMemo(
    () =>
      buildClinicianScript({
        symptoms: s.symptoms,
        redFlag: s.redFlag,
        questionnaireAnswered: Object.keys(s.answers).length > 0,
        recordedNights: status === 'ready' ? nights.length : 0,
        snoreLikeNights: status === 'ready' ? nights.filter((n) => n.view.summary.nightState === 'snore-like-observed').length : 0,
      }),
    [s.symptoms, s.redFlag, s.answers, status, nights],
  );
  const share = async () => {
    setNote(null);
    try {
      await Share.share({ message: scriptToText(built), title: 'What to say to a clinician (suggested, not validated)' });
    } catch {
      setNote(Platform.OS === 'web' ? 'Sharing needs the iPhone app. This web preview cannot open a share sheet. Nothing was sent.' : 'The script could not be shared. Nothing was sent.');
    }
  };
  return (
    <>
      <Label>{SCRIPT_LABEL}</Label>
      <Para>{built.factCount === 0 ? SCRIPT_EMPTY_NOTE : SCRIPT_BUILT_NOTE}</Para>
      <Surface level="L2" source="app-guidance" padding={12} radius="md" testID="clinician-script">
        <View style={{ gap: 8 }}>
          {built.lines.map((l) => (
            <AppText key={l} variant="subheadline" selectable>
              {l}
            </AppText>
          ))}
        </View>
      </Surface>
      <PrimaryButton label={SCRIPT_SHARE} variant="tinted" onPress={share} testID="script-share" />
      {note ? (
        <AppText variant="footnote" tone="secondary" accessibilityLiveRegion="polite">
          {note}
        </AppText>
      ) : null}
      <AppText variant="footnote" tone="secondary">
        {SCRIPT_BASIS_NOTE}
      </AppText>
    </>
  );
}

function TrackerSection() {
  const { colors } = useTheme();
  const s = useSettings();
  const [note, setNote] = useState<string | null>(null);
  const now = new Date();
  const reminder = activeReminder(s.followUpReminderAt, now);

  const toggle = (id: string) => {
    Haptics.selectionAsync().catch(() => undefined);
    updateSettings((cur) => ({ ...cur, nextStepsTicks: toggleTick(cur.nextStepsTicks, id) }));
  };
  const setReminder = async (days: number) => {
    setNote(null);
    if ((await requestNotifs()) !== 'granted') {
      setNote(REMINDER_DENIED);
      return;
    }
    const when = reminderDate(new Date(), days);
    const ok = await scheduleFollowUpReminder(when, REMINDER_NOTIF_TITLE, REMINDER_NOTIF_BODY);
    if (!ok) {
      setNote(REMINDER_FAILED);
      return;
    }
    updateSettings((cur) => ({ ...cur, followUpReminderAt: when.toISOString() }));
  };
  const clearReminder = async () => {
    setNote(null);
    await cancelFollowUpReminder();
    updateSettings((cur) => ({ ...cur, followUpReminderAt: null }));
  };

  return (
    <>
      <Label>{TRACKER_LABEL}</Label>
      <Para>{TRACKER_NOTE}</Para>
      <Sources list={[TRACKER_SOURCE]} />
      <InsetGroup>
        {TRACKER_ITEMS.map((t) => {
          const on = s.nextStepsTicks.includes(t.id);
          return (
            <ListRow
              key={t.id}
              title={t.label}
              leading={<Icon name={on ? 'checkmark.circle.fill' : 'circle'} size={24} color={on ? colors.accent : colors.labelTertiary} />}
              onPress={() => toggle(t.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={t.label}
              testID={`track-${t.id}`}
            />
          );
        })}
      </InsetGroup>
      <Label>{REMINDER_HEADING}</Label>
      {Platform.OS === 'web' ? (
        <Para>{REMINDER_WEB_NOTE}</Para>
      ) : (
        <>
          <Para>{REMINDER_NOTE}</Para>
          {reminder ? (
            <InsetGroup footer={`Reminder set for ${reminder.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}, 9:00 AM.`}>
              <ListRow title={REMINDER_OFF} leading="minus.circle" onPress={clearReminder} accessibilityRole="button" />
            </InsetGroup>
          ) : (
            <InsetGroup>
              {REMINDER_CHOICES.map((c) => (
                <ListRow key={c.id} title={c.label} leading="bell" onPress={() => void setReminder(c.days)} accessibilityRole="button" accessibilityLabel={`Remind me ${c.label.toLowerCase()}`} />
              ))}
            </InsetGroup>
          )}
          {note ? (
            <AppText variant="footnote" tone="secondary" accessibilityLiveRegion="polite">
              {note}
            </AppText>
          ) : null}
        </>
      )}
    </>
  );
}

/** Pathway guide: one heading line per section, detail behind a tap. */
export function PathwayGuide() {
  return (
    <Surface level="L2" padding={0} radius="lg" testID="pathway-guide">
      <Disclosure title={PATHWAY_HEADING}>
        <Para>{PATHWAY_INTRO}</Para>
        {PATHWAY_STEPS.map((p) => (
          <View key={p.id} style={{ gap: 4, marginTop: 4 }}>
            <AppText variant="subheadline" weight="600">
              {p.title}
            </AppText>
            <Para>{p.body}</Para>
            {p.source ? <Sources list={[p.source]} /> : null}
          </View>
        ))}
      </Disclosure>
      <Divider />
      <Disclosure title={TREATMENTS_HEADING}>
        <Label>{TREATMENTS_LABEL}</Label>
        <Para>{TREATMENTS_NOTE}</Para>
        {TREATMENT_OPTIONS.map((t) => (
          <View key={t.id} style={{ gap: 4, marginTop: 4 }}>
            <AppText variant="subheadline" weight="600">
              {t.name}
            </AppText>
            <Para>{t.body}</Para>
            <Sources list={[t.source]} />
          </View>
        ))}
      </Disclosure>
      <Divider />
      <Disclosure title={QUESTIONS_HEADING}>
        {QUESTIONS_LIST.map((q) => (
          <Para key={q}>{`• ${q}`}</Para>
        ))}
        <Label>{QUESTIONS_COST_LINE}</Label>
        <AppText variant="footnote" tone="secondary">
          {QUESTIONS_SOURCE_NOTE}
        </AppText>
      </Disclosure>
      <Divider />
      <Disclosure title={SCRIPT_HEADING}>
        <ScriptSection />
      </Disclosure>
      <Divider />
      <Disclosure title={TRACKER_HEADING}>
        <TrackerSection />
      </Disclosure>
      <Divider />
      <Disclosure title={SCOPE_HEADING}>
        <Para>{SCOPE_ADULTS}</Para>
        <Para>{SCOPE_CHILDREN}</Para>
        <Para>{SCOPE_PREGNANCY}</Para>
        <Sources list={SCOPE_SOURCES} />
      </Disclosure>
      <Divider />
      <Disclosure title={DIFFERENT_HEADING}>
        <Para>{DIFFERENT_INTRO}</Para>
        {DIFFERENT_POINTS.map((p) => (
          <Para key={p}>{`• ${p}`}</Para>
        ))}
        <Sources list={DIFFERENT_SOURCES} />
      </Disclosure>
    </Surface>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: 0.5, backgroundColor: colors.separator, marginLeft: 16 }} />;
}
