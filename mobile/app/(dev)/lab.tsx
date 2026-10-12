import { Redirect } from 'expo-router';

// The existing M0/M1 spike screens, behavior unchanged. Available in dev builds, and in a Release build only when started
// with EXPO_PUBLIC_DEVICE_LAB=1 (DEVICE_TEST.md). The condition is written inline so Metro can fold it away otherwise.
export default function Lab() {
  if (__DEV__ || process.env.EXPO_PUBLIC_DEVICE_LAB === '1') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy require keeps the lab out of Release bundles unless enabled
    const { LabScreens } = require('../../src/screens/LabScreens') as typeof import('../../src/screens/LabScreens');
    return <LabScreens />;
  }
  return <Redirect href="/" />;
}
