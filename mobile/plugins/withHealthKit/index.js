// SleepSmooth Apple Health (read-only): config plugin with ONE feature flag, `healthkit` in app.json.
//
//   ["./plugins/withHealthKit", { "healthkit": true }]    adds the HealthKit entitlement and NSHealthShareUsageDescription
//   ["./plugins/withHealthKit", { "healthkit": false }]   adds NOTHING: entitlements stay exactly as they were (empty)
//
// WHY A FLAG: a free Apple ID (Personal Team) very likely cannot sign the HealthKit entitlement // report; Apple publishes no clear statement, so it is UNCERTAIN). If signing fails with "Personal development teams do not
// support the HealthKit capability", set `healthkit` to false and run `npx expo prebuild --platform ios --clean` again.
// The app is fully usable with it off: the Apple Health row says "Unavailable" and everything else is unchanged.
//
// Entitlement added when ON (and only then): com.apple.developer.healthkit = true. No health-records entitlement, no
// background delivery, no write access, no UIRequiredDeviceCapabilities change, no App Group, no push.
const { withEntitlementsPlist, withInfoPlist } = require('expo/config-plugins');

// Keep identical to HEALTH_PLIST_USAGE in src/content/claims.ts (a unit test checks this).
const USAGE = 'SleepSmooth reads your sleep and step history to suggest your usual sleep hours. It never writes to Health.';

module.exports = function withHealthKit(config, props = {}) {
  const enabled = props.healthkit === true;
  config.extra = { ...(config.extra || {}), healthKit: enabled };
  if (!enabled) return config;
  config = withEntitlementsPlist(config, (c) => {
    c.modResults['com.apple.developer.healthkit'] = true;
    return c;
  });
  return withInfoPlist(config, (c) => {
    c.modResults.NSHealthShareUsageDescription = USAGE;
    return c;
  });
};
