import { View } from 'react-native';
import { useTheme } from '../theme/useTheme';

/** Static placeholder blocks. No shimmer (nothing here is worth the attention). */
export function Skeleton({ lines = 3, height = 14 }: { lines?: number; height?: number }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel="Loading" accessibilityRole="progressbar" style={{ gap: 10 }}>
      {Array.from({ length: lines }, (_, i) => (
        <View key={i} style={{ height, width: i === lines - 1 ? '60%' : '100%', borderRadius: 6, borderCurve: 'continuous', backgroundColor: colors.fill }} />
      ))}
    </View>
  );
}
