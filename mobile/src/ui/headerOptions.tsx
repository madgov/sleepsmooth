import type { NativeStackNavigationOptions } from 'expo-router';
import { useTheme } from '../theme/useTheme';

/**
 * Native form sheet (UISheetPresentationController on iOS): grabber, 28pt corners, detents.
 * Tab and detail screens draw their own collapsing large title (see Screen `title`), so the old unused native-header helpers were removed.
 */
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
