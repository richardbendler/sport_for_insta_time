
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  Pressable,
  Switch,
  TextInput,
  ScrollView,
  StyleSheet,
  NativeModules,
  Platform,
  PermissionsAndroid,
  Linking,
  AppState,
  BackHandler,
  Alert,
  Modal,
  useWindowDimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Voice from "@react-native-voice/voice";

const InstaControl = NativeModules.InstaControl;
const AI_CAMERA_ENABLED = false;

const STORAGE_KEYS = {
  sports: "@sports_v1",
  stats: "@stats_v1",
  settings: "@settings_v1",
  permissions: "@permissions_prompted_v1",
  accessibilityDisclosure: "@accessibility_disclosure_v1",
  usagePermissions: "@usage_permissions_prompted_v1",
  notificationsPermissions: "@notifications_permissions_prompted_v1",
  carryover: "@carryover_seconds_v1",
  carryoverDay: "@carryover_day_v1",
  usageSnapshot: "@usage_snapshot_v1",
  logs: "@logs_v1",
  tutorialSeen: "@tutorial_seen_v1",
  workouts: "@workouts_v1",
};


const DEFAULT_SETTINGS = {
  controlledApps: [],
  language: "en",
  prefaceDelaySeconds: 10,
  grayscaleRestrictedApps: false,
};

const SPEECH_LOCALES = {
  de: "de-DE",
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
};

const NUMBER_WORDS = {
  de: [
    "null",
    "eins",
    "ein",
    "zwei",
    "drei",
    "vier",
    "funf",
    "sechs",
    "sieben",
    "acht",
    "neun",
    "zehn",
    "elf",
    "zwolf",
    "dreizehn",
    "vierzehn",
    "funfzehn",
    "sechzehn",
    "siebzehn",
    "achtzehn",
    "neunzehn",
    "zwanzig",
  ],
  en: [
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
    "twenty",
  ],
  es: [
    "cero",
    "uno",
    "dos",
    "tres",
    "cuatro",
    "cinco",
    "seis",
    "siete",
    "ocho",
    "nueve",
    "diez",
    "once",
    "doce",
    "trece",
    "catorce",
    "quince",
    "dieciseis",
    "diecisiete",
    "dieciocho",
    "diecinueve",
    "veinte",
  ],
  fr: [
    "zero",
    "un",
    "deux",
    "trois",
    "quatre",
    "cinq",
    "six",
    "sept",
    "huit",
    "neuf",
    "dix",
    "onze",
    "douze",
    "treize",
    "quatorze",
    "quinze",
    "seize",
    "dixsept",
    "dixhuit",
    "dixneuf",
    "vingt",
  ],
};

const AI_EXERCISES = {
  pushups: {
    id: "pushups",
    minConfidence: 0.5,
    upAngle: 160,
    downAngle: 95,
    minRepMs: 700,
  },
};

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const WEEKDAY_LABELS_BY_LANG = {
  de: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  es: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"],
  fr: ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"],
};
const MONTH_LABELS = {
  de: [
    "Januar",
    "Februar",
    "März",
    "April",
    "Mai",
    "Juni",
    "Juli",
    "August",
    "September",
    "Oktober",
    "November",
    "Dezember",
  ],
  en: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
  es: [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ],
  fr: [
    "Janvier",
    "Février",
    "Mars",
    "Avril",
    "Mai",
    "Juin",
    "Juillet",
    "Août",
    "Septembre",
    "Octobre",
    "Novembre",
    "Décembre",
  ],
};
const DEFAULT_ICON = "⭐";
const PRESET_KEYS = {
  pushups: "pushups",
};

const createDefaultPresetSports = () => {
  const now = Date.now();
  return [
    {
      id: "pushups",
      name: "Pushups",
      type: "reps",
      hidden: false,
      createdAt: now,
    },
  ];
};

const PRESET_IDS_TO_REMOVE = new Set(["pullups", "pushups_alt", "jogging"]);

const pruneNonPushupPresets = (sportsList) =>
  sportsList.filter((sport) => !PRESET_IDS_TO_REMOVE.has(sport.id));

const ensurePushupPreset = (sportsList) => {
  if (sportsList.some((sport) => sport.id === "pushups")) {
    return sportsList;
  }
  const pushupPreset = createDefaultPresetSports().find(
    (sport) => sport.id === "pushups"
  );
  return pushupPreset ? [pushupPreset, ...sportsList] : sportsList;
};

const COLORS = {
  ink: "#0b1020",
  amber: "#f59e0b",
  ember: "#ef4444",
  olive: "#22c55e",
  background: "#0f172a",
  surface: "rgba(148, 163, 184, 0.12)",
  card: "rgba(15, 23, 42, 0.72)",
  cardSolid: "#111827",
  cardAlt: "rgba(148, 163, 184, 0.18)",
  cardDark: "rgba(2, 6, 23, 0.9)",
  sportCard: "rgba(15, 23, 42, 0.9)",
  overlay: "rgba(3, 7, 18, 0.94)",
  modalSurface: "rgba(15, 23, 42, 0.96)",
  menuSurface: "rgba(30, 41, 59, 0.95)",
  text: "#f8fafc",
  muted: "rgba(226, 232, 240, 0.7)",
  accent: "#f59e0b",
  accentDark: "rgba(245, 158, 11, 0.85)",
  success: "rgba(34, 197, 94, 0.9)",
  warning: "rgba(245, 158, 11, 0.9)",
  danger: "rgba(239, 68, 68, 0.9)",
  white: "#f8fafc",
};

const SportTitleSlots = ({ sport, sportLabel }) => {
  const [slotWidth, setSlotWidth] = useState(0);
  const updateSlotWidth = useCallback((width) => {
    setSlotWidth((prev) => Math.max(prev, width));
  }, []);
  const slotStyle = slotWidth ? { width: slotWidth } : undefined;
  return (
    <View style={styles.sportTitleCenterRow}>
      <View
        style={[styles.titleSideSlot, slotStyle]}
        onLayout={(event) => updateSlotWidth(event.nativeEvent.layout.width)}
      >
        <Text style={styles.sportIcon}>{sport.icon || DEFAULT_ICON}</Text>
      </View>
      <Text style={styles.sportName} numberOfLines={1}>
        {sportLabel}
      </Text>
      <View
        style={[styles.titleSideSlot, slotStyle]}
        onLayout={(event) => updateSlotWidth(event.nativeEvent.layout.width)}
      >
        {sport.supportsAi ? (
          <View style={styles.aiBadge}>
            <Text style={styles.aiBadgeText}>AI</Text>
          </View>
        ) : (
          <View style={styles.aiBadgePlaceholder} />
        )}
      </View>
    </View>
  );
};

const STRINGS = {
  de: {
    "app.title": "Sport für Screen Time",
    "menu.home": "Einzelne Übungen",
    "menu.sports": "Deine Sportarten",
    "menu.apps": "Eingeschränkte Apps bearbeiten",
    "menu.settings": "Einstellungen",
    "menu.workout": "Workout",
    "menu.stats": "Statistik",
    "menu.language": "Sprache",
    "menu.preface": "Vorschaltseite",
    "label.today": "Heute",
    "label.week": "Woche",
    "label.month": "Monat",
    "label.weekScreenTime": "Erspielte Zeit Woche",
    "label.screenTime": "Erspielte Zeit",
    "label.screenTimeTitle": "Screen Time",
    "label.screenTimeHint": "Summe der erspielten Bildschirmzeit aus den letzten 24h.",
    "label.remaining": "Übrig",
    "label.remainingHint": "Zeit, die aktuell noch genutzt werden darf.",
    "label.editEntries": "Einträge bearbeiten",
    "label.deleteAllEntries": "Alle Einträge (diese Sportart) löschen",
    "label.deleteAllEntriesGlobal": "Alle Einträge löschen",
    "label.editSport": "Sportart bearbeiten",
    "label.editEntry": "Eintrag bearbeiten",
    "label.dayDetails": "Tagesdetails",
    "label.noEntries": "Keine Einträge",
    "label.breakdown": "Aufschlüsselung",
    "label.save": "Speichern",
    "label.editHint": "Nur verringern möglich.",
    "label.confirmDeleteAll": "Sicher, dass du alle Einträge löschen willst?",
    "label.confirmDeleteAllGlobal":
      "Sicher, dass du wirklich alle Einträge aller Sportarten löschen willst?",
    "label.overallStats": "Gesamtstatistik",
    "label.overallStatsHint":
      "Einträge bearbeiten geht nur in der jeweiligen Sportart über die Statistik.",
    "label.runningSession": "Laufende Session",
    "label.workoutTimer": "Workout-Timer",
    "label.startWorkout": "Workout starten",
    "label.endWorkout": "Workout beenden",
    "label.workoutExercises": "Übungen",
    "label.workoutHistory": "Vergangene Workouts",
    "label.workoutRunning": "Workout läuft noch",
    "label.workoutDetail": "Workout-Details",
    "label.workoutDuration": "Dauer",
    "label.availableToday": "Heute verfügbar",
    "label.used": "Verbraucht",
    "label.permissions": "Berechtigungen",
    "label.permissionsIntro":
      "Damit Screen Time berechnet und Apps blockiert werden können, braucht die App Zugriff. Du wirst jetzt zu den Einstellungen geführt.",
      "label.gettingStarted": "Erste Schritte",
      "label.permissionsNeeded": "Diese Berechtigungen sind erforderlich, damit die App funktioniert.",
      "label.permissionsHint": "Tippe, um alles einzurichten",
      "label.accessibilityTitle": "Zugriffshilfe",
      "label.accessibilityReason": "N\u00f6tig, um die Vordergrund-App zu erkennen und gesperrte Apps zu blockieren.",
      "label.accessibilitySteps": "Einstellungen > Zugriffshilfe > Sport for Screen Time > Aktivieren",
      "label.usageAccessTitle": "Nutzungszugriff",
      "label.usageAccessReason": "N\u00f6tig, um App-Nutzung zu erkennen und Zeiten zu berechnen.",
      "label.usageAccessSteps": "Einstellungen > Nutzungszugriff > Sport for Screen Time",
      "label.notificationsTitle": "Benachrichtigungen",
      "label.notificationsOptional": "Optional",
      "label.notificationsReason": "Optional, um an Timer oder Trainings erinnert zu werden.",
      "label.notificationsSteps": "Einstellungen > Benachrichtigungen > Sport for Screen Time > Erlauben",
    "label.notificationsButton": "Benachrichtigungen verwalten",
    "label.notificationsPromptTitle": "Benachrichtigungen",
    "label.notificationsPromptBody": "Wir nutzen Benachrichtigungen, um dich an Timer oder Trainings zu erinnern. Das ist optional.",
    "label.notificationsPromptConfirm": "Erlauben",
    "label.notificationsPromptCancel": "Nicht jetzt",
    "label.notificationsNotRequired": "Auf dieser Android-Version nicht nötig.",
    "label.status": "Status",
    "label.statusOverview": "Status",
    "label.quickActions": "Quick actions",
    "label.sectionData": "Data",
    "label.statusOverview": "Status",
    "label.quickActions": "Schnellzugriff",
    "label.sectionData": "Daten",
    "label.resetData": "App zurücksetzen",
    "label.resetDataHint": "Löscht Sportarten, Statistik, Logs und Einstellungen.",
    "label.confirmResetData": "Willst du wirklich alle App-Daten löschen?",
    "label.carryover": "Übertrag",
    "label.carryoverHint":
      "Restzeit aus Übungen, die älter als 24h sind. Sie halbiert sich alle 24h weiter.",
    "label.usageAccess": "Nutzungszugriff",
    "label.usageAccessHint":
      "Damit Apps nach Nutzungszeit sortiert werden k?nnen, braucht die App Nutzungszugriff.",
    "label.openUsageAccess": "Zugriff erlauben",
    "label.usageAccessMissing": "Nutzungszugriff fehlt",
    "label.usageAccessActive": "Nutzungszugriff aktiv",
    "label.later": "Später",
    "label.apps": "Apps auswählen",
    "label.openApps": "Apps verwalten",
    "label.grayscaleRestrictedApps": "Eingeschränkte Apps in Schwarz-Weiß",
    "label.grayscaleRestrictedAppsHint":
      "Zeigt blockierte Apps in der Liste mit einem Schwarz-Weiß-Stil an.",
    "label.closeApps": "Apps schließen",
    "label.searchApps": "Apps suchen",
    "label.noApps": "Keine Apps gefunden.",
    "label.accessibilityMissing": "Zugriffshilfe fehlt",
    "label.accessibilityActive": "Zugriffshilfe aktiv",
    "label.permissionNeeded": "Zugriffshilfe nötig",
    "label.accessibilityDisclosureTitle": "Zugriffshilfe erforderlich",
    "label.accessibilityDisclosureBody":
      "Wir nutzen die Zugriffshilfe, um die Vordergrund-App zu erkennen und gesperrte Apps zu blockieren. Wir lesen oder teilen keine Inhalte aus deinen Apps.",
    "label.accessibilityDisclosureConfirm": "Zugriff erlauben",
    "label.accessibilityDisclosureCancel": "Später",
    "label.hiddenShow": "Versteckte Sportarten anzeigen",
    "label.hiddenHide": "Versteckte Sportarten verbergen",
    "label.screenRateReps": "Screen Time pro Wiederholung (Minuten)",
    "label.screenRateTime": "Screen Time pro Sport-Minute (Minuten)",
    "label.weekOverview": "Tagesübersicht",
    "label.weekTotal": "Diese Woche",
    "label.noSports": "Keine aktiven Sportarten. Füge neue hinzu.",
    "label.todayScreenTime": "Erspielte Zeit",
    "label.widgets": "Widgets",
    "label.widget": "Widget auf Startbildschirm",
    "label.widgetOverall": "Allgemeines Widget",
    "label.recentActivity": "Letzte Aktivit\u00e4t",
    "label.recentActivityEmpty": "Keine Eintr\u00e4ge vorhanden.",
    "label.statsBySport": "Statistik nach Sportart",
    "label.iconChoose": "Icon wählen",
    "label.iconPlaceholder": "Ein Icon",
    "label.addSport": "Neue Sportart",
    "label.reps": "Wiederholungen",
    "label.repsShort": "Wdh.",
    "label.timeUnit": "Zeit",
    "label.weightExercise": "Gewichtsübung",
    "label.weightFactor": "Faktor (1-10)",
    "label.weightFactorHint":
      "Screen Time = Gewicht × Wdh. × Faktor ÷ 50 (Sekunden).",
    "label.weightFactorGuide":
      "Wähle 1–10: nah an 1 für leichte Sets, nah an 10 für schwere oder langsame Wiederholungen.",
    "label.weightEntryButton": "Satz eintragen",
    "label.weightEntryPreview": "Screen Time (Vorschau)",
    "label.weightEntryWeight": "Gewicht (kg)",
    "label.weightEntryReps": "Wiederholungen",
    "label.timeBased": "Zeitbasiert",
    "label.typeHelp":
      "Wiederholungen: für Zählen (z.B. 10 Liegestütze). Zeitbasiert: für Minuten/Sekunden (z.B. 15 Minuten Joggen).",
    "label.activateNow": "Jetzt aktivieren",
    "label.loadApps": "Apps laden",
    "label.androidOnly": "App-Auswahl ist nur auf Android verfügbar.",
    "label.accessibilityHint":
      "Aktiviere die Zugriffshilfe, damit Social Apps gesperrt werden können.",
    "label.settingsHint":
      "Aktiviere die Zugriffshilfe, damit die App Social Apps blockieren kann, wenn die Zeit aufgebraucht ist.",
    "label.changeLanguage": "Sprache ändern",
    "label.prefaceSettings": "Vorschaltseite",
    "label.prefaceDelay": "Wartezeit (Sekunden)",
    "label.tapAnywhere": "Tippe irgendwo",
    "label.voiceOn": "Mikrofon an",
    "label.voiceOff": "Mikrofon aus",
    "label.voiceListening": "Hört zu...",
    "label.voiceIdle": "Bereit",
    "label.voiceHint": "Zähle laut, die App zählt mit (Mikrofonzugriff nötig, Beta).",
    "label.voicePermissionMissing": "Mikrofon-Zugriff fehlt",
    "label.voiceError": "Spracherkennung fehlgeschlagen",
    "label.voiceUnavailable": "Spracherkennung nicht verfügbar",
    "label.aiStart": "AI-Zählen starten",
    "label.aiStop": "AI stoppen",
    "label.aiHint": "Kamera seitlich platzieren, Oberkörper sichtbar halten.",
    "label.aiHintInline": "AI zählt Push-ups automatisch (Kamera nötig).",
    "label.aiPermission": "Kamera-Zugriff fehlt oder wurde verweigert.",
    "label.aiLoading": "Kamera wird geladen...",
    "label.aiUnavailable": "AI-Kamera ist vorübergehend deaktiviert.",
    "label.aiUnavailableInline": "AI-Training ist derzeit deaktiviert.",
    "label.back": "Zurück",
    "label.start": "Start",
    "label.stop": "Stop",
    "label.track": "Tracken",
    "label.hide": "Ausblenden",
    "label.show": "Einblenden",
    "label.delete": "Löschen",
    "label.add": "Hinzufügen",
    "label.active": "Aktiv",
    "label.off": "Aus",
    "label.confirmTitle": "Sicher?",
    "label.confirmDelete": "Sicher, dass du löschen willst?",
    "label.confirmHide": "Sicher, dass du ausblenden willst?",
    "label.confirmShow": "Sicher, dass du einblenden willst?",
    "label.confirm": "Ja",
    "label.cancel": "Abbrechen",
    "placeholder.sportName": "Name (z.B. Situps)",
    "language.de": "Deutsch",
    "language.en": "Englisch",
    "language.es": "Spanisch",
    "language.fr": "Französisch",
    "sport.pushups": "Liegestütze",
    "sport.pullups": "Klimmzüge",
    "sport.situps": "Situps",
    "sport.jogging": "Joggen",
    "label.tutorial": "Tutorial",
    "label.tutorialHint": "Kurze Einf\u00fchrung in die wichtigsten Bereiche.",
    "label.tutorialStart": "Tutorial starten",
    "tutorial.step.overview.title": "Deine Bildschirmzeit",
    "tutorial.step.overview.body":
      "Hier siehst du erspielte Zeit, Restzeit und den \u00dcbertrag.",
    "tutorial.step.openSport.title": "Sportart \u00f6ffnen",
    "tutorial.step.openSport.body":
      "Tippe eine Sportkarte an, um sie zu tracken.",
    "tutorial.step.addSport.title": "Neue Sportart",
    "tutorial.step.addSport.body": "Tippe auf +, um eine Sportart hinzuzuf\u00fcgen.",
    "tutorial.step.track.title": "Training tracken",
    "tutorial.step.track.body.reps":
      "Tippe einmal in die gro\u00dfe Fl\u00e4che, um eine Wiederholung zu z\u00e4hlen.",
    "tutorial.step.track.body.time": "Tippe auf Start, um den Timer zu starten.",
    "tutorial.step.back.title": "Zur\u00fcck zur \u00dcbersicht",
    "tutorial.step.back.body":
      "Mit Zur\u00fcck gelangst du wieder zur Sport-\u00dcbersicht.",
    "tutorial.step.openSettings.title": "Einstellungen \u00f6ffnen",
    "tutorial.step.openSettings.body":
      "Tippe auf Einstellungen f\u00fcr Apps, Berechtigungen und mehr.",
    "tutorial.step.openApps.title": "Eingeschr\u00e4nkte Apps",
    "tutorial.step.openApps.body":
      "Tippe auf Apps, um auszuw\u00e4hlen, welche Anwendungen eingeschr\u00e4nkt bleiben.",
    "tutorial.step.finish.title": "Fertig",
    "tutorial.step.finish.body":
      "Du kannst das Tutorial jederzeit über den Tutorial-Button oben rechts im Tab 'Einzelne Übungen' im Hauptmenü starten.",
    "tutorial.step.singleExercises.title": "Einzelne Übungen",
    "tutorial.step.singleExercises.body":
      "Im Tab Einzelne Übungen findest du deine Sportarten und kannst sie direkt antippen.",
    "tutorial.step.workout.title": "Workout-Tab",
    "tutorial.step.workout.body":
      "Im Workout-Tab startest du ein getracktes Training und zählst deine Übungen während der Session.",
    "tutorial.cta.next": "Weiter",
    "tutorial.cta.skip": "\u00dcberspringen",
    "tutorial.cta.exit": "Tutorial abbrechen",
    "tutorial.cta.done": "Fertig",
  },
  en: {
    "app.title": "Sport for Screen Time",
    "menu.home": "Single exercises",
    "menu.sports": "Your sports",
    "menu.apps": "Edit restricted apps",
    "menu.settings": "Settings",
    "menu.workout": "Workout",
    "menu.stats": "Stats",
    "menu.language": "Language",
    "menu.preface": "Preface screen",
    "label.today": "Today",
    "label.week": "Week",
    "label.month": "Month",
    "label.weekScreenTime": "Earned time week",
    "label.screenTime": "Earned time",
    "label.screenTimeTitle": "Screen Time",
    "label.screenTimeHint": "Total earned screen time from the last 24h.",
    "label.remaining": "Remaining",
    "label.remainingHint": "Time that is still available to use.",
    "label.editEntries": "Edit entries",
    "label.deleteAllEntries": "Delete entries (this sport)",
    "label.deleteAllEntriesGlobal": "Delete all entries",
    "label.editSport": "Edit sport",
    "label.editEntry": "Edit entry",
    "label.dayDetails": "Day details",
    "label.noEntries": "No entries",
    "label.breakdown": "Breakdown",
    "label.save": "Save",
    "label.editHint": "Only reducing is possible.",
    "label.confirmDeleteAll": "Are you sure you want to delete all entries?",
    "label.confirmDeleteAllGlobal":
      "Are you sure you want to delete all entries for all sports?",
    "label.overallStats": "Overall stats",
    "label.overallStatsHint":
      "To edit entries, open a sport from the main menu and then its stats.",
    "label.runningSession": "Running session",
    "label.workoutTimer": "Workout timer",
    "label.startWorkout": "Start workout",
    "label.endWorkout": "End workout",
    "label.workoutExercises": "Exercises",
    "label.workoutHistory": "Past workouts",
    "label.workoutRunning": "Workout running",
    "label.workoutDetail": "Workout details",
    "label.workoutDuration": "Duration",
    "label.availableToday": "Available today",
    "label.used": "Used",
    "label.permissions": "Permissions",
    "label.permissionsIntro":
      "To track screen time and block apps, the app needs access. You'll be sent to settings now.",
      "label.gettingStarted": "Getting started",
      "label.permissionsNeeded": "These permissions are required for the app to work.",
      "label.permissionsHint": "Tap to set everything up",
      "label.accessibilityTitle": "Accessibility",
      "label.accessibilityReason": "Needed to detect the foreground app and block restricted apps.",
      "label.accessibilitySteps": "Settings > Accessibility > Sport for Screen Time > Enable",
      "label.usageAccessTitle": "Usage access",
      "label.usageAccessReason": "Needed to read app usage and calculate time.",
      "label.usageAccessSteps": "Settings > Usage access > Sport for Screen Time",
      "label.notificationsTitle": "Notifications",
      "label.notificationsOptional": "Optional",
      "label.notificationsReason": "Optional, for timer or training reminders.",
      "label.notificationsSteps": "Settings > Notifications > Sport for Screen Time > Allow",
    "label.notificationsButton": "Manage notifications",
    "label.notificationsPromptTitle": "Notifications",
    "label.notificationsPromptBody": "We use notifications to remind you about timers or training. This is optional.",
    "label.notificationsPromptConfirm": "Allow",
    "label.notificationsPromptCancel": "Not now",
    "label.notificationsNotRequired": "Not required on this Android version.",
    "label.status": "Status",
    "label.resetData": "Reset app data",
    "label.resetDataHint": "Deletes sports, stats, logs, and settings.",
    "label.confirmResetData": "Are you sure you want to delete all app data?",
    "label.carryover": "Carryover",
    "label.carryoverHint":
      "Remaining time from sessions older than 24h. It halves every 24h after that.",
    "label.usageAccess": "Usage access",
    "label.usageAccessHint":
      "Allow usage access so apps can be sorted by usage time.",
    "label.openUsageAccess": "Allow access",
    "label.usageAccessMissing": "Usage access missing",
    "label.usageAccessActive": "Usage access active",
    "label.later": "Later",
    "label.apps": "Choose apps",
    "label.openApps": "Manage apps",
    "label.grayscaleRestrictedApps": "Show restricted apps in monochrome",
    "label.grayscaleRestrictedAppsHint":
      "Render restricted apps in the list with a black-and-white style.",
    "label.closeApps": "Close apps",
    "label.searchApps": "Search apps",
    "label.noApps": "No apps found.",
    "label.accessibilityMissing": "Accessibility missing",
    "label.accessibilityActive": "Accessibility active",
    "label.permissionNeeded": "Accessibility required",
    "label.accessibilityDisclosureTitle": "Accessibility required",
    "label.accessibilityDisclosureBody":
      "We use Accessibility to detect which app is in the foreground and to block restricted apps when your earned screen time is used up. We do not read or share any content from your apps.",
    "label.accessibilityDisclosureConfirm": "Allow access",
    "label.accessibilityDisclosureCancel": "Not now",
    "label.hiddenShow": "Show hidden sports",
    "label.hiddenHide": "Hide hidden sports",
    "label.screenRateReps": "Screen Time per rep (minutes)",
    "label.screenRateTime": "Screen Time per sport minute (minutes)",
    "label.weekOverview": "Daily overview",
    "label.weekTotal": "This week",
    "label.noSports": "No active sports. Add new ones.",
    "label.todayScreenTime": "Earned time",
    "label.widgets": "Widgets",
    "label.widget": "Widget on home screen",
    "label.widgetOverall": "General widget",
    "label.recentActivity": "Recent activity",
    "label.recentActivityEmpty": "No recent entries yet.",
    "label.statsBySport": "Stats by sport",
    "label.iconChoose": "Choose icon",
    "label.iconPlaceholder": "One icon",
    "label.addSport": "New sport",
    "label.reps": "Repetitions",
    "label.repsShort": "reps",
    "label.timeUnit": "Time",
    "label.weightExercise": "Weight exercise",
    "label.weightFactor": "Factor (1-10)",
    "label.weightFactorHint":
      "Screen time = weight × reps × factor ÷ 50 (seconds).",
    "label.weightFactorGuide":
      "Pick 1–10: lower for light sets, higher for slow heavy efforts.",
    "label.weightEntryButton": "Log set",
    "label.weightEntryPreview": "Screen time preview",
    "label.weightEntryWeight": "Weight (kg)",
    "label.weightEntryReps": "Reps",
    "label.timeBased": "Time-based",
    "label.typeHelp":
      "Repetitions: for counting sets (e.g. 10 push-ups). Time-based: for minutes/seconds (e.g. 15 minutes jogging).",
    "label.activateNow": "Enable now",
    "label.loadApps": "Load apps",
    "label.androidOnly": "App selection is Android-only.",
    "label.accessibilityHint": "Enable accessibility to block social apps.",
    "label.settingsHint":
      "Enable accessibility so the app can block social apps when time is up.",
    "label.changeLanguage": "Change language",
    "label.prefaceSettings": "Preface screen",
    "label.prefaceDelay": "Wait time (seconds)",
    "label.tapAnywhere": "Tap anywhere",
    "label.voiceOn": "Mic on",
    "label.voiceOff": "Mic off",
    "label.voiceListening": "Listening...",
    "label.voiceIdle": "Ready",
    "label.voiceHint": "Say numbers out loud to count (microphone access required, beta).",
    "label.voicePermissionMissing": "Microphone access missing",
    "label.voiceError": "Speech recognition failed",
    "label.voiceUnavailable": "Speech recognition unavailable",
    "label.aiStart": "Start AI counting",
    "label.aiStop": "Stop AI",
    "label.aiHint": "Place the camera sideways and keep your upper body visible.",
    "label.aiHintInline": "AI counts push-ups automatically (camera required).",
    "label.aiPermission": "Camera access is missing or denied.",
    "label.aiLoading": "Loading camera...",
    "label.aiUnavailable": "AI camera is temporarily unavailable.",
    "label.aiUnavailableInline": "AI training is temporarily unavailable.",
    "label.back": "Back",
    "label.start": "Start",
    "label.stop": "Stop",
    "label.track": "Track",
    "label.hide": "Hide",
    "label.show": "Show",
    "label.delete": "Delete",
    "label.add": "Add",
    "label.active": "On",
    "label.off": "Off",
    "label.confirmTitle": "Are you sure?",
    "label.confirmDelete": "Are you sure you want to delete?",
    "label.confirmHide": "Are you sure you want to hide it?",
    "label.confirmShow": "Are you sure you want to show it?",
    "label.confirm": "Yes",
    "label.cancel": "Cancel",
    "placeholder.sportName": "Name (e.g. Situps)",
    "language.de": "German",
    "language.en": "English",
    "language.es": "Spanish",
    "language.fr": "French",
    "sport.pushups": "Push-ups",
    "sport.pullups": "Pull-ups",
    "sport.situps": "Situps",
    "sport.jogging": "Jogging",
    "label.tutorial": "Tutorial",
    "label.tutorialHint": "Short walkthrough of the main areas.",
    "label.tutorialStart": "Start tutorial",
    "tutorial.step.overview.title": "Your screen time",
    "tutorial.step.overview.body":
      "Here you see earned time, remaining time, and carryover.",
    "tutorial.step.openSport.title": "Open a sport",
    "tutorial.step.openSport.body": "Tap any sport card to track it.",
    "tutorial.step.addSport.title": "Add a sport",
    "tutorial.step.addSport.body": "Tap + to add a new sport.",
    "tutorial.step.track.title": "Track a session",
    "tutorial.step.track.body.reps": "Tap the big area once to log a rep.",
    "tutorial.step.track.body.time": "Tap Start to begin a timer.",
    "tutorial.step.back.title": "Back to overview",
    "tutorial.step.back.body": "Use Back to return to your sports list.",
    "tutorial.step.openSettings.title": "Open settings",
    "tutorial.step.openSettings.body":
      "Tap Settings to manage apps and permissions.",
    "tutorial.step.openApps.title": "Restricted apps",
    "tutorial.step.openApps.body":
      "Tap Apps to pick which applications you want to restrict.",
    "tutorial.step.finish.title": "All set",
    "tutorial.step.finish.body":
      "You can restart this tutorial anytime from the main menu by tapping the Tutorial button in the top-right of Single exercises.",
    "tutorial.step.singleExercises.title": "Single exercises",
    "tutorial.step.singleExercises.body":
      "The Single exercises tab keeps your sports ready for tracking, just tap one to start.",
    "tutorial.step.workout.title": "Workout tab",
    "tutorial.step.workout.body":
      "Use Workout to time a session and tap each exercise you do to log it for the active workout.",
    "tutorial.cta.next": "Next",
    "tutorial.cta.skip": "Skip",
    "tutorial.cta.exit": "Exit tutorial",
    "tutorial.cta.done": "Done",
  },
  es: {
    "app.title": "Deporte por tiempo de pantalla",
    "menu.home": "Ejercicios individuales",
    "menu.sports": "Tus deportes",
    "menu.apps": "Editar apps restringidas",
    "menu.settings": "Ajustes",
    "menu.workout": "Workout",
    "menu.stats": "Estadísticas",
    "menu.language": "Idioma",
    "menu.preface": "Pantalla previa",
    "label.today": "Hoy",
    "label.week": "Semana",
    "label.month": "Mes",
    "label.weekScreenTime": "Tiempo ganado semanal",
    "label.screenTime": "Tiempo ganado",
    "label.screenTimeTitle": "Tiempo de pantalla",
    "label.screenTimeHint": "Tiempo total ganado en las ultimas 24h.",
    "label.remaining": "Restante",
    "label.remainingHint": "Tiempo que aun puedes usar.",
    "label.editEntries": "Editar entradas",
    "label.deleteAllEntries": "Borrar entradas (este deporte)",
    "label.deleteAllEntriesGlobal": "Borrar todas",
    "label.editSport": "Editar deporte",
    "label.editEntry": "Editar entrada",
    "label.dayDetails": "Detalles del día",
    "label.noEntries": "Sin entradas",
    "label.breakdown": "Desglose",
    "label.save": "Guardar",
    "label.editHint": "Solo se puede reducir.",
    "label.confirmDeleteAll": "¿Seguro que quieres borrar todas las entradas?",
    "label.confirmDeleteAllGlobal":
      "¿Seguro que quieres borrar todas las entradas de todos los deportes?",
    "label.overallStats": "Estadísticas generales",
    "label.overallStatsHint":
      "Para editar entradas, abre un deporte y luego su estadística.",
    "label.runningSession": "Sesión activa",
    "label.workoutTimer": "Temporizador de entrenamiento",
    "label.startWorkout": "Iniciar entrenamiento",
    "label.endWorkout": "Finalizar entrenamiento",
    "label.workoutExercises": "Ejercicios",
    "label.workoutHistory": "Entrenamientos anteriores",
    "label.workoutRunning": "Entrenamiento activo",
    "label.workoutDetail": "Detalles del entrenamiento",
    "label.workoutDuration": "Duración",
    "label.availableToday": "Disponible hoy",
    "label.used": "Usado",
    "label.permissions": "Permisos",
    "label.permissionsIntro":
      "Para medir el tiempo de pantalla y bloquear apps, la app necesita acceso. Ahora te llevaremos a ajustes.",
      "label.gettingStarted": "Comencemos",
      "label.permissionsNeeded": "Estos permisos son necesarios para que la app funcione.",
      "label.permissionsHint": "Toca para configurarlo todo",
      "label.accessibilityTitle": "Accesibilidad",
      "label.accessibilityReason": "Necesario para detectar la app en primer plano y bloquear apps restringidas.",
      "label.accessibilitySteps": "Configuraci\u00f3n > Accesibilidad > Sport for Screen Time > Activar",
      "label.usageAccessTitle": "Acceso de uso",
      "label.usageAccessReason": "Necesario para leer el uso de apps y calcular el tiempo.",
      "label.usageAccessSteps": "Configuraci\u00f3n > Acceso de uso > Sport for Screen Time",
      "label.notificationsTitle": "Notificaciones",
      "label.notificationsOptional": "Opcional",
      "label.notificationsReason": "Opcional, para recordatorios del temporizador o entrenamiento.",
      "label.notificationsSteps": "Configuraci\u00f3n > Notificaciones > Sport for Screen Time > Permitir",
    "label.notificationsButton": "Administrar notificaciones",
    "label.notificationsPromptTitle": "Notificaciones",
    "label.notificationsPromptBody": "Usamos notificaciones para recordarte temporizadores o entrenamientos. Es opcional.",
    "label.notificationsPromptConfirm": "Permitir",
    "label.notificationsPromptCancel": "Ahora no",
    "label.notificationsNotRequired": "No requerido en esta version de Android.",
    "label.status": "Estado",
    "label.statusOverview": "Estado",
    "label.quickActions": "Acciones rapidas",
    "label.sectionData": "Datos",
    "label.resetData": "Restablecer app",
    "label.resetDataHint": "Borra deportes, estadisticas, logs y ajustes.",
    "label.confirmResetData": "Seguro que quieres borrar todos los datos?",
    "label.carryover": "Arrastre",
    "label.carryoverHint":
      "Tiempo restante de sesiones anteriores a 24h. Se reduce a la mitad cada 24h.",
    "label.usageAccess": "Acceso de uso",
    "label.usageAccessHint":
      "Permite el acceso de uso para ordenar las apps por tiempo de uso.",
    "label.openUsageAccess": "Permitir acceso",
    "label.usageAccessMissing": "Acceso de uso faltante",
    "label.usageAccessActive": "Acceso de uso activo",
    "label.later": "Más tarde",
    "label.apps": "Elegir apps",
    "label.openApps": "Gestionar apps",
    "label.grayscaleRestrictedApps": "Mostrar apps restringidas en escala de grises",
    "label.grayscaleRestrictedAppsHint":
      "Aplica un estilo en blanco y negro a las apps restringidas en la lista.",
    "label.closeApps": "Cerrar apps",
    "label.searchApps": "Buscar apps",
    "label.noApps": "No se encontraron apps.",
    "label.accessibilityMissing": "Accesibilidad desactivada",
    "label.accessibilityActive": "Accesibilidad activa",
    "label.permissionNeeded": "Accesibilidad requerida",
    "label.accessibilityDisclosureTitle": "Accesibilidad necesaria",
    "label.accessibilityDisclosureBody":
      "Usamos Accesibilidad para detectar qu\u00e9 app est\u00e1 en primer plano y bloquear apps restringidas cuando se acaba tu tiempo ganado. No leemos ni compartimos contenido de tus apps.",
    "label.accessibilityDisclosureConfirm": "Permitir acceso",
    "label.accessibilityDisclosureCancel": "M\u00e1s tarde",
    "label.hiddenShow": "Mostrar deportes ocultos",
    "label.hiddenHide": "Ocultar deportes ocultos",
    "label.screenRateReps": "Tiempo de pantalla por repetición (minutos)",
    "label.screenRateTime": "Tiempo de pantalla por minuto de deporte (minutos)",
    "label.weekOverview": "Resumen diario",
    "label.weekTotal": "Esta semana",
    "label.noSports": "No hay deportes activos. Añade nuevos.",
    "label.todayScreenTime": "Tiempo ganado",
    "label.widgets": "Widgets",
    "label.widget": "Widget en inicio",
    "label.widgetOverall": "Widget general",
    "label.recentActivity": "Actividad reciente",
    "label.recentActivityEmpty": "No hay registros recientes.",
    "label.statsBySport": "Estadisticas por deporte",
    "label.iconChoose": "Elegir icono",
    "label.iconPlaceholder": "Un icono",
    "label.addSport": "Nuevo deporte",
    "label.reps": "Repeticiones",
    "label.repsShort": "rep.",
    "label.timeUnit": "Tiempo",
    "label.weightExercise": "Ejercicio con peso",
    "label.weightFactor": "Factor (1-10)",
    "label.weightFactorHint":
      "Tiempo de pantalla = peso × repeticiones × factor ÷ 50 (segundos).",
    "label.weightFactorGuide":
      "Elige 1–10: valores bajos para ejercicios ligeros, altos para los más pesados o lentos.",
    "label.weightEntryButton": "Registrar serie",
    "label.weightEntryPreview": "Tiempo de pantalla (vista previa)",
    "label.weightEntryWeight": "Peso (kg)",
    "label.weightEntryReps": "Repeticiones",
    "label.timeBased": "Por tiempo",
    "label.typeHelp":
      "Repeticiones: para contar series (p. ej. 10 flexiones). Tiempo: para minutos/segundos (p. ej. 15 minutos).",
    "label.activateNow": "Activar ahora",
    "label.loadApps": "Cargar apps",
    "label.androidOnly": "La selección de apps es solo para Android.",
    "label.accessibilityHint":
      "Activa la accesibilidad para bloquear apps sociales.",
    "label.settingsHint":
      "Activa la accesibilidad para que la app bloquee redes sociales cuando se acabe el tiempo.",
    "label.changeLanguage": "Cambiar idioma",
    "label.prefaceSettings": "Pantalla previa",
    "label.prefaceDelay": "Tiempo de espera (segundos)",
    "label.tapAnywhere": "Toca en cualquier lugar",
    "label.voiceOn": "Microfono activado",
    "label.voiceOff": "Microfono desactivado",
    "label.voiceListening": "Escuchando...",
    "label.voiceIdle": "Listo",
    "label.voiceHint": "Di numeros en voz alta para contar (requiere microfono, beta).",
    "label.voicePermissionMissing": "Falta acceso al microfono",
    "label.voiceError": "Fallo de reconocimiento de voz",
    "label.voiceUnavailable": "Reconocimiento de voz no disponible",
    "label.aiStart": "Iniciar conteo AI",
    "label.aiStop": "Detener AI",
    "label.aiHint": "Coloca la camara de lado y mantente visible.",
    "label.aiHintInline": "AI cuenta flexiones automaticamente (camara necesaria).",
    "label.aiPermission": "Falta acceso a la camara.",
    "label.aiLoading": "Cargando camara...",
    "label.aiUnavailable": "La camara AI no esta disponible.",
    "label.aiUnavailableInline": "AI temporalmente desactivado.",
    "label.back": "Atrás",
    "label.start": "Iniciar",
    "label.stop": "Parar",
    "label.track": "Registrar",
    "label.hide": "Ocultar",
    "label.show": "Mostrar",
    "label.delete": "Eliminar",
    "label.add": "Añadir",
    "label.active": "Activado",
    "label.off": "Desactivado",
    "label.confirmTitle": "¿Seguro?",
    "label.confirmDelete": "¿Seguro que quieres eliminar?",
    "label.confirmHide": "¿Seguro que quieres ocultar?",
    "label.confirmShow": "¿Seguro que quieres mostrar?",
    "label.confirm": "Sí",
    "label.cancel": "Cancelar",
    "placeholder.sportName": "Nombre (p. ej. Situps)",
    "language.de": "Alemán",
    "language.en": "Inglés",
    "language.es": "Español",
    "language.fr": "Francés",
    "sport.pushups": "Flexiones",
    "sport.pullups": "Dominadas",
    "sport.situps": "Abdominales",
    "sport.jogging": "Trote",
    "label.tutorial": "Tutorial",
    "label.tutorialHint": "Guia corta de las secciones principales.",
    "label.tutorialStart": "Iniciar tutorial",
    "tutorial.step.overview.title": "Tu tiempo de pantalla",
    "tutorial.step.overview.body":
      "Aqui ves el tiempo ganado, el restante y el arrastre.",
    "tutorial.step.openSport.title": "Abrir un deporte",
    "tutorial.step.openSport.body":
      "Toca una tarjeta de deporte para registrarlo.",
    "tutorial.step.addSport.title": "Anadir un deporte",
    "tutorial.step.addSport.body": "Toca + para anadir un deporte.",
    "tutorial.step.track.title": "Registrar sesion",
    "tutorial.step.track.body.reps":
      "Toca una vez el area grande para sumar una repeticion.",
    "tutorial.step.track.body.time": "Toca Iniciar para empezar el temporizador.",
    "tutorial.step.back.title": "Volver al inicio",
    "tutorial.step.back.body": "Usa Atras para volver a la lista.",
    "tutorial.step.openSettings.title": "Abrir ajustes",
    "tutorial.step.openSettings.body":
      "Toca Ajustes para apps, permisos y mas.",
    "tutorial.step.openApps.title": "Apps restringidas",
    "tutorial.step.openApps.body":
      "Toca Apps para elegir qué aplicaciones quieres restringir.",
    "tutorial.step.finish.title": "Listo",
    "tutorial.step.finish.body": "Puedes reiniciar este tutorial desde el menú principal tocando el botón Tutorial arriba a la derecha en 'Ejercicios individuales'.",
    "tutorial.step.singleExercises.title": "Ejercicios individuales",
    "tutorial.step.singleExercises.body":
      "La pestaña Ejercicios individuales reúne todos tus deportes para tocarlos y seguirlos.",
    "tutorial.step.workout.title": "Pestaña Workout",
    "tutorial.step.workout.body":
      "Desde Workout arrancas sesiones cronometradas y tocas las disciplinas que haces para guardarlas en el entrenamiento.",
    "tutorial.cta.next": "Siguiente",
    "tutorial.cta.skip": "Saltar",
    "tutorial.cta.exit": "Salir del tutorial",
    "tutorial.cta.done": "Listo",
  },
  fr: {
    "app.title": "Sport pour le temps d’écran",
    "menu.home": "Exercices individuels",
    "menu.sports": "Tes sports",
    "menu.apps": "Modifier les apps restreintes",
    "menu.settings": "Reglages",
    "menu.workout": "Workout",
    "menu.stats": "Statistiques",
    "menu.language": "Langue",
    "menu.preface": "Ecran preface",
    "label.today": "Aujourd'hui",
    "label.week": "Semaine",
    "label.month": "Mois",
    "label.weekScreenTime": "Temps gagné hebdo",
    "label.screenTime": "Temps gagné",
    "label.screenTimeTitle": "Temps d'ecran",
    "label.screenTimeHint": "Temps total gagne pendant les dernieres 24h.",
    "label.remaining": "Restant",
    "label.remainingHint": "Temps encore disponible a utiliser.",
    "label.editEntries": "Modifier les entrées",
    "label.deleteAllEntries": "Supprimer (ce sport)",
    "label.deleteAllEntriesGlobal": "Supprimer tout",
    "label.editSport": "Modifier le sport",
    "label.editEntry": "Modifier l’entrée",
    "label.dayDetails": "Détails du jour",
    "label.noEntries": "Aucune entrée",
    "label.breakdown": "Detail",
    "label.save": "Enregistrer",
    "label.editHint": "Réduction uniquement.",
    "label.confirmDeleteAll": "Confirmer la suppression de toutes les entrées ?",
    "label.confirmDeleteAllGlobal":
      "Confirmer la suppression de toutes les entrées de tous les sports ?",
    "label.overallStats": "Statistiques globales",
    "label.overallStatsHint":
      "Pour modifier des entrées, ouvrez un sport puis sa statistique.",
    "label.runningSession": "Session en cours",
    "label.workoutTimer": "Minuteur d'entraînement",
    "label.startWorkout": "Démarrer l'entraînement",
    "label.endWorkout": "Terminer l'entraînement",
    "label.workoutExercises": "Exercices",
    "label.workoutHistory": "Entraînements passés",
    "label.workoutRunning": "Entraînement en cours",
    "label.workoutDetail": "Détails de l'entraînement",
    "label.workoutDuration": "Durée",
    "label.availableToday": "Disponible aujourd'hui",
    "label.used": "Utilisé",
    "label.permissions": "Autorisations",
    "label.permissionsIntro":
      "Pour suivre le temps d’écran et bloquer des apps, l’app a besoin d’accès. Vous allez être redirigé vers les réglages.",
      "label.gettingStarted": "Bien d\u00e9marrer",
      "label.permissionsNeeded": "Ces autorisations sont n\u00e9cessaires pour que l\u2019app fonctionne.",
      "label.permissionsHint": "Appuie pour tout configurer",
      "label.accessibilityTitle": "Accessibilit\u00e9",
      "label.accessibilityReason": "N\u00e9cessaire pour d\u00e9tecter l\u2019app au premier plan et bloquer les apps restreintes.",
      "label.accessibilitySteps": "R\u00e9glages > Accessibilit\u00e9 > Sport for Screen Time > Activer",
      "label.usageAccessTitle": "Acc\u00e8s d\u2019utilisation",
      "label.usageAccessReason": "N\u00e9cessaire pour lire l\u2019utilisation des apps et calculer le temps.",
      "label.usageAccessSteps": "R\u00e9glages > Acc\u00e8s d\u2019utilisation > Sport for Screen Time",
      "label.notificationsTitle": "Notifications",
      "label.notificationsOptional": "Optionnel",
      "label.notificationsReason": "Optionnel, pour des rappels de minuterie ou d\u2019entra\u00eenement.",
      "label.notificationsSteps": "R\u00e9glages > Notifications > Sport for Screen Time > Autoriser",
    "label.notificationsButton": "Gerer les notifications",
    "label.notificationsPromptTitle": "Notifications",
    "label.notificationsPromptBody": "Nous utilisons les notifications pour te rappeler les minuteries ou les entra?nements. C’est optionnel.",
    "label.notificationsPromptConfirm": "Autoriser",
    "label.notificationsPromptCancel": "Pas maintenant",
    "label.notificationsNotRequired": "Pas requis sur cette version d'Android.",
    "label.status": "Statut",
    "label.statusOverview": "Statut",
    "label.quickActions": "Actions rapides",
    "label.sectionData": "Donnees",
    "label.resetData": "Reinitialiser l'app",
    "label.resetDataHint": "Supprime sports, stats, logs et reglages.",
    "label.confirmResetData": "Confirmer la suppression de toutes les donnees?",
    "label.carryover": "Report",
    "label.carryoverHint":
      "Temps restant des sessions de plus de 24h. Il est divise par deux toutes les 24h.",
    "label.usageAccess": "Acces d'utilisation",
    "label.usageAccessHint":
      "Autorisez l'acces d'utilisation pour trier les apps par temps d'usage.",
    "label.openUsageAccess": "Autoriser l\u2019acc\u00e8s",
    "label.usageAccessMissing": "Acces d'utilisation manquant",
    "label.usageAccessActive": "Acces d'utilisation actif",
    "label.later": "Plus tard",
    "label.apps": "Choisir les apps",
    "label.openApps": "Gerer les apps",
    "label.grayscaleRestrictedApps": "Afficher les apps restreintes en niveaux de gris",
    "label.grayscaleRestrictedAppsHint":
      "Applique un style noir et blanc aux apps restreintes dans la liste.",
    "label.closeApps": "Fermer les apps",
    "label.searchApps": "Rechercher des apps",
    "label.noApps": "Aucune app trouvee.",
    "label.accessibilityMissing": "Accessibilité inactive",
    "label.accessibilityActive": "Accessibilité active",
    "label.permissionNeeded": "Accessibilité requise",
    "label.hiddenShow": "Afficher les sports cachés",
    "label.hiddenHide": "Masquer les sports cachés",
    "label.screenRateReps": "Temps d’écran par répétition (minutes)",
    "label.screenRateTime": "Temps d’écran par minute de sport (minutes)",
    "label.weekOverview": "Aperçu quotidien",
    "label.weekTotal": "Cette semaine",
    "label.noSports": "Aucun sport actif. Ajoutez-en.",
    "label.todayScreenTime": "Temps gagné",
    "label.widgets": "Widgets",
    "label.widget": "Widget sur l’accueil",
    "label.widgetOverall": "Widget general",
    "label.recentActivity": "Activite recente",
    "label.recentActivityEmpty": "Aucune entree recente.",
    "label.statsBySport": "Stats par sport",
    "label.iconChoose": "Choisir une icône",
    "label.iconPlaceholder": "Une icône",
    "label.addSport": "Nouveau sport",
    "label.reps": "Répétitions",
    "label.repsShort": "rép.",
    "label.timeUnit": "Temps",
    "label.weightExercise": "Exercice de force",
    "label.weightFactor": "Facteur (1-10)",
    "label.weightFactorHint":
      "Temps écran = poids × répétitions × facteur ÷ 50 (secondes).",
    "label.weightFactorGuide":
      "Choisis 1–10 : bas pour les séries légères, haut pour les efforts lourds ou lents.",
    "label.weightEntryButton": "Enregistrer la série",
    "label.weightEntryPreview": "Aperçu du temps écran",
    "label.weightEntryWeight": "Poids (kg)",
    "label.weightEntryReps": "Répétitions",
    "label.timeBased": "Basé sur le temps",
    "label.typeHelp":
      "Repetitions: pour compter les series (ex. 10 pompes). Temps: pour minutes/secondes (ex. 15 minutes).",
    "label.activateNow": "Activer",
    "label.loadApps": "Charger les apps",
    "label.androidOnly": "La sélection des apps est uniquement sur Android.",
    "label.accessibilityHint":
      "Activez l’accessibilité pour bloquer les apps sociales.",
    "label.settingsHint":
      "Activez l’accessibilité pour que l’app bloque les apps sociales quand le temps est écoulé.",
    "label.changeLanguage": "Changer de langue",
    "label.prefaceSettings": "Ecran preface",
    "label.prefaceDelay": "Delai (secondes)",
    "label.tapAnywhere": "Touchez n’importe où",
    "label.voiceOn": "Micro actif",
    "label.voiceOff": "Micro inactif",
    "label.voiceListening": "Ecoute...",
    "label.voiceIdle": "Pret",
    "label.voiceHint": "Dis les numeros a voix haute pour compter (micro requis, beta).",
    "label.voicePermissionMissing": "Acces micro manquant",
    "label.voiceError": "Echec de reconnaissance vocale",
    "label.voiceUnavailable": "Reconnaissance vocale indisponible",
    "label.aiStart": "Demarrer AI",
    "label.aiStop": "Arreter AI",
    "label.aiHint": "Place la camera de cote et reste visible.",
    "label.aiHintInline": "AI compte les pompes automatiquement (camera requise).",
    "label.aiPermission": "Acces camera manquant.",
    "label.aiLoading": "Chargement de la camera...",
    "label.aiUnavailable": "La camera AI est temporairement indisponible.",
    "label.aiUnavailableInline": "AI temporairement desactive.",
    "label.back": "Retour",
    "label.start": "Démarrer",
    "label.stop": "Arrêter",
    "label.track": "Suivre",
    "label.hide": "Masquer",
    "label.show": "Afficher",
    "label.delete": "Supprimer",
    "label.add": "Ajouter",
    "label.active": "Activé",
    "label.off": "Désactivé",
    "label.confirmTitle": "Confirmer",
    "label.confirmDelete": "Confirmer la suppression ?",
    "label.confirmHide": "Confirmer le masquage ?",
    "label.confirmShow": "Confirmer l’affichage ?",
    "label.confirm": "Oui",
    "label.cancel": "Annuler",
    "placeholder.sportName": "Nom (ex. Situps)",
    "language.de": "Allemand",
    "language.en": "Anglais",
    "language.es": "Espagnol",
    "language.fr": "Français",
    "sport.pushups": "Pompes",
    "sport.pullups": "Tractions",
    "sport.situps": "Abdos",
    "sport.jogging": "Jogging",
    "label.tutorial": "Tutoriel",
    "label.tutorialHint": "Courte visite des zones principales.",
    "label.tutorialStart": "Demarrer le tutoriel",
    "tutorial.step.overview.title": "Ton temps d'ecran",
    "tutorial.step.overview.body":
      "Ici tu vois le temps gagne, le restant et le report.",
    "tutorial.step.openSport.title": "Ouvrir un sport",
    "tutorial.step.openSport.body":
      "Touche une carte pour commencer le suivi.",
    "tutorial.step.addSport.title": "Ajouter un sport",
    "tutorial.step.addSport.body": "Touche + pour ajouter un sport.",
    "tutorial.step.track.title": "Suivre une session",
    "tutorial.step.track.body.reps":
      "Touche une fois la grande zone pour compter une repetition.",
    "tutorial.step.track.body.time": "Touche Demarrer pour lancer le minuteur.",
    "tutorial.step.back.title": "Retour a la liste",
    "tutorial.step.back.body": "Utilise Retour pour revenir aux sports.",
    "tutorial.step.openSettings.title": "Ouvrir les reglages",
    "tutorial.step.openSettings.body":
      "Touche Reglages pour apps, permissions et plus.",
    "tutorial.step.openApps.title": "Apps restreintes",
    "tutorial.step.openApps.body":
      "Touche Apps pour choisir quelles applications restreindre.",
    "tutorial.step.finish.title": "Termine",
    "tutorial.step.finish.body":
      "Tu peux relancer ce tutoriel depuis le menu principal en touchant le bouton Tutoriel en haut à droite de 'Exercices individuels'.",
    "tutorial.step.singleExercises.title": "Exercices individuels",
    "tutorial.step.singleExercises.body":
      "L'onglet Exercices individuels rassemble tes sports ; touche-en un pour activer son suivi.",
    "tutorial.step.workout.title": "Onglet Workout",
    "tutorial.step.workout.body":
      "Dans Workout, lance une session chronometree et touche chaque exercice que tu réalises pour l'ajouter à cet entraînement.",
    "tutorial.cta.next": "Suivant",
    "tutorial.cta.skip": "Passer",
    "tutorial.cta.exit": "Quitter le tutoriel",
    "tutorial.cta.done": "Termine",
  },
};

const todayKey = () => new Date().toISOString().slice(0, 10);

const dateKeyFromDate = (date) => {
  return new Date(date).toISOString().slice(0, 10);
};

const startOfWeek = (date) => {
  const current = new Date(date);
  const day = (current.getDay() + 6) % 7;
  current.setDate(current.getDate() - day);
  current.setHours(0, 0, 0, 0);
  return current;
};

const getWeekKeys = () => {
  const start = startOfWeek(new Date());
  return Array.from({ length: 7 }, (_, index) => {
    const entry = new Date(start);
    entry.setDate(start.getDate() + index);
    return {
      key: dateKeyFromDate(entry),
      label: WEEKDAY_LABELS[index],
    };
  });
};

const parseDateKey = (key) => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const formatMonthLabel = (date, language) => {
  const labels = MONTH_LABELS[language] || MONTH_LABELS.en;
  return `${labels[date.getMonth()]} ${date.getFullYear()}`;
};

const buildCalendarDays = (sportStats) => {
  const keys = Object.keys(sportStats || {}).sort();
  const today = new Date();
  const startDate = keys.length > 0 ? parseDateKey(keys[0]) : new Date();
  startDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const days = [];
  for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
    days.push({ key: dateKeyFromDate(d), date: new Date(d) });
  }
  return days;
};

const buildCalendarDaysFromKeys = (keys) => {
  const sorted = [...keys].sort();
  const today = new Date();
  const startDate = sorted.length > 0 ? parseDateKey(sorted[0]) : new Date();
  startDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const days = [];
  for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
    days.push({ key: dateKeyFromDate(d), date: new Date(d) });
  }
  return days;
};

const formatDateLabel = (key) => {
  const date = parseDateKey(key);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()}`;
};

const getMonthsForCalendar = (keysSet) => {
  const earliestKey = keysSet.size > 0 ? [...keysSet].sort()[0] : todayKey();
  const earliestDate = parseDateKey(earliestKey);
  const earliestMonthStart = new Date(
    earliestDate.getFullYear(),
    earliestDate.getMonth(),
    1
  );
  const currentMonthStart = new Date();
  currentMonthStart.setDate(1);
  currentMonthStart.setHours(0, 0, 0, 0);
  const months = [];
  let cursor = new Date(currentMonthStart);
  while (months.length < 2 || cursor >= earliestMonthStart) {
    months.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth() - 1);
  }
  return months;
};

const buildWeeksForMonth = (monthDate) => {
  const monthStart = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth(),
    1
  );
  const monthEnd = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth() + 1,
    0
  );
  const firstWeekStart = startOfWeek(monthStart);
  const weeks = [];
  const cursorDate = new Date(firstWeekStart);
  while (cursorDate <= monthEnd) {
    const weekStart = new Date(cursorDate);
    const days = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + index);
      return day;
    });
    weeks.push(days);
    cursorDate.setDate(cursorDate.getDate() + 7);
  }
  return weeks;
};

const formatSeconds = (totalSeconds) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0"
    )}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}`;
};

const getRollingStats = (logs, sportId) => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const sportLogs = logs[sportId] || {};
  let reps = 0;
  let seconds = 0;
  let screenSeconds = 0;
  Object.values(sportLogs).forEach((dayLogs) => {
    (dayLogs || []).forEach((entry) => {
      if (!entry || !entry.ts || entry.ts < cutoff) {
        return;
      }
      reps += entry.reps || 0;
      seconds += entry.seconds || 0;
      screenSeconds += entry.screenSeconds || 0;
    });
  });
  return { reps, seconds, screenSeconds };
};

const getWeeklyStats = (stats, sportId) => {
  const weekKeys = getWeekKeys();
  return weekKeys.map(({ key, label }) => ({
    key,
    label,
    dayStats: (stats[sportId] || {})[key] || { reps: 0, seconds: 0 },
  }));
};

const formatSportValue = (sportType, dayStats, repsLabel = "Wdh.") => {
  if (sportType === "reps") {
    return `${dayStats.reps} ${repsLabel}`;
  }
  return formatSeconds(dayStats.seconds || 0);
};

const formatScreenTime = (seconds) => {
  return formatSeconds(Math.round(seconds || 0));
};

const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const parseRateMinutes = (value, fallback) => {
  const parsed = Number.parseFloat(String(value).replace(",", "."));
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

const parsePositiveNumber = (value) => {
  const parsed = Number.parseFloat(String(value).replace(",", "."));
  if (Number.isNaN(parsed)) {
    return 0;
  }
  return Math.max(0, parsed);
};

const parsePositiveInteger = (value) => {
  const parsed = Number.parseInt(String(value).replace(",", "."), 10);
  if (Number.isNaN(parsed)) {
    return 0;
  }
  return Math.max(0, parsed);
};

const clampWeightFactor = (value) => {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return Math.max(1, Math.min(10, parsed));
};

const getDefaultRateMinutes = (sportType) => {
  if (sportType === "reps") {
    return 1;
  }
  return 1;
};

const generateLogId = () =>
  `log_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

const screenSecondsForStats = (sport, dayStats) => {
  if (!sport || !dayStats) {
    return 0;
  }
  if (sport.weightExercise && sport.type === "reps") {
    return Math.max(0, Math.floor(dayStats.screenSeconds || 0));
  }
  const rate = sport.screenSecondsPerUnit ?? 0;
  if (sport.type === "reps") {
    return dayStats.reps * rate;
  }
  return (dayStats.seconds || 0) * rate;
};

const screenSecondsForEntry = (sport, entry) => {
  if (!sport || !entry) {
    return 0;
  }
  if (sport.type === "reps" && sport.weightExercise) {
    const weight = parsePositiveNumber(entry.weight);
    const factor = clampWeightFactor(sport.weightFactor ?? 1);
    const value = (weight * (entry.reps || 0) * factor) / 50;
    return Math.max(0, Math.floor(value));
  }
  const rate = sport.screenSecondsPerUnit ?? 0;
  if (sport.type === "reps") {
    return Math.max(0, Math.floor((entry.reps || 0) * rate));
  }
  return Math.max(0, Math.floor((entry.seconds || 0) * rate));
};

const widgetValueForStats = (sport, dayStats) => {
  if (!sport) {
    return "0";
  }
  if (sport.type === "reps") {
    return String(dayStats.reps || 0);
  }
  return String(Math.floor((dayStats.seconds || 0) / 60));
};

const rollingScreenSecondsTotal = (logs, sports) => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const sportMap = new Map(sports.map((sport) => [sport.id, sport]));
  let totalSeconds = 0;
  Object.entries(logs || {}).forEach(([sportId, sportLogs]) => {
    const sport = sportMap.get(sportId);
    if (!sport) {
      return;
    }
    Object.values(sportLogs || {}).forEach((dayLogs) => {
      (dayLogs || []).forEach((entry) => {
        if (!entry || !entry.ts || entry.ts < cutoff) {
          return;
        }
        totalSeconds += screenSecondsForEntry(sport, entry);
      });
    });
  });
  return Math.max(0, Math.floor(totalSeconds));
};

const normalizeLogs = (logs, sports) => {
  if (!logs) {
    return { normalized: {}, changed: false };
  }
  const sportsMap = new Map(sports.map((sport) => [sport.id, sport]));
  let changed = false;
  const normalized = Object.entries(logs).reduce((acc, [sportId, sportLogs]) => {
    const sport = sportsMap.get(sportId);
    if (!sport) {
      acc[sportId] = sportLogs;
      return acc;
    }
    const nextLogsByDay = Object.entries(sportLogs || {}).reduce(
      (dayAcc, [dayKey, entries]) => {
        const nextEntries = (entries || []).map((entry) => {
          const nextEntry = { ...entry };
          if (!nextEntry.id) {
            nextEntry.id = generateLogId();
            changed = true;
          }
          if (!Number.isFinite(nextEntry.screenSeconds)) {
            nextEntry.screenSeconds = screenSecondsForEntry(sport, nextEntry);
            changed = true;
          }
          return nextEntry;
        });
        dayAcc[dayKey] = nextEntries;
        return dayAcc;
      },
      {}
    );
    acc[sportId] = nextLogsByDay;
    return acc;
  }, {});
  return { normalized, changed };
};

const buildStatsFromLogs = (logs) => {
  const nextStats = {};
  Object.entries(logs || {}).forEach(([sportId, sportLogs]) => {
    const nextSportStats = {};
    Object.entries(sportLogs || {}).forEach(([dayKey, entries]) => {
      const dayEntries = entries || [];
      if (dayEntries.length === 0) {
        return;
      }
      const reps = dayEntries.reduce((sum, entry) => sum + (entry.reps || 0), 0);
      const seconds = dayEntries.reduce(
        (sum, entry) => sum + (entry.seconds || 0),
        0
      );
      const screenSeconds = dayEntries.reduce(
        (sum, entry) => sum + (entry.screenSeconds || 0),
        0
      );
      if (reps <= 0 && seconds <= 0 && screenSeconds <= 0) {
        return;
      }
      nextSportStats[dayKey] = {
        reps,
        seconds,
        screenSeconds,
      };
    });
    if (Object.keys(nextSportStats).length > 0) {
      nextStats[sportId] = nextSportStats;
    }
  });
  return nextStats;
};

const groupEntriesByWindow = (entries, type) => {
  const sorted = [...entries].sort((a, b) => a.ts - b.ts);
  const groups = [];
  const windowMs = type === "reps" ? 5 * 60 * 1000 : 30 * 60 * 1000;
  sorted.forEach((entry) => {
    const last = groups[groups.length - 1];
    if (!last || entry.ts - last.endTs > windowMs) {
      groups.push({
        startTs: entry.ts,
        endTs: entry.ts,
        reps: entry.reps || 0,
        seconds: entry.seconds || 0,
      });
    } else {
      last.endTs = entry.ts;
      last.reps += entry.reps || 0;
      last.seconds += entry.seconds || 0;
    }
  });
  return groups;
};

const weeklyScreenSeconds = (stats, sport) => {
  const weekEntries = getWeeklyStats(stats, sport.id);
  return weekEntries.reduce(
    (sum, entry) => sum + screenSecondsForStats(sport, entry.dayStats),
    0
  );
};

const normalizeIcon = (value) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  return Array.from(trimmed)[0];
};

const defaultIconForSport = (sport) => {
  if (sport.id === "pushups") return "💪";
  if (sport.id === "pullups") return "🏋️";
  if (sport.id === "pushups_alt") return "🧘";
  if (sport.id === "jogging") return "🏃";
  return DEFAULT_ICON;
};

const defaultScreenSecondsPerUnit = (sport) => {
  if (sport.id === "pushups") return 60;
  if (sport.id === "pullups") return 90;
  if (sport.id === "pushups_alt") return 45;
  if (sport.id === "jogging") return 1.2;
  if (sport.type === "reps") return 60;
  return 1;
};

const normalizeSports = (sportList) => {
  let changed = false;
  const normalized = sportList.map((sport) => {
    const presetKey = PRESET_KEYS[sport.id];
    let name = sport.name;
    if (sport.id === "pushups_alt" && sport.name === "Pushups") {
      name = "Situps";
      changed = true;
    }
    const supportsAi = sport.supportsAi ?? Boolean(getAiModeForSport(sport));
    const next = {
      ...sport,
      name,
      presetKey,
      icon: sport.icon || defaultIconForSport(sport),
      screenSecondsPerUnit:
        sport.screenSecondsPerUnit ?? defaultScreenSecondsPerUnit(sport),
      supportsAi,
      nonDeletable: supportsAi,
    };
    if (!sport.icon || sport.screenSecondsPerUnit == null || presetKey) {
      changed = true;
    }
    return next;
  });
  return { normalized, changed };
};

const computeWeeklyTotal = (stats, sport) => {
  const weekEntries = getWeeklyStats(stats, sport.id);
  if (sport.type === "reps") {
    return weekEntries.reduce((sum, entry) => sum + entry.dayStats.reps, 0);
  }
  return weekEntries.reduce(
    (sum, entry) => sum + (entry.dayStats.seconds || 0),
    0
  );
};

const ensureDefaultSettings = async () => {
  const existing = await AsyncStorage.getItem(STORAGE_KEYS.settings);
  if (!existing) {
    await AsyncStorage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify(DEFAULT_SETTINGS)
    );
  }
};

const generateId = () =>
  `sport_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

const normalizeSpeechText = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const extractNumberToken = (value, lang) => {
  const normalized = normalizeSpeechText(value);
  if (!normalized) {
    return null;
  }
  const digitMatches = normalized.match(/\d+/g);
  if (digitMatches && digitMatches.length > 0) {
    return digitMatches[digitMatches.length - 1];
  }
  const words = NUMBER_WORDS[lang] || NUMBER_WORDS.en;
  const tokens = normalized.split(/\s+/).filter(Boolean);
  let found = null;
  tokens.forEach((token) => {
    if (words.includes(token)) {
      found = token;
    }
  });
  return found;
};

const getAiModeForSport = (sport) => {
  if (!sport) {
    return null;
  }
  if (sport.id === "pushups") {
    return "pushups";
  }
  return null;
};

const angleBetween = (a, b, c) => {
  if (!a || !b || !c) {
    return null;
  }
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const abLen = Math.hypot(ab.x, ab.y);
  const cbLen = Math.hypot(cb.x, cb.y);
  if (!abLen || !cbLen) {
    return null;
  }
  const cos = Math.max(-1, Math.min(1, dot / (abLen * cbLen)));
  return (Math.acos(cos) * 180) / Math.PI;
};

const pickElbowAngle = (landmarks, side, minConfidence) => {
  const shoulder = landmarks[`${side}Shoulder`];
  const elbow = landmarks[`${side}Elbow`];
  const wrist = landmarks[`${side}Wrist`];
  if (
    !shoulder ||
    !elbow ||
    !wrist ||
    shoulder.confidence < minConfidence ||
    elbow.confidence < minConfidence ||
    wrist.confidence < minConfidence
  ) {
    return null;
  }
  return angleBetween(shoulder, elbow, wrist);
};

const AiCameraScreen = ({ onClose, repsValue, t }) => (
  <SafeAreaView style={styles.aiScreen}>
    <View style={styles.aiHeader}>
      <Text style={styles.aiCounter}>{repsValue}</Text>
      <Pressable style={styles.aiStopButton} onPress={onClose}>
        <Text style={styles.aiStopText}>{t("label.aiStop")}</Text>
      </Pressable>
    </View>
    <View style={styles.aiPermission}>
      <Text style={styles.aiPermissionText}>{t("label.aiUnavailable")}</Text>
      <Pressable style={styles.primaryButton} onPress={onClose}>
        <Text style={styles.primaryButtonText}>{t("label.back")}</Text>
      </Pressable>
    </View>
    <View style={styles.aiFooter}>
      <Text style={styles.aiHint}>{t("label.aiUnavailableInline")}</Text>
    </View>
  </SafeAreaView>
);

export default function App() {
  const { width, height } = useWindowDimensions();
  const [sports, setSports] = useState([]);
  const [stats, setStats] = useState({});
  const [logs, setLogs] = useState({});
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [language, setLanguage] = useState(DEFAULT_SETTINGS.language);
  const [selectedSportId, setSelectedSportId] = useState(null);
  const [statsSportId, setStatsSportId] = useState(null);
  const [statsDayKey, setStatsDayKey] = useState(null);
  const [overallStatsOpen, setOverallStatsOpen] = useState(false);
  const [overallDayKey, setOverallDayKey] = useState(null);
  const [statsEditMode, setStatsEditMode] = useState(false);
  const [editEntryKey, setEditEntryKey] = useState(null);
  const [editEntryValue, setEditEntryValue] = useState("");
  const [editingSportId, setEditingSportId] = useState(null);
  const [isSportModalOpen, setIsSportModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPrefaceSettingsOpen, setIsPrefaceSettingsOpen] = useState(false);
  const [isAppsSettingsOpen, setIsAppsSettingsOpen] = useState(false);
  const [isWorkoutOpen, setIsWorkoutOpen] = useState(false);
  const [prefaceDelayInput, setPrefaceDelayInput] = useState("");
  const [currentWorkout, setCurrentWorkout] = useState(null);
  const [workoutHistory, setWorkoutHistory] = useState([]);
  const [workoutDetailId, setWorkoutDetailId] = useState(null);
  const [workoutRunning, setWorkoutRunning] = useState(false);
  const [workoutSeconds, setWorkoutSeconds] = useState(0);
  const [workoutSessionCount, setWorkoutSessionCount] = useState(0);
  const workoutTrackingMode = workoutRunning && isWorkoutOpen;
  const [showHidden, setShowHidden] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("reps");
  const [newIcon, setNewIcon] = useState("");
  const [newRateMinutes, setNewRateMinutes] = useState("1");
  const [newWeightExercise, setNewWeightExercise] = useState(false);
  const [newWeightFactor, setNewWeightFactor] = useState("3");
  const [showIconInput, setShowIconInput] = useState(false);
  const [installedApps, setInstalledApps] = useState([]);
  const [appSearch, setAppSearch] = useState("");
  const [appUsageMap, setAppUsageMap] = useState({});
  const [usageState, setUsageState] = useState({
    remainingSeconds: 0,
    usedSeconds: 0,
    day: todayKey(),
    remainingBySport: {},
    entryCount: 0,
    carryoverSeconds: 0,
  });
  const [needsAccessibility, setNeedsAccessibility] = useState(false);
  const [accessibilityDisclosureVisible, setAccessibilityDisclosureVisible] =
    useState(false);
  const [permissionsPrompted, setPermissionsPrompted] = useState(false);
  const [accessibilityDisclosureAccepted, setAccessibilityDisclosureAccepted] =
    useState(false);
  const [usagePermissionsPrompted, setUsagePermissionsPrompted] = useState(false);
  const [usageAccessGranted, setUsageAccessGranted] = useState(true);
  const [notificationsPrompted, setNotificationsPrompted] = useState(false);
  const [notificationsGranted, setNotificationsGranted] = useState(false);
  const [permissionsPanelOpen, setPermissionsPanelOpen] = useState(false);
  const [permissionsCheckTick, setPermissionsCheckTick] = useState(0);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [statsRange, setStatsRange] = useState("month");
  const [infoHint, setInfoHint] = useState(null);
  const [infoAnchors, setInfoAnchors] = useState({});
  const [infoCardWidth, setInfoCardWidth] = useState(0);
  const [tutorialStepIndex, setTutorialStepIndex] = useState(null);
  const [tutorialTarget, setTutorialTarget] = useState(null);
  const [tutorialCardHeight, setTutorialCardHeight] = useState(0);
  const [tutorialSeen, setTutorialSeen] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceError, setVoiceError] = useState(null);
  const [isAppActive, setIsAppActive] = useState(
    AppState.currentState === "active"
  );
  const [aiSession, setAiSession] = useState(null);
  const [weightEntryWeight, setWeightEntryWeight] = useState("");
  const [weightEntryReps, setWeightEntryReps] = useState("");
  const intervalRef = useRef(null);
  const sessionStartRef = useRef(null);
  const runningRef = useRef(false);
  const workoutStartRef = useRef(null);
  const workoutIntervalRef = useRef(null);
  const workoutRunningRef = useRef(false);
  const lastPermissionPromptAt = useRef(0);
  const notificationsPromptedRef = useRef(false);
  const lastVoiceTokenRef = useRef(null);
  const lastVoiceAtRef = useRef(0);
  const voiceEnabledRef = useRef(false);
  const voiceListeningRef = useRef(false);
  const languageRef = useRef(language);
  const selectedSportRef = useRef(null);
  const lastTutorialTargetRef = useRef(null);
  const tutorialScreenTimeRef = useRef(null);
  const tutorialFirstSportRef = useRef(null);
  const tutorialTrackingAreaRef = useRef(null);
  const tutorialBackButtonRef = useRef(null);
  const tutorialSettingsNavRef = useRef(null);
  const tutorialWorkoutNavRef = useRef(null);
  const tutorialAddSportRef = useRef(null);
  const tutorialSettingsCardRef = useRef(null);
  const tutorialAppsButtonRef = useRef(null);

  const t = (key) => {
    const dict = STRINGS[language] || STRINGS.de;
    return dict[key] ?? STRINGS.de[key] ?? key;
  };
  const repsShort = t("label.repsShort");
  const voiceStatusText = voiceError
    ? voiceError
    : voiceEnabled
    ? voiceListening
      ? t("label.voiceListening")
      : t("label.voiceIdle")
    : "";

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  useEffect(() => {
    workoutRunningRef.current = workoutRunning;
  }, [workoutRunning]);

  useEffect(() => {
    notificationsPromptedRef.current = notificationsPrompted;
  }, [notificationsPrompted]);

  const getSportLabel = (sport) => {
    if (sport.presetKey) {
      return t(`sport.${sport.presetKey}`);
    }
    return sport.name;
  };

  const getWorkoutExerciseCount = (sportId) => {
    const entry = currentWorkout?.exercises?.find(
      (item) => item.sportId === sportId
    );
    return entry?.count || 0;
  };

const confirmAction = (message, onConfirm) => {
    Alert.alert(
      t("label.confirmTitle"),
      message,
      [
        { text: t("label.cancel"), style: "cancel" },
        { text: t("label.confirm"), onPress: onConfirm },
      ],
      { cancelable: true }
    );
};

const canDeleteSport = (sport) => !sport.nonDeletable;

  const setAppLanguage = async (nextLanguage) => {
    const nextSettings = { ...settings, language: nextLanguage };
    await saveSettings(nextSettings);
    if (InstaControl?.setAppLanguage) {
      InstaControl.setAppLanguage(nextLanguage);
    }
    setLanguage(nextLanguage);
    setShowLanguageMenu(false);
  };

  useEffect(() => {
    const load = async () => {
      await ensureDefaultSettings();
      const sportsRaw = await AsyncStorage.getItem(STORAGE_KEYS.sports);
      const statsRaw = await AsyncStorage.getItem(STORAGE_KEYS.stats);
      const logsRaw = await AsyncStorage.getItem(STORAGE_KEYS.logs);
      const settingsRaw = await AsyncStorage.getItem(STORAGE_KEYS.settings);
      const permissionsRaw = await AsyncStorage.getItem(STORAGE_KEYS.permissions);
      const accessibilityDisclosureRaw = await AsyncStorage.getItem(
        STORAGE_KEYS.accessibilityDisclosure
      );
      const notificationsPermissionsRaw = await AsyncStorage.getItem(
        STORAGE_KEYS.notificationsPermissions
      );
      const usagePermissionsRaw = await AsyncStorage.getItem(
        STORAGE_KEYS.usagePermissions
      );
      const tutorialSeenRaw = await AsyncStorage.getItem(
        STORAGE_KEYS.tutorialSeen
      );
      const workoutsRaw = await AsyncStorage.getItem(STORAGE_KEYS.workouts);
      const parsedSports = sportsRaw ? JSON.parse(sportsRaw) : [];
      const cleanedSports = parsedSports.length
        ? pruneNonPushupPresets(parsedSports)
        : parsedSports;
      const baseSports = cleanedSports.length
        ? ensurePushupPreset(cleanedSports)
        : createDefaultPresetSports();
      const { normalized, changed } = normalizeSports(baseSports);
      setSports(normalized);
      if (changed || !parsedSports.length) {
        await AsyncStorage.setItem(
          STORAGE_KEYS.sports,
          JSON.stringify(normalized)
        );
      }
      const parsedLogs = logsRaw ? JSON.parse(logsRaw) : {};
      const { normalized: normalizedLogs, changed: logsChanged } = normalizeLogs(
        parsedLogs,
        normalized
      );
      const rebuiltStats = buildStatsFromLogs(normalizedLogs);
      setStats(rebuiltStats);
      const statsJson = JSON.stringify(rebuiltStats);
      if (statsJson !== statsRaw) {
        await AsyncStorage.setItem(STORAGE_KEYS.stats, statsJson);
      }
      setLogs(normalizedLogs);
      if (logsChanged) {
        await AsyncStorage.setItem(
          STORAGE_KEYS.logs,
          JSON.stringify(normalizedLogs)
        );
      }
      const parsedSettings = settingsRaw
        ? { ...DEFAULT_SETTINGS, ...JSON.parse(settingsRaw) }
        : DEFAULT_SETTINGS;
      setSettings(parsedSettings);
      setLanguage(parsedSettings.language || DEFAULT_SETTINGS.language);
      if (InstaControl?.setAppLanguage) {
        InstaControl.setAppLanguage(
          parsedSettings.language || DEFAULT_SETTINGS.language
        );
      }
      setPermissionsPrompted(permissionsRaw === "true");
      setAccessibilityDisclosureAccepted(
        accessibilityDisclosureRaw === "true"
      );
      setUsagePermissionsPrompted(usagePermissionsRaw === "true");
      setNotificationsPrompted(!!notificationsPermissionsRaw);
      setNotificationsGranted(false);
      setTutorialSeen(tutorialSeenRaw === "true");
      setWorkoutHistory(workoutsRaw ? JSON.parse(workoutsRaw) : []);
      setHasLoaded(true);
    };
    load();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const active = nextState === "active";
      setIsAppActive(active);
      if (active) {
        if (runningRef.current && sessionStartRef.current) {
          const elapsed = Math.max(
            0,
            Math.floor((Date.now() - sessionStartRef.current) / 1000)
          );
          setSessionSeconds(elapsed);
        }
        if (workoutRunningRef.current && workoutStartRef.current) {
          const elapsedWorkout = Math.max(
            0,
            Math.floor((Date.now() - workoutStartRef.current) / 1000)
          );
          setWorkoutSeconds(elapsedWorkout);
        }
        refreshUsageState();
        checkAccessibility();
        checkUsageAccess();
        refreshNotificationPermission();
      }
    });
    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    checkAccessibility();
  }, []);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    const updateElapsed = () => {
      if (!sessionStartRef.current) {
        sessionStartRef.current = Date.now();
      }
      const elapsed = Math.max(
        0,
        Math.floor((Date.now() - sessionStartRef.current) / 1000)
      );
      setSessionSeconds(elapsed);
    };
    updateElapsed();
    intervalRef.current = setInterval(updateElapsed, 1000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [running]);

  useEffect(() => {
    if (!workoutRunning) {
      if (workoutIntervalRef.current) {
        clearInterval(workoutIntervalRef.current);
        workoutIntervalRef.current = null;
      }
      return;
    }
    if (!workoutStartRef.current) {
      workoutStartRef.current = Date.now();
    }
    const updateWorkoutElapsed = () => {
      const elapsed = Math.max(
        0,
        Math.floor((Date.now() - (workoutStartRef.current || Date.now())) / 1000)
      );
      setWorkoutSeconds(elapsed);
    };
    updateWorkoutElapsed();
    workoutIntervalRef.current = setInterval(updateWorkoutElapsed, 1000);
    return () => {
      if (workoutIntervalRef.current) {
        clearInterval(workoutIntervalRef.current);
        workoutIntervalRef.current = null;
      }
    };
  }, [workoutRunning]);

  useEffect(() => {
    if (!isAppActive) {
      return;
    }
    const usageInterval = setInterval(() => {
      refreshUsageState();
    }, 2000);
    return () => {
      clearInterval(usageInterval);
    };
  }, [isAppActive, permissionsCheckTick]);

  const saveSports = async (nextSports) => {
    setSports(nextSports);
    await AsyncStorage.setItem(
      STORAGE_KEYS.sports,
      JSON.stringify(nextSports)
    );
  };

  const saveStats = async (nextStats) => {
    setStats(nextStats);
    await AsyncStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(nextStats));
  };

  const saveLogs = async (nextLogs) => {
    setLogs(nextLogs);
    await AsyncStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(nextLogs));
  };

  const saveSettings = async (nextSettings) => {
    setSettings(nextSettings);
    await AsyncStorage.setItem(
      STORAGE_KEYS.settings,
      JSON.stringify(nextSettings)
    );
  };

  const updateDayStat = (sportId, updater) => {
    const day = todayKey();
    setStats((prev) => {
      const nextStats = { ...prev };
      const sportStats = { ...(nextStats[sportId] || {}) };
      const dayStats = { reps: 0, seconds: 0, screenSeconds: 0, ...(sportStats[day] || {}) };
      const updated = updater(dayStats);
      sportStats[day] = updated;
      nextStats[sportId] = sportStats;
      AsyncStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(nextStats));
      return nextStats;
    });
  };

  const syncDayStatsFromEntries = (sportId, dayKey, entries) => {
    setStats((prev) => {
      const nextStats = { ...prev };
      const sportStats = { ...(nextStats[sportId] || {}) };
      const dayEntries = entries || [];
      const repsTotal = dayEntries.reduce((sum, entry) => sum + (entry.reps || 0), 0);
      const secondsTotal = dayEntries.reduce(
        (sum, entry) => sum + (entry.seconds || 0),
        0
      );
      const screenSecondsTotal = dayEntries.reduce(
        (sum, entry) => sum + (entry.screenSeconds || 0),
        0
      );
      if (repsTotal <= 0 && secondsTotal <= 0 && screenSecondsTotal <= 0) {
        delete sportStats[dayKey];
      } else {
        sportStats[dayKey] = {
          reps: repsTotal,
          seconds: secondsTotal,
          screenSeconds: screenSecondsTotal,
        };
      }
      if (Object.keys(sportStats).length === 0) {
        delete nextStats[sportId];
      } else {
        nextStats[sportId] = sportStats;
      }
      AsyncStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(nextStats));
      return nextStats;
    });
  };

  const syncScreenTimeEntry = (sport, entry) => {
    if (!sport || !entry?.id || !InstaControl?.upsertScreenTimeEntry) {
      return;
    }
    InstaControl.upsertScreenTimeEntry(
      entry.id,
      sport.id,
      entry.ts,
      entry.screenSeconds || 0
    );
    InstaControl?.updateOverallWidgets?.();
  };

  const removeScreenTimeEntry = (entryId) => {
    if (!entryId || !InstaControl?.removeScreenTimeEntry) {
      return;
    }
    InstaControl.removeScreenTimeEntry(entryId);
    InstaControl?.updateOverallWidgets?.();
  };

  const addLogEntry = (sport, entry) => {
    if (!sport) {
      return;
    }
    const nextEntry = {
      id: entry.id || generateLogId(),
      ts: entry.ts || Date.now(),
      reps: entry.reps || 0,
      seconds: entry.seconds || 0,
      weight: entry.weight || 0,
    };
    nextEntry.screenSeconds =
      Number.isFinite(entry.screenSeconds) && entry.screenSeconds >= 0
        ? entry.screenSeconds
        : screenSecondsForEntry(sport, nextEntry);
    const day = dateKeyFromDate(nextEntry.ts);
    setLogs((prev) => {
      const nextLogs = { ...prev };
      const sportLogs = { ...(nextLogs[sport.id] || {}) };
      const dayLogs = [...(sportLogs[day] || [])];
      dayLogs.push(nextEntry);
      sportLogs[day] = dayLogs;
      nextLogs[sport.id] = sportLogs;
      AsyncStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(nextLogs));
      return nextLogs;
    });
    syncScreenTimeEntry(sport, nextEntry);
    refreshUsageState();
  };

  const syncScreenTimeEntries = useCallback(() => {
    if (!InstaControl?.upsertScreenTimeEntry) {
      return;
    }
    if (sports.length === 0) {
      return;
    }
    const sportMap = new Map(sports.map((sport) => [sport.id, sport]));
    Object.entries(logs || {}).forEach(([sportId, sportLogs]) => {
      const sport = sportMap.get(sportId);
      if (!sport) {
        return;
      }
      Object.values(sportLogs || {}).forEach((dayEntries) => {
        (dayEntries || []).forEach((entry) => {
          if (!entry?.id || !entry?.ts) {
            return;
          }
          const screenSeconds = Number.isFinite(entry.screenSeconds)
            ? entry.screenSeconds
            : screenSecondsForEntry(sport, entry);
          InstaControl.upsertScreenTimeEntry(
            entry.id,
            sport.id,
            entry.ts,
            screenSeconds
          );
        });
      });
    });
  }, [logs, sports]);

  useEffect(() => {
    if (!InstaControl?.upsertScreenTimeEntry) {
      return;
    }
    syncScreenTimeEntries();
    if (InstaControl?.updateOverallWidgets) {
      InstaControl.updateOverallWidgets();
    }
    refreshUsageState();
  }, [logs, sports, syncScreenTimeEntries]);

  const adjustLogsToTarget = (sport, dayKey, targetValue) => {
    if (!sport) {
      return;
    }
    setLogs((prev) => {
      const nextLogs = { ...prev };
      const sportLogs = { ...(nextLogs[sport.id] || {}) };
      const dayLogs = [...(sportLogs[dayKey] || [])].sort((a, b) => a.ts - b.ts);
      let total =
        sport.type === "reps"
          ? dayLogs.reduce((sum, e) => sum + (e.reps || 0), 0)
          : dayLogs.reduce((sum, e) => sum + (e.seconds || 0), 0);
      let remaining = Math.max(0, targetValue);
      if (total <= remaining) {
        return prev;
      }
      const removedIds = [];
      const updatedEntries = [];
      for (let i = dayLogs.length - 1; i >= 0; i -= 1) {
        const entry = dayLogs[i];
        const value =
          sport.type === "reps" ? entry.reps || 0 : entry.seconds || 0;
        if (remaining <= 0) {
          removedIds.push(entry.id);
          dayLogs.splice(i, 1);
          continue;
        }
        if (value <= remaining) {
          remaining -= value;
        } else {
          const reduced = remaining;
          if (sport.type === "reps") {
            entry.reps = reduced;
          } else {
            entry.seconds = reduced;
          }
          entry.screenSeconds = screenSecondsForEntry(sport, entry);
          updatedEntries.push(entry);
          remaining = 0;
        }
      }
      if (dayLogs.length === 0) {
        delete sportLogs[dayKey];
      } else {
        sportLogs[dayKey] = dayLogs;
      }
      if (Object.keys(sportLogs).length === 0) {
        delete nextLogs[sport.id];
      } else {
        nextLogs[sport.id] = sportLogs;
      }
      AsyncStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(nextLogs));
      removedIds.forEach((entryId) => removeScreenTimeEntry(entryId));
      updatedEntries.forEach((entry) => syncScreenTimeEntry(sport, entry));
      if (removedIds.length > 0 || updatedEntries.length > 0) {
        refreshUsageState();
      }
      syncDayStatsFromEntries(sport.id, dayKey, dayLogs);
      return nextLogs;
    });
  };

  const deleteLogGroup = (sportId, dayKey, group, type) => {
    let nextDayLogs = null;
    let removedIds = [];
    setLogs((prev) => {
      const nextLogs = { ...prev };
      const sportLogs = { ...(nextLogs[sportId] || {}) };
      const dayLogs = [...(sportLogs[dayKey] || [])];
      if (dayLogs.length === 0) {
        return prev;
      }
      removedIds = dayLogs
        .filter((entry) => entry.ts >= group.startTs && entry.ts <= group.endTs)
        .map((entry) => entry.id);
      const filtered = dayLogs.filter(
        (entry) => entry.ts < group.startTs || entry.ts > group.endTs
      );
      if (filtered.length === dayLogs.length) {
        return prev;
      }
      nextDayLogs = filtered;
      if (filtered.length === 0) {
        delete sportLogs[dayKey];
      } else {
        sportLogs[dayKey] = filtered;
      }
      if (Object.keys(sportLogs).length === 0) {
        delete nextLogs[sportId];
      } else {
        nextLogs[sportId] = sportLogs;
      }
      AsyncStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(nextLogs));
      removedIds.forEach((entryId) => removeScreenTimeEntry(entryId));
      if (removedIds.length > 0) {
        refreshUsageState();
      }
      syncDayStatsFromEntries(sportId, dayKey, nextDayLogs);
      return nextLogs;
    });
  };

  const decrementLogGroup = (sport, dayKey, group) => {
    if (!sport) {
      return;
    }
    let removedEntryId = null;
    let updatedEntry = null;
    setLogs((prev) => {
      const nextLogs = { ...prev };
      const sportLogs = { ...(nextLogs[sport.id] || {}) };
      const dayLogs = [...(sportLogs[dayKey] || [])];
      if (dayLogs.length === 0) {
        return prev;
      }
      const candidates = dayLogs
        .filter((entry) => entry.ts >= group.startTs && entry.ts <= group.endTs)
        .sort((a, b) => b.ts - a.ts);
      if (candidates.length === 0) {
        return prev;
      }
      const target = candidates[0];
      const index = dayLogs.findIndex((entry) => entry.id === target.id);
      if (index < 0) {
        return prev;
      }
      const entry = { ...dayLogs[index] };
      if (sport.type === "reps") {
        const nextReps = Math.max(0, (entry.reps || 0) - 1);
        if (nextReps <= 0) {
          removedEntryId = entry.id;
          dayLogs.splice(index, 1);
        } else {
          entry.reps = nextReps;
          entry.screenSeconds = screenSecondsForEntry(sport, entry);
          dayLogs[index] = entry;
          updatedEntry = entry;
        }
      } else {
        const nextSeconds = Math.max(0, (entry.seconds || 0) - 60);
        if (nextSeconds <= 0) {
          removedEntryId = entry.id;
          dayLogs.splice(index, 1);
        } else {
          entry.seconds = nextSeconds;
          entry.screenSeconds = screenSecondsForEntry(sport, entry);
          dayLogs[index] = entry;
          updatedEntry = entry;
        }
      }
      if (dayLogs.length === 0) {
        delete sportLogs[dayKey];
      } else {
        sportLogs[dayKey] = dayLogs;
      }
      if (Object.keys(sportLogs).length === 0) {
        delete nextLogs[sport.id];
      } else {
        nextLogs[sport.id] = sportLogs;
      }
      AsyncStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(nextLogs));
      if (removedEntryId) {
        removeScreenTimeEntry(removedEntryId);
      }
      if (updatedEntry) {
        syncScreenTimeEntry(sport, updatedEntry);
      }
      if (removedEntryId || updatedEntry) {
        refreshUsageState();
      }
      syncDayStatsFromEntries(sport.id, dayKey, dayLogs);
      return nextLogs;
    });
  };

  const updateSpecificDayStat = (sportId, dayKey, updater) => {
    setStats((prev) => {
      const nextStats = { ...prev };
      const sportStats = { ...(nextStats[sportId] || {}) };
      const current = {
        reps: 0,
        seconds: 0,
        screenSeconds: 0,
        ...(sportStats[dayKey] || {}),
      };
      const updated = updater(current);
      if ((updated.reps || 0) <= 0 && (updated.seconds || 0) <= 0) {
        delete sportStats[dayKey];
      } else {
        sportStats[dayKey] = updated;
      }
      if (Object.keys(sportStats).length === 0) {
        delete nextStats[sportId];
      } else {
        nextStats[sportId] = sportStats;
      }
      AsyncStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(nextStats));
      return nextStats;
    });
  };

  const clearAllStatsForSport = async (sportId) => {
    const nextStats = { ...stats };
    delete nextStats[sportId];
    await saveStats(nextStats);
    const nextLogs = { ...logs };
    delete nextLogs[sportId];
    await saveLogs(nextLogs);
    if (InstaControl?.clearScreenTimeEntriesForSport) {
      InstaControl.clearScreenTimeEntriesForSport(sportId);
      InstaControl?.updateOverallWidgets?.();
      refreshUsageState();
    }
  };

  const clearAllStats = async () => {
    await saveStats({});
    await saveLogs({});
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.carryover,
      STORAGE_KEYS.carryoverDay,
      STORAGE_KEYS.usageSnapshot,
    ]);
    if (InstaControl?.clearAllScreenTimeEntries) {
      InstaControl.clearAllScreenTimeEntries();
      InstaControl?.updateOverallWidgets?.();
      refreshUsageState();
    }
  };

  const resetAllData = async () => {
    const nextSports = createDefaultPresetSports();
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.sports,
      STORAGE_KEYS.stats,
      STORAGE_KEYS.settings,
      STORAGE_KEYS.permissions,
      STORAGE_KEYS.accessibilityDisclosure,
      STORAGE_KEYS.usagePermissions,
      STORAGE_KEYS.notificationsPermissions,
      STORAGE_KEYS.carryover,
      STORAGE_KEYS.carryoverDay,
      STORAGE_KEYS.usageSnapshot,
      STORAGE_KEYS.logs,
      STORAGE_KEYS.tutorialSeen,
    ]);
    await saveSports(nextSports);
    await saveStats({});
    await saveLogs({});
    await saveSettings(DEFAULT_SETTINGS);
    setLanguage(DEFAULT_SETTINGS.language);
    setSelectedSportId(null);
    setStatsSportId(null);
    setStatsDayKey(null);
    setOverallStatsOpen(false);
    setOverallDayKey(null);
    setStatsEditMode(false);
    setPermissionsPrompted(false);
    setUsagePermissionsPrompted(false);
    setAccessibilityDisclosureAccepted(false);
    setNotificationsPrompted(false);
    setPrefaceDelayInput(String(DEFAULT_SETTINGS.prefaceDelaySeconds));
    setShowLanguageMenu(false);
    setInstalledApps([]);
    setAppSearch("");
    setAppUsageMap({});
    setTutorialSeen(false);
    setTutorialStepIndex(null);
    setTutorialTarget(null);
    setUsageState({
      remainingSeconds: 0,
      usedSeconds: 0,
      day: todayKey(),
      remainingBySport: {},
      entryCount: 0,
      carryoverSeconds: 0,
    });
    if (InstaControl?.clearAllScreenTimeEntries) {
      InstaControl.clearAllScreenTimeEntries();
      InstaControl?.updateOverallWidgets?.();
    }
    await checkAccessibility();
    await checkUsageAccess();
    await refreshNotificationPermission();
    refreshUsageState();
  };

  const openSportModal = (sport = null) => {
    if (sport) {
      const rateMinutes =
        sport.type === "reps"
          ? Math.max(0, Number(sport.screenSecondsPerUnit) || 0) / 60
          : Math.max(0, Number(sport.screenSecondsPerUnit) || 0);
      setEditingSportId(sport.id);
      setNewName(getSportLabel(sport));
      setNewType(sport.type);
      setNewIcon(sport.icon || "");
      setNewRateMinutes(String(rateMinutes || getDefaultRateMinutes(sport.type)));
      setNewWeightExercise(!!sport.weightExercise);
      setNewWeightFactor(
        String(
          clampWeightFactor(
            Number.isFinite(sport.weightFactor) ? sport.weightFactor : 3
          )
        )
      );
    } else {
      setEditingSportId(null);
      setNewName("");
      setNewType("reps");
      setNewIcon("");
      setNewRateMinutes(String(getDefaultRateMinutes("reps")));
      setNewWeightExercise(false);
      setNewWeightFactor("3");
      maybeAdvanceTutorial("openAddSport");
    }
    setShowIconInput(false);
    setIsSportModalOpen(true);
  };

  const closeSportModal = () => {
    setIsSportModalOpen(false);
    setEditingSportId(null);
    setShowIconInput(false);
  };

  const saveSportModal = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      return;
    }
    const icon = normalizeIcon(newIcon) || DEFAULT_ICON;
    const rateMinutes = parseRateMinutes(
      newRateMinutes,
      getDefaultRateMinutes(newType)
    );
    const screenSecondsPerUnit =
      newType === "reps" ? rateMinutes * 60 : rateMinutes;
    const weightMode = newType === "reps" && newWeightExercise;
    const parsedFactor =
      clampWeightFactor(parsePositiveNumber(newWeightFactor) || 1);
    if (editingSportId) {
      const nextSports = sports.map((sport) => {
        if (sport.id !== editingSportId) {
          return sport;
        }
        const keepPresetKey =
          sport.presetKey && trimmed === getSportLabel(sport)
            ? sport.presetKey
            : undefined;
        return {
          ...sport,
          name: trimmed,
          type: newType,
          icon,
          screenSecondsPerUnit,
          presetKey: keepPresetKey,
          supportsAi: sport.supportsAi,
          weightExercise: weightMode,
          weightFactor: parsedFactor,
        };
      });
      await saveSports(nextSports);
    } else {
      const newSport = {
        id: generateId(),
        name: trimmed,
        type: newType,
        hidden: false,
        icon,
        screenSecondsPerUnit,
        createdAt: Date.now(),
        weightExercise: weightMode,
        weightFactor: parsedFactor,
      };
      await saveSports([newSport, ...sports]);
    }
    closeSportModal();
  };

  const handleHideSport = async (sportId, hidden) => {
    const nextSports = sports.map((sport) =>
      sport.id === sportId ? { ...sport, hidden } : sport
    );
    await saveSports(nextSports);
  };

  const handleDeleteSport = async (sportId) => {
    const sport = sports.find((entry) => entry.id === sportId);
    if (sport && !canDeleteSport(sport)) {
      return;
    }
    const nextSports = sports.filter((sport) => sport.id !== sportId);
    await saveSports(nextSports);
    if (selectedSportId === sportId) {
      setSelectedSportId(null);
    }
  };

  const moveSport = async (sportId, direction) => {
    const currentIndex = sports.findIndex((sport) => sport.id === sportId);
    if (currentIndex === -1 || direction === 0) {
      return;
    }
    const isHidden = sports[currentIndex].hidden;
    const step = direction > 0 ? 1 : -1;
    let targetIndex = currentIndex + step;
    while (
      targetIndex >= 0 &&
      targetIndex < sports.length &&
      sports[targetIndex].hidden !== isHidden
    ) {
      targetIndex += step;
    }
    if (targetIndex < 0 || targetIndex >= sports.length) {
      return;
    }
    const nextSports = [...sports];
    [nextSports[currentIndex], nextSports[targetIndex]] = [
      nextSports[targetIndex],
      nextSports[currentIndex],
    ];
    await saveSports(nextSports);
  };

  const checkAccessibility = async () => {
    if (!InstaControl?.isAccessibilityEnabled) {
      return;
    }
    const enabled = await InstaControl.isAccessibilityEnabled();
    setNeedsAccessibility(!enabled);
    setPermissionsCheckTick((tick) => tick + 1);
  };

  const checkUsageAccess = async () => {
    if (!InstaControl?.hasUsageAccess) {
      return true;
    }
    const hasAccess = await InstaControl.hasUsageAccess();
    setUsageAccessGranted(!!hasAccess);
    return !!hasAccess;
  };

  const refreshUsageState = async () => {
    if (!InstaControl?.getUsageState) {
      return;
    }
    const state = await InstaControl.getUsageState();
    if (state) {
      setUsageState({
        remainingSeconds: state.remainingSeconds || 0,
        usedSeconds: state.usedSeconds || 0,
        day: state.day || todayKey(),
        remainingBySport: state.remainingBySport || {},
        entryCount: state.entryCount || 0,
        carryoverSeconds: state.carryoverSeconds || 0,
      });
    }
  };

  const refreshNotificationPermission = async () => {
    if (Platform.OS !== "android") {
      return;
    }
    if (Number(Platform.Version) < 33) {
      return;
    }
    const granted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );
    setNotificationsGranted(!!granted);
  };

  const openAccessibilitySettings = async () => {
    if (InstaControl?.openAccessibilitySettings) {
      InstaControl.openAccessibilitySettings();
      await AsyncStorage.setItem(STORAGE_KEYS.permissions, "true");
      setPermissionsPrompted(true);
    }
  };

  const requestAccessibilityAccess = () => {
    if (accessibilityDisclosureAccepted) {
      openAccessibilitySettings();
      return;
    }
    setAccessibilityDisclosureVisible(true);
  };

  const confirmAccessibilityDisclosure = async () => {
    setAccessibilityDisclosureVisible(false);
    if (!accessibilityDisclosureAccepted) {
      setAccessibilityDisclosureAccepted(true);
      await AsyncStorage.setItem(
        STORAGE_KEYS.accessibilityDisclosure,
        "true"
      );
    }
    openAccessibilitySettings();
  };

  const cancelAccessibilityDisclosure = () => {
    setAccessibilityDisclosureVisible(false);
  };

  const openUsageAccessSettings = async () => {
    if (InstaControl?.openUsageAccessSettings) {
      InstaControl.openUsageAccessSettings();
      await AsyncStorage.setItem(STORAGE_KEYS.usagePermissions, "true");
      setUsagePermissionsPrompted(true);
    }
  };

  useEffect(() => {
    if (InstaControl?.setControlledApps) {
      InstaControl.setControlledApps(settings.controlledApps || []);
      syncScreenTimeEntries();
      refreshUsageState();
    }
    if (InstaControl?.setPrefaceDelaySeconds) {
      const delay = Number.isFinite(settings.prefaceDelaySeconds)
        ? settings.prefaceDelaySeconds
        : DEFAULT_SETTINGS.prefaceDelaySeconds;
      InstaControl.setPrefaceDelaySeconds(delay);
    }
  }, [settings, syncScreenTimeEntries]);

  useEffect(() => {
    checkAccessibility();
    checkUsageAccess();
    refreshNotificationPermission();
  }, [isSettingsOpen, statsSportId]);

  useEffect(() => {
    if (!isAppsSettingsOpen) {
      return;
    }
    loadInstalledApps();
  }, [isAppsSettingsOpen]);

  useEffect(() => {
    if (permissionsPanelOpen) {
      checkAccessibility();
      checkUsageAccess();
      refreshNotificationPermission();
    }
  }, [permissionsPanelOpen]);

  useEffect(() => {
    if (!needsAccessibility && accessibilityDisclosureVisible) {
      setAccessibilityDisclosureVisible(false);
    }
  }, [needsAccessibility, accessibilityDisclosureVisible]);

  useEffect(() => {
    if (!selectedSportId) {
      setRunning(false);
      setSessionSeconds(0);
      sessionStartRef.current = null;
    }
  }, [selectedSportId]);

  useEffect(() => {
    setWeightEntryWeight("");
    setWeightEntryReps("");
  }, [selectedSportId]);

  useEffect(() => {
    const handler = () => {
      if (statsSportId) {
        setStatsSportId(null);
        return true;
      }
      if (statsDayKey) {
        setStatsDayKey(null);
        return true;
      }
      if (overallDayKey) {
        setOverallDayKey(null);
        return true;
      }
      if (overallStatsOpen) {
        setOverallStatsOpen(false);
        return true;
      }
      if (selectedSportId) {
        setSelectedSportId(null);
        return true;
      }
      if (isAppsSettingsOpen) {
        setIsAppsSettingsOpen(false);
        return true;
      }
      if (isSettingsOpen) {
        setIsSettingsOpen(false);
        return true;
      }
      if (isWorkoutOpen) {
        setIsWorkoutOpen(false);
        return true;
      }
      if (isPrefaceSettingsOpen) {
        setIsPrefaceSettingsOpen(false);
        return true;
      }
      if (workoutRunning) {
        handleWorkoutStop();
      }
      return false;
    };
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      handler
    );
    return () => subscription.remove();
  }, [
    statsSportId,
    statsDayKey,
    overallDayKey,
    overallStatsOpen,
    selectedSportId,
    isAppsSettingsOpen,
    isSettingsOpen,
    isWorkoutOpen,
    workoutRunning,
    isPrefaceSettingsOpen,
  ]);

  useEffect(() => {
    if (!statsSportId) {
      setStatsEditMode(false);
      setEditEntryKey(null);
      setEditEntryValue("");
      setStatsDayKey(null);
    }
  }, [statsSportId]);

  useEffect(() => {
    if (!overallStatsOpen) {
      setOverallDayKey(null);
    }
  }, [overallStatsOpen]);

  const loadInstalledApps = async () => {
    if (!InstaControl?.getInstalledApps) {
      return;
    }
    const hasUsageAccess = await checkUsageAccess();
    const apps = await InstaControl.getInstalledApps();
    setInstalledApps(apps || []);
    if (!hasUsageAccess || !InstaControl?.getAppUsageStats) {
      setAppUsageMap({});
      return;
    }
    const usageStats = await InstaControl.getAppUsageStats();
    const usageMap = {};
    (usageStats || []).forEach((entry) => {
      if (!entry?.packageName) {
        return;
      }
      const totalMs = Number(entry.totalTimeMs || 0);
      usageMap[entry.packageName] = Number.isFinite(totalMs) ? totalMs : 0;
    });
    setAppUsageMap(usageMap);
  };

  const toggleControlledApp = async (packageName) => {
    const current = settings.controlledApps || [];
    const exists = current.includes(packageName);
    const nextApps = exists
      ? current.filter((pkg) => pkg !== packageName)
      : [packageName, ...current];
    await saveSettings({ ...settings, controlledApps: nextApps });
    if (InstaControl?.setControlledApps) {
      InstaControl.setControlledApps(nextApps);
    }
  };

  const toggleGrayscaleRestrictedApps = async () => {
    const nextSettings = {
      ...settings,
      grayscaleRestrictedApps: !settings.grayscaleRestrictedApps,
    };
    await saveSettings(nextSettings);
  };

  const openPrefaceSettings = () => {
    const delay = Number.isFinite(settings.prefaceDelaySeconds)
      ? settings.prefaceDelaySeconds
      : DEFAULT_SETTINGS.prefaceDelaySeconds;
    setPrefaceDelayInput(String(delay));
    setIsPrefaceSettingsOpen(true);
  };

  const openHome = () => {
    setIsSettingsOpen(false);
    setOverallStatsOpen(false);
    setIsPrefaceSettingsOpen(false);
    setIsWorkoutOpen(false);
    setSelectedSportId(null);
    setStatsSportId(null);
    setStatsDayKey(null);
    setOverallDayKey(null);
    setStatsEditMode(false);
  };

  const openWorkout = () => {
    setIsSettingsOpen(false);
    setOverallStatsOpen(false);
    setIsPrefaceSettingsOpen(false);
    setSelectedSportId(null);
    setStatsSportId(null);
    setStatsDayKey(null);
    setOverallDayKey(null);
    setStatsEditMode(false);
    setWorkoutDetailId(null);
    setIsWorkoutOpen(true);
  };

  const openStatsOverview = () => {
    setIsSettingsOpen(false);
    setIsPrefaceSettingsOpen(false);
    setIsWorkoutOpen(false);
    setSelectedSportId(null);
    setStatsSportId(null);
    setStatsDayKey(null);
    setOverallDayKey(null);
    setStatsEditMode(false);
    setOverallStatsOpen(true);
  };

  const openSportStats = (sportId) => {
    setIsSettingsOpen(false);
    setIsPrefaceSettingsOpen(false);
    setSelectedSportId(null);
    setStatsDayKey(null);
    setOverallDayKey(null);
    setStatsEditMode(false);
    setOverallStatsOpen(false);
    setStatsSportId(sportId);
  };

  const openSettings = () => {
    setOverallStatsOpen(false);
    setIsPrefaceSettingsOpen(false);
    setIsWorkoutOpen(false);
    setSelectedSportId(null);
    setStatsSportId(null);
    setStatsDayKey(null);
    setOverallDayKey(null);
    setStatsEditMode(false);
    setIsSettingsOpen(true);
    loadInstalledApps();
    refreshUsageState();
    maybeAdvanceTutorial("openSettings");
  };

  const handleSelectSport = (sportId) => {
    setSelectedSportId(sportId);
    maybeAdvanceTutorial("openSport");
  };

  const handleBackFromSport = () => {
    setSelectedSportId(null);
    setWorkoutSessionCount(0);
    maybeAdvanceTutorial("backHome");
  };

  const openAppsSettings = () => {
    setIsAppsSettingsOpen(true);
    maybeAdvanceTutorial("openApps");
  };

  const startTutorial = () => {
    openHome();
    setTutorialTarget(null);
    setTutorialStepIndex(0);
  };

  const finishTutorial = async () => {
    openHome();
    setTutorialStepIndex(null);
    setTutorialTarget(null);
    setTutorialSeen(true);
    await AsyncStorage.setItem(STORAGE_KEYS.tutorialSeen, "true");
  };

  const completeTutorial = async () => {
    await finishTutorial();
    await maybePromptNotifications();
  };

  const renderTutorialHeaderButton = () => (
    <Pressable style={styles.tutorialHeaderButton} onPress={startTutorial}>
      <Text style={styles.tutorialHeaderText}>{t("label.tutorial")}</Text>
    </Pressable>
  );

  const renderMainNav = (active) => (
    <View style={styles.mainNav}>
      <Pressable
        style={[
          styles.mainNavButton,
          active === "home" && styles.mainNavButtonActive,
        ]}
        onPress={openHome}
      >
        <Text
          style={[
            styles.mainNavText,
            active === "home" && styles.mainNavTextActive,
          ]}
        >
          {t("menu.home")}
        </Text>
      </Pressable>
      <Pressable
        style={[
          styles.mainNavButton,
          active === "workout" && styles.mainNavButtonActive,
        ]}
        ref={tutorialWorkoutNavRef}
        onPress={openWorkout}
      >
        <Text
          style={[
            styles.mainNavText,
            active === "workout" && styles.mainNavTextActive,
          ]}
        >
          {t("menu.workout")}
        </Text>
      </Pressable>
      <Pressable
        style={[
          styles.mainNavButton,
          active === "stats" && styles.mainNavButtonActive,
        ]}
        onPress={openStatsOverview}
      >
        <Text
          style={[
            styles.mainNavText,
            active === "stats" && styles.mainNavTextActive,
          ]}
        >
          {t("menu.stats")}
        </Text>
      </Pressable>
      <Pressable
        style={[
          styles.mainNavButton,
          active === "settings" && styles.mainNavButtonActive,
        ]}
        ref={tutorialSettingsNavRef}
        onPress={openSettings}
      >
        <Text
          style={[
            styles.mainNavText,
            active === "settings" && styles.mainNavTextActive,
          ]}
        >
          {t("menu.settings")}
        </Text>
      </Pressable>
    </View>
  );

  const renderWorkoutBanner = () => {
    if (!workoutRunning || isAppActive) {
      return null;
    }
    return (
      <View style={styles.workoutNotification}>
        <Text style={styles.workoutNotificationText}>
          {t("label.workoutRunning")}: {formatSeconds(workoutSeconds)}
        </Text>
      </View>
    );
  };

  const savePrefaceSettings = async () => {
    const parsed = Math.max(0, Number.parseInt(prefaceDelayInput, 10) || 0);
    const nextSettings = { ...settings, prefaceDelaySeconds: parsed };
    await saveSettings(nextSettings);
    if (InstaControl?.setPrefaceDelaySeconds) {
      InstaControl.setPrefaceDelaySeconds(parsed);
    }
    setIsPrefaceSettingsOpen(false);
  };

  const handleStart = () => {
    sessionStartRef.current = Date.now();
    setSessionSeconds(0);
    setRunning(true);
    maybeAdvanceTutorial("trackAction");
  };

  const handleStop = () => {
    const elapsed =
      sessionStartRef.current != null
        ? Math.max(
            0,
            Math.floor((Date.now() - sessionStartRef.current) / 1000)
          )
        : sessionSeconds;
    setRunning(false);
    if (!selectedSport) {
      setSessionSeconds(0);
      sessionStartRef.current = null;
      return;
    }
    if (elapsed > 0) {
      addLogEntry(selectedSport, {
        ts: Date.now(),
        seconds: elapsed,
      });
      const addedSeconds = screenSecondsForEntry(selectedSport, {
        seconds: elapsed,
      });
      updateDayStat(selectedSport.id, (dayStats) => ({
        ...dayStats,
        seconds: dayStats.seconds + elapsed,
        screenSeconds: (dayStats.screenSeconds || 0) + addedSeconds,
      }));
    }
    setSessionSeconds(0);
    sessionStartRef.current = null;
  };

  const handleWorkoutStart = () => {
    if (workoutRunning) {
      return;
    }
    const now = Date.now();
    setCurrentWorkout({
      id: `workout-${now}`,
      startTs: now,
      exercises: [],
    });
    workoutStartRef.current = now;
    setWorkoutSeconds(0);
    setWorkoutSessionCount(0);
    setWorkoutRunning(true);
    setWorkoutDetailId(null);
  };

  const handleWorkoutStop = () => {
    if (!workoutRunning) {
      return;
    }
    const now = Date.now();
    const startTs = workoutStartRef.current || now;
    const durationSeconds = Math.max(0, Math.floor((now - startTs) / 1000));
    const workoutScreenSeconds = sumScreenSecondsForRange(startTs, now);
    const completedWorkout = {
      id: currentWorkout?.id || `workout-${now}`,
      startTs,
      endTs: now,
      duration: durationSeconds,
      screenSeconds: workoutScreenSeconds,
      exercises: currentWorkout?.exercises || [],
    };
    workoutStartRef.current = null;
    setWorkoutRunning(false);
    setWorkoutSeconds(0);
    setCurrentWorkout(null);
    setWorkoutHistory((prev) => {
      const next = [completedWorkout, ...prev].slice(0, 20);
      AsyncStorage.setItem(STORAGE_KEYS.workouts, JSON.stringify(next));
      return next;
    });
    setWorkoutDetailId(completedWorkout.id);
  };

  const recordWorkoutExercise = (sport) => {
    if (!currentWorkout || !sport) {
      return;
    }
    setCurrentWorkout((prev) => {
      if (!prev) {
        return prev;
      }
      const previousExercises = prev.exercises || [];
      const nextExercises = [...previousExercises];
      const index = nextExercises.findIndex((entry) => entry.sportId === sport.id);
      if (index >= 0) {
        nextExercises[index] = {
          ...nextExercises[index],
          count: (nextExercises[index].count || 0) + 1,
        };
      } else {
        nextExercises.push({ sportId: sport.id, count: 1 });
      }
      return { ...prev, exercises: nextExercises };
    });
  };

  const sumScreenSecondsForRange = (startTs, endTs) => {
    if (!startTs || !endTs) {
      return 0;
    }
    let total = 0;
    Object.values(logs || {}).forEach((sportLogs) => {
      Object.values(sportLogs || {}).forEach((dayEntries) => {
        (dayEntries || []).forEach((entry) => {
          if (
            entry?.ts >= startTs &&
            entry?.ts <= endTs &&
            Number.isFinite(entry.screenSeconds)
          ) {
            total += entry.screenSeconds;
          }
        });
      });
    });
    return total;
  };

  const handleWorkoutExercisePress = (sport) => {
    if (workoutRunning) {
      recordWorkoutExercise(sport);
    }
    handleSelectSport(sport.id);
  };

  const deleteWorkout = (workoutId) => {
    setWorkoutHistory((prev) => {
      const next = (prev || []).filter((entry) => entry.id !== workoutId);
      AsyncStorage.setItem(STORAGE_KEYS.workouts, JSON.stringify(next));
      return next;
    });
    if (workoutDetailId === workoutId) {
      setWorkoutDetailId(null);
    }
  };

  const getSpeechLocale = () => SPEECH_LOCALES[language] || "en-US";

  const incrementReps = () => {
    const currentSport = selectedSportRef.current;
    if (!currentSport || currentSport.type !== "reps") {
      return;
    }
    if (workoutTrackingMode) {
      recordWorkoutExercise(currentSport);
      setWorkoutSessionCount((prev) => prev + 1);
    }
    addLogEntry(currentSport, {
      ts: Date.now(),
      reps: 1,
    });
    const addedSeconds = screenSecondsForEntry(currentSport, { reps: 1 });
    updateDayStat(currentSport.id, (dayStats) => ({
      ...dayStats,
      reps: dayStats.reps + 1,
      screenSeconds: (dayStats.screenSeconds || 0) + addedSeconds,
    }));
    maybeAdvanceTutorial("trackAction");
  };

  const startAiSession = (sport) => {
    if (!AI_CAMERA_ENABLED) {
      Alert.alert(t("label.aiUnavailable"), t("label.aiUnavailableInline"));
      return;
    }
    const mode = getAiModeForSport(sport);
    if (!mode) {
      return;
    }
    setVoiceEnabled(false);
    setAiSession({ sportId: sport.id, mode });
  };

  const stopAiSession = () => {
    setAiSession(null);
  };

  const ensureAudioPermission = async () => {
    if (Platform.OS !== "android") {
      return true;
    }
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  };

  const requestNotificationPermission = async () => {
    if (Platform.OS !== "android") {
      return;
    }
    if (Number(Platform.Version) < 33) {
      return;
    }
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );
    await AsyncStorage.setItem(STORAGE_KEYS.notificationsPermissions, "1");
    setNotificationsPrompted(true);
    setNotificationsGranted(
      result === PermissionsAndroid.RESULTS.GRANTED
    );
  };

  const openNotificationSettings = () => {
    if (Platform.OS !== "android") {
      return;
    }
    if (Number(Platform.Version) < 33) {
      return;
    }
    Linking.openSettings();
  };

  const maybePromptNotifications = async () => {
    if (Platform.OS !== "android") {
      return;
    }
    if (Number(Platform.Version) < 33) {
      return;
    }
    if (notificationsPromptedRef.current) {
      return;
    }
    const prompted = await AsyncStorage.getItem(
      STORAGE_KEYS.notificationsPermissions
    );
    if (prompted) {
      notificationsPromptedRef.current = true;
      setNotificationsPrompted(true);
      return;
    }
    notificationsPromptedRef.current = true;
    Alert.alert(
      t("label.notificationsPromptTitle"),
      t("label.notificationsPromptBody"),
      [
        {
          text: t("label.notificationsPromptCancel"),
          style: "cancel",
          onPress: async () => {
            await AsyncStorage.setItem(
              STORAGE_KEYS.notificationsPermissions,
              "1"
            );
            setNotificationsPrompted(true);
          },
        },
        {
          text: t("label.notificationsPromptConfirm"),
          onPress: requestNotificationPermission,
        },
      ],
      { cancelable: true }
    );
  };

  const setListeningState = (value) => {
    voiceListeningRef.current = value;
    setVoiceListening(value);
  };

  const startVoice = async () => {
    if (voiceListeningRef.current) {
      return;
    }
    setVoiceError(null);
    const hasPermission = await ensureAudioPermission();
    if (!hasPermission) {
      setVoiceError(t("label.voicePermissionMissing"));
      setVoiceEnabled(false);
      return;
    }
    try {
      const available = await Voice.isAvailable();
      if (!available) {
        setVoiceError(t("label.voiceUnavailable"));
        setVoiceEnabled(false);
        return;
      }
      await Voice.start(getSpeechLocale());
      setListeningState(true);
    } catch (error) {
      setListeningState(false);
      const message =
        typeof error?.message === "string" && error.message.trim().length > 0
          ? error.message
          : t("label.voiceError");
      setVoiceError(message);
    }
  };

  const stopVoice = async () => {
    setListeningState(false);
    try {
      await Voice.stop();
    } catch (error) {
      // Ignore stop errors when not active.
    }
  };

  const handleVoiceResults = (event) => {
    const currentSport = selectedSportRef.current;
    if (!currentSport || currentSport.type !== "reps") {
      return;
    }
    const transcript = (event?.value || []).join(" ");
    const token = extractNumberToken(transcript, languageRef.current);
    if (!token) {
      return;
    }
    const now = Date.now();
    if (
      token === lastVoiceTokenRef.current &&
      now - lastVoiceAtRef.current < 1200
    ) {
      return;
    }
    lastVoiceTokenRef.current = token;
    lastVoiceAtRef.current = now;
    incrementReps();
  };

  const handleVoiceError = (event) => {
    setListeningState(false);
    if (voiceEnabledRef.current) {
      const message =
        typeof event?.error?.message === "string" &&
        event.error.message.trim().length > 0
          ? event.error.message
          : t("label.voiceError");
      setVoiceError(message);
    }
  };

  const handleVoiceEnd = () => {
    setListeningState(false);
    if (voiceEnabledRef.current) {
      startVoice();
    }
  };

  const toggleVoice = () => {
    setVoiceEnabled((current) => !current);
  };

  const activeSports = sports.filter((sport) => !sport.hidden);
  const hiddenSports = sports.filter((sport) => sport.hidden);
  const selectedSport = sports.find((sport) => sport.id === selectedSportId);
  const tutorialSportId = activeSports[0]?.id;
  const statsSport = sports.find((sport) => sport.id === statsSportId);
  const aiSport = aiSession
    ? sports.find((sport) => sport.id === aiSession.sportId)
    : null;
  const rollingEarnedSeconds = useMemo(
    () => rollingScreenSecondsTotal(logs, sports),
    [logs, sports]
  );
  const trackBodyKey =
    selectedSport && selectedSport.type === "time"
      ? "tutorial.step.track.body.time"
      : "tutorial.step.track.body.reps";
  const tutorialSteps = useMemo(() => {
    const steps = [
      {
        id: "overview",
        titleKey: "tutorial.step.overview.title",
        bodyKey: "tutorial.step.overview.body",
        targetRef: tutorialScreenTimeRef,
      },
    ];
    if (activeSports.length > 0) {
      steps.push({
        id: "singleExercises",
        titleKey: "tutorial.step.singleExercises.title",
        bodyKey: "tutorial.step.singleExercises.body",
        targetRef: tutorialFirstSportRef,
      });
      steps.push({
        id: "openSport",
        titleKey: "tutorial.step.openSport.title",
        bodyKey: "tutorial.step.openSport.body",
        targetRef: tutorialFirstSportRef,
        actionId: "openSport",
        requiresAction: true,
      });
      steps.push({
        id: "track",
        titleKey: "tutorial.step.track.title",
        bodyKey: trackBodyKey,
        targetRef: tutorialTrackingAreaRef,
        actionId: "trackAction",
        requiresAction: true,
      });
      steps.push({
        id: "back",
        titleKey: "tutorial.step.back.title",
        bodyKey: "tutorial.step.back.body",
        targetRef: tutorialBackButtonRef,
        actionId: "backHome",
        requiresAction: true,
      });
    } else {
      steps.push({
        id: "addSport",
        titleKey: "tutorial.step.addSport.title",
        bodyKey: "tutorial.step.addSport.body",
        targetRef: tutorialAddSportRef,
        actionId: "openAddSport",
        requiresAction: true,
      });
    }
    steps.push({
      id: "workout",
      titleKey: "tutorial.step.workout.title",
      bodyKey: "tutorial.step.workout.body",
      targetRef: tutorialWorkoutNavRef,
    });
    steps.push({
      id: "openSettings",
      titleKey: "tutorial.step.openSettings.title",
      bodyKey: "tutorial.step.openSettings.body",
      targetRef: tutorialSettingsNavRef,
      actionId: "openSettings",
      requiresAction: true,
    });
    if (Platform.OS === "android") {
      steps.push({
        id: "openApps",
        titleKey: "tutorial.step.openApps.title",
        bodyKey: "tutorial.step.openApps.body",
        targetRef: tutorialAppsButtonRef,
        actionId: "openApps",
        requiresAction: true,
      });
    }
    steps.push({
      id: "finish",
      titleKey: "tutorial.step.finish.title",
      bodyKey: "tutorial.step.finish.body",
      targetRef: tutorialSettingsCardRef,
    });
    return steps;
  }, [activeSports.length, trackBodyKey]);
  const tutorialActive = tutorialStepIndex !== null;
  const tutorialStep = tutorialActive ? tutorialSteps[tutorialStepIndex] : null;
  const isTutorialLastStep =
    tutorialStepIndex !== null &&
    tutorialStepIndex === tutorialSteps.length - 1;
  const recentActivityGroups = useMemo(() => {
    const groups = [];
    sports.forEach((sport) => {
      const sportLogs = logs[sport.id] || {};
      const dayKeys = Object.keys(sportLogs || {});
      if (dayKeys.length === 0) {
        return;
      }
      const latestKey = [...dayKeys].sort().pop();
      if (!latestKey) {
        return;
      }
      const dayLogs = sportLogs[latestKey] || [];
      if (dayLogs.length === 0) {
        return;
      }
      const sorted = [...dayLogs].sort((a, b) => (a.ts || 0) - (b.ts || 0));
      const latestTs = sorted[sorted.length - 1]?.ts || 0;
      groups.push({
        sport,
        dayKey: latestKey,
        groups: groupEntriesByWindow(sorted, sport.type),
        latestTs,
      });
    });
    groups.sort((a, b) => b.latestTs - a.latestTs);
    return groups;
  }, [logs, sports]);
  const widgetIcon = "\uD83D\uDCCC";
  const micIcon = "\uD83C\uDFA4";
  const notificationsSupported =
    Platform.OS === "android" && Number(Platform.Version) >= 33;
  const tooltipWidth =
    infoCardWidth > 0 ? Math.min(220, Math.max(180, infoCardWidth - 24)) : 200;

  useEffect(() => {
    if (!infoHint) {
      return;
    }
    return () => {};
  }, [infoHint]);

  const showInfoHint = (key, titleKey, bodyKey) => {
    const anchor = infoAnchors[key];
    if (!anchor) {
      return;
    }
    setInfoHint({
      title: t(titleKey),
      body: t(bodyKey),
      y: anchor.y,
      height: anchor.height,
    });
  };

  const advanceTutorial = () => {
    if (!tutorialActive) {
      return;
    }
    const nextIndex = (tutorialStepIndex ?? 0) + 1;
    if (nextIndex >= tutorialSteps.length) {
      completeTutorial();
      return;
    }
    setTutorialStepIndex(nextIndex);
  };

  const maybeAdvanceTutorial = (actionId) => {
    if (!tutorialActive) {
      return;
    }
    if (tutorialStep?.actionId !== actionId) {
      return;
    }
    const nextIndex = (tutorialStepIndex ?? 0) + 1;
    if (nextIndex >= tutorialSteps.length) {
      completeTutorial();
      return;
    }
    setTutorialStepIndex(nextIndex);
  };

  useEffect(() => {
    if (!tutorialActive || !tutorialStep) {
      setTutorialTarget(null);
      return;
    }
    let raf = null;
    let cancelled = false;
    const updateTarget = () => {
      if (cancelled || !tutorialActive || !tutorialStep) {
        return;
      }
      const ref = tutorialStep.targetRef;
      if (!ref?.current?.measureInWindow) {
        if (lastTutorialTargetRef.current) {
          lastTutorialTargetRef.current = null;
          setTutorialTarget(null);
        }
        raf = requestAnimationFrame(updateTarget);
        return;
      }
      ref.current.measureInWindow((x, y, widthValue, heightValue) => {
        if (cancelled) {
          return;
        }
        if (
          !Number.isFinite(x) ||
          !Number.isFinite(y) ||
          !Number.isFinite(widthValue) ||
          !Number.isFinite(heightValue)
        ) {
          if (lastTutorialTargetRef.current) {
            lastTutorialTargetRef.current = null;
            setTutorialTarget(null);
          }
          raf = requestAnimationFrame(updateTarget);
          return;
        }
        const next = {
          x,
          y,
          width: widthValue,
          height: heightValue,
        };
        const prev = lastTutorialTargetRef.current;
        const delta =
          !prev ||
          Math.abs(prev.x - next.x) > 0.5 ||
          Math.abs(prev.y - next.y) > 0.5 ||
          Math.abs(prev.width - next.width) > 0.5 ||
          Math.abs(prev.height - next.height) > 0.5;
        if (delta) {
          lastTutorialTargetRef.current = next;
          setTutorialTarget(next);
        }
        raf = requestAnimationFrame(updateTarget);
      });
    };
    raf = requestAnimationFrame(updateTarget);
    return () => {
      cancelled = true;
      if (raf) {
        cancelAnimationFrame(raf);
      }
    };
  }, [
    tutorialActive,
    tutorialStepIndex,
    tutorialStep,
    width,
    height,
    isSettingsOpen,
    selectedSportId,
    activeSports.length,
  ]);
  useEffect(() => {
    lastTutorialTargetRef.current = null;
    setTutorialTarget(null);
    setTutorialCardHeight(0);
  }, [tutorialStepIndex]);

  const renderTutorialOverlay = () => {
    if (!tutorialActive || !tutorialStep) {
      return null;
    }
    const target = tutorialTarget;
    const hasTarget =
      target &&
      Number.isFinite(target.x) &&
      Number.isFinite(target.y) &&
      Number.isFinite(target.width) &&
      Number.isFinite(target.height);
    const basePadding = 14;
    const paddingByStep = {
      "tutorial.step.track.title": 8,
      "tutorial.step.addSport.title": 10,
    };
    const highlightPadding =
      paddingByStep[tutorialStep.titleKey] ?? basePadding;
    const minWidthByStep = {
      "tutorial.step.track.title": 48,
    };
    const minHeightByStep = {
      "tutorial.step.track.title": 32,
    };
    const minHighlightWidth = minWidthByStep[tutorialStep.titleKey] ?? 56;
    const minHighlightHeight = minHeightByStep[tutorialStep.titleKey] ?? 40;
    const highlightWidth = hasTarget
      ? Math.max(target.width + highlightPadding * 2, minHighlightWidth)
      : 64;
    const highlightHeight = hasTarget
      ? Math.max(target.height + highlightPadding * 2, minHighlightHeight)
      : 64;
    const offsetYByStep = {
      "tutorial.step.back.title": 24,
      "tutorial.step.openSettings.title": 24,
    };
    const offsetXByStep = {
      // Additional horizontal adjustments can be added here.
    };
    const rawCenterX = hasTarget
      ? target.x + target.width / 2 + (offsetXByStep[tutorialStep.titleKey] ?? 0)
      : width / 2;
    const rawCenterY = hasTarget
      ? target.y + target.height / 2 + (offsetYByStep[tutorialStep.titleKey] ?? 0)
      : height / 2;
    const horizontalMax = Math.max(width - highlightWidth, 0);
    const verticalMax = Math.max(height - highlightHeight, 0);
    const highlightLeft = Math.min(
      Math.max(rawCenterX - highlightWidth / 2, 0),
      horizontalMax
    );
    const highlightTop = Math.min(
      Math.max(rawCenterY - highlightHeight / 2, 0),
      verticalMax
    );
    const centerX = highlightLeft + highlightWidth / 2;
    const centerY = highlightTop + highlightHeight / 2;
    const cardWidth = Math.min(320, width - 32);
    const estimatedCardHeight = tutorialCardHeight || 160;
    const spaceAbove = centerY - highlightHeight / 2 - 12;
    const spaceBelow = height - (centerY + highlightHeight / 2) - 12;
    const preferBelow = spaceBelow >= estimatedCardHeight || spaceBelow >= spaceAbove;
    const exitButtonSafe = 72;
    const maxTop = Math.max(16, height - estimatedCardHeight - exitButtonSafe);
    let cardTop = preferBelow
      ? centerY + highlightHeight / 2 + 12
      : centerY - highlightHeight / 2 - 12 - estimatedCardHeight;
    cardTop = Math.min(maxTop, Math.max(16, cardTop));
    const cardLeft = Math.min(
      width - cardWidth - 16,
      Math.max(16, centerX - cardWidth / 2)
    );
    const highlightBottom = highlightTop + highlightHeight;
    const highlightRight = highlightLeft + highlightWidth;
    const blockingResponder = { onStartShouldSetResponder: () => true };
    const renderBlockingAreas = () => {
      if (!hasTarget) {
        return (
          <View
            style={[styles.tutorialBlockingLayer, StyleSheet.absoluteFillObject]}
            {...blockingResponder}
          />
        );
      }
      return (
        <>
          <View
            style={[
              styles.tutorialBlockingLayer,
              { left: 0, right: 0, top: 0, height: highlightTop },
            ]}
            {...blockingResponder}
          />
          <View
            style={[
              styles.tutorialBlockingLayer,
              { left: 0, right: 0, top: highlightBottom, bottom: 0 },
            ]}
            {...blockingResponder}
          />
          <View
            style={[
              styles.tutorialBlockingLayer,
              {
                left: 0,
                top: highlightTop,
                width: highlightLeft,
                height: highlightHeight,
              },
            ]}
            {...blockingResponder}
          />
          <View
            style={[
              styles.tutorialBlockingLayer,
              {
                top: highlightTop,
                left: highlightRight,
                right: 0,
                height: highlightHeight,
              },
            ]}
            {...blockingResponder}
          />
        </>
      );
    };

    return (
      <View style={styles.tutorialOverlay} pointerEvents="auto">
        {renderBlockingAreas()}
        <View style={styles.tutorialBackdrop} pointerEvents="none" />
        {hasTarget ? (
          <View
            style={[
              styles.tutorialHighlight,
              {
                width: highlightWidth,
                height: highlightHeight,
                left: highlightLeft,
                top: highlightTop,
              },
            ]}
            pointerEvents="none"
          />
        ) : null}
        <Pressable style={styles.tutorialExitButton} onPress={finishTutorial}>
          <Text style={styles.tutorialExitText}>{t("tutorial.cta.exit")}</Text>
        </Pressable>
        <View
          style={[styles.tutorialCard, { width: cardWidth, left: cardLeft, top: cardTop }]}
          onLayout={(event) => {
            const nextHeight = event.nativeEvent.layout.height;
            if (Math.abs(nextHeight - tutorialCardHeight) > 1) {
              setTutorialCardHeight(nextHeight);
            }
          }}
        >
          <Text style={styles.tutorialTitle}>{t(tutorialStep.titleKey)}</Text>
          <Text style={styles.tutorialBody}>{t(tutorialStep.bodyKey)}</Text>
          <View style={styles.tutorialActions}>
            {!tutorialStep.requiresAction ? (
              <Pressable
                style={[styles.tutorialActionButton, styles.tutorialActionPrimary]}
                onPress={isTutorialLastStep ? completeTutorial : advanceTutorial}
              >
                <Text style={styles.tutorialActionPrimaryText}>
                  {isTutorialLastStep ? t("tutorial.cta.done") : t("tutorial.cta.next")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  const todayStats = useMemo(() => {
    if (!selectedSport) {
      return { reps: 0, seconds: 0 };
    }
    return getRollingStats(logs, selectedSport.id);
  }, [logs, selectedSport]);

  const workoutDisplayReps = workoutTrackingMode ? workoutSessionCount : todayStats.reps;

  const aiTodayStats = useMemo(() => {
    if (!aiSport) {
      return { reps: 0, seconds: 0 };
    }
    return getRollingStats(logs, aiSport.id);
  }, [logs, aiSport]);

  useEffect(() => {
    selectedSportRef.current = selectedSport || null;
  }, [selectedSport]);

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);

  useEffect(() => {
    if (voiceEnabled) {
      lastVoiceTokenRef.current = null;
      lastVoiceAtRef.current = 0;
    }
  }, [voiceEnabled]);

  const showPermissionPrompt =
    Platform.OS === "android" && (needsAccessibility || !usageAccessGranted);
  const missingPermissions = needsAccessibility || !usageAccessGranted;
  const completedGettingStarted =
    !missingPermissions &&
    (permissionsPrompted ||
      usagePermissionsPrompted ||
      accessibilityDisclosureAccepted);

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }
    if (tutorialSeen || tutorialActive) {
      return;
    }
    if (!completedGettingStarted) {
      return;
    }
    startTutorial();
  }, [hasLoaded, tutorialSeen, tutorialActive, completedGettingStarted]);
  const appSearchTerm = appSearch.trim().toLowerCase();
  const filteredApps = installedApps.filter((app) => {
    if (!appSearchTerm) {
      return true;
    }
    const label = (app.label || "").toLowerCase();
    const pkg = (app.packageName || "").toLowerCase();
    return label.includes(appSearchTerm) || pkg.includes(appSearchTerm);
  });
  const sortedApps = [...filteredApps].sort((a, b) => {
    const aUsage = appUsageMap[a.packageName] || 0;
    const bUsage = appUsageMap[b.packageName] || 0;
    if (bUsage !== aUsage) {
      return bUsage - aUsage;
    }
    return (a.label || "").localeCompare(b.label || "");
  });

  useEffect(() => {
    Voice.onSpeechResults = handleVoiceResults;
    Voice.onSpeechError = handleVoiceError;
    Voice.onSpeechEnd = handleVoiceEnd;
    Voice.onSpeechStart = () => setListeningState(true);
  }, [language]);

  useEffect(() => {
    if (!voiceEnabled) {
      stopVoice();
      return;
    }
    startVoice();
  }, [voiceEnabled, language]);

  useEffect(() => {
    if (!selectedSport || selectedSport.type !== "reps") {
      if (voiceEnabled) {
        setVoiceEnabled(false);
      }
    }
  }, [selectedSport, voiceEnabled]);

  useEffect(() => {
    if (selectedSportId === null) {
      setWorkoutSessionCount(0);
    }
  }, [selectedSportId]);

  useEffect(() => {
    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }
    if (!InstaControl?.setWidgetSportData || !InstaControl?.updateWidgets) {
      return;
    }
    sports.forEach((sport) => {
      const dayStats = getRollingStats(logs, sport.id);
      const label = getSportLabel(sport);
      InstaControl.setWidgetSportData(
        sport.id,
        label,
        widgetValueForStats(sport, dayStats),
        "",
        t("label.screenTime"),
        sport.icon || DEFAULT_ICON
      );
    });
    InstaControl.updateWidgets();
  }, [sports, logs, stats, language, usageState.remainingBySport]);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }
    InstaControl?.updateOverallWidgets?.();
    InstaControl?.setOverallWidgetData?.(
      usageState.remainingSeconds || 0,
      rollingEarnedSeconds,
      usageState.carryoverSeconds || 0
    );
  }, [
    usageState.remainingSeconds,
    usageState.usedSeconds,
    usageState.carryoverSeconds,
    rollingEarnedSeconds,
  ]);
  if (aiSession && aiSport) {
    return (
      <AiCameraScreen
        onClose={stopAiSession}
        repsValue={aiTodayStats.reps}
        t={t}
      />
    );
  }
  if (overallStatsOpen) {
    const allKeys = Object.values(stats || {}).reduce((acc, sportStats) => {
      Object.keys(sportStats || {}).forEach((key) => acc.add(key));
      return acc;
    }, new Set());
    const weekdayLabels = WEEKDAY_LABELS_BY_LANG[language] || WEEKDAY_LABELS;
    const dayTotals = Object.entries(stats || {}).reduce((acc, [sportId, sportStats]) => {
      const sport = sports.find((entry) => entry.id === sportId);
      if (!sport) {
        return acc;
      }
      Object.entries(sportStats || {}).forEach(([key, dayStats]) => {
        acc[key] = (acc[key] || 0) + screenSecondsForStats(sport, dayStats);
      });
      return acc;
    }, {});
    const rangeKeys =
      statsRange === "month"
        ? []
        : Array.from({ length: statsRange === "week" ? 7 : 1 }, (_, index) => {
            const date = new Date();
            date.setDate(date.getDate() - index);
            return dateKeyFromDate(date);
          });
    const months = getMonthsForCalendar(allKeys);
    if (overallDayKey) {
      const workoutGroups = sports
        .flatMap((sport) => {
          const dayLogs = (logs[sport.id] || {})[overallDayKey] || [];
          const groups = groupEntriesByWindow(dayLogs, sport.type);
          return groups.map((group, index) => ({
            key: `${sport.id}-${group.startTs}-${index}`,
            sport,
            group,
          }));
        })
        .sort((a, b) => a.group.startTs - b.group.startTs);
      return (
        <SafeAreaView style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.headerRow}>
              <View
                style={[
                  styles.headerTitleBlock,
                  { flexDirection: "row", alignItems: "center" },
                ]}
              >
                <Pressable
                  style={styles.backButton}
                  onPress={() => setOverallDayKey(null)}
                >
                  <Text style={styles.backText}>{t("label.back")}</Text>
                </Pressable>
                <Text style={styles.headerTitle}>{t("label.dayDetails")}</Text>
              </View>
              {renderTutorialHeaderButton()}
            </View>
            {renderMainNav("stats")}
            <View style={styles.infoCard}>
              <Text style={styles.sectionTitle}>{formatDateLabel(overallDayKey)}</Text>
              <Text style={styles.cardMeta}>{t("label.overallStats")}</Text>
            </View>
            {workoutGroups.length === 0 ? (
              <Text style={styles.helperText}>{t("label.noEntries")}</Text>
            ) : (
              workoutGroups.map(({ key, sport, group }) => {
                const valueText =
                  sport.type === "reps"
                    ? `${group.reps} ${repsShort}`
                    : formatSeconds(group.seconds);
                const range =
                  group.startTs === group.endTs
                    ? formatTime(group.startTs)
                    : `${formatTime(group.startTs)}-${formatTime(group.endTs)}`;
                return (
                  <View key={key} style={styles.statRow}>
                    <Text style={styles.statLabel}>
                      {sport.icon || DEFAULT_ICON} {getSportLabel(sport)} · {range}
                    </Text>
                    <View style={styles.statRowActions}>
                      <Text style={styles.statValue}>{valueText}</Text>
                      <Pressable
                        style={styles.statMinusButton}
                        onPress={() =>
                          decrementLogGroup(sport, overallDayKey, group)
                        }
                      >
                        <Text style={styles.statMinusText}>-</Text>
                      </Pressable>
                      <Pressable
                        style={styles.statDeleteButton}
                        onPress={() =>
                          confirmAction(t("label.confirmDelete"), () =>
                            deleteLogGroup(
                              sport.id,
                              overallDayKey,
                              group,
                              sport.type
                            )
                          )
                        }
                      >
                        <Text style={styles.statDeleteText}>{t("label.delete")}</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={styles.container}>
        <Pressable
          style={styles.deleteAllButton}
          onPress={() =>
            confirmAction(t("label.confirmDeleteAllGlobal"), clearAllStats)
          }
        >
          <Text style={styles.deleteAllText}>
            {t("label.deleteAllEntriesGlobal")}
          </Text>
        </Pressable>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerRow}>
            <View style={styles.headerTitleBlock}>
              <View style={styles.titleWrap}>
                <Text style={styles.title}>{t("app.title")}</Text>
                <View style={styles.titleDecoration} />
              </View>
              <Text style={styles.subtitle}>{t("menu.stats")}</Text>
            </View>
            {renderTutorialHeaderButton()}
          </View>
          {renderMainNav("stats")}
          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>{t("label.statsBySport")}</Text>
            <View style={styles.quickActionsRow}>
              {activeSports.length === 0 ? (
                <Text style={styles.helperText}>{t("label.noSports")}</Text>
              ) : (
                activeSports.map((sport) => (
                  <Pressable
                    key={sport.id}
                    style={styles.quickActionButton}
                    onPress={() => openSportStats(sport.id)}
                  >
                    <Text style={styles.quickActionText}>
                      {sport.icon || DEFAULT_ICON} {getSportLabel(sport)}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>
          </View>
          <View style={styles.filterRow}>
            {[
              { key: "today", label: t("label.today") },
              { key: "week", label: t("label.week") },
              { key: "month", label: t("label.month") },
            ].map((item) => (
              <Pressable
                key={item.key}
                style={[
                  styles.filterChip,
                  statsRange === item.key && styles.filterChipActive,
                ]}
                onPress={() => setStatsRange(item.key)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    statsRange === item.key && styles.filterChipTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {statsRange !== "month" ? (
            <View style={styles.infoCard}>
              {rangeKeys.map((key) => (
                <View key={key} style={styles.statRow}>
                  <Text style={styles.statLabel}>{formatDateLabel(key)}</Text>
                  <Text style={styles.statValue}>
                    {formatScreenTime(dayTotals[key] || 0)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>{t("label.overallStats")}</Text>
          </View>
          {statsRange === "month"
            ? months.map((monthDate) => {
                const monthKey = `${monthDate.getFullYear()}-${String(
                  monthDate.getMonth() + 1
                ).padStart(2, "0")}`;
                const weeks = buildWeeksForMonth(monthDate);
                return (
                  <View key={monthKey} style={styles.overallMonth}>
                    <Text style={styles.calendarMonthTitle}>
                      {formatMonthLabel(monthDate, language)}
                    </Text>
                    {weeks.map((weekDays, weekIndex) => (
                      <View
                        key={`${monthKey}-w${weekIndex}`}
                        style={styles.overallWeekRow}
                      >
                        {weekDays.map((day, index) => {
                          const key = dateKeyFromDate(day);
                          const totalSeconds = dayTotals[key] || 0;
                          const hasValue = totalSeconds > 0;
                          const inMonth = day.getMonth() === monthDate.getMonth();
                          const isToday = key === todayKey();
                          return (
                            <Pressable
                              key={key}
                              style={[
                                styles.overallDayCell,
                                !inMonth && styles.overallDayCellOut,
                                isToday && styles.overallDayCellToday,
                              ]}
                              onPress={() => setOverallDayKey(key)}
                            >
                              <Text style={styles.overallWeekday}>
                                {weekdayLabels[index]}
                              </Text>
                              <Text style={styles.overallDayNumber}>
                                {day.getDate()}
                              </Text>
                              <Text style={styles.overallDayValue}>
                                {hasValue ? formatScreenTime(totalSeconds) : "-"}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ))}
                  </View>
                );
              })
            : null}
        </ScrollView>
        {editEntryKey ? (
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{t("label.editEntry")}</Text>
              <Text style={styles.modalSubtitle}>{formatDateLabel(editEntryKey)}</Text>
              <TextInput
                style={styles.input}
                value={editEntryValue}
                onChangeText={setEditEntryValue}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#7a7a7a"
              />
              <Text style={styles.modalUnit}>{editUnitLabel}</Text>
              <Text style={styles.helperText}>{t("label.editHint")}</Text>
              <View style={styles.modalActions}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => {
                    setEditEntryKey(null);
                    setEditEntryValue("");
                  }}
                >
                  <Text style={styles.secondaryButtonText}>{t("label.cancel")}</Text>
                </Pressable>
                <Pressable style={styles.primaryButton} onPress={saveEditedEntry}>
                  <Text style={styles.primaryButtonText}>{t("label.save")}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}
      </SafeAreaView>
    );
  }

  if (statsSport) {
    const weekEntries = getWeeklyStats(stats, statsSport.id);
    const weeklyTotal =
      statsSport.type === "reps"
        ? weekEntries.reduce((sum, entry) => sum + entry.dayStats.reps, 0)
        : weekEntries.reduce(
            (sum, entry) => sum + (entry.dayStats.seconds || 0),
            0
          );
    const sportStats = stats[statsSport.id] || {};
    const sportKeys = new Set(Object.keys(sportStats || {}));
    const months = getMonthsForCalendar(sportKeys);
    const weekdayLabels = WEEKDAY_LABELS_BY_LANG[language] || WEEKDAY_LABELS;
    const editUnitLabel =
      statsSport.type === "reps" ? repsShort : t("label.timeUnit");

    const openEditEntry = (dayKey) => {
      const dayStats = sportStats[dayKey] || { reps: 0, seconds: 0 };
      const currentValue =
        statsSport.type === "reps"
          ? dayStats.reps
          : Math.floor((dayStats.seconds || 0) / 60);
      if (currentValue <= 0) {
        return;
      }
      setEditEntryKey(dayKey);
      setEditEntryValue(String(currentValue));
    };

    const saveEditedEntry = () => {
      if (!editEntryKey) {
        return;
      }
      const dayStats = sportStats[editEntryKey] || { reps: 0, seconds: 0 };
      const currentValue =
        statsSport.type === "reps"
          ? dayStats.reps
          : Math.floor((dayStats.seconds || 0) / 60);
      const parsed = Math.max(0, Number.parseInt(editEntryValue, 10) || 0);
      const nextValue = Math.min(parsed, currentValue);
      if (statsSport.type === "reps") {
        updateSpecificDayStat(statsSport.id, editEntryKey, (current) => ({
          ...current,
          reps: nextValue,
        }));
        adjustLogsToTarget(statsSport, editEntryKey, nextValue);
      } else {
        updateSpecificDayStat(statsSport.id, editEntryKey, (current) => ({
          ...current,
          seconds: nextValue * 60,
        }));
        adjustLogsToTarget(statsSport, editEntryKey, nextValue * 60);
      }
      setEditEntryKey(null);
      setEditEntryValue("");
    };
    if (statsDayKey) {
      const dayLogs = (logs[statsSport.id] || {})[statsDayKey] || [];
      const groups = groupEntriesByWindow(dayLogs, statsSport.type);
      const sortedEntries = [...dayLogs].sort((a, b) => a.ts - b.ts);
      return (
        <SafeAreaView style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.headerRow}>
              <View
                style={[
                  styles.headerTitleBlock,
                  { flexDirection: "row", alignItems: "center" },
                ]}
              >
                <Pressable
                  style={styles.backButton}
                  onPress={() => setStatsDayKey(null)}
                >
                  <Text style={styles.backText}>{t("label.back")}</Text>
                </Pressable>
                <Text style={styles.headerTitle}>{t("label.dayDetails")}</Text>
              </View>
              {renderTutorialHeaderButton()}
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.sectionTitle}>{formatDateLabel(statsDayKey)}</Text>
              <Text style={styles.cardMeta}>{getSportLabel(statsSport)}</Text>
            </View>
            {groups.length === 0 ? (
              <Text style={styles.helperText}>{t("label.noEntries")}</Text>
            ) : (
              groups.map((group, index) => {
                const valueText =
                  statsSport.type === "reps"
                    ? `${group.reps} ${repsShort}`
                    : formatSeconds(group.seconds);
                const range =
                  group.startTs === group.endTs
                    ? formatTime(group.startTs)
                    : `${formatTime(group.startTs)}-${formatTime(group.endTs)}`;
                return (
                  <View key={`${group.startTs}-${index}`} style={styles.statRow}>
                    <Text style={styles.statLabel}>{range}</Text>
                    <View style={styles.statRowActions}>
                      <Text style={styles.statValue}>{valueText}</Text>
                      <Pressable
                        style={styles.statMinusButton}
                        onPress={() =>
                          decrementLogGroup(statsSport, statsDayKey, group)
                        }
                      >
                        <Text style={styles.statMinusText}>-</Text>
                      </Pressable>
                      <Pressable
                        style={styles.statDeleteButton}
                        onPress={() =>
                          confirmAction(t("label.confirmDelete"), () =>
                            deleteLogGroup(
                              statsSport.id,
                              statsDayKey,
                              group,
                              statsSport.type
                            )
                          )
                        }
                      >
                        <Text style={styles.statDeleteText}>{t("label.delete")}</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
            {sortedEntries.length > 0 ? (
              <View style={styles.breakdownSection}>
                <Text style={styles.sectionTitle}>{t("label.breakdown")}</Text>
                {sortedEntries.map((entry) => {
                  const baseValue =
                    statsSport.type === "reps"
                      ? `${entry.reps || 0} ${repsShort}`
                      : formatSeconds(entry.seconds || 0);
                  const earnedSeconds = Number.isFinite(entry.screenSeconds)
                    ? entry.screenSeconds
                    : screenSecondsForEntry(statsSport, entry);
                  return (
                    <View key={entry.id} style={styles.statRow}>
                      <Text style={styles.statLabel}>
                        {formatTime(entry.ts)} · {baseValue}
                      </Text>
                      <Text style={styles.statValue}>
                        +{formatScreenTime(earnedSeconds)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerRow}>
            <Pressable
              style={styles.backButton}
              onPress={() => setStatsSportId(null)}
            >
              <Text style={styles.backText}>{t("label.back")}</Text>
            </Pressable>
            <Text style={styles.headerTitle}>{t("menu.stats")}</Text>
          </View>
          <View style={styles.statsActionsRow}>
            <Pressable
              style={styles.statsActionButton}
              onPress={() => setStatsEditMode((prev) => !prev)}
            >
              <Text style={styles.editEntriesText}>{t("label.editEntries")}</Text>
            </Pressable>
            <Pressable
              style={styles.statsActionButtonDanger}
              onPress={() =>
                confirmAction(t("label.confirmDeleteAll"), () =>
                  clearAllStatsForSport(statsSport.id)
                )
              }
            >
              <Text style={styles.deleteAllText}>{t("label.deleteAllEntries")}</Text>
            </Pressable>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>{getSportLabel(statsSport)}</Text>
            <Text style={styles.cardMeta}>{t("label.weekTotal")}</Text>
            <Text style={styles.cardValue}>
              {statsSport.type === "reps"
                ? `${weeklyTotal} ${repsShort}`
                : formatSeconds(weeklyTotal)}
            </Text>
            <Text style={styles.cardMeta}>
              {t("label.screenTime")}: {formatScreenTime(weeklyScreenSeconds(stats, statsSport))}
            </Text>
          </View>
          {months.map((monthDate) => {
            const monthKey = `${monthDate.getFullYear()}-${String(
              monthDate.getMonth() + 1
            ).padStart(2, "0")}`;
            const weeks = buildWeeksForMonth(monthDate);
            return (
              <View key={monthKey} style={styles.overallMonth}>
                <Text style={styles.calendarMonthTitle}>
                  {formatMonthLabel(monthDate, language)}
                </Text>
                {weeks.map((weekDays, weekIndex) => (
                  <View key={`${monthKey}-w${weekIndex}`} style={styles.overallWeekRow}>
                    {weekDays.map((day, index) => {
                      const key = dateKeyFromDate(day);
                      const dayStats = sportStats[key] || { reps: 0, seconds: 0 };
                      const hasValue =
                        statsSport.type === "reps"
                          ? dayStats.reps > 0
                          : (dayStats.seconds || 0) > 0;
                      const displayValue = hasValue
                        ? statsSport.type === "reps"
                          ? `${dayStats.reps}`
                          : formatSeconds(dayStats.seconds || 0)
                        : "-";
                      const inMonth = day.getMonth() === monthDate.getMonth();
                      const isToday = key === todayKey();
                      return (
                        <Pressable
                          key={key}
                          style={[
                            styles.overallDayCell,
                            !inMonth && styles.overallDayCellOut,
                            isToday && styles.overallDayCellToday,
                          ]}
                          onPress={() => {
                            if (!statsEditMode) {
                              setStatsDayKey(key);
                            }
                          }}
                        >
                          <Text style={styles.overallWeekday}>
                            {weekdayLabels[index]}
                          </Text>
                          <Text style={styles.overallDayNumber}>{day.getDate()}</Text>
                          <Text style={styles.overallDayValue}>{displayValue}</Text>
                          {statsEditMode && hasValue ? (
                            <Pressable
                              style={styles.calendarEditButton}
                              onPress={() => openEditEntry(key)}
                            >
                              <Text style={styles.calendarEditText}>-</Text>
                            </Pressable>
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (selectedSport) {
    const isReps = selectedSport.type === "reps";
    const isWeightMode = isReps && selectedSport.weightExercise;
    const isSimpleReps = isReps && !selectedSport.weightExercise;
    const previewWeight = parsePositiveNumber(weightEntryWeight);
    const previewReps = parsePositiveInteger(weightEntryReps);
    const weightPreviewSeconds =
      isWeightMode && previewWeight > 0 && previewReps > 0
        ? screenSecondsForEntry(selectedSport, {
            reps: previewReps,
            weight: previewWeight,
          })
        : 0;
    const logWeightSet = () => {
      if (!isWeightMode) {
        return;
      }
      const weight = parsePositiveNumber(weightEntryWeight);
      const reps = parsePositiveInteger(weightEntryReps);
      if (weight <= 0 || reps <= 0) {
        return;
      }
      const entry = {
        ts: Date.now(),
        reps,
        weight,
      };
      addLogEntry(selectedSport, entry);
      const addedSeconds = screenSecondsForEntry(selectedSport, entry);
      updateDayStat(selectedSport.id, (dayStats) => ({
        ...dayStats,
        reps: dayStats.reps + reps,
        screenSeconds: (dayStats.screenSeconds || 0) + addedSeconds,
      }));
      setWeightEntryWeight("");
      setWeightEntryReps("");
    };
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable
              style={styles.backButton}
              ref={tutorialBackButtonRef}
              onPress={handleBackFromSport}
            >
              <Text style={styles.backText}>{t("label.back")}</Text>
            </Pressable>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerIcon}>{selectedSport.icon || DEFAULT_ICON}</Text>
              <Text
                style={styles.headerTitle}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {getSportLabel(selectedSport)}
              </Text>
            </View>
          </View>
          <Pressable
            style={styles.iconButton}
            onPress={() => setStatsSportId(selectedSport.id)}
          >
            <Text style={styles.iconButtonText}>{t("menu.stats")}</Text>
          </Pressable>
        </View>
        <Pressable
          style={styles.statsCard}
          onPress={() => setStatsSportId(selectedSport.id)}
        >
          <View style={styles.counterRow}>
            <View style={styles.counterBlock}>
              <Text style={styles.counterLabel}>{t("label.today")}</Text>
              <Text style={styles.counterValueSmall}>
                {selectedSport.type === "reps"
                  ? `${todayStats.reps}`
                  : formatSeconds(todayStats.seconds || 0)}
              </Text>
              <Text style={styles.counterUnit}>
                {selectedSport.type === "reps" ? repsShort : t("label.timeUnit")}
              </Text>
            </View>
          </View>
        </Pressable>
        {isSimpleReps ? (
          <Pressable
            style={styles.trackingArea}
            ref={tutorialTrackingAreaRef}
            onPress={incrementReps}
          >
            <Text style={styles.counterValue}>{workoutDisplayReps}</Text>
            <Text style={styles.plusSign}>+</Text>
            <Text style={styles.helperText}>{t("label.tapAnywhere")}</Text>
            <View style={styles.voiceRow}>
              <Pressable
                style={[
                  styles.secondaryButton,
                  styles.voiceButton,
                  voiceEnabled && styles.voiceButtonActive,
                ]}
                onPress={toggleVoice}
              >
                <Text
                  style={[
                    styles.secondaryButtonText,
                    voiceEnabled && styles.voiceButtonTextActive,
                  ]}
                >
                  {micIcon} {voiceEnabled ? t("label.voiceOn") : t("label.voiceOff")}
                </Text>
              </Pressable>
              <Text style={styles.voiceHint}>{t("label.voiceHint")}</Text>
              {voiceStatusText ? (
                <Text
                  style={[
                    styles.voiceStatus,
                    voiceError && styles.voiceStatusError,
                  ]}
                >
                  {voiceStatusText}
                </Text>
              ) : null}
            </View>
            {selectedSport.supportsAi || selectedSport.id === "pushups" ? (
              <View style={styles.aiRow}>
                <Pressable
                  style={[
                    styles.secondaryButton,
                    styles.aiButton,
                    !AI_CAMERA_ENABLED && styles.aiButtonDisabled,
                  ]}
                  onPress={() => startAiSession(selectedSport)}
                >
                  <Text style={styles.secondaryButtonText}>
                    {t("label.aiStart")}
                  </Text>
                </Pressable>
                <Text style={styles.aiHintInline}>
                  {t(
                    AI_CAMERA_ENABLED
                      ? "label.aiHintInline"
                      : "label.aiUnavailableInline"
                  )}
                </Text>
              </View>
            ) : null}
          </Pressable>
        ) : isWeightMode ? (
          <View style={styles.weightEntryArea} ref={tutorialTrackingAreaRef}>
            <View style={styles.weightFieldsRow}>
              <View style={styles.weightField}>
                <Text style={styles.weightFieldLabel}>
                  {t("label.weightEntryWeight")}
                </Text>
                <TextInput
                  style={[styles.input, styles.weightFieldInput]}
                  value={weightEntryWeight}
                  onChangeText={setWeightEntryWeight}
                  placeholder="60"
                  keyboardType="decimal-pad"
                  placeholderTextColor="#7a7a7a"
                />
              </View>
              <View style={styles.weightField}>
                <Text style={styles.weightFieldLabel}>
                  {t("label.weightEntryReps")}
                </Text>
                <TextInput
                  style={[styles.input, styles.weightFieldInput]}
                  value={weightEntryReps}
                  onChangeText={setWeightEntryReps}
                  placeholder="10"
                  keyboardType="number-pad"
                  placeholderTextColor="#7a7a7a"
                />
              </View>
            </View>
            <Text style={styles.weightPreviewText}>
              {t("label.weightEntryPreview")}: {formatScreenTime(weightPreviewSeconds)}
            </Text>
            <Pressable
              style={[styles.primaryButton, styles.fullWidthButton]}
              onPress={logWeightSet}
            >
              <Text style={styles.primaryButtonText}>
                {t("label.weightEntryButton")}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.trackingArea} ref={tutorialTrackingAreaRef}>
            <Text style={styles.counterValue}>
              {formatSeconds(todayStats.seconds + sessionSeconds)}
            </Text>
            <Text style={[styles.helperText, styles.trackingHelperText]}>
              {t("label.today")}
            </Text>
            <View style={styles.timerRow}>
              {!running ? (
                <Pressable style={styles.primaryButton} onPress={handleStart}>
                  <Text style={styles.primaryButtonText}>{t("label.start")}</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.dangerButton} onPress={handleStop}>
                  <Text style={styles.primaryButtonText}>{t("label.stop")}</Text>
                </Pressable>
              )}
            </View>
            {running ? (
              <Text style={[styles.helperText, styles.trackingHelperText]}>
                {t("label.runningSession")}: {formatSeconds(sessionSeconds)}
              </Text>
            ) : null}
          </View>
        )}
        {tutorialActive ? renderTutorialOverlay() : null}
      </SafeAreaView>
    );
  }

  if (isWorkoutOpen) {
    const recentWorkouts = workoutHistory.slice(0, 5);
    const workoutDetail = workoutHistory.find(
      (entry) => entry.id === workoutDetailId
    );
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerRow}>
            <View style={styles.headerTitleBlock}>
              <View style={styles.titleWrap}>
                <Text style={styles.title}>{t("app.title")}</Text>
                <View style={styles.titleDecoration} />
              </View>
              <Text style={styles.subtitle}>{t("menu.workout")}</Text>
            </View>
            {renderTutorialHeaderButton()}
          </View>
          {renderMainNav("workout")}
          {renderWorkoutBanner()}
          <View style={[styles.infoCard, styles.workoutTimerCard]}>
            <View style={styles.workoutTimerContent}>
              <Text
                style={[styles.sectionTitle, styles.workoutTimerTitle]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {t("label.workoutTimer")}
              </Text>
              <Text style={styles.workoutTimerValue}>
                {formatSeconds(workoutSeconds)}
              </Text>
            </View>
            <Pressable
              style={[
                workoutRunning ? styles.dangerButton : styles.primaryButton,
                styles.workoutTimerButton,
              ]}
              onPress={workoutRunning ? handleWorkoutStop : handleWorkoutStart}
            >
              <Text style={styles.primaryButtonText}>
                {workoutRunning
                  ? t("label.endWorkout")
                  : t("label.startWorkout")}
              </Text>
            </Pressable>
          </View>
          <Text style={styles.sectionTitle}>{t("label.workoutExercises")}</Text>
          <View style={styles.workoutList}>
            {activeSports.length === 0 ? (
              <Text style={styles.helperText}>{t("label.noSports")}</Text>
            ) : (
            activeSports.map((sport) => {
              const workoutCount = getWorkoutExerciseCount(sport.id);
              return (
                <Pressable
                  key={sport.id}
                  style={styles.workoutListItem}
                  onPress={() => handleWorkoutExercisePress(sport)}
                >
                  <Text style={styles.workoutListItemMain}>
                    {sport.icon || DEFAULT_ICON} {getSportLabel(sport)}
                  </Text>
                  <Text style={styles.workoutListItemMeta}>
                    {sport.type === "reps"
                        ? `${workoutCount} ${repsShort}`
                        : formatSeconds(0)}
                  </Text>
                </Pressable>
              );
            })
            )}
          </View>
          <Text style={styles.sectionTitle}>{t("label.workoutHistory")}</Text>
          {recentWorkouts.length === 0 ? (
            <Text style={styles.helperText}>{t("label.noEntries")}</Text>
          ) : (
            recentWorkouts.map((session) => (
              <View key={session.id} style={styles.workoutHistoryWrapper}>
                <View style={styles.workoutHistoryHeader}>
                  <Pressable
                    style={[
                      styles.workoutHistoryItem,
                      workoutDetailId === session.id &&
                        styles.workoutHistoryItemActive,
                    ]}
                    onPress={() => setWorkoutDetailId(session.id)}
                  >
                    <Text style={styles.workoutHistoryTitle}>
                      {formatDateLabel(
                        dateKeyFromDate(new Date(session.startTs || Date.now()))
                      )}
                    </Text>
                    <Text style={styles.workoutHistoryMeta}>
                      {formatTime(session.startTs || Date.now())} ·{" "}
                      {formatSeconds(session.duration || 0)}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.workoutHistoryDelete}
                    onPress={() =>
                      confirmAction(t("label.confirmDelete"), () =>
                        deleteWorkout(session.id)
                      )
                    }
                  >
                    <Text style={styles.iconActionText}>🗑</Text>
                  </Pressable>
                </View>
                <Text style={styles.workoutHistoryMeta}>
                  {t("label.screenTime")}:{" "}
                  {formatScreenTime(session.screenSeconds || 0)}
                </Text>
              </View>
            ))
          )}
          {workoutDetail ? (
            <View style={styles.workoutDetailCard}>
              <Text style={styles.sectionTitle}>{t("label.workoutDetail")}</Text>
              <Text style={styles.workoutDetailText}>
                {formatTime(workoutDetail.startTs || Date.now())} ·{" "}
                {t("label.workoutDuration")}:{" "}
                {formatSeconds(workoutDetail.duration || 0)}
              </Text>
              <Text style={styles.workoutDetailText}>
                {t("label.screenTime")}:{" "}
                {formatScreenTime(workoutDetail.screenSeconds || 0)}
              </Text>
              {(workoutDetail.exercises || []).length === 0 ? (
                <Text style={styles.helperText}>{t("label.noEntries")}</Text>
              ) : (
                (workoutDetail.exercises || []).map((entry) => {
                  const sport = sports.find((item) => item.id === entry.sportId);
                  return (
                    <View key={entry.sportId} style={styles.workoutDetailRow}>
                      <Text style={styles.workoutDetailLabel}>
                        {sport?.icon || DEFAULT_ICON}{" "}
                        {sport ? getSportLabel(sport) : entry.sportId}
                      </Text>
                      <Text style={styles.workoutDetailValue}>
                        {entry.count}x
                      </Text>
                    </View>
                  );
                })
              )}
              <Pressable
                style={[styles.secondaryButton, styles.workoutDetailClose]}
                onPress={() => setWorkoutDetailId(null)}
              >
                <Text style={styles.secondaryButtonText}>{t("label.back")}</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (isAppsSettingsOpen) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerRow}>
            <Pressable
              style={styles.backButton}
              onPress={() => setIsAppsSettingsOpen(false)}
            >
              <Text style={styles.backText}>{t("label.back")}</Text>
            </Pressable>
            <Text style={styles.headerTitle}>{t("label.apps")}</Text>
          </View>
          {Platform.OS !== "android" ? (
            <Text style={styles.helperText}>{t("label.androidOnly")}</Text>
          ) : (
            <>
              <TextInput
                style={styles.searchInput}
                value={appSearch}
                onChangeText={setAppSearch}
                placeholder={t("label.searchApps")}
                placeholderTextColor="#7a7a7a"
              />
              {installedApps.length === 0 ? (
                <Text style={styles.helperText}>{t("label.noApps")}</Text>
              ) : null}
              {sortedApps.map((app) => {
                const enabled = settings.controlledApps.includes(app.packageName);
                const usageMs = appUsageMap[app.packageName] || 0;
                const usageMinutes = Math.floor(usageMs / 60000);
                const grayscaleActive = settings.grayscaleRestrictedApps && enabled;
                return (
                  <Pressable
                    key={app.packageName}
                    style={[
                      styles.appRow,
                      enabled && styles.appRowActive,
                      grayscaleActive && styles.appRowGrayscale,
                    ]}
                    onPress={() => toggleControlledApp(app.packageName)}
                  >
                    <Text
                      style={[
                        styles.appLabel,
                        grayscaleActive && styles.grayscaleText,
                      ]}
                    >
                      {app.label}
                    </Text>
                    <Text
                      style={[
                        styles.appPackage,
                        grayscaleActive && styles.grayscaleText,
                      ]}
                    >
                      {app.packageName}
                    </Text>
                    <Text
                      style={[
                        styles.appUsageText,
                        grayscaleActive && styles.grayscaleText,
                      ]}
                    >
                      {usageMinutes} min
                    </Text>
                    <Text
                      style={[
                        styles.appToggle,
                        enabled && styles.appToggleActive,
                        grayscaleActive && styles.grayscaleText,
                      ]}
                    >
                      {enabled ? t("label.active") : t("label.off")}
                    </Text>
                  </Pressable>
                );
              })}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (isSettingsOpen) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerRow}>
            <View style={styles.headerTitleBlock}>
              <View style={styles.titleWrap}>
                <Text style={styles.title}>{t("app.title")}</Text>
                <View style={styles.titleDecoration} />
              </View>
              <Text style={styles.subtitle}>{t("menu.settings")}</Text>
            </View>
            {renderTutorialHeaderButton()}
          </View>
          {renderMainNav("settings")}
          <Text style={styles.settingsSectionTitle}>{t("menu.language")}</Text>
            <View style={styles.infoCard} ref={tutorialSettingsCardRef}>
              <View style={styles.languageWrap}>
                {showLanguageMenu ? (
                  <View style={styles.languageMenu}>
                  <Text style={styles.languageTitle}>{t("menu.language")}</Text>
                  {["de", "en", "es", "fr"].map((code) => {
                    const isActive = code === language;
                    return (
                      <Pressable
                        key={code}
                        style={[
                          styles.languageOption,
                          isActive && styles.languageOptionActive,
                        ]}
                        onPress={() => setAppLanguage(code)}
                      >
                        <Text
                          style={[
                            styles.languageOptionText,
                            isActive && styles.languageOptionTextActive,
                          ]}
                        >
                          {t(`language.${code}`)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
              <Pressable
                style={styles.languageButton}
                onPress={() => setShowLanguageMenu((prev) => !prev)}
              >
                <Text style={styles.languageButtonText}>
                  {t("label.changeLanguage")}
                </Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.settingsDivider} />
          <Text style={styles.settingsSectionTitle}>
            {t("label.widgets")}
          </Text>
          <View style={styles.infoCard}>
            <Text style={styles.helperText}>{t("label.widgetOverall")}</Text>
            <Pressable
              style={styles.secondaryButton}
              onPress={() =>
                InstaControl?.requestPinWidget?.(
                  "overall",
                  t("label.todayScreenTime")
                )
              }
            >
              <Text style={styles.secondaryButtonText}>
                {widgetIcon} {t("label.widgetOverall")}
              </Text>
            </Pressable>
          </View>
          <View style={styles.settingsDivider} />
          <Text style={styles.settingsSectionTitle}>{t("label.apps")}</Text>
          <View style={styles.infoCard}>
            {Platform.OS !== "android" ? (
              <Text style={styles.helperText}>{t("label.androidOnly")}</Text>
            ) : (
                <Pressable
                  ref={tutorialAppsButtonRef}
                  style={styles.secondaryButton}
                  onPress={openAppsSettings}
                >
                <Text style={styles.secondaryButtonText}>
                  {t("label.openApps")}
                </Text>
              </Pressable>
            )}
            <View style={styles.settingsSwitchRow}>
              <Text style={styles.settingsSwitchLabel}>
                {t("label.grayscaleRestrictedApps")}
              </Text>
              <Switch
                value={!!settings.grayscaleRestrictedApps}
                onValueChange={toggleGrayscaleRestrictedApps}
                trackColor={{
                  true: "rgba(245, 158, 11, 0.4)",
                  false: "rgba(148, 163, 184, 0.2)",
                }}
                thumbColor={
                  settings.grayscaleRestrictedApps ? COLORS.ember : "#f4f3f4"
                }
              />
            </View>
            <Text style={styles.helperText}>
              {t("label.grayscaleRestrictedAppsHint")}
            </Text>
          </View>
          <View style={styles.settingsDivider} />
          <Text style={styles.settingsSectionTitle}>
            {t("label.prefaceSettings")}
          </Text>
          <View style={styles.infoCard}>
            <Text style={styles.helperText}>
              {t("label.prefaceDelay")}: {settings.prefaceDelaySeconds} s
            </Text>
            <Pressable
              style={styles.secondaryButton}
              onPress={openPrefaceSettings}
            >
              <Text style={styles.secondaryButtonText}>
                {t("label.prefaceSettings")}
              </Text>
            </Pressable>
          </View>
          <View style={styles.settingsDivider} />
          <Text style={styles.settingsSectionTitle}>
            {t("label.notificationsTitle")}
          </Text>
          <View style={styles.infoCard}>
            <Text style={styles.helperText}>
              {t("label.notificationsReason")}
            </Text>
            <Text style={styles.helperText}>
              {t("label.status")}:{" "}
              {notificationsSupported
                ? notificationsGranted
                  ? t("label.active")
                  : t("label.off")
                : t("label.notificationsNotRequired")}
            </Text>
              {notificationsSupported ? (
                <Pressable
                  style={styles.secondaryButton}
                  onPress={openNotificationSettings}
                >
                  <Text style={styles.secondaryButtonText}>
                    {t("label.notificationsButton")}
                  </Text>
                </Pressable>
              ) : null}
          </View>
          <View style={styles.settingsDivider} />
          <Text style={styles.settingsSectionTitle}>
            {t("label.permissions")}
          </Text>
          <View style={styles.infoCard}>
            <Text style={styles.helperText}>
              {t("label.accessibilityTitle")}:{" "}
              {needsAccessibility
                ? t("label.accessibilityMissing")
                : t("label.accessibilityActive")}
            </Text>
            <Text style={styles.helperText}>
              {t("label.usageAccessTitle")}:{" "}
              {!usageAccessGranted
                ? t("label.usageAccessMissing")
                : t("label.usageAccessActive")}
            </Text>
            {needsAccessibility ? (
              <Pressable
                style={styles.primaryButton}
                onPress={requestAccessibilityAccess}
              >
                <Text style={styles.primaryButtonText}>
                  {t("label.permissionNeeded")}
                </Text>
              </Pressable>
            ) : null}
            {!usageAccessGranted ? (
              <Pressable
                style={styles.secondaryButton}
                onPress={openUsageAccessSettings}
              >
                <Text style={styles.secondaryButtonText}>
                  {t("label.openUsageAccess")}
                </Text>
              </Pressable>
            ) : null}
          </View>
            <View style={styles.settingsDivider} />
          <Text style={styles.settingsSectionTitle}>
            {t("label.sectionData")}
          </Text>
          <View style={styles.infoCard}>
            <Text style={styles.helperText}>{t("label.resetDataHint")}</Text>
            <Pressable
              style={styles.resetDataButton}
              onPress={() =>
                confirmAction(t("label.confirmResetData"), resetAllData)
              }
            >
              <Text style={styles.deleteAllText}>{t("label.resetData")}</Text>
            </Pressable>
          </View>
          <View style={styles.settingsDivider} />
          <Text style={styles.settingsSectionTitle}>
            {t("label.statusOverview")}
          </Text>
          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>{t("label.availableToday")}</Text>
            <Text style={styles.cardValue}>
              {Math.floor((usageState.remainingSeconds || 0) / 60)} min
            </Text>
            <Text style={styles.cardMeta}>
              {t("label.used")}: {Math.floor(usageState.usedSeconds / 60)} min
            </Text>
          </View>
        </ScrollView>
        {tutorialActive ? renderTutorialOverlay() : null}
      </SafeAreaView>
    );
  }
  const gridPadding = 16;
  const gridGap = 12;
  const gridWidth = Math.max(0, width - gridPadding * 2);
  const columnCount = width >= 900 ? 3 : width >= 520 ? 2 : 1;
  const cardWidth = Math.max(
    0,
    Math.floor((gridWidth - gridGap * (columnCount - 1)) / columnCount)
  );
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        onTouchStart={() => {
          if (infoHint) {
            setInfoHint(null);
          }
        }}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerTitleBlock}>
            <View style={styles.titleWrap}>
              <Text style={styles.title}>{t("app.title")}</Text>
              <View style={styles.titleDecoration} />
            </View>
            <Text style={styles.subtitle}>{t("menu.sports")}</Text>
          </View>
          {renderTutorialHeaderButton()}
        </View>
        {renderMainNav("home")}
        {renderWorkoutBanner()}
        {showPermissionPrompt ? (
          <View
            style={[
              styles.permissionCardLarge,
              !permissionsPanelOpen && styles.permissionCardCollapsed,
            ]}
          >
            <Pressable
              style={styles.permissionHeaderRow}
              onPress={() => setPermissionsPanelOpen((prev) => !prev)}
            >
              <View>
                <Text style={styles.permissionTitle}>
                  {t("label.gettingStarted")}
                </Text>
                <Text style={styles.permissionSubtitle}>
                  {t("label.permissionsNeeded")}
                </Text>
                <Text style={styles.permissionHint}>
                  {t("label.permissionsHint")}
                </Text>
              </View>
              <Text style={styles.permissionToggle}>
                {permissionsPanelOpen ? "−" : "+"}
              </Text>
            </Pressable>
            {permissionsPanelOpen ? (
              <View style={styles.permissionList}>
                <View
                  style={[
                    styles.permissionItem,
                    !needsAccessibility && styles.permissionItemGranted,
                  ]}
                >
                  <Text style={styles.permissionItemTitle}>
                    {t("label.accessibilityTitle")}
                  </Text>
                  <Text style={styles.permissionItemText}>
                    {t("label.accessibilityReason")}
                  </Text>
                  <Text style={styles.permissionItemSteps}>
                    {t("label.accessibilitySteps")}
                  </Text>
                  {!needsAccessibility ? null : (
                    <View style={styles.permissionItemActions}>
                      <Pressable
                        style={styles.permissionActionButton}
                        onPress={requestAccessibilityAccess}
                      >
                        <Text style={styles.permissionActionButtonText}>
                          {t("label.accessibilityDisclosureConfirm")}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
                <View
                  style={[
                    styles.permissionItem,
                    usageAccessGranted && styles.permissionItemGranted,
                  ]}
                >
                  <Text style={styles.permissionItemTitle}>
                    {t("label.usageAccessTitle")}
                  </Text>
                  <Text style={styles.permissionItemText}>
                    {t("label.usageAccessReason")}
                  </Text>
                  <Text style={styles.permissionItemSteps}>
                    {t("label.usageAccessSteps")}
                  </Text>
                  {usageAccessGranted ? null : (
                    <View style={styles.permissionItemActions}>
                      <Pressable
                        style={styles.permissionActionButton}
                        onPress={openUsageAccessSettings}
                      >
                        <Text style={styles.permissionActionButtonText}>
                          {t("label.openUsageAccess")}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}
        <Modal
          visible={accessibilityDisclosureVisible}
          transparent
          animationType="fade"
          onRequestClose={cancelAccessibilityDisclosure}
        >
          <View style={styles.accessibilityDisclosureOverlay}>
            <View style={styles.accessibilityDisclosureModal}>
              <Text style={styles.accessibilityDisclosureTitle}>
                {t("label.accessibilityDisclosureTitle")}
              </Text>
              <Text style={styles.accessibilityDisclosureBody}>
                {t("label.accessibilityDisclosureBody")}
              </Text>
              <View style={styles.accessibilityDisclosureActions}>
                <Pressable
                  style={[
                    styles.accessibilityDisclosureButton,
                    styles.accessibilityDisclosurePrimary,
                  ]}
                  onPress={confirmAccessibilityDisclosure}
                >
                  <Text
                    style={[
                      styles.accessibilityDisclosureButtonText,
                      styles.accessibilityDisclosurePrimaryText,
                    ]}
                  >
                    {t("label.accessibilityDisclosureConfirm")}
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.accessibilityDisclosureButton,
                    styles.accessibilityDisclosureSecondary,
                  ]}
                  onPress={cancelAccessibilityDisclosure}
                >
                  <Text
                    style={[
                      styles.accessibilityDisclosureButtonText,
                      styles.accessibilityDisclosureSecondaryText,
                    ]}
                  >
                    {t("label.accessibilityDisclosureCancel")}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
        
        <Text style={styles.sectionTitle}>{t("menu.sports")}</Text>
        {activeSports.length === 0 ? (
          <Text style={styles.helperText}>{t("label.noSports")}</Text>
        ) : null}
        <View style={styles.sportsGrid}>
          {activeSports.map((sport) => {
            const daily = getRollingStats(logs, sport.id);
            const sportLabel = getSportLabel(sport);
            const remainingSeconds = usageState.remainingBySport?.[sport.id];
            const todayBadgeText =
              sport.type === "reps"
                ? `${t("label.today")}: ${daily.reps}`
                : `${t("label.today")}: ${formatSeconds(daily.seconds || 0)}`;
            const remainingBadgeText =
              remainingSeconds != null
                ? `${t("label.remaining")}: ${formatScreenTime(remainingSeconds)}`
                : null;
            return (
              <View
                key={sport.id}
                style={[styles.sportCard, { width: cardWidth }]}
                ref={sport.id === tutorialSportId ? tutorialFirstSportRef : undefined}
              >
                <View style={styles.sportTopRow}>
                  <View style={styles.sportTopIconsLeft}>
                    <Pressable
                      style={styles.iconAction}
                      onPress={() => setStatsSportId(sport.id)}
                    >
                      <Text style={styles.iconActionText}>📊</Text>
                    </Pressable>
                    <Pressable
                      style={styles.iconAction}
                      onPress={() => openSportModal(sport)}
                    >
                      <Text style={styles.iconActionText}>🛠</Text>
                    </Pressable>
                  </View>
                  <View style={styles.sportTopTitleCenter}>
                    <SportTitleSlots sport={sport} sportLabel={sportLabel} />
                  </View>
                  <View style={styles.sportTopIconsRight}>
                    <Pressable
                      style={styles.iconAction}
                      onPress={() =>
                        confirmAction(t("label.confirmHide"), () =>
                          handleHideSport(sport.id, true)
                        )
                      }
                    >
                      <Text style={styles.iconActionText}>👁</Text>
                    </Pressable>
                    {canDeleteSport(sport) ? (
                      <Pressable
                        style={styles.iconAction}
                        onPress={() =>
                          confirmAction(t("label.confirmDelete"), () =>
                            handleDeleteSport(sport.id)
                          )
                        }
                      >
                        <Text style={styles.iconActionText}>✕</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
                <Pressable
                  style={styles.sportBodyPressable}
                  onPress={() => handleSelectSport(sport.id)}
                >
                  <View style={styles.sportInfo}>
                    <View style={styles.sportGridContent}>
                      <View style={styles.sportGridRow}>
                        <View style={styles.sportGridColumnLeft}>
                          <Pressable
                            style={[styles.secondaryButton, styles.widgetButton]}
                            onPress={() =>
                              InstaControl?.requestPinWidget?.(sport.id, sportLabel)
                            }
                          >
                            <Text
                              style={[
                                styles.secondaryButtonText,
                                styles.widgetButtonText,
                              ]}
                            >
                              {widgetIcon} {t("label.widget")}
                            </Text>
                          </Pressable>
                        </View>
                        <View style={styles.sportGridColumnCenter}>
                          <View style={styles.sportCounterCenter}>
                            <View
                              style={[styles.counterBlock, styles.sportCounterBlock]}
                            >
                              <Text style={styles.counterLabel}>
                                {t("label.today")}
                              </Text>
                              <Text style={styles.counterValueSmall}>
                                {sport.type === "reps"
                                  ? `${daily.reps}`
                                  : formatSeconds(daily.seconds || 0)}
                              </Text>
                              <Text style={styles.counterUnit}>
                                {sport.type === "reps"
                                  ? repsShort
                                  : t("label.timeUnit")}
                              </Text>
                            </View>
                          </View>
                        </View>
                        <View style={styles.sportGridColumnRight}>
                          <View style={styles.moveActionsRow}>
                            <Text style={styles.earnedTimeTextRight}>
                              {t("label.screenTime")}: {formatScreenTime(daily.screenSeconds || 0)}
                            </Text>
                            <View style={styles.moveButtonColumn}>
                              <Pressable
                                style={styles.iconAction}
                                onPress={() => moveSport(sport.id, -1)}
                              >
                                <Text style={styles.iconActionText}>▲</Text>
                              </Pressable>
                              <Pressable
                                style={[styles.iconAction, styles.moveButtonArrow]}
                                onPress={() => moveSport(sport.id, 1)}
                              >
                                <Text style={styles.iconActionText}>▼</Text>
                              </Pressable>
                            </View>
                          </View>
                        </View>
                      </View>
                      <View style={styles.sportGridRow}>
                        <View style={styles.sportGridColumnLeft}>
                          <View style={styles.sportBadges}>
                            <View style={styles.sportBadge}>
                              <Text style={styles.sportBadgeText}>
                                {todayBadgeText}
                              </Text>
                            </View>
                            {remainingBadgeText ? (
                              <View style={styles.sportBadge}>
                                <Text style={styles.sportBadgeText}>
                                  {remainingBadgeText}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                        <View style={styles.sportGridColumnCenter} />
                        <View style={styles.sportGridColumnRight} />
                      </View>
                    </View>
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>
        <View style={styles.addCard}>
          <Pressable
            style={[styles.addSportButton, styles.fullWidthButton]}
            ref={tutorialAddSportRef}
            onPress={() => openSportModal()}
          >
            <Text style={styles.addSportButtonText}>
              + {t("label.addSport")}
            </Text>
          </Pressable>
        </View>
        <View style={styles.hiddenSection}>
          <Pressable
            style={styles.hiddenToggle}
            onPress={() => setShowHidden((s) => !s)}
          >
            <Text style={styles.hiddenToggleText}>
              {showHidden ? t("label.hiddenHide") : t("label.hiddenShow")} ({hiddenSports.length})
            </Text>
            <Text style={styles.hiddenToggleIcon}>{showHidden ? "v" : ">"}</Text>
          </Pressable>
          {showHidden
            ? hiddenSports.map((sport) => {
                const daily = getRollingStats(logs, sport.id);
                const sportLabel = getSportLabel(sport);
                const remainingSeconds = usageState.remainingBySport?.[sport.id];
                const todayBadgeText =
                  sport.type === "reps"
                    ? `${t("label.today")}: ${daily.reps}`
                    : `${t("label.today")}: ${formatSeconds(daily.seconds || 0)}`;
                const remainingBadgeText =
                  remainingSeconds != null
                    ? `${t("label.remaining")}: ${formatScreenTime(remainingSeconds)}`
                    : null;
                return (
                  <View
                    key={sport.id}
                    style={[styles.sportCard, styles.hiddenCard, { width: cardWidth }]}
                  >
                    <View style={styles.sportTopRow}>
                      <View style={styles.sportTopIconsLeft}>
                        <Pressable
                          style={styles.iconAction}
                          onPress={() => setStatsSportId(sport.id)}
                        >
                          <Text style={styles.iconActionText}>📊</Text>
                        </Pressable>
                        <Pressable
                          style={styles.iconAction}
                          onPress={() => openSportModal(sport)}
                        >
                          <Text style={styles.iconActionText}>🛠</Text>
                        </Pressable>
                      </View>
                      <View style={styles.sportTopTitleCenter}>
                        <SportTitleSlots sport={sport} sportLabel={sportLabel} />
                      </View>
                      <View style={styles.sportTopIconsRight}>
                        <Pressable
                          style={[styles.iconAction, styles.iconActionWithLabel]}
                          onPress={() =>
                            confirmAction(t("label.confirmShow"), () =>
                              handleHideSport(sport.id, false)
                            )
                          }
                        >
                          <Text style={styles.iconActionText}>👁</Text>
                          <Text style={styles.iconActionLabel}>
                            {t("label.show")}
                          </Text>
                        </Pressable>
                        {canDeleteSport(sport) ? (
                          <Pressable
                            style={styles.iconAction}
                            onPress={() =>
                              confirmAction(t("label.confirmDelete"), () =>
                                handleDeleteSport(sport.id)
                              )
                            }
                          >
                            <Text style={styles.iconActionText}>✕</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                    <Pressable
                      style={styles.sportBodyPressable}
                      onPress={() => handleSelectSport(sport.id)}
                    >
                      <View style={styles.sportInfo}>
                        <View style={styles.sportGridContent}>
                        <View style={styles.sportGridRow}>
                          <View style={styles.sportGridColumnLeft}>
                            <Pressable
                              style={[styles.secondaryButton, styles.widgetButton]}
                              onPress={() =>
                                InstaControl?.requestPinWidget?.(sport.id, sportLabel)
                              }
                            >
                            <Text
                              style={[
                                styles.secondaryButtonText,
                                styles.widgetButtonText,
                              ]}
                            >
                              {widgetIcon} {t("label.widget")}
                            </Text>
                            </Pressable>
                          </View>
                          <View style={styles.sportGridColumnCenter}>
                            <View style={styles.sportCounterCenter}>
                              <View
                                style={[styles.counterBlock, styles.sportCounterBlock]}
                              >
                                <Text style={styles.counterLabel}>
                                  {t("label.today")}
                                </Text>
                                <Text style={styles.counterValueSmall}>
                                  {sport.type === "reps"
                                    ? `${daily.reps}`
                                    : formatSeconds(daily.seconds || 0)}
                                </Text>
                                <Text style={styles.counterUnit}>
                                  {sport.type === "reps"
                                    ? repsShort
                                    : t("label.timeUnit")}
                                </Text>
                              </View>
                            </View>
                          </View>
                          <View style={styles.sportGridColumnRight}>
                            <View style={styles.moveActionsRow}>
                              <Text style={styles.earnedTimeTextRight}>
                                {t("label.screenTime")}: {formatScreenTime(daily.screenSeconds || 0)}
                              </Text>
                              <View style={styles.moveButtonColumn}>
                                <Pressable
                                  style={styles.iconAction}
                                  onPress={() => moveSport(sport.id, -1)}
                                >
                                  <Text style={styles.iconActionText}>▲</Text>
                                </Pressable>
                                <Pressable
                                  style={[styles.iconAction, styles.moveButtonArrow]}
                                  onPress={() => moveSport(sport.id, 1)}
                                >
                                  <Text style={styles.iconActionText}>▼</Text>
                                </Pressable>
                              </View>
                            </View>
                          </View>
                        </View>
                        <View style={styles.sportGridRow}>
                          <View style={styles.sportGridColumnLeft}>
                            <View style={styles.sportBadges}>
                              <View style={styles.sportBadge}>
                                <Text style={styles.sportBadgeText}>
                                  {todayBadgeText}
                                </Text>
                              </View>
                              {remainingBadgeText ? (
                                <View style={styles.sportBadge}>
                                  <Text style={styles.sportBadgeText}>
                                    {remainingBadgeText}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          </View>
                          <View style={styles.sportGridColumnCenter} />
                          <View style={styles.sportGridColumnRight} />
                        </View>
                        </View>
                      </View>
                    </Pressable>
                  </View>
                );
              })
            : null}
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>{t("label.recentActivity")}</Text>
          {recentActivityGroups.length === 0 ? (
            <Text style={styles.helperText}>{t("label.recentActivityEmpty")}</Text>
          ) : (
            recentActivityGroups.map(({ sport, dayKey, groups }) => (
              <View key={`${sport.id}-${dayKey}`} style={styles.recentGroup}>
                <Text style={styles.recentGroupTitle}>
                  {sport.icon || DEFAULT_ICON} {getSportLabel(sport)}
                </Text>
                <Text style={styles.cardMeta}>{formatDateLabel(dayKey)}</Text>
                {groups.length === 0 ? (
                  <Text style={styles.helperText}>{t("label.noEntries")}</Text>
                ) : (
                  [...groups]
                    .reverse()
                    .map((group, index) => {
                    const valueText =
                      sport.type === "reps"
                        ? `${group.reps} ${repsShort}`
                        : formatSeconds(group.seconds);
                    const range =
                      group.startTs === group.endTs
                        ? formatTime(group.startTs)
                        : `${formatTime(group.startTs)}-${formatTime(group.endTs)}`;
                    return (
                      <View key={`${group.startTs}-${index}`} style={styles.statRow}>
                        <Text style={styles.statLabel}>{range}</Text>
                        <Text style={styles.statValue}>{valueText}</Text>
                      </View>
                    );
                  })
                )}
              </View>
            ))
          )}
        </View>
      

    </ScrollView>
      <View style={styles.fixedTimers}>
        <Pressable
          style={[styles.infoCard, styles.infoCardMain]}
          ref={tutorialScreenTimeRef}
          onLayout={(event) => setInfoCardWidth(event.nativeEvent.layout.width)}
          onPress={() => setInfoHint(null)}
        >
            <Text style={styles.sectionTitle}>{t("label.screenTimeTitle")}</Text>
          <View style={styles.infoRow}>
            <Pressable
              style={styles.infoItem}
              onLayout={(event) => {
                const layout = event.nativeEvent.layout;
                setInfoAnchors((prev) => ({
                  ...prev,
                  screenTime: layout,
                }));
              }}
              onPress={() =>
                showInfoHint(
                  "screenTime",
                  "label.screenTime",
                  "label.screenTimeHint"
                )
              }
            >
              <Text style={styles.infoIcon}>⏱</Text>
              <Text style={styles.infoValue}>
                {formatScreenTime(rollingEarnedSeconds)}
              </Text>
              <Text style={styles.infoLabel}>{t("label.screenTime")}</Text>
            </Pressable>
            <Pressable
              style={styles.infoItem}
              onLayout={(event) => {
                const layout = event.nativeEvent.layout;
                setInfoAnchors((prev) => ({
                  ...prev,
                  remaining: layout,
                }));
              }}
              onPress={() =>
                showInfoHint(
                  "remaining",
                  "label.remaining",
                  "label.remainingHint"
                )
              }
            >
              <Text style={styles.infoIcon}>⏳</Text>
              <Text style={styles.infoValue}>
                {formatScreenTime(usageState.remainingSeconds || 0)}
              </Text>
              <Text style={styles.infoLabel}>{t("label.remaining")}</Text>
            </Pressable>
            <Pressable
              style={styles.infoItem}
              onLayout={(event) => {
                const layout = event.nativeEvent.layout;
                setInfoAnchors((prev) => ({
                  ...prev,
                  carryover: layout,
                }));
              }}
              onPress={() =>
                showInfoHint(
                  "carryover",
                  "label.carryover",
                  "label.carryoverHint"
                )
              }
            >
              <Text style={styles.infoIcon}>♻️</Text>
              <Text style={styles.infoValue}>
                {formatScreenTime(usageState.carryoverSeconds || 0)}
              </Text>
              <Text style={styles.infoLabel}>{t("label.carryover")}</Text>
            </Pressable>
          </View>
          {infoHint ? (
            <Pressable
              style={[
                styles.infoTooltip,
                {
                  left:
                    infoCardWidth > 0
                      ? Math.max(12, (infoCardWidth - tooltipWidth) / 2)
                      : 12,
                  top: Math.max(8, infoHint.y + infoHint.height / 2 - 24),
                },
              ]}
              onPress={() => setInfoHint(null)}
            >
              <Text style={styles.infoTooltipTitle}>{infoHint.title}</Text>
              <Text style={styles.infoTooltipText}>{infoHint.body}</Text>
            </Pressable>
          ) : null}
        </Pressable>
      </View>
      {isPrefaceSettingsOpen ? (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t("label.prefaceSettings")}</Text>
            <Text style={styles.rateLabel}>{t("label.prefaceDelay")}</Text>
            <TextInput
              style={styles.input}
              value={prefaceDelayInput}
              onChangeText={setPrefaceDelayInput}
              keyboardType="number-pad"
              placeholder="10"
              placeholderTextColor="#7a7a7a"
            />
            <View style={styles.modalActions}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => setIsPrefaceSettingsOpen(false)}
              >
                <Text style={styles.secondaryButtonText}>{t("label.cancel")}</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={savePrefaceSettings}>
                <Text style={styles.primaryButtonText}>{t("label.save")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
      {isSportModalOpen ? (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingSportId ? t("label.editSport") : t("label.addSport")}
            </Text>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder={t("placeholder.sportName")}
              placeholderTextColor="#7a7a7a"
            />
            <View style={styles.iconRow}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => setShowIconInput((prev) => !prev)}
              >
                <Text style={styles.secondaryButtonText}>
                  {t("label.iconChoose")}
                </Text>
              </Pressable>
              <Text style={styles.iconPreview}>{newIcon || DEFAULT_ICON}</Text>
            </View>
            {showIconInput ? (
              <TextInput
                style={styles.input}
                value={newIcon}
                onChangeText={(text) => setNewIcon(normalizeIcon(text))}
                placeholder={t("label.iconPlaceholder")}
                placeholderTextColor="#7a7a7a"
                maxLength={2}
              />
            ) : null}
            <Text style={styles.rateLabel}>
              {newType === "reps"
                ? t("label.screenRateReps")
                : t("label.screenRateTime")}
            </Text>
            <TextInput
              style={styles.input}
              value={newRateMinutes}
              onChangeText={setNewRateMinutes}
              placeholder="1"
              keyboardType="decimal-pad"
              placeholderTextColor="#7a7a7a"
            />
            <Text style={styles.typeHelpText}>{t("label.typeHelp")}</Text>
            <View style={styles.typeRow}>
              <Pressable
                style={[
                  styles.typeButton,
                  newType === "reps" && styles.typeButtonActive,
                ]}
                onPress={() => {
                  setNewType("reps");
                  setNewRateMinutes(String(getDefaultRateMinutes("reps")));
                }}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    newType === "reps" && styles.typeButtonTextActive,
                  ]}
                >
                  {t("label.reps")}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.typeButton,
                  newType === "time" && styles.typeButtonActive,
                ]}
                onPress={() => {
                  setNewType("time");
                  setNewRateMinutes(String(getDefaultRateMinutes("time")));
                  setNewWeightExercise(false);
                }}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    newType === "time" && styles.typeButtonTextActive,
                  ]}
                >
                  {t("label.timeBased")}
                </Text>
              </Pressable>
            </View>
            {newType === "reps" ? (
              <>
                <View style={styles.weightToggleRow}>
                  <Pressable
                    style={[
                      styles.weightToggleButton,
                      newWeightExercise && styles.weightToggleButtonActive,
                    ]}
                    onPress={() => setNewWeightExercise((prev) => !prev)}
                  >
                    <Text style={styles.weightToggleLabel}>
                      {t("label.weightExercise")}
                    </Text>
                    <Text style={styles.weightToggleIndicator}>
                      {newWeightExercise ? "✔" : "○"}
                    </Text>
                  </Pressable>
                </View>
                {newWeightExercise ? (
                  <>
                    <Text style={styles.rateLabel}>{t("label.weightFactor")}</Text>
                    <TextInput
                      style={styles.input}
                      value={newWeightFactor}
                      onChangeText={(value) =>
                        setNewWeightFactor(value.replace(",", "."))
                      }
                      placeholder="3"
                      keyboardType="number-pad"
                      placeholderTextColor="#7a7a7a"
                    />
                    <Text style={styles.weightHintText}>
                      {t("label.weightFactorHint")}
                    </Text>
                    <Text style={styles.weightGuideText}>
                      {t("label.weightFactorGuide")}
                    </Text>
                  </>
                ) : null}
              </>
            ) : null}
            <View style={styles.modalActions}>
              <Pressable
                style={styles.secondaryButton}
                onPress={closeSportModal}
              >
                <Text style={styles.secondaryButtonText}>{t("label.cancel")}</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={saveSportModal}>
                <Text style={styles.primaryButtonText}>{t("label.save")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
      {tutorialActive ? renderTutorialOverlay() : null}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 68,
    paddingBottom: 220,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.text,
    letterSpacing: 0.2,
  },
  titleWrap: {
    alignItems: "flex-start",
  },
  titleDecoration: {
    marginTop: 6,
    width: 54,
    height: 4,
    borderRadius: 999,
    backgroundColor: COLORS.accent,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.muted,
    marginTop: 6,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 62,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerTitleBlock: {
    flex: 1,
    paddingRight: 12,
  },
  tutorialHeaderButton: {
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: COLORS.cardAlt,
  },
  tutorialHeaderText: {
    color: COLORS.text,
    fontWeight: "700",
    fontSize: 12,
  },
  mainNav: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  mainNavButton: {
    backgroundColor: COLORS.cardAlt,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  mainNavButtonActive: {
    backgroundColor: COLORS.accent,
  },
  mainNavText: {
    color: COLORS.text,
    fontWeight: "700",
    fontSize: 12,
  },
  mainNavTextActive: {
    color: COLORS.ink,
  },
  settingsSectionTitle: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  settingsSwitchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  settingsSwitchLabel: {
    color: COLORS.text,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  settingsDivider: {
    height: 1,
    backgroundColor: COLORS.cardAlt,
    marginVertical: 8,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    backgroundColor: COLORS.cardAlt,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  filterChipActive: {
    backgroundColor: COLORS.accent,
  },
  filterChipText: {
    color: COLORS.text,
    fontWeight: "700",
    fontSize: 12,
  },
  filterChipTextActive: {
    color: COLORS.ink,
  },
  quickActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  quickActionButton: {
    backgroundColor: COLORS.cardAlt,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  quickActionText: {
    color: COLORS.text,
    fontWeight: "700",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  recentGroup: {
    marginTop: 10,
  },
  recentGroupTitle: {
    color: COLORS.text,
    fontWeight: "700",
    marginBottom: 6,
  },
  fabButton: {
    position: "absolute",
    right: 18,
    bottom: 130,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 6,
  },
  fabButtonText: {
    color: COLORS.ink,
    fontSize: 28,
    fontWeight: "800",
    marginTop: -2,
  },
  sportsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    gap: 12,
    width: "100%",
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: COLORS.cardAlt,
    marginRight: 12,
  },
  backText: {
    color: COLORS.text,
    fontWeight: "600",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    color: COLORS.text,
    fontWeight: "700",
  },
  iconButton: {
    backgroundColor: COLORS.cardAlt,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  iconButtonText: {
    color: COLORS.text,
    fontWeight: "600",
  },
  trackingArea: {
    flex: 1,
    margin: 16,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  weightEntryArea: {
    margin: 16,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    padding: 16,
    alignItems: "stretch",
  },
  weightFieldsRow: {
    flexDirection: "row",
    gap: 12,
  },
  weightField: {
    flex: 1,
  },
  weightFieldLabel: {
    color: COLORS.muted,
    fontSize: 12,
    marginBottom: 4,
  },
  weightFieldInput: {
    marginBottom: 0,
  },
  weightPreviewText: {
    color: COLORS.muted,
    marginTop: 10,
    marginBottom: 8,
  },
  counterValue: {
    fontSize: 56,
    color: COLORS.text,
    fontWeight: "700",
    textAlign: "center",
  },
  plusSign: {
    fontSize: 72,
    color: COLORS.accent,
    marginTop: 12,
  },
  helperText: {
    marginTop: 12,
    color: COLORS.muted,
  },
  trackingHelperText: {
    textAlign: "center",
  },
  voiceRow: {
    marginTop: 16,
    alignItems: "center",
    gap: 8,
  },
  voiceButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  voiceButtonActive: {
    backgroundColor: COLORS.accentDark,
  },
  voiceButtonTextActive: {
    color: COLORS.white,
  },
  voiceStatus: {
    color: COLORS.muted,
    textAlign: "center",
  },
  voiceHint: {
    color: COLORS.muted,
    textAlign: "center",
    fontSize: 12,
  },
  aiRow: {
    marginTop: 16,
    alignItems: "center",
    gap: 6,
  },
  aiButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  aiButtonDisabled: {
    backgroundColor: COLORS.cardAlt,
    opacity: 0.7,
  },
  aiHintInline: {
    color: COLORS.muted,
    textAlign: "center",
    fontSize: 12,
  },
  voiceStatusError: {
    color: COLORS.danger,
  },
  timerRow: {
    flexDirection: "row",
    marginTop: 24,
  },
  sportCard: {
    backgroundColor: "rgba(30, 41, 59, 0.9)",
    borderRadius: 12,
    padding: 10,
    marginBottom: 6,
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.35)",
    borderTopWidth: 2,
    borderTopColor: COLORS.accent,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7,
  },
  hiddenCard: {
    backgroundColor: COLORS.cardAlt,
    borderColor: COLORS.cardAlt,
    marginTop: 8,
    opacity: 0.9,
  },
  sportInfo: {
    marginBottom: 8,
    alignItems: "stretch",
  },
  sportBodyPressable: {
    flexGrow: 1,
  },
  sportName: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
  },
  sportBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  sportBadge: {
    backgroundColor: COLORS.cardAlt,
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  sportBadgeText: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: "700",
  },
  sportGridContent: {
    width: "100%",
    gap: 8,
  },
  sportGridRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sportGridColumnLeft: {
    width: "25%",
    alignItems: "flex-start",
    justifyContent: "center",
  },
  sportGridColumnCenter: {
    width: "50%",
    alignItems: "center",
    justifyContent: "center",
  },
  sportGridColumnRight: {
    width: "25%",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  aiBadge: {
    borderWidth: 1,
    borderColor: COLORS.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  aiBadgeText: {
    color: COLORS.accent,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  aiBadgePlaceholder: {
    width: 0,
    height: 0,
  },
  sportIcon: {
    fontSize: 18,
  },
  sportMeta: {
    marginTop: 4,
    color: COLORS.muted,
  },
  counterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  counterBlock: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 6,
    paddingVertical: 6,
    alignItems: "center",
  },
  counterLabel: {
    color: "#1f1b16",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  counterValueSmall: {
    color: "#14110c",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 2,
  },
  counterUnit: {
    color: "#3a332a",
    fontSize: 10,
    marginTop: 2,
  },
  rateLabel: {
    color: COLORS.muted,
    marginBottom: 6,
  },
  statsCard: {
    marginHorizontal: 16,
    marginTop: 6,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: 10,
  },
  statsActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginBottom: 10,
  },
  statsActionButton: {
    backgroundColor: COLORS.cardAlt,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  statsActionButtonDanger: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  editEntriesText: {
    color: COLORS.text,
    fontWeight: "600",
    fontSize: 12,
  },
  deleteAllButton: {
    position: "absolute",
    bottom: 24,
    right: 16,
    backgroundColor: COLORS.danger,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    zIndex: 20,
  },
  resetDataButton: {
    backgroundColor: COLORS.danger,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  deleteAllText: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 12,
  },
  calendarMonth: {
    marginTop: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
  },
  calendarMonthTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  calendarHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  calendarWeekLabel: {
    width: "14.28%",
    textAlign: "center",
    color: COLORS.muted,
    fontSize: 10,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calendarSpacer: {
    width: "14.28%",
    height: 46,
  },
  calendarCell: {
    width: "14.28%",
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    backgroundColor: COLORS.card,
    marginBottom: 6,
  },
  overallMonth: {
    marginTop: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
  },
  overallWeekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  overallDayCell: {
    width: "14.28%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    backgroundColor: COLORS.card,
    paddingVertical: 6,
  },
  overallDayCellToday: {
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  overallDayCellOut: {
    opacity: 0.4,
  },
  overallWeekday: {
    color: COLORS.muted,
    fontSize: 9,
    textTransform: "uppercase",
  },
  overallDayNumber: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
  },
  overallDayValue: {
    color: COLORS.white,
    fontSize: 9,
    marginTop: 2,
  },
  calendarDayText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: "700",
  },
  calendarValueText: {
    color: COLORS.white,
    fontSize: 10,
  },
  calendarEditButton: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarEditText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "700",
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.overlay,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 30,
  },
  modalCard: {
    backgroundColor: COLORS.modalSurface,
    borderRadius: 12,
    padding: 16,
    width: "100%",
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  modalSubtitle: {
    color: COLORS.muted,
    marginBottom: 10,
  },
  modalUnit: {
    color: COLORS.muted,
    marginTop: -6,
    marginBottom: 6,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 10,
  },
  statsTitle: {
    color: COLORS.muted,
    marginBottom: 6,
  },
  statsValue: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "700",
  },
  statsMeta: {
    marginTop: 6,
    color: COLORS.muted,
  },
  sportTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sportTopIconsLeft: {
    flexDirection: "row",
    gap: 6,
  },
  sportTopTitleCenter: {
    flex: 1,
    alignItems: "center",
  },
  sportTopIconsRight: {
    flexDirection: "row",
    gap: 6,
  },
  sportTitleCenterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  titleSideSlot: {
    alignItems: "center",
    justifyContent: "center",
  },
  iconAction: {
    backgroundColor: COLORS.cardAlt,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 3,
    minWidth: 22,
    alignItems: "center",
  },
  iconActionWithLabel: {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 6,
  },
  iconActionText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: "700",
  },
  iconActionLabel: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: "700",
  },
  sportCounterBlock: {
    flex: 0,
    minWidth: 100,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: COLORS.white,
  },
  widgetButton: {
    minWidth: 100,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  moveButtonColumn: {
    justifyContent: "flex-end",
    alignItems: "flex-end",
  },
  moveButtonArrow: {
    marginTop: 4,
  },
  moveActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  earnedTimeTextRight: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: COLORS.ember,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 5,
    alignItems: "center",
  },
  trackButtonTop: {
    alignSelf: "stretch",
    width: "100%",
    marginBottom: 8,
  },
  fullWidthButton: {
    alignSelf: "stretch",
    width: "100%",
  },
  primaryButtonText: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: 11,
  },
  addSportButton: {
    backgroundColor: "rgba(245, 158, 11, 0.18)",
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.accent,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },
  addSportButtonText: {
    color: COLORS.accent,
    fontWeight: "800",
    fontSize: 16,
    textAlign: "center",
    letterSpacing: 0.4,
  },
  secondaryButton: {
    backgroundColor: COLORS.cardAlt,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 5,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: COLORS.text,
    fontWeight: "600",
    fontSize: 11,
  },
  widgetButtonText: {
    textAlign: "center",
    fontSize: 10,
  },
  dangerButton: {
    backgroundColor: COLORS.danger,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 5,
  },
  addCard: {
    backgroundColor: COLORS.cardAlt,
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  addTitle: {
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 12,
    fontWeight: "600",
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.text,
    marginBottom: 10,
  },
  searchInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.text,
    marginBottom: 10,
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  iconPreview: {
    fontSize: 20,
  },
  typeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  typeHelpText: {
    color: COLORS.muted,
    fontSize: 12,
    marginBottom: 8,
    lineHeight: 16,
  },
  typeButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  typeButtonActive: {
    backgroundColor: COLORS.accent,
  },
  typeButtonText: {
    color: COLORS.text,
    fontWeight: "600",
  },
  typeButtonTextActive: {
    color: COLORS.white,
  },
  weightToggleRow: {
    marginBottom: 8,
  },
  weightToggleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: COLORS.cardAlt,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  weightToggleButtonActive: {
    borderColor: COLORS.accent,
    backgroundColor: "rgba(245, 158, 11, 0.1)",
  },
  weightToggleLabel: {
    color: COLORS.text,
    fontWeight: "600",
  },
  weightToggleIndicator: {
    color: COLORS.accent,
    fontWeight: "700",
  },
  weightHintText: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 4,
    marginBottom: 8,
  },
  weightGuideText: {
    color: COLORS.muted,
    fontSize: 11,
    marginBottom: 8,
  },
  hiddenSection: {
    marginTop: 20,
  },
  hiddenToggle: {
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  hiddenToggleText: {
    color: COLORS.muted,
    fontWeight: "600",
  },
  hiddenToggleIcon: {
    color: COLORS.muted,
    fontWeight: "700",
    fontSize: 14,
  },
  permissionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  permissionCardLarge: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderRadius: 14,
    padding: 24,
    marginBottom: 24,
    minHeight: 320,
    borderWidth: 1,
    borderColor: COLORS.accentDark,
  },
  permissionCardCollapsed: {
    justifyContent: "center",
  },
  permissionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  permissionTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "700",
  },
  permissionSubtitle: {
    color: COLORS.muted,
    marginTop: 6,
    fontSize: 14,
  },
  permissionHint: {
    color: COLORS.text,
    marginTop: 8,
    fontSize: 16,
    fontWeight: "600",
  },
  permissionToggle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "700",
    marginLeft: 12,
  },
  permissionList: {
    marginTop: 18,
    gap: 12,
  },
  permissionItem: {
    backgroundColor: COLORS.cardAlt,
    borderRadius: 12,
    padding: 12,
  },
  permissionItemGranted: {
    backgroundColor: "rgba(34, 197, 94, 0.22)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.6)",
  },
  permissionItemTitle: {
    color: COLORS.text,
    fontWeight: "700",
    marginBottom: 4,
  },
  permissionItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  permissionOptionalBadge: {
    color: COLORS.muted,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  permissionItemText: {
    color: COLORS.muted,
    marginBottom: 6,
  },
  permissionItemSteps: {
    color: COLORS.muted,
    fontSize: 12,
    marginBottom: 10,
  },
  permissionItemActions: {
    alignItems: "flex-start",
  },
  permissionActionButton: {
    backgroundColor: COLORS.danger,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  permissionActionButtonText: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 12,
  },
  accessibilityDisclosureOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  accessibilityDisclosureModal: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.cardAlt,
  },
  accessibilityDisclosureTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 12,
  },
  accessibilityDisclosureBody: {
    color: COLORS.muted,
    lineHeight: 20,
    marginBottom: 20,
  },
  accessibilityDisclosureActions: {
    flexDirection: "row",
    gap: 12,
  },
  accessibilityDisclosureButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  accessibilityDisclosurePrimary: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  accessibilityDisclosureSecondary: {
    backgroundColor: "transparent",
    borderColor: COLORS.cardAlt,
  },
  accessibilityDisclosureButtonText: {
    fontWeight: "700",
    fontSize: 14,
  },
  accessibilityDisclosurePrimaryText: {
    color: COLORS.ink,
  },
  accessibilityDisclosureSecondaryText: {
    color: COLORS.text,
  },
  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  infoCardMain: {
    position: "relative",
    backgroundColor: COLORS.cardSolid,
  },
  workoutNotification: {
    marginBottom: 12,
    borderRadius: 10,
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  workoutNotificationText: {
    color: COLORS.accent,
    fontWeight: "600",
    textAlign: "center",
  },
  workoutTimerCard: {
    alignItems: "center",
    marginBottom: 18,
    justifyContent: "center",
  },
  workoutTimerValue: {
    fontSize: 40,
    fontWeight: "700",
    color: COLORS.text,
    marginVertical: 6,
    textAlign: "center",
  },
  workoutTimerTitle: {
    textAlign: "center",
  },
  workoutTimerContent: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  workoutTimerButton: {
    alignSelf: "stretch",
    marginTop: 8,
  },
  workoutList: {
    marginBottom: 12,
  },
  workoutListItem: {
    borderRadius: 10,
    backgroundColor: COLORS.card,
    padding: 12,
    marginBottom: 10,
  },
  workoutListItemMain: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },
  workoutListItemMeta: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 4,
  },
  workoutHistoryItem: {
    borderRadius: 10,
    backgroundColor: COLORS.cardAlt,
    padding: 12,
    marginBottom: 10,
  },
  workoutHistoryItemActive: {
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  workoutHistoryWrapper: {
    marginBottom: 12,
  },
  workoutHistoryHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  workoutHistoryDelete: {
    marginLeft: 8,
    padding: 6,
  },
  workoutHistoryTitle: {
    color: COLORS.text,
    fontWeight: "600",
  },
  workoutHistoryMeta: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 2,
  },
  workoutDetailCard: {
    borderRadius: 12,
    backgroundColor: COLORS.card,
    padding: 12,
    marginTop: 12,
  },
  workoutDetailText: {
    color: COLORS.muted,
    marginBottom: 8,
  },
  workoutDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  workoutDetailLabel: {
    color: COLORS.text,
    fontWeight: "600",
  },
  workoutDetailValue: {
    color: COLORS.accent,
    fontWeight: "600",
  },
  workoutDetailClose: {
    marginTop: 12,
  },
  fixedTimers: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 12,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  infoItem: {
    flex: 1,
    alignItems: "center",
    backgroundColor: COLORS.cardAlt,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  infoIcon: {
    fontSize: 16,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: "700",
  },
  infoLabel: {
    marginTop: 4,
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "600",
  },
  infoTooltip: {
    position: "absolute",
    backgroundColor: COLORS.cardDark,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.accentDark,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  infoTooltipTitle: {
    color: COLORS.white,
    fontWeight: "700",
    marginBottom: 4,
    fontSize: 12,
  },
  infoTooltipText: {
    color: COLORS.muted,
    fontSize: 11,
  },
  cardTitle: {
    color: COLORS.muted,
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 28,
    color: COLORS.text,
    fontWeight: "700",
  },
  cardMeta: {
    marginTop: 6,
    color: COLORS.muted,
  },
  sectionTitle: {
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 8,
    fontWeight: "600",
  },
  warningText: {
    marginTop: 10,
    color: COLORS.warning,
    fontWeight: "600",
  },
  successText: {
    marginTop: 10,
    color: COLORS.success,
    fontWeight: "600",
  },
  permissionAlertCard: {
    backgroundColor: "rgba(239, 68, 68, 0.18)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.7)",
  },
  permissionAlertTitle: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  permissionAlertText: {
    color: COLORS.text,
    marginBottom: 10,
    fontWeight: "600",
  },
  appRow: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  appRowActive: {
    borderWidth: 1,
    borderColor: COLORS.accentDark,
  },
  appRowGrayscale: {
    backgroundColor: "rgba(148, 163, 184, 0.06)",
  },
  grayscaleText: {
    color: COLORS.muted,
  },
  appLabel: {
    color: COLORS.text,
    fontWeight: "600",
  },
  appPackage: {
    color: COLORS.muted,
    marginTop: 4,
    fontSize: 12,
  },
  appUsageText: {
    color: COLORS.muted,
    marginTop: 4,
    fontSize: 12,
  },
  appToggle: {
    marginTop: 8,
    color: COLORS.muted,
    fontWeight: "600",
  },
  appToggleActive: {
    color: COLORS.success,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardAlt,
  },
  statRowActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  statLabel: {
    color: COLORS.muted,
    fontWeight: "600",
  },
  statValue: {
    color: COLORS.text,
    fontWeight: "600",
  },
  statMinusButton: {
    marginLeft: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: COLORS.cardAlt,
  },
  statMinusText: {
    color: COLORS.text,
    fontWeight: "700",
    fontSize: 12,
  },
  statDeleteButton: {
    marginLeft: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(239, 68, 68, 0.18)",
  },
  statDeleteText: {
    color: COLORS.danger,
    fontWeight: "700",
    fontSize: 12,
  },
  breakdownSection: {
    marginTop: 16,
  },
  languageWrap: {
    alignItems: "flex-start",
  },
  languageButton: {
    backgroundColor: COLORS.cardAlt,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  languageButtonText: {
    color: COLORS.text,
    fontWeight: "700",
  },
  languageMenu: {
    backgroundColor: COLORS.menuSurface,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    minWidth: 160,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  languageTitle: {
    color: COLORS.muted,
    marginBottom: 6,
    fontWeight: "600",
  },
  languageOption: {
    paddingVertical: 8,
  },
  languageOptionActive: {
    backgroundColor: "rgba(34, 197, 94, 0.18)",
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  languageOptionText: {
    color: COLORS.text,
    fontWeight: "600",
  },
  languageOptionTextActive: {
    color: COLORS.olive,
  },
  aiScreen: {
    flex: 1,
    backgroundColor: "#000",
  },
  aiCamera: {
    flex: 1,
  },
  aiHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  aiCounter: {
    color: COLORS.white,
    fontSize: 52,
    fontWeight: "700",
  },
  aiStopButton: {
    backgroundColor: COLORS.danger,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  aiStopText: {
    color: COLORS.white,
    fontWeight: "700",
  },
  aiFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    alignItems: "center",
  },
  aiHint: {
    color: COLORS.muted,
    textAlign: "center",
    fontSize: 12,
  },
  aiPermission: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    padding: 24,
  },
  aiPermissionText: {
    color: COLORS.muted,
    textAlign: "center",
  },
  tutorialOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
  },
  tutorialBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2, 6, 23, 0.72)",
  },
  tutorialBlockingLayer: {
    position: "absolute",
    backgroundColor: "transparent",
  },
  tutorialExitButton: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 24,
    backgroundColor: COLORS.cardDark,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.35)",
  },
  tutorialExitText: {
    color: COLORS.muted,
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 0.3,
  },
  tutorialHighlight: {
    position: "absolute",
    borderWidth: 2,
    borderColor: COLORS.accent,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderRadius: 8,
  },
  tutorialCard: {
    position: "absolute",
    backgroundColor: COLORS.cardDark,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.35)",
  },
  tutorialTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  tutorialBody: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  tutorialActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 12,
  },
  tutorialActionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.cardAlt,
  },
  tutorialActionPrimary: {
    backgroundColor: COLORS.accent,
  },
  tutorialActionText: {
    color: COLORS.text,
    fontWeight: "600",
    fontSize: 12,
  },
  tutorialActionPrimaryText: {
    color: COLORS.ink,
    fontWeight: "700",
    fontSize: 12,
  },
});
