import { View } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { AppText } from './AppText';
import { Icon, type SymbolName } from './Icon';

/**
 * Small schematic of what each Shortcuts step looks like. It is an ILLUSTRATION made by SleepSmooth, not a screenshot of
 * Apple's app, and the menu names may differ by iOS version. The caller labels it as such.
 */
function Row({ icon, label, on, trailing }: { icon: SymbolName; label: string; on?: boolean; trailing?: SymbolName }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: on ? colors.accentFill : 'transparent', borderRadius: 10 }}>
      <Icon name={icon} size={16} color={on ? colors.accent : colors.labelSecondary} />
      <AppText variant="footnote" weight={on ? '600' : '400'} tone={on ? 'accent' : 'label'} style={{ flex: 1 }}>
        {label}
      </AppText>
      {trailing ? <Icon name={trailing} size={14} color={on ? colors.accent : colors.labelTertiary} /> : null}
    </View>
  );
}

export function ShortcutsMock({ step }: { step: 1 | 2 | 3 }) {
  const { colors } = useTheme();
  const box = { backgroundColor: colors.card, borderRadius: 12, borderCurve: 'continuous' as const, borderWidth: 1, borderColor: colors.separatorOpaque };
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={[box, { padding: 8, gap: 2 }]}>
      {step === 1 ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 6 }}>
            <AppText variant="footnote" weight="700">Automation</AppText>
            <Icon name="plus.circle.fill" size={20} color={colors.accent} />
          </View>
          <Row icon="bolt" label="New automation" on trailing="chevron.right" />
        </>
      ) : null}
      {step === 2 ? (
        <>
          <Row icon="bed.double" label="Sleep (Bedtime or Wind Down)" on trailing="checkmark" />
          <Row icon="clock" label="Time of Day" />
          <Row icon="bolt.fill" label="Run Immediately" on trailing="checkmark.circle.fill" />
        </>
      ) : null}
      {step === 3 ? (
        <>
          <Row icon="magnifyingglass" label="Search actions: SleepSmooth" />
          <Row icon="moon.stars" label="Start SleepSmooth overnight check" on trailing="plus.circle.fill" />
        </>
      ) : null}
    </View>
  );
}
