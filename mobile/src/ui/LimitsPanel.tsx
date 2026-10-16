import { View } from 'react-native';
import { LIMITS_PANEL_ITEMS, LIMITS_PANEL_MORE, LIMITS_PANEL_SOURCES, LIMITS_PANEL_TITLE, LIMITS_PANEL_WATCH_LINE } from '@core/content/claims';
import { AppText } from './AppText';
import { Disclosure } from './Disclosure';
import { Surface } from './Surface';

/** Calm, neutral "what this cannot tell you" panel. Same wording as the web app. Never a success or warning colour. */
export function LimitsPanel() {
  return (
    <Surface radius="xl" padding={0} testID="limits-panel">
      <View style={{ gap: 8, padding: 18, paddingBottom: 6 }}>
        <AppText variant="headline" accessibilityRole="header">
          {LIMITS_PANEL_TITLE}
        </AppText>
        {LIMITS_PANEL_ITEMS.map((t) => (
          <AppText key={t} variant="subheadline" tone="secondary">
            {t}
          </AppText>
        ))}
      </View>
      <Disclosure title={LIMITS_PANEL_MORE}>
        <AppText variant="subheadline">{LIMITS_PANEL_WATCH_LINE}</AppText>
        <AppText variant="footnote" tone="secondary">
          {LIMITS_PANEL_SOURCES}
        </AppText>
      </Disclosure>
    </Surface>
  );
}
