
import { ScrollView, View } from 'react-native';
import { useSafeRouter } from '../src/nav/useSafeRouter';
import { setOvernightConsent } from '@core/consent/history';
import { DISCLAIMER_AUDIO } from '@core/content/claims';
import { COPY, privacyRows, privacyTitle } from '../src/content/copy';
import { IS_EXPO_GO } from '../src/native/runtime';
import { updateSettings, useSettings } from '../src/state/settings';
import { useTheme } from '../src/theme/useTheme';
import { AppText } from '../src/ui/AppText';
import { Icon } from '../src/ui/Icon';
import { InsetGroup, ListRow } from '../src/ui/InsetGroup';
import { PrimaryButton } from '../src/ui/PrimaryButton';
import { SheetHeader } from '../src/ui/SheetHeader';

/** Re-asks consent for overnight sound analysis (skipped or withdrawn earlier). Continues to the start sheet on agree. */
export default function Consent() {
  const router = useSafeRouter();
  const { colors } = useTheme();
  const clipsOn = useSettings().clips.enabled;
  const agree = () => {
    updateSettings((p) => setOvernightConsent(p, true, new Date().toISOString()));
    router.replace(IS_EXPO_GO ? '/expo-go-recording' : '/start-sheet');
  };
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 16 }}>
      <SheetHeader title={privacyTitle()} />
      <InsetGroup>
        {privacyRows(undefined, clipsOn).map((r) => (
          <ListRow key={r.id} title={r.text} leading={<Icon name={r.symbol} size={22} color={colors.accent} />} />
        ))}
      </InsetGroup>
      <AppText variant="footnote" tone="secondary">
        {DISCLAIMER_AUDIO}
      </AppText>
      <AppText variant="footnote" tone="secondary">
        {COPY.N08_CONSENT}
      </AppText>
      <View style={{ gap: 4 }}>
        <PrimaryButton label={COPY.C.agree} onPress={agree} accessibilityHint={COPY.N08_CONSENT} />
        <PrimaryButton label={COPY.C.notNow} variant="plain" onPress={() => router.back()} />
      </View>
    </ScrollView>
  );
}
