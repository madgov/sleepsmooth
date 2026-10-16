import { Stack, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAutomationBridge } from '../src/automation/useAutomationBridge';
import { clearClipTemp, pruneOldClips } from '../src/clips/clipFiles';
import { useLiveActivitySync } from '../src/hooks/useLiveActivitySync';
import { IS_EXPO_GO } from '../src/native/runtime';
import { loadSettings, useSettingsSnapshot } from '../src/state/settings';
import { ThemeProvider, useTheme } from '../src/theme/useTheme';
import { useSheetOptions } from '../src/ui/headerOptions';

void SplashScreen.preventAutoHideAsync();

// Local notifications only. Showing a banner while the app is open is harmless; no sound, no badge.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

function Routes() {
  const { colors } = useTheme();
  const router = useRouter();
  const { status, settings } = useSettingsSnapshot();
  const fit = useSheetOptions('fitToContents');
  const tall = useSheetOptions([0.75, 1]);
  const lastResponse = Notifications.useLastNotificationResponse();
  useLiveActivitySync();
  useAutomationBridge();

  useEffect(() => {
    void loadSettings();
  }, []);
  useEffect(() => {
    if (status === 'ready') void SplashScreen.hideAsync();
  }, [status]);

  // Housekeeping at launch: leftover temp clip candidates (a crash) and clips older than the retention the user chose.
  const retention = settings.clips.retentionDays;
  useEffect(() => {
    if (status !== 'ready') return;
    try {
      pruneOldClips(retention);
    } catch {
      /* nothing to clean */
    }
  }, [status, retention]);
  useEffect(() => {
    // Launch only: a running night keeps its temp candidates until it ends.
    if (status === 'ready') clearClipTemp();
  }, [status]);

  // Bedtime reminder tap: open the start sheet. It only opens a sheet; recording starts on a tap while the app is active.
  useEffect(() => {
    const url = (lastResponse?.notification.request.content.data as { url?: string } | undefined)?.url;
    if (status === 'ready' && url === 'sleepsmooth://start' && settings.onboardingCompletedAt) router.push(IS_EXPO_GO ? '/expo-go-recording' : '/start-sheet?source=notification');
  }, [lastResponse, status, settings.onboardingCompletedAt, router]);

  if (status !== 'ready') return null;
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="intro" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="onboarding" options={{ animation: 'slide_from_right', gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="recording" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom', gestureEnabled: false }} />
        <Stack.Screen name="start-sheet" options={tall} />
        <Stack.Screen name="consent" options={fit} />
        <Stack.Screen name="auto-record" options={tall} />
        <Stack.Screen name="expo-go-recording" options={fit} />
        <Stack.Screen name="stop" options={{ animation: 'none' }} />
        <Stack.Screen name="questionnaire" options={{ presentation: 'modal' }} />
        <Stack.Screen name="(dev)/lab" options={{ headerShown: true, title: 'Device lab' }} />
        <Stack.Screen name="(dev)/gallery" options={{ headerShown: true, title: 'Gallery' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <Routes />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
