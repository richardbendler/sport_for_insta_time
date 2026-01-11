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
  },
};
