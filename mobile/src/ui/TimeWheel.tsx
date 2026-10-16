import DateTimePicker from '@react-native-community/datetimepicker';
import { View } from 'react-native';
import { useTheme } from '../theme/useTheme';

/** Native time wheel (UIDatePicker, spinner style). Value is minutes after midnight. */
export function TimeWheel({ minutes, onChange, label }: { minutes: number; onChange: (m: number) => void; label: string }) {
  const { scheme } = useTheme();
  const d = new Date();
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return (
    <View accessible={false} style={{ alignItems: 'center' }} accessibilityLabel={label}>
      <DateTimePicker accessibilityLabel={label} value={d} mode="time" display="spinner" themeVariant={scheme} onChange={(_, v) => v && onChange(v.getHours() * 60 + v.getMinutes())} />
    </View>
  );
}
