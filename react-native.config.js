const path = require("path");

module.exports = {
  dependencies: {
    "@react-native-async-storage/async-storage": {
      platforms: {
        android: {
          sourceDir: path.resolve(
            __dirname,
            "node_modules/@react-native-async-storage/async-storage/android"
          ),
        },
      },
    },
    "@react-native-voice/voice": {
      platforms: {
        android: {
          sourceDir: path.resolve(__dirname, "node_modules/@react-native-voice/voice/android"),
        },
      },
    },
    "react-native-vision-camera": {
      platforms: {
        android: {
          sourceDir: path.resolve(__dirname, "node_modules/react-native-vision-camera/android"),
        },
      },
    },
    "vision-camera-pose-detector": {
      platforms: {
        android: {
          sourceDir: path.resolve(__dirname, "node_modules/vision-camera-pose-detector/android"),
        },
      },
    },
  },
};
