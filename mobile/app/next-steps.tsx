import * as Haptics from 'expo-haptics';
import { View } from 'react-native';
import {
  NEXT_STEPS_DROWSY_HEADING,
  NEXT_STEPS_GROUPS,
  NEXT_STEPS_INTRO,
  NEXT_STEPS_NOT_REASSURANCE,
  NEXT_STEPS_PROGRESS,
  RED_FLAG_NOTE,
} from '@core/content/claims';
import { COPY } from '../src/content/copy';
import { updateSettings, useSettings } from '../src/state/settings';
import { useTheme } from '../src/theme/useTheme';
import { AppText } from '../src/ui/AppText';
import { Icon } from '../src/ui/Icon';
import { BackBar } from '../src/ui/ScreenHeader';
import { Screen } from '../src/ui/Screen';
import { InsetGroup, ListRow } from '../src/ui/InsetGroup';
import { PathwayGuide } from '../src/ui/PathwayGuide';

export default function NextSteps() {
  const { colors } = useTheme();
  const s = useSettings();
  const ticks = new Set(s.nextStepsTicks);
  const all = NEXT_STEPS_GROUPS.flatMap((g) => g.items);
  const done = all.filter((i) => ticks.has(i.id)).length;

  const toggle = (id: string) => {
    // A light selection tick only. No success feedback: ticking a step is not a result.
    Haptics.selectionAsync().catch(() => undefined);
    updateSettings((cur) => {
      const set = new Set(cur.nextStepsTicks);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...cur, nextStepsTicks: [...set] };
    });
  };

  return (
    <Screen variant="app" top={<BackBar title="Next steps" />} gap={24}>
      <>
        <AppText variant="body" tone="secondary">
          {NEXT_STEPS_INTRO}
        </AppText>
        {NEXT_STEPS_GROUPS.map((g) => (
          <InsetGroup key={g.id} header={g.title}>
            {g.items.map((i) => {
              const on = ticks.has(i.id);
              return (
                <ListRow
                  key={i.id}
                  title={i.text}
                  leading={<Icon name={on ? 'checkmark.circle.fill' : 'circle'} size={24} color={on ? colors.accent : colors.labelTertiary} />}
                  onPress={() => toggle(i.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={i.text}
                  testID={`step-${i.id}`}
                />
              );
            })}
          </InsetGroup>
        ))}
        <AppText variant="footnote" tone="secondary" accessibilityLiveRegion="polite">
          {NEXT_STEPS_PROGRESS(done, all.length)}
        </AppText>
        {s.redFlag ? (
          <View style={{ gap: 4 }}>
            <AppText variant="headline" accessibilityRole="header">
              {NEXT_STEPS_DROWSY_HEADING}
            </AppText>
            <AppText variant="body">{RED_FLAG_NOTE}</AppText>
          </View>
        ) : null}
        <PathwayGuide />
        <View style={{ gap: 8 }}>
          <AppText variant="subheadline" weight="600">
            {NEXT_STEPS_NOT_REASSURANCE}
          </AppText>
          <AppText variant="footnote" tone="secondary">
            {COPY.N72_NEXT_STEPS_STORAGE}
          </AppText>
        </View>
      </>
    </Screen>
  );
}
