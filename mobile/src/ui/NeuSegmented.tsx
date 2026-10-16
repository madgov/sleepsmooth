import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { AppText } from './AppText';

export interface NeuSegmentedProps {
  values: readonly string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  accessibilityLabel: string;
  testID?: string;
}

/**
 * v2 neumorphic segmented control (bike-file pair): a recessed track with an inset shadow pair, and a raised active pill
 * with an outer shadow pair. Selected text is solid accent (not the file's gradient text, which measured 3.1 to 4.1:1).
 * Radiogroup semantics, 44pt segments, no motion (state change only), so there is nothing to pause under Reduce Motion.
 */
export function NeuSegmented({ values, selectedIndex, onChange, accessibilityLabel, testID }: NeuSegmentedProps) {
  const { colors, increasedContrast } = useTheme();
  const n = colors.neu;
  return (
    <View
      testID={testID}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={{
        flexDirection: 'row',
        padding: 4,
        gap: 4,
        borderRadius: 14,
        borderCurve: 'continuous',
        backgroundColor: n.track,
        borderWidth: increasedContrast ? 1 : 0,
        borderColor: colors.separatorOpaque,
        boxShadow: `inset -4px -4px 8px ${n.trackLight}, inset 4px 4px 8px ${n.trackDark}`,
      }}
    >
      {values.map((v, i) => {
        const on = i === selectedIndex;
        return (
          <Pressable
            key={v}
            accessibilityRole="radio"
            accessibilityLabel={v}
            accessibilityState={{ checked: on }}
            onPress={() => {
              if (on) return;
              void Haptics.selectionAsync();
              onChange(i);
            }}
            style={{
              flex: 1,
              minHeight: 44,
              paddingHorizontal: 12,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 10,
              borderCurve: 'continuous',
              backgroundColor: on ? n.active : 'transparent',
              boxShadow: on ? `-4px -4px 10px ${n.activeLight}, 4px 4px 10px ${n.activeDark}` : undefined,
            }}
          >
            <AppText variant="callout" weight={on ? '700' : '400'} tone={on ? 'accent' : 'secondary'} center>
              {v}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
