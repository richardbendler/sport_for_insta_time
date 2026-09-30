const {
  createConfig,
} = require("react-native-device-activity/config-plugin/createExpoTargetConfig");

// Bundle IDs are registered with the Family Controls (Distribution)
// entitlement under these exact names, so they must not be derived from the
// folder name.
const baseConfig = createConfig("shield-action");

module.exports = (config) => ({
  ...baseConfig(config),
  bundleIdentifier: ".ShieldAction",
  deploymentTarget: "16.0",
});
