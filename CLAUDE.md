# CLAUDE.md

Anweisungen für Claude Code in diesem Projekt (React-Native/Expo-App, Play Store & App Store).

## Kanarienvogel-Regel
Beginne **jede** Antwort an den Nutzer mit der Nennung des Namens "Richard" (z. B. als Anrede im ersten Satz). Grund: Der Nutzer nutzt dies als Indikator dafür, ob diese CLAUDE.md-Anweisungen noch zuverlässig befolgt werden. Fehlt der Name in einer Antwort, ist das für ihn das Signal, dass die Session zu lang geworden ist und er eine neue Session starten sollte. Diese Regel gilt für jede Antwort, unabhängig von Thema oder Länge, und hat Vorrang vor sonstigen Kürze-Vorgaben.

## Git-Workflow (automatisch, ohne Rückfrage)
Nach **jeder** inhaltlichen Änderung an Dateien in diesem Projekt:
1. Geänderte Dateien gezielt stagen (`git add <dateien>`, kein `git add -A`, keine Secrets/`.env`/Keys mitcommitten)
2. Commit mit kurzer, aussagekräftiger Message erstellen
3. `git push` zum aktuellen Branch auf `origin` durchführen

Diese Anweisung autorisiert Commit + Push im Voraus – keine erneute Rückfrage nötig, außer bei ungewöhnlichen Fällen (z. B. Merge-Konflikte, nötiger Force-Push, versehentlich gefundene Secrets).

## Build
Kein lokaler Build-Schritt zwingend nötig (App läuft über Expo, z. B. `npm start`). Cloud-Builds laufen über EAS (siehe unten).

## Play Store / App Store
`eas.json` enthält eine gültige EAS-Konfiguration für Android (Play-Console-Service-Account) und iOS (Apple Team ID / App Store Connect App-ID). Nach jeder Änderung, die einen neuen Build rechtfertigt (Feature, Bugfix, Versions-Bump):

1. `eas build --platform all --profile production --non-interactive` (Cloud-Build, kein lokales Xcode/Android Studio nötig)
2. `eas submit --platform all --profile production --non-interactive` – lädt den Build automatisch in den internen Test-Bereich hoch (Android: `track: internal`; iOS: App Store Connect/TestFlight). Das ist automatisch und ohne Rückfrage erlaubt, da nicht öffentlich sichtbar.

**Nicht automatisch:** Das Android-Profil `production-release` (`track: production`, `releaseStatus: completed` = voller öffentlicher Rollout) sowie jede Übergabe eines iOS-Builds von TestFlight zur öffentlichen App-Store-Freigabe dürfen **nicht** automatisch ausgeführt werden. Dafür ist immer eine explizite Aufforderung des Nutzers in der jeweiligen Session nötig, da ein öffentlicher Rollout an echte Endnutzer nicht rückgängig zu machen ist.
