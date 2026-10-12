import { useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { EXPO_GO } from '../src/content/copy';
import { useTheme } from '../src/theme/useTheme';
import { AppText } from '../src/ui/AppText';
import { Icon } from '../src/ui/Icon';
import { PrimaryButton } from '../src/ui/PrimaryButton';
import { SheetHeader } from '../src/ui/SheetHeader';

/** Shown instead of the start sheet when the app runs inside Expo Go. No recording, no fake data. */
export default function ExpoGoRecording() {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 16 }} contentInsetAdjustmentBehavior="automatic" testID="expo-go-sheet">
      <SheetHeader title={EXPO_GO.SHEET_TITLE} />
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <Icon name="mic.slash" size={26} color={colors.accent} />
        <AppText variant="body" style={{ flex: 1 }}>
          {EXPO_GO.SHEET_BODY}
        </AppText>
      </View>
      <AppText variant="subheadline" tone="secondary">
        {EXPO_GO.WHAT_WORKS}
      </AppText>
      <AppText variant="subheadline" tone="secondary">
        {EXPO_GO.WHAT_NOT}
      </AppText>
      <PrimaryButton label={EXPO_GO.OK} onPress={() => router.back()} testID="expo-go-ok" />
    </ScrollView>
  );
}
