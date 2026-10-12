// NSMotionUsageDescription for CMMotionActivityManager history ("Find my routine"). No entitlement is needed.
// The prompt appears only when the user taps "Find my routine"; the app never queries motion history at launch.
const { withInfoPlist } = require('expo/config-plugins');

// Keep identical to MOTION_PLIST_USAGE in src/content/claims.ts (a unit test checks this).
const USAGE = 'SleepSmooth reads how long your iPhone was still overnight, only when you tap Find my routine, to suggest your usual sleep hours.';

module.exports = function withMotionUsage(config) {
  return withInfoPlist(config, (c) => {
    c.modResults.NSMotionUsageDescription = USAGE;
    return c;
  });
};
