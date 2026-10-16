import { Linking } from 'react-native';
import { NOSAS_CITATION, NOSAS_URLS, SOURCES_INTRO, SOURCES_TITLE } from '@core/content/claims';
import { AppText } from '../src/ui/AppText';
import { BackBar } from '../src/ui/ScreenHeader';
import { Screen } from '../src/ui/Screen';
import { InsetGroup, ListRow } from '../src/ui/InsetGroup';

export default function Sources() {
  const urls: readonly string[] = NOSAS_URLS;
  return (
    <Screen variant="app" top={<BackBar title={SOURCES_TITLE} />} gap={24}>
      <>
        <AppText variant="body" tone="secondary" style={{ paddingHorizontal: 16 }}>
          {SOURCES_INTRO}
        </AppText>
        <InsetGroup header="NoSAS questionnaire score">
          <ListRow title={NOSAS_CITATION} />
          {urls.map((u) => (
            <ListRow key={u} title={u} leading="link" accessibilityRole="link" onPress={() => void Linking.openURL(u)} />
          ))}
        </InsetGroup>
      </>
    </Screen>
  );
}
