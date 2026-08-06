# Sport for Screen Time

Eine einfache React Native App, die Sport gegen Social-Media-Zeit tauscht.
Workouts erzeugen erspielte Zeit, alles wird lokal gespeichert, und auf Android
koennen ausgewaehlte Apps blockiert werden, sobald die erspielte Zeit verbraucht ist.

## Erstes Setup (Windows, nativ – lokaler Dev-Build)

Diese Variante baut die App direkt in Windows (kein WSL noetig) und installiert sie auf
einem laufenden Android-Emulator oder einem per USB verbundenen Geraet. Einmalig noetig:

1. **Node.js** installieren (Version passend zu `eas.json`, aktuell 20.x) und pruefen:
   ```powershell
   node -v
   ```
2. **PowerShell-Skriptausfuehrung erlauben** (Windows blockiert `npm`/`npx` standardmaessig,
   da sie als `.ps1`-Skripte laufen):
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```
3. **Android Studio** installieren (bringt SDK, Emulator und eine passende Java-Runtime mit)
   und darin mindestens ein virtuelles Geraet (AVD) anlegen, z.B. "Pixel ...".
4. **Abhaengigkeiten installieren:**
   ```powershell
   npm install
   ```
5. **Umgebungsvariablen setzen** (einmalig pro Windows-Account; Pfade ggf. an die eigene
   Installation anpassen):
   ```powershell
   [System.Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Android\Android Studio\jbr", "User")
   [System.Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
   [System.Environment]::SetEnvironmentVariable("ANDROID_SDK_ROOT", "$env:LOCALAPPDATA\Android\Sdk", "User")
   ```
   Terminal danach einmal neu starten, damit die Variablen greifen. `JAVA_HOME` zeigt hier
   bewusst auf die von Android Studio mitgelieferte Java-Runtime (JBR) statt auf eine separate
   JDK-Installation - Java 21 daraus funktioniert mit dem aktuellen Gradle 8.14.3 Setup dieses
   Projekts.
6. **`android/local.properties` anlegen** (lokal, nicht eingecheckt, zeigt Gradle auf das SDK):
   ```powershell
   "sdk.dir=$($env:LOCALAPPDATA -replace '\\','/')/Android/Sdk" | Set-Content android/local.properties
   ```
   Falls das Projekt schonmal in Android Studio geoeffnet wurde, existiert diese Datei meist
   schon automatisch.

### Taeglich: Emulator starten und App bauen
```powershell
# Emulator ueber Android Studio (Device Manager) oder per Kommandozeile starten:
emulator -avd <AVD-Name>

# Bauen + installieren:
npx expo run:android
```

**Bekannte Falle:** Laeuft Android Studio gleichzeitig geoeffnet (z.B. mit offenem Device
Manager), kann `adb devices` gelegentlich einen "Geister"-Eintrag wie `emulator-5562 offline`
zeigen, der keinen echten Prozess dahinter hat und den Build mit einem ADB-Verbindungsfehler
abbrechen laesst. Fix: ADB-Server kurz neu starten und direkt danach erneut bauen:
```powershell
adb kill-server
adb start-server
npx expo run:android
```

## Expo Befehle (wichtig)
```bash
npx expo run:android
npx expo start --dev-client
```

Fuer lokale EAS-Builds (`eas build --local`) braucht es Linux oder macOS (auch via WSL) -
unter nativem Windows funktioniert nur die Expo-Cloud-Variante weiter unten oder der oben
beschriebene `expo run:android`-Weg:
```bash
eas build --platform android --profile production --local
```

## Expo Cloud Build (EAS)
Falls lokale Builds (WSL) Probleme machen, nutze den Cloud Build.

### Einmalig
```bash
npm i -g eas-cli
eas login
```

Falls `eas` nicht gefunden wird (Windows):
```bash
mkdir %APPDATA%\\npm
npx eas-cli build --platform android --profile production
```

### Android (Production, Cloud)
```bash
eas build --platform android --profile production
```

Hinweis: Der Build laeuft in der Expo Cloud. Den Download-Link findest du danach in der Konsole
oder im Expo Dashboard.

## Google Play: Service Account & eas submit (Android)
Damit `eas submit --platform android` Builds automatisch (ohne manuellen Upload über die
Play-Console-Weboberfläche) hochladen kann, braucht EAS ein **Google-Cloud-Dienstkonto** mit
Freigabe in der Play Console. Einmalig einrichten:

**Wichtig:** Ein Google-Cloud-Projekt reicht für **alle** eigenen Apps zusammen – die
eigentliche Trennung zwischen Apps passiert in der Play Console (Schritt 3, pro-App-Rolle),
nicht auf Cloud-Projekt-Ebene. Also nicht pro App ein neues Cloud-Projekt anlegen, sondern
ein Projekt wiederverwenden.

**Aktueller Stand hier:** Es wird aktuell **ein gemeinsames Dienstkonto**
(`play-console-releases@play-console-access-504713.iam.gserviceaccount.com`) für **beide**
Apps genutzt (Sport for Screen Time **und** The One - Trinkspielbar), im selben Cloud-Projekt
`play-console-access`. Das ist bewusst so gewählt (weniger Verwaltungsaufwand) und für
Hobby-/Soloprojekte völlig ausreichend. Theoretisch könnte man das jederzeit auftrennen –
also pro App ein eigenes Dienstkonto (z. B. `sport-for-screen-time-releases`) im selben
Projekt anlegen und in der Play Console nur für die jeweils eine App freischalten. Vorteil
einer Trennung: Falls der Schlüssel einer App mal kompromittiert wird, ist nur diese eine App
betroffen, nicht beide. Für den aktuellen Zweck (privater Nebenprojekte) ist das nicht nötig.

### 1) Google-Cloud-Projekt wählen
1. Auf https://console.cloud.google.com gehen.
2. Falls es schon ein eigenes Projekt für Play-Console-Zugriffe gibt (z. B. von einer
   anderen App), dieses wiederverwenden. Falls nicht: neues Projekt anlegen, empfohlener
   Name **`play-console-access`** (bewusst nicht app-spezifisch benannt, da es für alle
   Apps gemeinsam genutzt wird).

### 2) Dienstkonto erstellen
1. **IAM & Verwaltung → Dienstkonten → Dienstkonto erstellen**. Name z. B.
   `play-console-releases` (gemeinsam für alle Apps) oder app-spezifisch wie
   `sport-for-screen-time-releases`, falls man später doch auftrennen möchte.
2. Rollen-Zuweisung im Cloud-Projekt selbst kann übersprungen werden – die eigentliche
   Berechtigung kommt aus der Play Console (Schritt 3).
3. Auf das neu erstellte Dienstkonto klicken → Tab **„Keys"** → **„Add Key" → „Create new
   key"** → Typ **JSON** (vorausgewählt/empfohlen, nicht P12) → **„Erstellen"**. Der Browser
   lädt die Datei automatisch herunter.

### 3) Dienstkonto in der Play Console freischalten
1. Play Console → **Nutzer und Berechtigungen → Nutzer einladen**.
2. Als E-Mail-Adresse die Dienstkonto-Adresse eintragen (Format
   `NAME@PROJEKT-ID.iam.gserviceaccount.com`, zu finden in der Cloud Console beim
   Dienstkonto).
3. Unter **App-Berechtigungen** die betroffene(n) App(s) auswählen (hier: „Sport for Screen
   Time", ggf. zusätzlich weitere Apps, falls das Dienstkonto geteilt wird). Bei mehreren
   Apps zeigt Google einen kombinierten Berechtigungs-Dialog „Berechtigungen für N Apps" –
   die gewählten Häkchen gelten dann für alle ausgewählten Apps gemeinsam.
4. Es gibt keine einfache Rollen-Dropdown mehr, sondern einzelne Checkboxen. Für
   `eas submit` (Upload + Release erstellen) genau diese **vier** ankreuzen (die ersten
   beiden sind oft schon vorausgewählt, bitte trotzdem prüfen):
   - **„App-Informationen ansehen (schreibgeschützt)"** – Basis-Leserecht, ohne das der
     Rest nicht richtig funktioniert.
   - **„Informationen zur App-Qualität ansehen (schreibgeschützt)"** – Leserecht für
     Android Vitals/Artefakte/Tracks/Releases.
   - **„Produktionsversionen veröffentlichen, Geräte ausschließen und die Play
     App-Signatur verwenden"** – nötig, damit später auch Production-Releases hochgeladen
     werden können.
   - **„Apps in Test-Tracks veröffentlichen"** – nötig für Uploads in interne/geschlossene/
     offene Test-Tracks (Standard-Track von `eas submit`, wenn in `eas.json` kein `track`
     gesetzt ist).

   Nicht nötig: „Administrator", „App-Entwürfe bearbeiten und löschen", beide
   „Finanzdaten"-Checkboxen, „Test-Tracks verwalten und Testerlisten bearbeiten",
   „App-Präsenz im Play Store verwalten", „Auf Rezensionen antworten", „Richtlinien",
   „Deeplinks verwalten".
5. Oben bei „Ablaufdatum für den Zugriff" den Toggle **ausgeschaltet lassen** (kein
   Ablaufdatum), sonst funktioniert das Dienstkonto irgendwann nicht mehr.
6. Unten auf **„Anwenden"** klicken.

Hinweis: Falls eine App noch nie manuell über die Play-Console-Weboberfläche hochgeladen
wurde (kein einziger Entwurf/Release existiert), verlangt Googles Publishing-API, dass der
allererste Upload manuell passiert – danach funktioniert `eas submit` für alle weiteren
Versionen.

### 4) JSON-Schlüssel sicher ablegen
Die heruntergeladene JSON-Datei **niemals ins Git-Repo committen**. Tatsächlich genutzter
Ort hier: ein verstecktes `.keys`-Verzeichnis **eine Ebene über** beiden Projektordnern
(also im gemeinsamen übergeordneten Ordner, nicht in `sport_for_insta_time` selbst):
```
<übergeordneter Ordner>/
├── .keys/
│   └── play-console-access-504713-dc6c0f3c622b.json
├── sport_for_insta_time/
└── the-one-trinkspielbar/   (oder wie das andere Projekt heißt)
```
Der Punkt vor `keys` versteckt den Ordner (z. B. bei `ls`), was zusätzlichen Schutz vor
versehentlichem Commit bietet, da er aber außerhalb des Repos liegt, ist er ohnehin nie Teil
von `git add`. Falls eine solche Datei doch mal versehentlich in einen Projektordner
landet, unbedingt vorher (bevor committed wird) in `.gitignore` eintragen.

### 5) serviceAccountKeyPath in eas.json
`eas.json` wird über Git versioniert, der folgende Eintrag ist also bereits committet und
kommt bei jedem `git pull` automatisch mit - hier muss normalerweise **nichts** eingetragen
werden:
```json
"submit": {
  "production": {
    "android": {
      "serviceAccountKeyPath": "../.keys/play-console-access-504713-dc6c0f3c622b.json"
    }
  }
}
```
Der relative Pfad (`../.keys/...`) funktioniert auf jeder Maschine automatisch, **solange**
die JSON-Schlüsseldatei dort genau eine Ebene über dem Projektordner in einem `.keys`-Ordner
mit demselben Dateinamen liegt (siehe Schritt 4). Nur falls die Datei auf einer bestimmten
Maschine an einem anderen Ort liegt (anderer Ordnername, andere Verzeichnistiefe, o. Ä.),
muss dieser Pfad dort lokal angepasst werden.

### 6) Verwenden
Tatsächlicher Workflow hier: lokal mit `eas build --local` bauen (nicht `./gradlew` direkt),
danach `eas submit`:
```bash
eas build --platform android --profile production --local
eas submit --platform android --profile production --latest
```
`eas submit --latest` nimmt automatisch den zuletzt lokal erzeugten Build - kein manuelles
Suchen/Angeben des `.aab`-Pfads nötig.

Alternativ (z. B. wenn der Cloud-Build statt des lokalen genutzt werden soll, oder ein
konkreter `.aab`-Pfad übergeben werden muss):
```bash
# Zuletzt gebauten Cloud-Build hochladen:
eas submit --platform android --latest --profile production

# Oder einen bestimmten lokal gebauten AAB hochladen (z.B. nach ./gradlew bundleRelease):
eas submit --platform android --path android/app/build/outputs/bundle/release/app-release.aab --profile production
```

## Apple (iOS) über Expo Cloud
1. Apple-Zugangsdaten: `eas credentials` hilft beim Hochladen von Zertifikaten/Profilen; beim ersten Build legt Expo das für dich an, wenn du mit deinem Apple Developer Account verknüpft bist.
2. Stelle sicher, dass die App in App Store Connect angelegt ist (Bundle-ID `com.richardbendler.sportforscreentime`, Sprache Englisch US).
3. Starte den Cloud Build mit dem iOS-Profil:

```bash
eas build --platform ios --profile production
```

### iOS (lokal vorbereiten / auf macOS)
```bash
# Falls noch nicht installiert:
npm install

# Auf macOS (oder im Apple-Build-Cloud-Job) vor dem Build:
npx expo prebuild --platform ios

# Danach generischen iOS-Build (Expo Cloud oder lokal auf macOS):
npx eas build --platform ios --profile production
```

4. Nach Abschluss erhältst du im Expo Dashboard den Download-Link für das `.ipa`; du findest dort auch Build-Logs.

## Apple: TestFlight / App Store Distribution
1. Lade das `.ipa` aus dem Expo Dashboard herunter oder verwende `eas submit --platform ios --profile production`, um den Upload direkt in App Store Connect zu erledigen.
2. In App Store Connect:
   - Wähle deine App, öffne den „Build“-Reiter unter „App-Informationen“, und füge den neuen Build hinzu.
   - Fülle die Metadaten (Screenshots, Beschreibung, Kategorien, Datenschutz, Altersfreigabe) aus, falls noch nicht geschehen.
   - Veröffentliche den Build für eine interne/beta TestFlight-Runde oder reiche ihn zur Prüfung ein.
3. TestFlight: Nach Freigabe kannst du Tester:innen via E-Mail oder öffentlichem Link einladen (Einstellungen > TestFlight > Gruppe/Tester).
4. Für die finale Veröffentlichung: Stelle sicher, dass alle App-Infos, Screenshots und Preisangaben in App Store Connect stehen, und reiche die neue Version zur Prüfung ein („Preparing for Submission“ > „Submit for Review“).

Hinweis: Apple verlangt pro Version Zertifikate/Provisioning-Profile; `eas credentials` bzw. das Expo-Dashboard hilft dabei, diese automatisch zu verwalten.

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
echo 'export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64' >> ~/.bash_profile
source ~/.bash_profile
java -version
```

#### 4) Android SDK installieren (empfohlen in WSL)
```bash
mkdir -p ~/Android/Sdk/cmdline-tools && cd ~/Android/Sdk/cmdline-tools
wget -O tools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip tools.zip && mkdir -p latest && mv cmdline-tools/* latest/
echo 'export ANDROID_SDK_ROOT=$HOME/Android/Sdk' >> ~/.bash_profile
echo 'export ANDROID_HOME=$HOME/Android/Sdk' >> ~/.bash_profile
echo 'export PATH=$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$ANDROID_SDK_ROOT/platform-tools:$PATH' >> ~/.bash_profile
source ~/.bash_profile
sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0" "ndk;27.1.12297006"
yes | sdkmanager --licenses
```

**Bekanntes Problem (WSL2-Netzwerkbug bei großen Downloads):** Der `sdkmanager`- oder
Gradle-Download der NDK (~1 GB) kann in WSL2 mit einem Fehler wie
`javax.crypto.AEADBadTagException: Tag mismatch!` oder `Failed to install the following
SDK components: ndk;...` abbrechen. Das liegt nicht am Projekt, sondern an einem bekannten
WSL2-Bug: Der virtuelle Netzwerkadapter macht "TCP Checksum Offloading" bei großen
Downloads manchmal falsch, wodurch Pakete bei der TLS-Entschlüsselung als beschädigt
erkannt werden.

Fix (einmalig, in einer **PowerShell als Administrator** unter Windows, nicht in WSL):
```powershell
Get-NetAdapter | Where-Object { $_.InterfaceDescription -match "Hyper-V" }
# Namen aus der Ausgabe uebernehmen, z.B. "vEthernet (WSL (Hyper-V firewall))"
Set-NetAdapterChecksumOffload -Name "vEthernet (WSL (Hyper-V firewall))" -TcpIPv4 Disabled -UdpIPv4 Disabled -IpIPv4 Disabled -TcpIPv6 Disabled -UdpIPv6 Disabled
wsl --shutdown
```
Danach WSL neu starten und den Download erneut versuchen.

Alternativ (schneller, aber nur wenn auf demselben Rechner schon eine Windows-Android-SDK
mit derselben NDK-Version existiert, z.B. von `npx expo run:android`): die NDK-Ordner
direkt kopieren statt neu herunterzuladen:
```bash
cp -r "/mnt/c/Users/<DEIN_USER>/AppData/Local/Android/Sdk/ndk/27.1.12297006" ~/Android/Sdk/ndk/
```
Das ist aber nur ein Workaround für diese eine Maschine - der Netzwerk-Fix oben behebt die
Ursache dauerhaft für jeden Download.

#### 5) EAS CLI
Option A (empfohlen): npm-global in dein Home legen (ohne sudo)

```bash
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.bash_profile
source ~/.bash_profile
```

Dann installieren:

```bash
npm i -g eas-cli
eas --version
eas login
```
Falls `eas` nicht gefunden wird: `source ~/.bash_profile` oder neues WSL-Terminal.

### Build APK
```bash
cd ~/sport_for_insta_time
printf "sdk.dir=%s\n" "$HOME/Android/Sdk" > android/local.properties
npm ci --include=dev || (rm -rf node_modules package-lock.json && npm install)
cd ~/sport_for_insta_time
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
