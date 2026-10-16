// Production variant switch. app.json stays the base (the dev build is unchanged when nothing is set).
//
//   APP_VARIANT=production npx expo prebuild --platform ios --clean
//     bundle id  -> SLEEPSMOOTH_BUNDLE_ID, default com.sleepsmooth.overnight   (TODO: the user must register this id in their Apple Developer account and confirm it)
//     name       -> SLEEPSMOOTH_APP_NAME, default "SleepSmooth Overnight"       (TODO: confirm the App Store display name)
//
// Unset APP_VARIANT: nothing changes (com.sleepsmooth.overnight.dev). The Live Activity extension id is derived from
// the app id by plugins/withLiveActivity, so it follows automatically (<id>.LiveActivity).
//
// A production build must not carry the developer device lab (see docs/APP_STORE_REVIEW.md, "Release checklist").
module.exports = ({ config }) => {
  if (process.env.APP_VARIANT !== 'production') return config;
  if (process.env.EXPO_PUBLIC_DEVICE_LAB === '1') {
    throw new Error('APP_VARIANT=production cannot be combined with EXPO_PUBLIC_DEVICE_LAB=1 (the device lab must not ship).');
  }
  const id = process.env.SLEEPSMOOTH_BUNDLE_ID || 'com.sleepsmooth.overnight';
  return {
    ...config,
    name: process.env.SLEEPSMOOTH_APP_NAME || config.name,
    ios: { ...config.ios, bundleIdentifier: id },
    android: { ...config.android, package: id },
  };
};
