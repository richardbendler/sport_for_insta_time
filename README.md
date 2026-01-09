# Sport gegen Insta Zeit

Eine einfache React Native App, die Sport gegen Social Media Zeit tauscht. Sportarten und Tageswerte werden lokal gespeichert, und ausgewaehlte Apps koennen auf Android blockiert werden, sobald die verdiente Zeit verbraucht ist.

## Features
- Presets: Liegestuetze, Klimmzuege, Pushups, Joggen
- Eigene Sportarten erstellen, ausblenden oder loeschen
- Tracking: Wiederholungen per Tap, Zeit via Start/Stop
- Tagesstatistik wird gespeichert und taeglich neu gestartet
- Insta Controller: Apps auswaehlen, verdiente Zeit berechnen, Blocker bei Zeitende

## Zeit-Logik
- Wiederholungen: 1 Rep = 1 Minute Social Time
- Zeitbasiert: 1 Sekunde Sport = 1 Sekunde Social Time
- Die Tageszeit wird aus allen Sportarten des aktuellen Tages summiert

## Speicherung
AsyncStorage Keys:
- `@sports_v1`: Liste der Sportarten
- `@stats_v1`: Tageswerte je Sportart (`{ sportId: { "YYYY-MM-DD": { reps, seconds } } }`)
- `@settings_v1`: Controller-Einstellungen (ausgewaehlte Apps)

## Android Berechtigungen
Die App nutzt eine Accessibility Service, um Apps im Vordergrund zu erkennen und bei Ablauf der Zeit eine Sperrseite anzuzeigen.
- Zugriffshilfe (Accessibility Service) muss aktiviert werden
- `QUERY_ALL_PACKAGES` wird verwendet, um installierte Apps zu listen

Beim ersten Start wird nach der Zugriffshilfe gefragt. Die Freigabe kann jederzeit im Controller-Menue erneut geoeffnet werden.

## Entwicklung (Android)
Ein Dev Build ist notwendig (Expo Go auf Android 14 hat Einschraenkungen).

```bash
npm install
npx expo run:android
npx expo start --dev-client
```

## Hinweise
- Die Blocker-Seite fuehrt zurueck zum Homescreen, sobald die Zeit aufgebraucht ist.
- Die App ist aktuell Android-only fuer die App-Auswahl und den Blocker.
