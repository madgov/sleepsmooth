import { createElement } from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme/useTheme';

// Web preview only: the iOS build uses the native UIDatePicker wheel (TimeWheel.tsx).
export function TimeWheel({ minutes, onChange, label }: { minutes: number; onChange: (m: number) => void; label: string }) {
  const { colors } = useTheme();
  const v = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  return (
    <View style={{ alignItems: 'center', padding: 8 }}>
      {createElement('input', {
        type: 'time',
        value: v,
        'aria-label': label,
        onChange: (e: { target: { value: string } }) => {
          const [h, m] = e.target.value.split(':').map(Number);
          if (Number.isFinite(h) && Number.isFinite(m)) onChange((h as number) * 60 + (m as number));
        },
        style: { fontSize: 34, padding: 12, borderRadius: 16, border: 'none', background: colors.card, color: colors.label, fontWeight: 700, fontFamily: 'inherit' },
      })}
    </View>
  );
}
