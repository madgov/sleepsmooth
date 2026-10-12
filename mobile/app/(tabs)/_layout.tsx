import { useRouter } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useEffect, useRef } from 'react';
import { useRecordAction } from '../../src/hooks/useRecordAction';
import { useTheme } from '../../src/theme/useTheme';
import { GlassTabBar } from '../../src/ui/GlassTabBar';

// v3: Dashboard | Checks | [Record] | Nights | Settings. The centre button is not a route; GlassTabBar draws it and wires it
// to the capture controller. When a recording begins (from the start sheet, a notification or a Live Activity link), the
// full-screen recording view opens once.
export default function TabsLayout() {
  const { colors } = useTheme();
  const router = useRouter();
  const { status } = useRecordAction();
  const prev = useRef(status);
  useEffect(() => {
    const was = prev.current === 'recording' || prev.current === 'starting';
    const now = status === 'recording' || status === 'starting';
    prev.current = status;
    if (now && !was) {
      const id = setTimeout(() => router.push('/recording'), 450);
      return () => clearTimeout(id);
    }
  }, [status, router]);
  return (
    <Tabs tabBar={(props) => <GlassTabBar {...props} />} screenOptions={{ headerShown: false, animation: 'none', sceneStyle: { backgroundColor: colors.bg } }}>
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="checks" options={{ title: 'Checks' }} />
      <Tabs.Screen name="nights" options={{ title: 'Nights' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
