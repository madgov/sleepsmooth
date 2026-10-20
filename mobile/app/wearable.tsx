import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { WEARABLE_EMPTY, WEARABLE_METRIC_LABELS, WEARABLE_NEUTRAL_LINE, WEARABLE_OPTIONAL_NOTE, WEARABLE_SOURCE_LABEL, WEARABLE_SOURCE_PLACEHOLDER, WEARABLE_TITLE, WEARABLE_UNITS_NOTE } from '@core/content/wearable';
import type { WearableMetric, WearableObservation } from '@core/types/wearable';
import {
  METRIC_SPEC,
  WEARABLE_METRICS,
  addObservations,
  draftFromObservation,
  emptyWearableDraft,
  observationLine,
  removeObservation,
  replaceObservation,
  validateDraft,
  validateEdit,
  type WearableDraft,
  type WearableErrors,
  localDateISO,
} from '@core/wearable/entries';
import { COPY } from '../src/content/copy';
import { updateSettings, useSettings } from '../src/state/settings';
import { AppText } from '../src/ui/AppText';
import { confirmAction } from '../src/ui/confirm';
import { InsetGroup, ListRow } from '../src/ui/InsetGroup';
import { PrimaryButton } from '../src/ui/PrimaryButton';
import { Screen } from '../src/ui/Screen';
import { BackBar } from '../src/ui/ScreenHeader';
import { TextField } from '../src/ui/TextField';

const todayISO = () => localDateISO(new Date());
const unitText = (m: WearableMetric) => (m === 'spo2-lowest' || m === 'spo2-average' ? 'percent' : m === 'resting-hr' ? 'beats per minute' : m === 'sleep-duration' ? 'hours' : 'number your device app shows');

/** Typed-in wearable numbers: add, edit, delete. Nothing is scored, coloured or interpreted. */
export default function Wearable() {
  const s = useSettings();
  const [draft, setDraft] = useState<WearableDraft>(emptyWearableDraft());
  const [editing, setEditing] = useState<WearableObservation | null>(null);
  const [errors, setErrors] = useState<WearableErrors>({});
  const [saved, setSaved] = useState(false);
  const entries = useMemo(() => [...s.wearable].sort((a, b) => b.timestamp.localeCompare(a.timestamp)), [s.wearable]);
  const metrics = editing ? [editing.metric] : WEARABLE_METRICS;
  const showLabel = metrics.includes('breathing-disturbances');

  const set = (patch: Partial<WearableDraft>) => {
    setSaved(false);
    setDraft((d) => ({ ...d, ...patch }));
  };
  const setValue = (m: WearableMetric, v: string) => set({ values: { ...draft.values, [m]: v } });
  const reset = () => {
    setDraft(emptyWearableDraft());
    setEditing(null);
    setErrors({});
  };

  const save = () => {
    const now = new Date().toISOString();
    if (editing) {
      const r = validateEdit(editing, draft, todayISO());
      if (!r.ok) return setErrors(r.errors);
      updateSettings((p) => ({ ...p, wearable: replaceObservation(p.wearable, r.observation) }));
    } else {
      const r = validateDraft(draft, now);
      if (!r.ok) return setErrors(r.errors);
      updateSettings((p) => ({ ...p, wearable: addObservations(p.wearable, r.observations) }));
    }
    reset();
    setSaved(true);
  };
  const edit = (o: WearableObservation) => {
    setEditing(o);
    setDraft(draftFromObservation(o));
    setErrors({});
    setSaved(false);
  };
  const remove = (o: WearableObservation) =>
    confirmAction({
      title: 'Delete this reading?',
      message: `${observationLine(o)}. It is removed from this iPhone and from any new summary.`,
      confirmLabel: COPY.C.delete,
      cancelLabel: COPY.C.cancel,
      destructive: true,
      onConfirm: () => {
        updateSettings((p) => ({ ...p, wearable: removeObservation(p.wearable, o.id) }));
        if (editing?.id === o.id) reset();
      },
    });

  return (
    <Screen variant="app" top={<BackBar title={WEARABLE_TITLE} />} gap={20} testID="screen-wearable">
      <>
        <View style={{ gap: 8, paddingHorizontal: 16 }}>
          <AppText variant="subheadline" weight="600" testID="wearable-source-label">
            {WEARABLE_SOURCE_LABEL}
          </AppText>
          <AppText variant="subheadline" tone="secondary">
            {WEARABLE_NEUTRAL_LINE}
          </AppText>
        </View>

        <View style={{ gap: 14, paddingHorizontal: 16 }}>
          <AppText variant="title3" accessibilityRole="header">
            {editing ? `Edit: ${WEARABLE_METRIC_LABELS[editing.metric]}` : 'Add readings'}
          </AppText>
          <AppText variant="footnote" tone="secondary">
            {WEARABLE_OPTIONAL_NOTE}
          </AppText>
          <TextField label="Device or app" value={draft.source} onChange={(t) => set({ source: t })} placeholder={WEARABLE_SOURCE_PLACEHOLDER} maxLength={80} error={errors.source} testID="wearable-source" />
          <TextField label="Night it is about" unit="YYYY-MM-DD" value={draft.forDate} onChange={(t) => set({ forDate: t })} placeholder="Optional" keyboardType="numbers-and-punctuation" maxLength={10} error={errors.forDate} testID="wearable-date" />
          {metrics.map((m) => (
            <TextField
              key={m}
              label={WEARABLE_METRIC_LABELS[m]}
              unit={m === 'breathing-disturbances' ? undefined : METRIC_SPEC[m].unit === 'bpm' ? 'bpm' : METRIC_SPEC[m].unit}
              hint={`Optional. ${unitText(m)}.`}
              value={draft.values[m] ?? ''}
              onChange={(t) => setValue(m, t)}
              placeholder="Optional"
              keyboardType="decimal-pad"
              maxLength={7}
              error={errors[m]}
              testID={`wearable-${m}`}
            />
          ))}
          {showLabel ? <TextField label="Name your device app uses for it" value={draft.deviceLabel} onChange={(t) => set({ deviceLabel: t })} placeholder="Optional, as written in the app" maxLength={80} error={errors.deviceLabel} testID="wearable-device-label" /> : null}
          <AppText variant="footnote" tone="secondary">
            {WEARABLE_UNITS_NOTE}
          </AppText>
          {errors.form ? (
            <AppText variant="footnote" tone="destructive" accessibilityLiveRegion="polite">
              {errors.form}
            </AppText>
          ) : null}
          {saved ? (
            <AppText variant="footnote" tone="secondary" accessibilityLiveRegion="polite">
              Saved on this iPhone.
            </AppText>
          ) : null}
          <PrimaryButton label={editing ? 'Save changes' : 'Add readings'} onPress={save} testID="wearable-save" />
          {editing ? <PrimaryButton label="Cancel" variant="plain" onPress={reset} /> : null}
          {editing ? <PrimaryButton label="Delete this reading" variant="destructive" onPress={() => remove(editing)} testID="wearable-delete" /> : null}
        </View>

        <InsetGroup header="Your readings" footer={entries.length === 0 ? WEARABLE_EMPTY : 'Tap a reading to edit or delete it.'}>
          {entries.map((o) => (
            <ListRow
              key={o.id}
              title={WEARABLE_METRIC_LABELS[o.metric]}
              value={o.metric === 'breathing-disturbances' ? String(o.value) : o.unit === '%' ? `${o.value}%` : `${o.value} ${o.unit}`}
              subtitle={[o.source || 'Device not named', o.forDate ? `night of ${o.forDate}` : null, o.metric === 'breathing-disturbances' && o.deviceLabel ? `"${o.deviceLabel}"` : null].filter(Boolean).join(', ')}
              accessibilityLabel={`${observationLine(o)}. Tap to edit.`}
              leading="heart.text.square"
              trailing="chevron"
              onPress={() => edit(o)}
              testID={`wearable-row-${o.id}`}
            />
          ))}
        </InsetGroup>
        <AppText variant="footnote" tone="secondary" style={{ paddingHorizontal: 16 }}>
          {WEARABLE_NEUTRAL_LINE}
        </AppText>
      </>
    </Screen>
  );
}
