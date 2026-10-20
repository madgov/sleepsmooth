import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { SUMMARY_EDITED_MARKER } from '@core/content/claims';
import { checkEditText, splitSectionText } from '@core/mobileLogic/summaryEdits';
import { useTheme } from '../theme/useTheme';
import { AppText } from './AppText';
import { Chip } from './Chip';
import { confirmAction } from './confirm';
import { Disclosure } from './Disclosure';
import { Surface } from './Surface';

/** Sections whose long lists are folded behind a Disclosure. Screening, audio, nights and limits always stay fully visible (labels, caveats, sources). */
const FOLDABLE = new Set(['reported', 'discuss', 'guidance', 'questions']);

/** A 44 pt text action. */
function TextAction({ label, onPress, destructive, disabled, testID }: { label: string; onPress: () => void; destructive?: boolean; disabled?: boolean; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({ minHeight: 44, minWidth: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 12, opacity: disabled ? 0.45 : 1, backgroundColor: pressed ? colors.fill : 'transparent' })}
    >
      <AppText variant="body" weight="600" tone={destructive ? 'destructive' : 'accent'}>
        {label}
      </AppText>
    </Pressable>
  );
}

export interface SummarySectionEditorProps {
  id: string;
  /** Section title as generated (without the "Edited by you" suffix). */
  title: string;
  /** Text to show now: the generated text, or the user's edit merged with the locked lines. */
  text: string;
  /** True when the user has edited this section. */
  edited: boolean;
  /** True when the edited section's generated text has changed since the edit. */
  stale: boolean;
  onSave: (id: string, bodyText: string) => void;
  onReset: (id: string) => void;
}

export function SummarySectionEditor({ id, title, text, edited, stale, onSave, onReset }: SummarySectionEditorProps) {
  const { colors } = useTheme();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const parts = splitSectionText(text);
  const check = checkEditText(draft);
  const locked = [...parts.head, ...parts.tail];

  const start = () => {
    setDraft(splitSectionText(text).body);
    setEditing(true);
  };
  const revert = () => {
    setDraft(splitSectionText(text).body);
    setEditing(false);
  };
  const save = () => {
    if (!check.ok) return;
    onSave(id, draft);
    setEditing(false);
  };
  const reset = () =>
    confirmAction({
      title: 'Reset to generated?',
      message: 'Your edits to this section will be replaced with the version made from your answers.',
      confirmLabel: 'Reset to generated',
      destructive: true,
      onConfirm: () => {
        onReset(id);
        setEditing(false);
      },
    });

  const lines = text.split('\n');
  const fold = !edited && FOLDABLE.has(id) && lines.length > 2;

  return (
    <Surface padding={0} testID={`summary-section-${id}`}>
      <View style={{ gap: 6, padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <AppText variant="headline" accessibilityRole="header" style={{ flexShrink: 1 }}>
            {title}
          </AppText>
          {edited ? <Chip label={SUMMARY_EDITED_MARKER} icon="pencil" tone="sample" testID={`summary-edited-${id}`} /> : null}
        </View>

        {editing ? (
          <View style={{ gap: 8 }}>
            <TextInput
              testID={`summary-input-${id}`}
              value={draft}
              onChangeText={setDraft}
              multiline
              scrollEnabled={false}
              textAlignVertical="top"
              accessibilityLabel={`Edit ${title}`}
              accessibilityHint="Your edit is saved on this iPhone only."
              placeholderTextColor={colors.labelTertiary}
              selectionColor={colors.accent}
              style={{ minHeight: 120, padding: 12, borderRadius: 12, borderCurve: 'continuous', borderWidth: 1, borderColor: check.ok ? colors.separatorOpaque : colors.error.border, backgroundColor: colors.cardRaised, color: colors.label, fontSize: 17, lineHeight: 22 }}
            />
            {!check.ok ? (
              <AppText variant="footnote" tone="destructive" accessibilityLiveRegion="polite">
                {check.reason}
              </AppText>
            ) : null}
            {locked.length > 0 ? (
              <View style={{ gap: 4 }} testID={`summary-locked-${id}`}>
                <AppText variant="footnote" tone="secondary" weight="600">
                  Fixed lines (these can't be edited)
                </AppText>
                {locked.map((l, i) => (
                  <AppText key={i} variant="footnote" tone="secondary">
                    {l}
                  </AppText>
                ))}
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              <TextAction label="Save" onPress={save} disabled={!check.ok} testID={`summary-save-${id}`} />
              <TextAction label="Revert" onPress={revert} testID={`summary-revert-${id}`} />
            </View>
          </View>
        ) : (
          <AppText variant="body">{fold ? (lines[0] ?? '') : text}</AppText>
        )}

        {stale && !editing ? (
          <AppText variant="footnote" tone="secondary">
            Your answers or recordings have changed since you edited this section. Your edit is kept as written. Reset to generated to see the current version.
          </AppText>
        ) : null}
      </View>
      {fold && !editing ? (
        <Disclosure title={`Show all ${lines.length - 1} lines`}>
          <AppText variant="body">{lines.slice(1).join('\n')}</AppText>
        </Disclosure>
      ) : null}
      {!editing ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, paddingBottom: 6 }}>
          <TextAction label="Edit" onPress={start} testID={`summary-edit-${id}`} />
          {edited ? <TextAction label="Reset to generated" onPress={reset} destructive testID={`summary-reset-${id}`} /> : null}
        </View>
      ) : null}
    </Surface>
  );
}
