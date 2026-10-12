// SleepSmooth uses LOCAL notifications only. expo-notifications' config plugin adds the push entitlement
// (aps-environment) by default; remove it so the build carries no push capability.
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (c) => {
    delete c.modResults['aps-environment'];
    return c;
  });
};
