# Sport for Screen Time

Eine einfache React Native App, die Sport gegen Social Media Zeit tauscht. Sportarten und Tageswerte werden lokal gespeichert, und ausgewählte Apps können auf Android blockiert werden, sobald die verdiente Zeit verbraucht ist.


## Expo Befehle (wichtig)
```bash
npx expo run:android
npx expo start --dev-client
eas build --platform android --local
npx eas build -p android --profile production
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
- `QUERY_ALL_PACKAGES` wird verwendet, um installierte Apps zu listen

Beim ersten Start wird nach der Zugriffshilfe gefragt. Die Freigabe kann jederzeit im Controller-Menü erneut geöffnet werden.

## Entwicklung (Android)
Ein Dev Build ist notwendig (Expo Go auf Android 14 hat Einschränkungen).
`npm install`

## Hinweise
- Die Blocker-Seite führt zurück zum Homescreen, sobald die Zeit aufgebraucht ist.
- Die App ist aktuell Android-only für die App-Auswahl und den Blocker.