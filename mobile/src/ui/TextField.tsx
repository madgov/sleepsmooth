import { TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { AppText } from './AppText';

export interface TextFieldProps {
  label: string;
  value: string;
  onChange: (t: string) => void;
  placeholder?: string;
  /** Spoken and shown after the label, for example a unit. */
  unit?: string;
  hint?: string;
  error?: string;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
  testID?: string;
}

/** One labelled single-line field. The label is also the accessibility label; an error is shown under the field and read with it. */
export function TextField({ label, value, onChange, placeholder, unit, hint, error, keyboardType, maxLength, testID }: TextFieldProps) {
  const { colors } = useTheme();
  const spoken = [label, unit, error].filter(Boolean).join(', ');
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="subheadline" tone="secondary" weight="600">
        {unit ? `${label} (${unit})` : label}
      </AppText>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.labelTertiary}
        selectionColor={colors.accent}
        keyboardType={keyboardType}
        maxLength={maxLength}
        accessibilityLabel={spoken}
        accessibilityHint={hint}
        autoCorrect={false}
        testID={testID}
        style={{
          minHeight: 44,
          paddingHorizontal: 14,
          borderRadius: 14,
          borderCurve: 'continuous',
          fontSize: 17,
          color: colors.label,
          backgroundColor: colors.glassFill,
          borderWidth: error ? 2 : 1,
          borderColor: error ? colors.error.border : colors.separatorOpaque,
        }}
      />
      {error ? (
        <AppText variant="footnote" tone="destructive" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
