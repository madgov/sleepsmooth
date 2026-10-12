import { useRouter, type NativeStackNavigationOptions } from 'expo-router';
import { Pressable } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { Icon } from './Icon';

export function GearButton() {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={() => router.push('/settings')} hitSlop={8} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="gearshape" size={22} color={colors.accent} />
    </Pressable>
  );
}

/** Native large title, transparent blurred header, gear on the right. The OS draws the material. */
export function useLargeTitleOptions(title: string): NativeStackNavigationOptions {
  const { colors, night, reduceTransparency } = useTheme();
  return {
    title,
    headerLargeTitleEnabled: true,
    headerTransparent: !reduceTransparency,
    headerBlurEffect: reduceTransparency ? 'none' : night ? 'dark' : 'systemMaterial',
    headerLargeTitleShadowVisible: false,
    headerShadowVisible: false,
    headerTintColor: colors.accent,
    headerTitleStyle: { color: colors.label },
    headerLargeTitleStyle: { color: colors.label },
    headerStyle: reduceTransparency ? { backgroundColor: colors.bg } : undefined,
    headerRight: () => <GearButton />,
    contentStyle: { backgroundColor: colors.bg },
  };
}

/** Pushed detail screen: small title, native back button. */
export function useDetailOptions(title: string): NativeStackNavigationOptions {
  const { colors, reduceTransparency } = useTheme();
  return {
    title,
    headerLargeTitleEnabled: false,
    headerTransparent: !reduceTransparency,
    headerBlurEffect: reduceTransparency ? 'none' : 'systemMaterial',
    headerShadowVisible: false,
    headerTintColor: colors.accent,
    headerTitleStyle: { color: colors.label },
    headerBackButtonDisplayMode: 'minimal',
    headerStyle: reduceTransparency ? { backgroundColor: colors.bg } : undefined,
    contentStyle: { backgroundColor: colors.bg },
  };
}

export function useSheetOptions(detents: number[] | 'fitToContents'): NativeStackNavigationOptions {
  const { colors } = useTheme();
  return {
    presentation: 'formSheet',
    headerShown: false,
    sheetAllowedDetents: detents,
    sheetGrabberVisible: true,
    sheetCornerRadius: 28,
    contentStyle: { backgroundColor: colors.bg },
  };
}
