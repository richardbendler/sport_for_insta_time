# Sport for Screen Time

Eine einfache React Native App, die Sport gegen Social Media Zeit tauscht. Sportarten und Tageswerte werden lokal gespeichert, und ausgewählte Apps können auf Android blockiert werden, sobald die verdiente Zeit verbraucht ist.


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
```bash
npm i -g eas-cli
eas login
```

### Build APK
```bash
cd ~/sport_for_insta_time
printf "sdk.dir=%s\n" "$HOME/Android/Sdk" > android/local.properties
npm ci --include=dev || (rm -rf node_modules package-lock.json && npm install)
Old: eas build --platform android --profile preview --local
eas build --platform android --profile production --local
```

### APK nach Windows kopieren
```bash
cp /pfad/zur/app-release.apk /mnt/c/Users/<DEIN_USER>/Desktop/
```


## Features
- Presets: Liegestütze, Klimmzüge, Situps, Joggen (mit Icons)
- Eigene Sportarten erstellen, ausblenden oder löschen
- Tracking: Wiederholungen per Tap, Zeit via Start/Stop
- Tagesstatistik wird gespeichert und täglich neu gestartet
- Screen Controller: Apps auswählen, verdiente Zeit berechnen, Blocker bei Zeitende
- Statistik-Ansicht pro Sportart (Tag & Woche)
- Icons pro Sportart, Auswahl beim Anlegen
- Widgets pro Sportart (heutige Werte + Screen Time)
- Sprache umschaltbar (Deutsch, Englisch, Spanisch, Französisch)

## Zeit-Logik
- Wiederholungen: Presets haben eigene Umrechnung, eigene Sportarten können es frei setzen
- Zeitbasiert: Standard 1:1, eigene Sportarten frei definierbar
- Die Tageszeit wird aus allen Sportarten des aktuellen Tages summiert

## Speicherung
AsyncStorage Keys:
- `@sports_v1`: Liste der Sportarten
- `@stats_v1`: Tageswerte je Sportart (`{ sportId: { "YYYY-MM-DD": { reps, seconds } } }`)
- `@settings_v1`: Controller-Einstellungen (ausgewählte Apps, Sprache)

## Android Berechtigungen
Die App nutzt eine Accessibility Service, um Apps im Vordergrund zu erkennen und bei Ablauf der Zeit eine Sperrseite anzuzeigen.
- Zugriffshilfe (Accessibility Service) muss aktiviert werden

Beim ersten Start wird nach der Zugriffshilfe gefragt. Die Freigabe kann jederzeit im Controller-Menü erneut geöffnet werden.

## Entwicklung (Android)
Ein Dev Build ist notwendig (Expo Go auf Android 14 hat Einschränkungen).
`npm install`

## Hinweise
- Die Blocker-Seite führt zurück zum Homescreen, sobald die Zeit aufgebraucht ist.
- Die App ist aktuell Android-only für die App-Auswahl und den Blocker.
