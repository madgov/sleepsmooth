import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { createNavGuard } from '@core/mobileLogic/navGuard';

// One lock for the whole app: any push, navigate or back within ~one transition of the previous one is dropped.
const guard = createNavGuard();

type Router = ReturnType<typeof useRouter>;

/**
 * Drop-in for `useRouter()` on user-initiated navigation.
 * - push / navigate / back are guarded against double taps.
 * - back never dead-ends: with no history (deep link, notification cold start, web reload) it replaces with the app root,
 *   which redirects to the right place for the user's onboarding state.
 */
export function useSafeRouter() {
  const r = useRouter();
  return useMemo(
    () => ({
      push: ((...a: Parameters<Router['push']>) => {
        if (guard.allow()) r.push(...a);
      }) as Router['push'],
      navigate: ((...a: Parameters<Router['navigate']>) => {
        if (guard.allow()) r.navigate(...a);
      }) as Router['navigate'],
      replace: r.replace,
      dismissAll: r.dismissAll,
      canGoBack: r.canGoBack,
      back: () => {
        if (!guard.allow()) return;
        if (r.canGoBack()) r.back();
        else r.replace('/');
      },
    }),
    [r],
  );
}
