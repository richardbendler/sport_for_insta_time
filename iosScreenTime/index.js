import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { createController } = require("./controller");

let deviceActivity = null;
if (Platform.OS === "ios") {
  try {
    const library = require("react-native-device-activity");
    deviceActivity = library.isAvailable() ? library : null;
  } catch (error) {
    deviceActivity = null;
  }
}

const iosScreenTime =
  Platform.OS === "ios"
    ? createController({
        deviceActivity,
        storage: AsyncStorage,
        platformVersion: Platform.Version,
      })
    : null;

export const AppSelectionSheet = deviceActivity
  ? deviceActivity.DeviceActivitySelectionSheetViewPersisted
  : null;

export default iosScreenTime;
