# Sport for Screen Time

Eine einfache React Native App, die Sport gegen Social-Media-Zeit tauscht.
Workouts erzeugen erspielte Zeit, alles wird lokal gespeichert, und auf Android
koennen ausgewaehlte Apps blockiert werden, sobald die erspielte Zeit verbraucht ist.

## Expo Befehle (wichtig)
```bash
npx expo run:android
npx expo start --dev-client
eas build --platform android --local
npx eas build -p android --profile production
```

## Android APK lokal bauen (Windows + WSL / Ubuntu)

### Voraussetzungen
- Windows + WSL (Ubuntu) oder Linux
- Node.js >= 20
- Java JDK 17
- Android SDK
- EAS CLI

### Setup (einmalig)

#### 1) WSL / Ubuntu oeffnen
```bash
wsl
```

#### 2) Node.js 20 installieren
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
```

#### 3) Java 17 installieren
```bash
sudo apt install -y openjdk-17-jdk
echo 'export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64' >> ~/.bashrc
source ~/.bashrc
java -version
```

#### 4) Android SDK installieren (empfohlen in WSL)
```bash
mkdir -p ~/Android/Sdk/cmdline-tools && cd ~/Android/Sdk/cmdline-tools
wget -O tools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip tools.zip && mv cmdline-tools latest
echo 'export ANDROID_HOME=$HOME/Android/Sdk' >> ~/.bashrc
echo 'export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools' >> ~/.bashrc
source ~/.bashrc
sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"
yes | sdkmanager --licenses
```

#### 5) EAS CLI
Option A (empfohlen): npm-global in dein Home legen (ohne sudo)

```bash
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

Dann installieren:

```bash
npm i -g eas-cli
eas --version
eas login
```

### Build APK
```bash
cd ~/sport_for_insta_time
printf "sdk.dir=%s\n" "$HOME/Android/Sdk" > android/local.properties
npm ci --include=dev || (rm -rf node_modules package-lock.json && npm install)
eas build --platform android --profile production --local
```

### APK nach Windows kopieren
```bash
cp /pfad/zur/app-release.apk /mnt/c/Users/<DEIN_USER>/Desktop/
```

## Features
- Presets: z.B. Liegestuetze, Klimmzuege, Situps, Joggen (mit Icons)
- Eigene Sportarten erstellen, bearbeiten, ausblenden, loeschen, sortieren
- Tracking: Wiederholungen per Tap oder Sprache, Zeit via Start/Stop
- Tagesstatistik, Wochenansicht und Monatskalender (pro Sport und Gesamt)
- Eintraege bearbeiten in der Tagesansicht (pro Sport und in der Gesamtstatistik)
- Widgets: pro Sport und ein Gesamtwidget fuer erspielte Zeit
- Tutorial mit Highlighting, jederzeit in den Einstellungen startbar
- Mehrsprachig (DE/EN/ES/FR)
- Optional: Benachrichtigungen (Android 13+), Mikrofon (Sprachzaehlung), Kamera

## Zeit-Logik
- Wiederholungen: je Sport frei definierbare Umrechnung in Sekunden erspielter Zeit
- Zeitbasiert: eigene Rate pro Sportart (Minuten erspielte Zeit pro Minute Training)
- Tageswerte werden sportuebergreifend zur erspielten Zeit summiert

## Speicherung
AsyncStorage Keys:
- `@sports_v1`: Liste der Sportarten
- `@stats_v1`: Tageswerte je Sportart (`{ sportId: { "YYYY-MM-DD": { reps, seconds } } }`)
- `@logs_v1`: Einzelne Eintraege pro Sport und Tag
- `@settings_v1`: Controller-Einstellungen (Apps, Sprache, Preface)
- `@tutorial_seen_v1`: Tutorial-Status
- `@permissions_prompted_v1`: erster Permissions-Hinweis
- `@usage_permissions_prompted_v1`: Usage-Access Hinweis
- `@notifications_permissions_prompted_v1`: Notifications Hinweis
- `@carryover_seconds_v1`, `@carryover_day_v1`, `@usage_snapshot_v1`: Screen-Time Logik

## Android Berechtigungen
Die App nutzt einen Accessibility Service, um Apps im Vordergrund zu erkennen und
bei Ablauf der erspielten Zeit eine Sperrseite anzuzeigen.
- Zugriffshilfe (Accessibility) und Usage Access fuer den App-Blocker
- Benachrichtigungen (Android 13+) optional
- Mikrofon (Sprachzaehlung) optional
- Kamera optional

## Entwicklung (Android)
Ein Dev Build ist notwendig (Expo Go auf Android 14 hat Einschraenkungen).
`npm install`

## Hinweise
- Die Blocker-Seite fuehrt zurueck zum Homescreen, sobald die erspielte Zeit aufgebraucht ist.
- App-Auswahl und Blocker sind aktuell Android-only.
