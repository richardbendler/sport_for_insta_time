import { Platform } from "react-native";

// The Screen Time extensions send local notifications (time is running,
// 5 minutes left, used up, "start workout" from the shield). iOS drops them
// silently unless the app itself asked for notification permission once.
let Notifications = null;
if (Platform.OS === "ios") {
  try {
    Notifications = require("expo-notifications");
  } catch (error) {
    Notifications = null;
  }
}

export const ensureIosNotificationPermission = async () => {
  if (!Notifications) {
    return false;
  }
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) {
      return true;
    }
    if (current.canAskAgain === false) {
      return false;
    }
    const result = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    return !!result.granted;
  } catch (error) {
    console.warn("iosScreenTime: notification permission failed", error);
    return false;
  }
};
