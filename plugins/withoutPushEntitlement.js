// expo-notifications adds the aps-environment (push) entitlement. The app only
// needs local notifications, and the provisioning profile has no push
// capability, so the entitlement is removed again.
const { withEntitlementsPlist } = require("expo/config-plugins");

module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (modConfig) => {
    delete modConfig.modResults["aps-environment"];
    return modConfig;
  });
};
