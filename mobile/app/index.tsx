import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useIntroSeen } from '../src/state/introFlag';
import { useSettings } from '../src/state/settings';
import { useTheme } from '../src/theme/useTheme';

/** First launch: intro slides, then the questionnaire onboarding, then the app. Spinner on the app background while reading flags. */
export default function Index() {
  const s = useSettings();
  const intro = useIntroSeen();
  const { colors } = useTheme();
  if (s.onboardingCompletedAt) return <Redirect href="/dashboard" />;
  if (intro === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  return <Redirect href={intro === 'seen' ? '/onboarding' : '/intro'} />;
}
