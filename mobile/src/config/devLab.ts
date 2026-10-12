// Documentation of the flag. Route code must inline the same expression (see app/(dev)/lab.tsx) so Metro can drop the lab in release builds.
// The lab is available in dev builds, and in a Release build only when started with EXPO_PUBLIC_DEVICE_LAB=1
// (DEVICE_TEST.md needs the Release lab for the M0 timing and M1 locked-screen gate).
export const LAB_ENABLED: boolean = __DEV__ || process.env.EXPO_PUBLIC_DEVICE_LAB === '1';
