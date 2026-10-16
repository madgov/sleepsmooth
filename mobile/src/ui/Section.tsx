import { View } from 'react-native';
import { AppText } from './AppText';
import { PressScale } from './Press';

/** Section title with an optional trailing text action. */
export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 4 }}>
      <AppText variant="title3" accessibilityRole="header">
        {title}
      </AppText>
      {action && onAction ? (
        <PressScale onPress={onAction} accessibilityLabel={action} haptic="none" containerStyle={{ minHeight: 44, justifyContent: 'center' }}>
          <AppText variant="subheadline" tone="accent" weight="600">
            {action}
          </AppText>
        </PressScale>
      ) : null}
    </View>
  );
}
