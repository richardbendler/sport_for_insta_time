import { Platform } from "react-native";

const platform = Platform.OS || "unknown";
const isAndroid = platform === "android";
const isIos = platform === "ios";

export { platform, isAndroid, isIos };
