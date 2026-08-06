# Sport for Screen Time - SETUP

Diese Datei ist für **einmalige** Einrichtungsschritte gedacht: Projekt auf einer neuen Maschine
komplett neu aufsetzen, native Windows-Entwicklungsumgebung einrichten, lokale EAS-Builds unter
WSL/Linux vorbereiten, sowie den Google Play Service Account für automatisierte Store-Uploads
einrichten. Für den normalen Entwickler-Alltag (Emulator starten, bauen, Expo-Befehle) siehe
[README.md](README.md).

## Windows: native Entwicklungsumgebung einrichten (einmalig)

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

## WSL/Linux: lokale EAS-Builds einrichten (einmalig)

Nur nötig, falls lokal gebaut werden soll (`eas build --local`, siehe
[README.md](README.md#android-apk-lokal-bauen-windows--wsl--ubuntu)), statt in der Expo-Cloud.
`eas-cli` unterstützt lokale Builds **nicht unter nativem Windows** — es braucht Linux oder
macOS, z.B. via WSL.

### Voraussetzungen
- Windows + WSL (Ubuntu) oder Linux
- Node.js >= 20
- Java JDK 17
- Android SDK
- EAS CLI

### 1) WSL / Ubuntu oeffnen
```bash
wsl
```

### 2) Node.js 20 installieren
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
```

### 3) Java 17 installieren
```bash
sudo apt install -y openjdk-17-jdk
echo 'export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64' >> ~/.bash_profile
source ~/.bash_profile
java -version
```

### 4) Android SDK installieren (empfohlen in WSL)
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

### 5) EAS CLI
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

Falls `eas` unter nativem Windows nicht gefunden wird:
```bash
mkdir %APPDATA%\\npm
npx eas-cli build --platform android --profile production
```

## Google Play: Service Account & eas submit (Android) — einmalig

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

### 4) Google Play Android Developer API aktivieren
Zusätzlich zu den Play-Console-Berechtigungen (Schritt 3) muss im Google-Cloud-Projekt
selbst noch die **Google Play Android Developer API** freigeschaltet werden – ohne diesen
Schritt schlägt `eas submit` mit einem Fehler wie folgendem fehl:
```
PERMISSION_DENIED: Google Play Android Developer API has not been used in project
<PROJEKT-NUMMER> before or it is disabled.
```
Fix:
1. Den Link aus der Fehlermeldung öffnen (Format
   `https://console.developers.google.com/apis/api/androidpublisher.googleapis.com/overview?project=<PROJEKT-NUMMER>`),
   oder in der Google Cloud Console manuell zu **APIs & Dienste → Bibliothek** gehen und
   nach „Google Play Android Developer API" suchen.
2. Auf **„Aktivieren"** klicken.
3. Ein paar Minuten warten (die Freischaltung propagiert nicht sofort), dann `eas submit`
   erneut ausführen.

### 5) JSON-Schlüssel sicher ablegen
Die heruntergeladene JSON-Datei **niemals ins Git-Repo committen**. Tatsächlich genutzter
Ort hier: ein verstecktes `.keys`-Verzeichnis **eine Ebene über** beiden Projektordnern
(also im gemeinsamen übergeordneten Ordner, nicht in `sport_for_insta_time` selbst):
```
<übergeordneter Ordner>/
├── .keys/
│   └── play-console-access-504713-dc6c0f3c622b.json
├── sport_for_insta_time/
└── Spiele-App/   (enthaelt Game_RN, eine Ebene tiefer)
```
Der Punkt vor `keys` versteckt den Ordner (z. B. bei `ls`), was zusätzlichen Schutz vor
versehentlichem Commit bietet, da er aber außerhalb des Repos liegt, ist er ohnehin nie Teil
von `git add`. Falls eine solche Datei doch mal versehentlich in einen Projektordner
landet, unbedingt vorher (bevor committed wird) in `.gitignore` eintragen.

**Datei von Windows nach WSL kopieren:** `scp`/SSH funktioniert dafür **nicht** ohne
Weiteres - WSL hat standardmäßig keinen laufenden SSH-Server, daher schlägt z. B.
`scp datei.json richard@<wsl-hostname>:~/.keys` mit "Connection refused" fehl. WSL2 hat
aber direkten Zugriff auf die Windows-Laufwerke unter `/mnt/c/...`, daher reicht ein
normales `cp` **innerhalb von WSL** (nicht in PowerShell ausführen):
```bash
mkdir -p ~/.keys
cp "/mnt/c/Users/richa/Documents/Programmieren/.keys/play-console-access-504713-dc6c0f3c622b.json" ~/.keys/
```

### 6) serviceAccountKeyPath in eas.json
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

Für die tatsächliche Nutzung von `eas build --local` + `eas submit` im Alltag siehe
[README.md](README.md#google-play-service-account--eas-submit-android).
