# Sport for Screen Time

**Earn your screen time.** A mobile app that turns exercise into social-media time: every
push-up, every minute of running is converted into screen time. Once it is used up, selected
apps (e.g. Instagram, TikTok) are blocked until the next workout.

The app combines a cross-platform React Native interface with native Android modules in Kotlin
for app blocking, home-screen widgets and background scheduling.

![React Native](https://img.shields.io/badge/React%20Native-0.81-61DAFB?logo=react&logoColor=black)
![Expo](https://img.shields.io/badge/Expo-SDK%2054-000020?logo=expo&logoColor=white)
![Kotlin](https://img.shields.io/badge/Kotlin-native%20modules-7F52FF?logo=kotlin&logoColor=white)
![Platforms](https://img.shields.io/badge/platforms-Android%20%7C%20iOS-lightgrey)

---

## Features

**Workout tracking**
- Preset exercises (push-ups, pull-ups, sit-ups, running, …) and fully customizable own exercises
- Counting by tap, by **voice** (speech recognition) or by **camera** – push-ups are detected
  automatically via on-device pose detection
- Time-based exercises with a stopwatch
- Configurable conversion rate per exercise (repetitions or minutes → earned screen time)

**Screen-time control (Android)**
- App blocker based on an Accessibility Service: detects the app in the foreground and shows a
  lock screen as soon as the earned time is used up
- Optional *preface screen* with a short waiting time before a selected app opens
- Optional grayscale mode for restricted apps to make them less appealing
- *Sick mode* with a limited daily allowance for days without training
- Earn extra time with mental arithmetic tasks

**Statistics & motivation**
- Daily, weekly and monthly views per exercise and overall
- Home-screen widgets per exercise and for the total earned time
- Interactive onboarding tutorial with highlighting
- Available in German, English, Spanish and French

All data is stored locally on the device – no account, no server.

## Architecture

```
React Native (JavaScript)                      Native Android (Kotlin)
┌──────────────────────────────┐               ┌────────────────────────────────────┐
│ UI, navigation, statistics   │   Native      │ InstaBlockerService                │
│ Exercise & time logic        │ ◄──Module───► │   Accessibility Service, lock page │
│ Camera rep counter           │   Bridge      │ ScreenTimeStore / CreditStore      │
│   (VisionCamera + pose det.) │               │   shared time budget               │
│ Voice counter                │               │ Widget providers + scheduler       │
│ i18n (i18next)               │               │ Preface / sick-mode / math screens │
└──────────────────────────────┘               └────────────────────────────────────┘
             │                                                │
        AsyncStorage                                SharedPreferences
```

The React Native layer handles the user interface and all tracking; the earned time budget is
synchronized to native storage, where the blocker service and the widgets read it independently
of the JavaScript runtime – so blocking keeps working even when the app is closed.

## Tech Stack

| Area | Technology |
| --- | --- |
| App | React Native 0.81, Expo SDK 54 (development build), React 19 |
| Native Android | Kotlin, Accessibility Service, App Widgets, Native Modules |
| Computer vision | react-native-vision-camera, ML-based pose detection (frame processors) |
| Speech | @react-native-voice/voice |
| Localization | i18next, react-i18next, expo-localization |
| Persistence | AsyncStorage, Android SharedPreferences |
| Build & Release | EAS Build, EAS Submit (Google Play, App Store Connect) |

## Getting Started

A development build is required (Expo Go does not support the native modules).

```bash
npm install
npx expo run:android
```

Further documentation:
- [DEVELOPMENT.md](DEVELOPMENT.md) – daily workflow, builds, store releases, storage format
- [SETUP.md](SETUP.md) – one-time setup of the development environment

## Privacy

The app does not collect or transmit any personal data. Accessibility and usage-access
permissions are used exclusively to detect blocked apps on the device.
See the [privacy policy](_Datenschutzerklaerung_movetoServer/Privacy_Policy_sport_for_screen_time.html).
