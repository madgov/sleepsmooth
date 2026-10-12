import { Pressable, View } from 'react-native';
import { COPY } from '../content/copy';
import { useTheme } from '../theme/useTheme';
import { AppText } from './AppText';

export function SheetHeader({ title, onClose, closeLabel = COPY.C.close }: { title: string; onClose?: () => void; closeLabel?: string }) {
  void useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 20, paddingBottom: 8, gap: 12 }}>
      <AppText variant="title2" accessibilityRole="header" style={{ flex: 1 }}>
        {title}
      </AppText>
      {onClose ? (
        <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} onPress={onClose} hitSlop={8} style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' }}>
          <AppText variant="body" tone="accent" weight="600">
            {closeLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
