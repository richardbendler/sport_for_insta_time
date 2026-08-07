# Sport for Screen Time

Eine einfache React Native App, die Sport gegen Social-Media-Zeit tauscht.
Workouts erzeugen erspielte Zeit, alles wird lokal gespeichert, und auf Android
koennen ausgewaehlte Apps blockiert werden, sobald die erspielte Zeit verbraucht ist.

Diese README deckt den laufenden Entwickler-Alltag ab: Emulator starten, Release-Builds
erstellen, in die Stores hochladen. Einmalige Einrichtung einer neuen Entwicklungsumgebung
(EAS CLI, native Windows-Umgebung, WSL/Linux für lokale EAS-Builds, Google Play Service
Account) steht in [SETUP.md](SETUP.md).

## Lokal entwickeln (Emulator)
```powershell
# Emulator ueber Android Studio (Device Manager) oder per Kommandozeile starten:
emulator -avd <AVD-Name>

# Bauen + installieren:
npx expo run:android
```

Nur den Metro-Bundler neu starten (App bereits installiert):
```bash
npx expo start --dev-client
```

Falls das Handy nicht im selben Netzwerk ist oder die WLAN-Verbindung blockiert wird (z.B.
restriktives Firmen-/Uni-Netz):
```bash
npx expo start --dev-client --tunnel
```
Etwas langsamer, funktioniert aber unabhängig vom lokalen Netzwerk.

**Bekannte Falle:** Laeuft Android Studio gleichzeitig geoeffnet (z.B. mit offenem Device
Manager), kann `adb devices` gelegentlich einen "Geister"-Eintrag wie `emulator-5562 offline`
zeigen, der keinen echten Prozess dahinter hat und den Build mit einem ADB-Verbindungsfehler
abbrechen laesst. Fix: ADB-Server kurz neu starten und direkt danach erneut bauen:
```powershell
adb kill-server
adb start-server
npx expo run:android
```

## Build und Release
Für eine Store-Version (statt nur lokalem Testen über den Emulator) wird [EAS](https://docs.expo.dev/build/setup/)
verwendet. Einmalige Einrichtung von EAS CLI/Login siehe [SETUP.md](SETUP.md#eas-cli-installieren--einloggen-einmalig).

### Android: Cloud-Build
```bash
eas build --platform android --profile production
```
Der Build laeuft in der Expo Cloud. Den Download-Link findest du danach in der Konsole oder im
Expo Dashboard.

### Android: Lokaler Build (WSL / Linux)
Nützlich bei Warteschlangen/Limits im kostenlosen EAS-Tier. Braucht Linux oder macOS (auch via
WSL) — unter nativem Windows funktioniert nur der Cloud-Build oben oder der `expo run:android`-Weg
von weiter oben. Einmalige Einrichtung der WSL/Linux-Umgebung (Node, Java, Android SDK, EAS CLI)
siehe [SETUP.md](SETUP.md#wsllinux-lokale-eas-builds-einrichten-einmalig).

```bash
cd ~/sport_for_insta_time
printf "sdk.dir=%s\n" "$HOME/Android/Sdk" > android/local.properties
npm ci --include=dev || (rm -rf node_modules package-lock.json && npm install)
eas build --platform android --profile production --local
```

APK nach Windows kopieren:
```bash
cp /pfad/zur/app-release.apk /mnt/c/Users/<DEIN_USER>/Desktop/
```

### iOS: Cloud-Build
1. Apple-Zugangsdaten: `eas credentials` hilft beim Hochladen von Zertifikaten/Profilen; beim ersten Build legt Expo das für dich an, wenn du mit deinem Apple Developer Account verknüpft bist.
2. Stelle sicher, dass die App in App Store Connect angelegt ist (Bundle-ID `com.richardbendler.sportforscreentime`, Sprache Englisch US).
3. Starte den Cloud Build mit dem iOS-Profil:

```bash
eas build --platform ios --profile production
```

Nach Abschluss erhältst du im Expo Dashboard den Download-Link für das `.ipa`; du findest dort
auch Build-Logs.

#### iOS lokal vorbereiten (nur macOS)
```bash
npm install
npx expo prebuild --platform ios
npx eas build --platform ios --profile production
```

## In die Stores hochladen (eas submit)
Für automatisierte Uploads ohne manuellen Weg über die Play-Console-Weboberfläche braucht EAS
ein Google-Cloud-Dienstkonto mit Freigabe in der Play Console. Die einmalige Einrichtung
(Cloud-Projekt, Dienstkonto, Play-Console-Berechtigungen, JSON-Key ablegen,
`serviceAccountKeyPath` in `eas.json`) steht in
[SETUP.md](SETUP.md#google-play-service-account--eas-submit-android--einmalig) — hier nur die
tägliche Nutzung.

**Aktueller Stand:** Es wird ein gemeinsames Dienstkonto
(`play-console-releases@play-console-access-504713.iam.gserviceaccount.com`) für **beide** Apps
genutzt (Sport for Screen Time **und** The One - Trinkspielbar), im selben Cloud-Projekt
`play-console-access`.

### Android (Google Play)
**Wichtig:** `eas submit` lädt standardmäßig **nicht** direkt live in Production hoch. Es
gibt zwei Submit-Profile in `eas.json`, die genau das steuern - je nachdem, welches du mit
`--profile` angibst, landet der Build in einem anderen Play-Console-Track:

```bash
# Internal-Test-Track: nur für eingeladene Tester sichtbar, geht sofort automatisch "live"
# (aber eben nur für Tester, nicht öffentlich im Play Store):
eas submit --platform android --profile production --latest

# Production-Track: schaltet direkt fuer alle im Play Store sichtbar/installierbar
# (releaseStatus: completed) - kein manueller Freigabe-Klick in der Play Console mehr noetig,
# dafuer auch kein Sicherheitsnetz mehr vor dem Livegang:
eas submit --platform android --profile production-release --latest
```
**Achtung:** `production-release` macht die neue Version sofort für alle Nutzer live (ggf. mit
kurzer Google-Prüfzeit dazwischen) — vorher unbedingt mit dem `production`-Profil (Internal
Track) getestet haben.

`--latest` nimmt in beiden Fällen automatisch den zuletzt erzeugten Build (Cloud oder lokal) -
kein manuelles Suchen/Angeben des `.aab`-Pfads nötig. Läuft dank `serviceAccountKeyPath` in
`eas.json` nicht-interaktiv.

Alternativ ein bestimmter Build (funktioniert mit beiden Profilen, `--profile` entsprechend
austauschen):
```bash
# Bestimmten lokal gebauten AAB hochladen (z.B. nach ./gradlew bundleRelease):
eas submit --platform android --path android/app/build/outputs/bundle/release/app-release.aab --profile production
```

Hinweis: Falls eine App noch nie manuell über die Play-Console-Weboberfläche hochgeladen wurde
(kein einziger Entwurf/Release existiert), verlangt Googles Publishing-API, dass der allererste
Upload manuell passiert – danach funktioniert `eas submit` für alle weiteren Versionen.

### iOS (App Store Connect / TestFlight)
Bei iOS gibt es die Internal/Production-Unterscheidung wie bei Android **nicht** - es gibt
nur ein Submit-Profil, weil `eas submit --platform ios` sowieso nie automatisch öffentlich
live geht. Es lädt den Build lediglich zu App Store Connect hoch (dort landet er zunächst in
TestFlight); die tatsächliche Veröffentlichung im App Store passiert immer manuell über die
Schritte unten ("Submit for Review" + Apples Review-Prozess).
```bash
eas submit --platform ios --profile production --latest
```
Fragt beim ersten Mal interaktiv nach den Apple-Zugangsdaten und speichert sie für künftige
Submits. Apple verlangt pro Version Zertifikate/Provisioning-Profile; `eas credentials` bzw. das
Expo-Dashboard hilft dabei, diese automatisch zu verwalten.

Nach dem Upload in App Store Connect:
1. Wähle deine App, öffne den „Build“-Reiter unter „App-Informationen“, und füge den neuen Build hinzu.
2. Fülle die Metadaten (Screenshots, Beschreibung, Kategorien, Datenschutz, Altersfreigabe) aus, falls noch nicht geschehen.
3. Veröffentliche den Build für eine interne/beta TestFlight-Runde oder reiche ihn zur Prüfung ein. Nach Freigabe kannst du Tester:innen via E-Mail oder öffentlichem Link einladen (Einstellungen > TestFlight > Gruppe/Tester).
4. Für die finale Veröffentlichung: Stelle sicher, dass alle App-Infos, Screenshots und Preisangaben in App Store Connect stehen, und reiche die neue Version zur Prüfung ein („Preparing for Submission“ > „Submit for Review“).

## Features
- Presets: z.B. Liegestuetze, Klimmzuege, Situps, Joggen (mit Icons)
- Eigene Sportarten erstellen, bearbeiten, ausblenden, loeschen, sortieren
- Tracking: Wiederholungen per Tap oder Sprache, Zeit via Start/Stop
- Tagesstatistik, Wochenansicht und Monatskalender (pro Sport und Gesamt)
- Eintraege bearbeiten in der Tagesansicht (pro Sport und in der Gesamtstatistik)
- Widgets: pro Sport und ein Gesamtwidget fuer erspielte Zeit
- Tutorial mit Highlighting, jederzeit in den Einstellungen startbar
- Mehrsprachig (DE/EN/ES/FR)
- Optional: Benachrichtigungen (Android 13+), Mikrofon (Sprachzaehlung), Kamera (Liegestuetz-Zaehlung per Pose Detection)

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
