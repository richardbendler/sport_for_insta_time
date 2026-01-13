
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  NativeModules,
  Platform,
  PermissionsAndroid,
  AppState,
  BackHandler,
  Alert,
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
  usagePermissions: "@usage_permissions_prompted_v1",
  notificationsPermissions: "@notifications_permissions_prompted_v1",
  carryover: "@carryover_seconds_v1",
  carryoverDay: "@carryover_day_v1",
  usageSnapshot: "@usage_snapshot_v1",
  logs: "@logs_v1",
};


const DEFAULT_SETTINGS = {
  controlledApps: [],
  language: "en",
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

const STRINGS = {
  de: {
    "app.title": "Sport für Screen Time",
    "menu.sports": "Deine Sportarten",
    "menu.apps": "Eingeschränkte Apps bearbeiten",
    "menu.settings": "Screen Controller",
    "menu.stats": "Statistik",
    "menu.language": "Sprache",
    "label.today": "Heute",
    "label.week": "Woche",
    "label.weekScreenTime": "Bildschirmzeit Woche",
    "label.screenTime": "Bildschirmzeit",
    "label.remaining": "Übrig",
    "label.editEntries": "Einträge bearbeiten",
    "label.deleteAllEntries": "Alle Einträge (diese Sportart) löschen",
    "label.deleteAllEntriesGlobal": "Alle Einträge löschen",
    "label.editSport": "Sportart bearbeiten",
    "label.editEntry": "Eintrag bearbeiten",
    "label.dayDetails": "Tagesdetails",
    "label.noEntries": "Keine Einträge",
    "label.breakdown": "Aufschluesselung",
    "label.save": "Speichern",
    "label.editHint": "Nur verringern möglich.",
    "label.confirmDeleteAll": "Sicher, dass du alle Einträge löschen willst?",
    "label.confirmDeleteAllGlobal":
      "Sicher, dass du wirklich alle Einträge aller Sportarten löschen willst?",
    "label.overallStats": "Gesamtstatistik",
    "label.overallStatsHint":
      "Einträge bearbeiten geht nur in der jeweiligen Sportart über die Statistik.",
    "label.runningSession": "Laufende Session",
    "label.availableToday": "Heute verfügbar",
    "label.used": "Verbraucht",
    "label.permissions": "Berechtigungen",
    "label.permissionsIntro":
      "Damit Screen Time berechnet und Apps blockiert werden können, braucht die App Zugriff. Du wirst jetzt zu den Einstellungen geführt.",
    "label.carryover": "Uebertrag (50% von gestern)",
    "label.usageAccess": "Nutzungszugriff",
    "label.usageAccessHint":
      "Damit Apps nach Nutzungszeit sortiert werden k?nnen, braucht die App Nutzungszugriff.",
    "label.openUsageAccess": "Nutzungszugriff aktivieren",
    "label.usageAccessMissing": "Nutzungszugriff fehlt",
    "label.usageAccessActive": "Nutzungszugriff aktiv",
    "label.later": "Später",
    "label.apps": "Apps auswählen",
    "label.searchApps": "Apps suchen",
    "label.noApps": "Keine Apps geladen. Tippe auf \"Apps laden\".",
    "label.accessibilityMissing": "Zugriffshilfe fehlt",
    "label.accessibilityActive": "Zugriffshilfe aktiv",
    "label.permissionNeeded": "Zugriffshilfe nötig",
    "label.hiddenShow": "Versteckte Sportarten anzeigen",
    "label.hiddenHide": "Versteckte Sportarten verbergen",
    "label.screenRateReps": "Screen Time pro Wiederholung (Minuten)",
    "label.screenRateTime": "Screen Time pro Sport-Minute (Minuten)",
    "label.weekOverview": "Tagesübersicht",
    "label.weekTotal": "Diese Woche",
    "label.noSports": "Keine aktiven Sportarten. Füge neue hinzu.",
    "label.todayScreenTime": "Bildschirmzeit",
    "label.widget": "Widget auf Startbildschirm",
    "label.widgetOverall": "Widget Gesamt",
    "label.iconChoose": "Icon wählen",
    "label.iconPlaceholder": "Ein Icon",
    "label.addSport": "Neue Sportart",
    "label.reps": "Wiederholungen",
    "label.repsShort": "Wdh.",
    "label.timeUnit": "Zeit",
    "label.timeBased": "Zeitbasiert",
    "label.typeHelp":
      "Wiederholungen: fuer Zaehlen (z.B. 10 Liegestuetze). Zeitbasiert: fuer Minuten/Sekunden (z.B. 15 Minuten Joggen).",
    "label.activateNow": "Jetzt aktivieren",
    "label.loadApps": "Apps laden",
    "label.androidOnly": "App-Auswahl ist nur auf Android verfügbar.",
    "label.accessibilityHint":
      "Aktiviere die Zugriffshilfe, damit Social Apps gesperrt werden können.",
    "label.settingsHint":
      "Aktiviere die Zugriffshilfe, damit die App Social Apps blockieren kann, wenn die Zeit aufgebraucht ist.",
    "label.tapAnywhere": "Tippe irgendwo",
    "label.voiceOn": "Mikrofon an",
    "label.voiceOff": "Mikrofon aus",
    "label.voiceListening": "Hoert zu...",
    "label.voiceIdle": "Bereit",
    "label.voiceHint": "Zaehle laut, die App zaehlt mit (Mikrofonzugriff noetig).",
    "label.voicePermissionMissing": "Mikrofon-Zugriff fehlt",
    "label.voiceError": "Spracherkennung fehlgeschlagen",
    "label.voiceUnavailable": "Spracherkennung nicht verfuegbar",
    "label.aiStart": "AI-Zaehlen starten",
    "label.aiStop": "AI stoppen",
    "label.aiHint": "Kamera seitlich platzieren, Oberkoerper sichtbar halten.",
    "label.aiHintInline": "AI zaehlt Push-ups automatisch (Kamera noetig).",
    "label.aiPermission": "Kamera-Zugriff fehlt oder wurde verweigert.",
    "label.aiLoading": "Kamera wird geladen...",
    "label.aiUnavailable": "AI-Kamera ist voruebergehend deaktiviert.",
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
  },
  en: {
    "app.title": "Sport for Screen Time",
    "menu.sports": "Your sports",
    "menu.apps": "Edit restricted apps",
    "menu.settings": "Screen Controller",
    "menu.stats": "Stats",
    "menu.language": "Language",
    "label.today": "Today",
    "label.week": "Week",
    "label.weekScreenTime": "Screen Time Week",
    "label.screenTime": "Screen Time",
    "label.remaining": "Remaining",
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
    "label.availableToday": "Available today",
    "label.used": "Used",
    "label.permissions": "Permissions",
    "label.permissionsIntro":
      "To track screen time and block apps, the app needs access. You'll be sent to settings now.",
    "label.carryover": "Carryover (50% of yesterday)",
    "label.usageAccess": "Usage access",
    "label.usageAccessHint":
      "Allow usage access so apps can be sorted by usage time.",
    "label.openUsageAccess": "Enable usage access",
    "label.usageAccessMissing": "Usage access missing",
    "label.usageAccessActive": "Usage access active",
    "label.later": "Later",
    "label.apps": "Choose apps",
    "label.searchApps": "Search apps",
    "label.noApps": "No apps loaded. Tap \"Load apps\".",
    "label.accessibilityMissing": "Accessibility missing",
    "label.accessibilityActive": "Accessibility active",
    "label.permissionNeeded": "Accessibility required",
    "label.hiddenShow": "Show hidden sports",
    "label.hiddenHide": "Hide hidden sports",
    "label.screenRateReps": "Screen Time per rep (minutes)",
    "label.screenRateTime": "Screen Time per sport minute (minutes)",
    "label.weekOverview": "Daily overview",
    "label.weekTotal": "This week",
    "label.noSports": "No active sports. Add new ones.",
    "label.todayScreenTime": "Screen Time",
    "label.widget": "Widget on home screen",
    "label.widgetOverall": "Overall widget",
    "label.iconChoose": "Choose icon",
    "label.iconPlaceholder": "One icon",
    "label.addSport": "New sport",
    "label.reps": "Repetitions",
    "label.repsShort": "reps",
    "label.timeUnit": "Time",
    "label.timeBased": "Time-based",
    "label.typeHelp":
      "Repetitions: for counting sets (e.g. 10 push-ups). Time-based: for minutes/seconds (e.g. 15 minutes jogging).",
    "label.activateNow": "Enable now",
    "label.loadApps": "Load apps",
    "label.androidOnly": "App selection is Android-only.",
    "label.accessibilityHint": "Enable accessibility to block social apps.",
    "label.settingsHint":
      "Enable accessibility so the app can block social apps when time is up.",
    "label.tapAnywhere": "Tap anywhere",
    "label.voiceOn": "Mic on",
    "label.voiceOff": "Mic off",
    "label.voiceListening": "Listening...",
    "label.voiceIdle": "Ready",
    "label.voiceHint": "Say numbers out loud to count (microphone access required).",
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
  },
  es: {
    "app.title": "Deporte por tiempo de pantalla",
    "menu.sports": "Tus deportes",
    "menu.apps": "Editar apps restringidas",
    "menu.settings": "Control de pantalla",
    "menu.stats": "Estadísticas",
    "menu.language": "Idioma",
    "label.today": "Hoy",
    "label.week": "Semana",
    "label.weekScreenTime": "Tiempo de pantalla semanal",
    "label.screenTime": "Tiempo de pantalla",
    "label.remaining": "Restante",
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
    "label.availableToday": "Disponible hoy",
    "label.used": "Usado",
    "label.permissions": "Permisos",
    "label.permissionsIntro":
      "Para medir el tiempo de pantalla y bloquear apps, la app necesita acceso. Ahora te llevaremos a ajustes.",
    "label.carryover": "Arrastre (50% de ayer)",
    "label.usageAccess": "Acceso de uso",
    "label.usageAccessHint":
      "Permite el acceso de uso para ordenar las apps por tiempo de uso.",
    "label.openUsageAccess": "Activar acceso de uso",
    "label.usageAccessMissing": "Acceso de uso faltante",
    "label.usageAccessActive": "Acceso de uso activo",
    "label.later": "Más tarde",
    "label.apps": "Elegir apps",
    "label.searchApps": "Buscar apps",
    "label.noApps": "No hay apps cargadas. Toca \"Cargar apps\".",
    "label.accessibilityMissing": "Accesibilidad desactivada",
    "label.accessibilityActive": "Accesibilidad activa",
    "label.permissionNeeded": "Accesibilidad requerida",
    "label.hiddenShow": "Mostrar deportes ocultos",
    "label.hiddenHide": "Ocultar deportes ocultos",
    "label.screenRateReps": "Tiempo de pantalla por repetición (minutos)",
    "label.screenRateTime": "Tiempo de pantalla por minuto de deporte (minutos)",
    "label.weekOverview": "Resumen diario",
    "label.weekTotal": "Esta semana",
    "label.noSports": "No hay deportes activos. Añade nuevos.",
    "label.todayScreenTime": "Tiempo de pantalla",
    "label.widget": "Widget en inicio",
    "label.widgetOverall": "Widget general",
    "label.iconChoose": "Elegir icono",
    "label.iconPlaceholder": "Un icono",
    "label.addSport": "Nuevo deporte",
    "label.reps": "Repeticiones",
    "label.repsShort": "rep.",
    "label.timeUnit": "Tiempo",
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
    "label.tapAnywhere": "Toca en cualquier lugar",
    "label.voiceOn": "Microfono activado",
    "label.voiceOff": "Microfono desactivado",
    "label.voiceListening": "Escuchando...",
    "label.voiceIdle": "Listo",
    "label.voiceHint": "Di numeros en voz alta para contar (requiere microfono).",
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
  },
  fr: {
    "app.title": "Sport pour le temps d’écran",
    "menu.sports": "Tes sports",
    "menu.apps": "Modifier les apps restreintes",
    "menu.settings": "Contrôle écran",
    "menu.stats": "Statistiques",
    "menu.language": "Langue",
    "label.today": "Aujourd'hui",
    "label.week": "Semaine",
    "label.weekScreenTime": "Temps d’écran hebdo",
    "label.screenTime": "Temps d’écran",
    "label.remaining": "Restant",
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
    "label.availableToday": "Disponible aujourd'hui",
    "label.used": "Utilisé",
    "label.permissions": "Autorisations",
    "label.permissionsIntro":
      "Pour suivre le temps d’écran et bloquer des apps, l’app a besoin d’accès. Vous allez être redirigé vers les réglages.",
    "label.carryover": "Report (50% d'hier)",
    "label.usageAccess": "Acces d'utilisation",
    "label.usageAccessHint":
      "Autorisez l'acces d'utilisation pour trier les apps par temps d'usage.",
    "label.openUsageAccess": "Activer l'acces d'utilisation",
    "label.usageAccessMissing": "Acces d'utilisation manquant",
    "label.usageAccessActive": "Acces d'utilisation actif",
    "label.later": "Plus tard",
    "label.apps": "Choisir les apps",
    "label.searchApps": "Rechercher des apps",
    "label.noApps": "Aucune app chargée. Touchez \"Charger les apps\".",
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
    "label.todayScreenTime": "Temps d’écran",
    "label.widget": "Widget sur l’accueil",
    "label.widgetOverall": "Widget global",
    "label.iconChoose": "Choisir une icône",
    "label.iconPlaceholder": "Une icône",
    "label.addSport": "Nouveau sport",
    "label.reps": "Répétitions",
    "label.repsShort": "rép.",
    "label.timeUnit": "Temps",
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
    "label.tapAnywhere": "Touchez n’importe où",
    "label.voiceOn": "Micro actif",
    "label.voiceOff": "Micro inactif",
    "label.voiceListening": "Ecoute...",
    "label.voiceIdle": "Pret",
    "label.voiceHint": "Dis les numeros a voix haute pour compter (micro requis).",
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

const getTodayStat = (stats, sportId) => {
  const day = todayKey();
  const sportStats = stats[sportId] || {};
  const dayStats = sportStats[day] || { reps: 0, seconds: 0 };
  return dayStats;
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

const getDefaultRateMinutes = (sportType) => {
  if (sportType === "reps") {
    return 1;
  }
  return 1;
};

const generateLogId = () =>
  `log_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

const screenSecondsForStats = (sport, dayStats) => {
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
  const rate = sport.screenSecondsPerUnit ?? 0;
  if (sport.type === "reps") {
    return Math.max(0, Math.floor((entry.reps || 0) * rate));
  }
  return Math.max(0, Math.floor((entry.seconds || 0) * rate));
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

const groupEntriesByWindow = (entries, type) => {
  const sorted = [...entries].sort((a, b) => a.ts - b.ts);
  const groups = [];
  const windowMs = 30 * 60 * 1000;
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
  const { width } = useWindowDimensions();
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
  const [showHidden, setShowHidden] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("reps");
  const [newIcon, setNewIcon] = useState("");
  const [newRateMinutes, setNewRateMinutes] = useState("1");
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
  });
  const [needsAccessibility, setNeedsAccessibility] = useState(false);
  const [permissionsPrompted, setPermissionsPrompted] = useState(false);
  const [usagePermissionsPrompted, setUsagePermissionsPrompted] = useState(false);
  const [usageAccessGranted, setUsageAccessGranted] = useState(true);
  const [permissionsCheckTick, setPermissionsCheckTick] = useState(0);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);

  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceError, setVoiceError] = useState(null);
  const [isAppActive, setIsAppActive] = useState(
    AppState.currentState === "active"
  );
  const [aiSession, setAiSession] = useState(null);
  const intervalRef = useRef(null);
  const lastPermissionPromptAt = useRef(0);
  const lastVoiceTokenRef = useRef(null);
  const lastVoiceAtRef = useRef(0);
  const voiceEnabledRef = useRef(false);
  const voiceListeningRef = useRef(false);
  const languageRef = useRef(language);
  const selectedSportRef = useRef(null);

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

  const getSportLabel = (sport) => {
    if (sport.presetKey) {
      return t(`sport.${sport.presetKey}`);
    }
    return sport.name;
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
      const usagePermissionsRaw = await AsyncStorage.getItem(
        STORAGE_KEYS.usagePermissions
      );
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
      setStats(statsRaw ? JSON.parse(statsRaw) : {});
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
      setUsagePermissionsPrompted(usagePermissionsRaw === "true");
    };
    load();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const active = nextState === "active";
      setIsAppActive(active);
      if (active) {
        refreshUsageState();
      }
    });
    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    requestNotificationPermissionIfNeeded();
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
    intervalRef.current = setInterval(() => {
      setSessionSeconds((s) => s + 1);
    }, 1000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [running]);

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
      const dayStats = { reps: 0, seconds: 0, ...(sportStats[day] || {}) };
      const updated = updater(dayStats);
      sportStats[day] = updated;
      nextStats[sportId] = sportStats;
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

  useEffect(() => {
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
    if (InstaControl?.updateOverallWidgets) {
      InstaControl.updateOverallWidgets();
    }
    refreshUsageState();
  }, [logs, sports]);

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
      return nextLogs;
    });
    setStats((prev) => {
      if (nextDayLogs == null) {
        return prev;
      }
      const nextStats = { ...prev };
      const sportStats = { ...(nextStats[sportId] || {}) };
      const total =
        type === "reps"
          ? nextDayLogs.reduce((sum, e) => sum + (e.reps || 0), 0)
          : nextDayLogs.reduce((sum, e) => sum + (e.seconds || 0), 0);
      if (total <= 0) {
        delete sportStats[dayKey];
      } else if (type === "reps") {
        sportStats[dayKey] = { reps: total, seconds: 0 };
      } else {
        sportStats[dayKey] = { reps: 0, seconds: total };
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

  const decrementLogGroup = (sport, dayKey, group) => {
    if (!sport) {
      return;
    }
    let nextDayLogs = null;
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
      nextDayLogs = dayLogs;
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
      return nextLogs;
    });
    setStats((prev) => {
      if (nextDayLogs == null) {
        return prev;
      }
      const nextStats = { ...prev };
      const sportStats = { ...(nextStats[sport.id] || {}) };
      const total =
        sport.type === "reps"
          ? nextDayLogs.reduce((sum, e) => sum + (e.reps || 0), 0)
          : nextDayLogs.reduce((sum, e) => sum + (e.seconds || 0), 0);
      if (total <= 0) {
        delete sportStats[dayKey];
      } else if (sport.type === "reps") {
        sportStats[dayKey] = { reps: total, seconds: 0 };
      } else {
        sportStats[dayKey] = { reps: 0, seconds: total };
      }
      if (Object.keys(sportStats).length === 0) {
        delete nextStats[sport.id];
      } else {
        nextStats[sport.id] = sportStats;
      }
      AsyncStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(nextStats));
      return nextStats;
    });
  };

  const updateSpecificDayStat = (sportId, dayKey, updater) => {
    setStats((prev) => {
      const nextStats = { ...prev };
      const sportStats = { ...(nextStats[sportId] || {}) };
      const current = { reps: 0, seconds: 0, ...(sportStats[dayKey] || {}) };
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
    } else {
      setEditingSportId(null);
      setNewName("");
      setNewType("reps");
      setNewIcon("");
      setNewRateMinutes(String(getDefaultRateMinutes("reps")));
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
      });
    }
  };

  const openAccessibilitySettings = async () => {
    if (InstaControl?.openAccessibilitySettings) {
      InstaControl.openAccessibilitySettings();
      await AsyncStorage.setItem(STORAGE_KEYS.permissions, "true");
      setPermissionsPrompted(true);
    }
  };

  const openUsageAccessSettings = async () => {
    if (InstaControl?.openUsageAccessSettings) {
      InstaControl.openUsageAccessSettings();
      await AsyncStorage.setItem(STORAGE_KEYS.usagePermissions, "true");
      setUsagePermissionsPrompted(true);
    }
  };

  useEffect(() => {
    if (!InstaControl?.setControlledApps) {
      return;
    }
    InstaControl.setControlledApps(settings.controlledApps || []);
    refreshUsageState();
  }, [settings]);

  useEffect(() => {
    checkAccessibility();
    checkUsageAccess();
  }, [isSettingsOpen, statsSportId]);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }
    if (!needsAccessibility) {
      return;
    }
    const now = Date.now();
    if (now - lastPermissionPromptAt.current < 10000) {
      return;
    }
    lastPermissionPromptAt.current = now;
    Alert.alert(
      t("label.permissions"),
      t("label.permissionsIntro"),
      [
        { text: t("label.later"), style: "cancel" },
        { text: t("label.confirm"), onPress: openAccessibilitySettings },
      ],
      { cancelable: true }
    );
  }, [needsAccessibility, permissionsCheckTick]);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }
    if (usageAccessGranted || usagePermissionsPrompted) {
      return;
    }
    const now = Date.now();
    if (now - lastPermissionPromptAt.current < 10000) {
      return;
    }
    lastPermissionPromptAt.current = now;
    Alert.alert(
      t("label.usageAccess"),
      t("label.usageAccessHint"),
      [
        { text: t("label.later"), style: "cancel" },
        { text: t("label.confirm"), onPress: openUsageAccessSettings },
      ],
      { cancelable: true }
    );
  }, [usageAccessGranted, usagePermissionsPrompted]);

  useEffect(() => {
    if (!selectedSportId) {
      setRunning(false);
      setSessionSeconds(0);
    }
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
      if (isSettingsOpen) {
        setIsSettingsOpen(false);
        return true;
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
    isSettingsOpen,
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

  const handleStart = () => {
    setSessionSeconds(0);
    setRunning(true);
  };

  const handleStop = () => {
    setRunning(false);
    if (!selectedSport) {
      return;
    }
    if (sessionSeconds > 0) {
      addLogEntry(selectedSport, {
        ts: Date.now(),
        seconds: sessionSeconds,
      });
      updateDayStat(selectedSport.id, (dayStats) => ({
        ...dayStats,
        seconds: dayStats.seconds + sessionSeconds,
      }));
    }
    setSessionSeconds(0);
  };

  const getSpeechLocale = () => SPEECH_LOCALES[language] || "en-US";

  const incrementReps = () => {
    const currentSport = selectedSportRef.current;
    if (!currentSport || currentSport.type !== "reps") {
      return;
    }
    addLogEntry(currentSport, {
      ts: Date.now(),
      reps: 1,
    });
    updateDayStat(currentSport.id, (dayStats) => ({
      ...dayStats,
      reps: dayStats.reps + 1,
    }));
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

  const requestNotificationPermissionIfNeeded = async () => {
    if (Platform.OS !== "android") {
      return;
    }
    const prompted = await AsyncStorage.getItem(
      STORAGE_KEYS.notificationsPermissions
    );
    if (prompted) {
      return;
    }
    if (Number(Platform.Version) >= 33) {
      await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
    }
    await AsyncStorage.setItem(STORAGE_KEYS.notificationsPermissions, "1");
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
  const statsSport = sports.find((sport) => sport.id === statsSportId);
  const aiSport = aiSession
    ? sports.find((sport) => sport.id === aiSession.sportId)
    : null;

  const todayStats = useMemo(() => {
    if (!selectedSport) {
      return { reps: 0, seconds: 0 };
    }
    return getTodayStat(stats, selectedSport.id);
  }, [stats, selectedSport]);

  const aiTodayStats = useMemo(() => {
    if (!aiSport) {
      return { reps: 0, seconds: 0 };
    }
    return getTodayStat(stats, aiSport.id);
  }, [stats, aiSport]);

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
    Platform.OS === "android" &&
    ((needsAccessibility && !permissionsPrompted) ||
      (!usageAccessGranted && !usagePermissionsPrompted));
  const missingPermissions = needsAccessibility || !usageAccessGranted;
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
    const remainingBySport = usageState.remainingBySport || {};
    const getRemainingForSport = (sportId) => remainingBySport[sportId] || 0;
    sports.forEach((sport) => {
      const dayStats = getTodayStat(stats, sport.id);
      const screenSeconds = screenSecondsForStats(sport, dayStats);
      const label = getSportLabel(sport);
      const remainingSeconds = getRemainingForSport(sport.id);
      InstaControl.setWidgetSportData(
        sport.id,
        label,
        `${t("label.today")}: ${formatSportValue(sport.type, dayStats, repsShort)}`,
        formatScreenTime(remainingSeconds || screenSeconds),
        t("label.screenTime"),
        sport.icon || DEFAULT_ICON
      );
    });
    InstaControl.updateWidgets();
  }, [sports, stats, language, usageState.remainingBySport]);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }
    InstaControl?.updateOverallWidgets?.();
  }, [usageState.remainingSeconds, usageState.usedSeconds]);
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
    const months = getMonthsForCalendar(allKeys);
    if (overallDayKey) {
      const flatEntries = sports.flatMap((sport) => {
        const dayLogs = (logs[sport.id] || {})[overallDayKey] || [];
        return dayLogs.map((entry) => ({
          ts: entry.ts,
          seconds:
            sport.type === "reps"
              ? (entry.reps || 0) * (sport.screenSecondsPerUnit || 0)
              : (entry.seconds || 0) * (sport.screenSecondsPerUnit || 0),
        }));
      });
      const groups = groupEntriesByWindow(flatEntries, "time");
      return (
        <SafeAreaView style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.headerRow}>
              <Pressable
                style={styles.backButton}
                onPress={() => setOverallDayKey(null)}
              >
                <Text style={styles.backText}>{t("label.back")}</Text>
              </Pressable>
              <Text style={styles.headerTitle}>{t("label.dayDetails")}</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.sectionTitle}>{formatDateLabel(overallDayKey)}</Text>
              <Text style={styles.cardMeta}>{t("label.overallStats")}</Text>
            </View>
            {groups.length === 0 ? (
              <Text style={styles.helperText}>{t("label.noEntries")}</Text>
            ) : (
              groups.map((group, index) => {
                const valueText = formatScreenTime(group.seconds || 0);
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
            <Pressable
              style={styles.backButton}
              onPress={() => setOverallStatsOpen(false)}
            >
              <Text style={styles.backText}>{t("label.back")}</Text>
            </Pressable>
            <Text style={styles.headerTitle}>{t("label.overallStats")}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>{t("label.overallStats")}</Text>
            <Text style={styles.helperText}>{t("label.overallStatsHint")}</Text>
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
                          <Text style={styles.overallDayNumber}>{day.getDate()}</Text>
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
          })}
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
              <Pressable
                style={styles.backButton}
                onPress={() => setStatsDayKey(null)}
              >
                <Text style={styles.backText}>{t("label.back")}</Text>
              </Pressable>
              <Text style={styles.headerTitle}>{t("label.dayDetails")}</Text>
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
        <Pressable
          style={styles.editEntriesButton}
          onPress={() => setStatsEditMode((prev) => !prev)}
        >
          <Text style={styles.editEntriesText}>{t("label.editEntries")}</Text>
        </Pressable>
        <Pressable
          style={styles.deleteAllButton}
          onPress={() =>
            confirmAction(t("label.confirmDeleteAll"), () =>
              clearAllStatsForSport(statsSport.id)
            )
          }
        >
          <Text style={styles.deleteAllText}>{t("label.deleteAllEntries")}</Text>
        </Pressable>
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
    const weeklyTotal = computeWeeklyTotal(stats, selectedSport);
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable
              style={styles.backButton}
              onPress={() => setSelectedSportId(null)}
            >
              <Text style={styles.backText}>{t("label.back")}</Text>
            </Pressable>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerIcon}>{selectedSport.icon || DEFAULT_ICON}</Text>
              <Text style={styles.headerTitle}>{getSportLabel(selectedSport)}</Text>
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
            <View style={styles.counterBlock}>
              <Text style={styles.counterLabel}>{t("label.week")}</Text>
              <Text style={styles.counterValueSmall}>
                {selectedSport.type === "reps"
                  ? `${weeklyTotal}`
                  : formatSeconds(weeklyTotal)}
              </Text>
              <Text style={styles.counterUnit}>
                {selectedSport.type === "reps" ? repsShort : t("label.timeUnit")}
              </Text>
            </View>
          </View>
          <View style={styles.screenRow}>
            <View style={styles.screenBlock}>
              <Text style={styles.screenLabel}>{t("label.screenTime")}</Text>
              <Text style={styles.screenValue}>
                {formatScreenTime(screenSecondsForStats(selectedSport, todayStats))}
              </Text>
            </View>
            <View style={styles.screenBlock}>
              <Text style={styles.screenLabel}>{t("label.remaining")}</Text>
                        <Text style={styles.screenValue}>
                          {formatScreenTime(usageState.remainingSeconds || 0)}
                        </Text>
            </View>
          </View>
        </Pressable>
        {isReps ? (
          <Pressable
            style={styles.trackingArea}
            onPress={incrementReps}
          >
            <Text style={styles.counterValue}>{todayStats.reps}</Text>
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
                  {voiceEnabled ? t("label.voiceOn") : t("label.voiceOff")}
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
                  disabled={!AI_CAMERA_ENABLED}
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
        ) : (
          <View style={styles.trackingArea}>
            <Text style={styles.counterValue}>
              {formatSeconds(todayStats.seconds + sessionSeconds)}
            </Text>
            <Text style={styles.helperText}>{t("label.today")}</Text>
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
              <Text style={styles.helperText}>
                {t("label.runningSession")}: {formatSeconds(sessionSeconds)}
              </Text>
            ) : null}
          </View>
        )}
      </SafeAreaView>
    );
  }

  if (isSettingsOpen) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerRow}>
            <Pressable
              style={styles.backButton}
              onPress={() => setIsSettingsOpen(false)}
            >
              <Text style={styles.backText}>{t("label.back")}</Text>
            </Pressable>
            <Text style={styles.headerTitle}>{t("menu.settings")}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>{t("label.availableToday")}</Text>
            <Text style={styles.cardValue}>
              {Math.floor((usageState.remainingSeconds || 0) / 60)} min
            </Text>
            <Text style={styles.cardMeta}>
              {t("label.used")}: {Math.floor(usageState.usedSeconds / 60)} min
            </Text>
          </View>
          {missingPermissions ? (
            <View style={styles.permissionAlertCard}>
              <Text style={styles.permissionAlertTitle}>
                {t("label.permissions")}
              </Text>
              <Text style={styles.permissionAlertText}>
                {t("label.settingsHint")}
              </Text>
              {needsAccessibility ? (
                <>
                  <Pressable
                    style={styles.primaryButton}
                    onPress={openAccessibilitySettings}
                  >
                    <Text style={styles.primaryButtonText}>
                      {t("label.permissionNeeded")}
                    </Text>
                  </Pressable>
                  <Text style={styles.warningText}>
                    {t("label.accessibilityMissing")}
                  </Text>
                </>
              ) : null}
              {!usageAccessGranted ? (
                <>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={openUsageAccessSettings}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {t("label.openUsageAccess")}
                    </Text>
                  </Pressable>
                  <Text style={styles.warningText}>
                    {t("label.usageAccessMissing")}
                  </Text>
                </>
              ) : null}
            </View>
          ) : null}
          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>{t("label.apps")}</Text>
            {Platform.OS !== "android" ? (
              <Text style={styles.helperText}>{t("label.androidOnly")}</Text>
            ) : (
              <View>
                <TextInput
                  style={styles.searchInput}
                  value={appSearch}
                  onChangeText={setAppSearch}
                  placeholder={t("label.searchApps")}
                  placeholderTextColor="#7a7a7a"
                />
                <Pressable
                  style={styles.secondaryButton}
                  onPress={loadInstalledApps}
                >
                  <Text style={styles.secondaryButtonText}>{t("label.loadApps")}</Text>
                </Pressable>
                {installedApps.length === 0 ? (
                  <Text style={styles.helperText}>{t("label.noApps")}</Text>
                ) : null}
                {sortedApps.map((app) => {
                  const enabled = settings.controlledApps.includes(
                    app.packageName
                  );
                  const usageMs = appUsageMap[app.packageName] || 0;
                  const usageMinutes = Math.floor(usageMs / 60000);
                  return (
                    <Pressable
                      key={app.packageName}
                      style={[
                        styles.appRow,
                        enabled && styles.appRowActive,
                      ]}
                      onPress={() => toggleControlledApp(app.packageName)}
                    >
                      <Text style={styles.appLabel}>{app.label}</Text>
                      <Text style={styles.appPackage}>{app.packageName}</Text>
                      <Text style={styles.appUsageText}>
                        {usageMinutes} min
                      </Text>
                      <Text
                        style={[
                          styles.appToggle,
                          enabled && styles.appToggleActive,
                        ]}
                      >
                        {enabled ? t("label.active") : t("label.off")}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <View style={styles.headerTitleBlock}>
            <Text style={styles.title}>{t("app.title")}</Text>
            <Text style={styles.subtitle}>{t("menu.sports")}</Text>
            <Pressable
              style={styles.appsHeaderButton}
              onPress={() => {
                setIsSettingsOpen(true);
                loadInstalledApps();
                refreshUsageState();
              }}
            >
              <Text style={styles.appsHeaderText}>{t("menu.apps")}</Text>
            </Pressable>
          </View>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.iconButton}
            onPress={() => setOverallStatsOpen(true)}
          >
            <Text style={styles.iconButtonText}>{t("label.overallStats")}</Text>
          </Pressable>
          <Pressable
            style={styles.iconButton}
            onPress={() =>
              InstaControl?.requestPinWidget?.("overall", t("label.todayScreenTime"))
            }
          >
            <Text style={styles.iconButtonText}>{t("label.widgetOverall")}</Text>
          </Pressable>
        </View>
        </View>
        {showPermissionPrompt ? (
          <View style={styles.permissionCard}>
            <Text style={styles.sectionTitle}>{t("label.permissions")}</Text>
            {needsAccessibility && !permissionsPrompted ? (
              <>
                <Text style={styles.helperText}>{t("label.accessibilityHint")}</Text>
                <Pressable
                  style={styles.primaryButton}
                  onPress={openAccessibilitySettings}
                >
                  <Text style={styles.primaryButtonText}>
                    {t("label.permissionNeeded")}
                  </Text>
                </Pressable>
              </>
            ) : null}
            {!usageAccessGranted && !usagePermissionsPrompted ? (
              <>
                <Text style={styles.helperText}>{t("label.usageAccessHint")}</Text>
                <Pressable
                  style={styles.primaryButton}
                  onPress={openUsageAccessSettings}
                >
                  <Text style={styles.primaryButtonText}>
                    {t("label.openUsageAccess")}
                  </Text>
                </Pressable>
              </>
            ) : null}
          </View>
        ) : null}
        {activeSports.length === 0 ? (
          <Text style={styles.helperText}>{t("label.noSports")}</Text>
        ) : null}
        <View style={styles.sportsGrid}>
          {activeSports.map((sport) => {
            const daily = getTodayStat(stats, sport.id);
            const weeklyTotal = computeWeeklyTotal(stats, sport);
            const sportLabel = getSportLabel(sport);
            return (
              <View key={sport.id} style={[styles.sportCard, { width: cardWidth }]}>
                <View style={styles.cardActionsOverlay}>
                  <View style={styles.cardActionsLeft}>
                    <Pressable
                      style={styles.iconAction}
                      onPress={() => setStatsSportId(sport.id)}
                    >
                      <Text style={styles.iconActionText}>📅</Text>
                    </Pressable>
                    <Pressable
                      style={styles.iconAction}
                      onPress={() => openSportModal(sport)}
                    >
                      <Text style={styles.iconActionText}>🛠</Text>
                    </Pressable>
                  </View>
                  <View style={styles.cardActionsRight}>
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
                  onPress={() => setSelectedSportId(sport.id)}
                >
                  <View style={styles.sportInfo}>
                    <View style={styles.sportTitleRow}>
                      <Text style={styles.sportIcon}>{sport.icon || DEFAULT_ICON}</Text>
                    <Text style={styles.sportName} numberOfLines={1}>
                      {sportLabel}
                    </Text>
                    {sport.supportsAi ? (
                      <View style={styles.aiBadge}>
                        <Text style={styles.aiBadgeText}>AI</Text>
                      </View>
                    ) : null}
                    </View>
                  </View>
                  <View style={styles.statsInlineCard}>
                    <View style={styles.counterRow}>
                      <View style={styles.counterBlock}>
                        <Text style={styles.counterLabel}>{t("label.today")}</Text>
                        <Text style={styles.counterValueSmall}>
                          {sport.type === "reps"
                            ? `${daily.reps}`
                            : formatSeconds(daily.seconds || 0)}
                        </Text>
                        <Text style={styles.counterUnit}>
                          {sport.type === "reps" ? repsShort : t("label.timeUnit")}
                        </Text>
                      </View>
                      <View style={styles.counterBlock}>
                        <Text style={styles.counterLabel}>{t("label.week")}</Text>
                        <Text style={styles.counterValueSmall}>
                          {sport.type === "reps"
                            ? `${weeklyTotal}`
                            : formatSeconds(weeklyTotal)}
                        </Text>
                        <Text style={styles.counterUnit}>
                          {sport.type === "reps" ? repsShort : t("label.timeUnit")}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.screenRow}>
                      <View style={styles.screenBlock}>
                        <Text style={styles.screenLabel}>{t("label.screenTime")}</Text>
                        <Text style={styles.screenValue}>
                          {formatScreenTime(screenSecondsForStats(sport, daily))}
                        </Text>
                      </View>
                      <View style={styles.screenBlock}>
                        <Text style={styles.screenLabel}>{t("label.remaining")}</Text>
                        <Text style={styles.screenValue}>
                          {formatScreenTime(usageState.remainingSeconds || 0)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
                <View style={styles.cardActions}>
                  <Pressable
                    style={[styles.secondaryButton, styles.fullWidthButton]}
                    onPress={() =>
                      InstaControl?.requestPinWidget?.(sport.id, sportLabel)
                    }
                  >
                    <Text style={styles.secondaryButtonText}>
                      {t("label.widget")}
                    </Text>
                  </Pressable>
                  <View style={styles.cardActionsBottom}>
                    <Pressable
                      style={styles.iconAction}
                      onPress={() => moveSport(sport.id, -1)}
                    >
                      <Text style={styles.iconActionText}>↑</Text>
                    </Pressable>
                    <Pressable
                      style={styles.iconAction}
                      onPress={() => moveSport(sport.id, 1)}
                    >
                      <Text style={styles.iconActionText}>↓</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
        <View style={styles.addCard}>
          <Pressable
            style={[styles.primaryButton, styles.fullWidthButton]}
            onPress={() => openSportModal()}
          >
            <Text style={styles.primaryButtonText}>{t("label.addSport")}</Text>
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
          </Pressable>
          {showHidden
            ? hiddenSports.map((sport) => {
                const daily = getTodayStat(stats, sport.id);
                const weeklyTotal = computeWeeklyTotal(stats, sport);
                const sportLabel = getSportLabel(sport);
                return (
                  <View
                    key={sport.id}
                    style={[styles.sportCard, styles.hiddenCard, { width: cardWidth }]}
                  >
                    <View style={styles.cardActionsOverlay}>
                      <View style={styles.cardActionsLeft}>
                        <Pressable
                          style={styles.iconAction}
                          onPress={() => setStatsSportId(sport.id)}
                        >
                          <Text style={styles.iconActionText}>📅</Text>
                        </Pressable>
                        <Pressable
                          style={styles.iconAction}
                          onPress={() => openSportModal(sport)}
                        >
                          <Text style={styles.iconActionText}>🛠</Text>
                        </Pressable>
                      </View>
                      <View style={styles.cardActionsRight}>
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
                      onPress={() => setSelectedSportId(sport.id)}
                    >
                      <View style={styles.sportInfo}>
                        <View style={styles.sportTitleRow}>
                          <Text style={styles.sportIcon}>
                            {sport.icon || DEFAULT_ICON}
                          </Text>
                          <Text style={styles.sportName} numberOfLines={1}>
                            {sportLabel}
                          </Text>
                          {sport.supportsAi ? (
                            <View style={styles.aiBadge}>
                              <Text style={styles.aiBadgeText}>AI</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                      <View style={styles.statsInlineCard}>
                        <View style={styles.counterRow}>
                          <View style={styles.counterBlock}>
                            <Text style={styles.counterLabel}>{t("label.today")}</Text>
                            <Text style={styles.counterValueSmall}>
                              {sport.type === "reps"
                                ? `${daily.reps}`
                                : formatSeconds(daily.seconds || 0)}
                            </Text>
                            <Text style={styles.counterUnit}>
                              {sport.type === "reps" ? repsShort : t("label.timeUnit")}
                            </Text>
                          </View>
                          <View style={styles.counterBlock}>
                            <Text style={styles.counterLabel}>{t("label.week")}</Text>
                            <Text style={styles.counterValueSmall}>
                              {sport.type === "reps"
                                ? `${weeklyTotal}`
                                : formatSeconds(weeklyTotal)}
                            </Text>
                            <Text style={styles.counterUnit}>
                              {sport.type === "reps" ? repsShort : t("label.timeUnit")}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.screenRow}>
                          <View style={styles.screenBlock}>
                            <Text style={styles.screenLabel}>
                              {t("label.screenTime")}
                            </Text>
                            <Text style={styles.screenValue}>
                              {formatScreenTime(
                                screenSecondsForStats(sport, daily)
                              )}
                            </Text>
                          </View>
                          <View style={styles.screenBlock}>
                            <Text style={styles.screenLabel}>
                              {t("label.remaining")}
                            </Text>
                            <Text style={styles.screenValue}>
                              {formatScreenTime(usageState.remainingSeconds || 0)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </Pressable>
                    <View style={styles.cardActions}>
                      <Pressable
                        style={[styles.secondaryButton, styles.fullWidthButton]}
                        onPress={() =>
                          InstaControl?.requestPinWidget?.(sport.id, sportLabel)
                        }
                      >
                        <Text style={styles.secondaryButtonText}>
                          {t("label.widget")}
                        </Text>
                      </Pressable>
                      <View style={styles.cardActionsBottom}>
                        <Pressable
                          style={styles.iconAction}
                          onPress={() => moveSport(sport.id, -1)}
                        >
                          <Text style={styles.iconActionText}>↑</Text>
                        </Pressable>
                        <Pressable
                          style={styles.iconAction}
                          onPress={() => moveSport(sport.id, 1)}
                        >
                          <Text style={styles.iconActionText}>↓</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                );
              })
            : null}
        </View>
    </ScrollView>
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
      <View style={styles.languageWrap}>
        {showLanguageMenu ? (
          <View style={styles.languageMenu}>
            <Text style={styles.languageTitle}>{t("menu.language")}</Text>
            {[
              "de",
              "en",
              "es",
              "fr",
            ].map((code) => (
              <Pressable
                key={code}
                style={styles.languageOption}
                onPress={() => setAppLanguage(code)}
              >
                <Text style={styles.languageOptionText}>{t(`language.${code}`)}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <Pressable
          style={styles.languageButton}
          onPress={() => setShowLanguageMenu((prev) => !prev)}
        >
          <Text style={styles.languageButtonText}>{t(`language.${language}`)}</Text>
        </Pressable>
      </View>
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
    paddingBottom: 96,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.muted,
    marginTop: 6,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 48,
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
  headerActions: {
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 8,
    marginTop: 6,
  },
  appsHeaderButton: {
    alignSelf: "flex-start",
    marginTop: 10,
    backgroundColor: COLORS.accent,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  appsHeaderText: {
    color: COLORS.ink,
    fontWeight: "800",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
  counterValue: {
    fontSize: 56,
    color: COLORS.text,
    fontWeight: "700",
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
    backgroundColor: COLORS.sportCard,
    borderRadius: 8,
    padding: 10,
    paddingTop: 46,
    marginBottom: 10,
    position: "relative",
    borderWidth: 1,
    borderColor: COLORS.accentDark,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  hiddenCard: {
    backgroundColor: COLORS.cardAlt,
    borderColor: COLORS.cardAlt,
    marginTop: 8,
    opacity: 0.9,
  },
  sportInfo: {
    marginBottom: 12,
    alignItems: "center",
  },
  sportBodyPressable: {
    flexGrow: 1,
  },
  sportName: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
  },
  sportTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  sportIcon: {
    fontSize: 18,
  },
  sportMeta: {
    marginTop: 4,
    color: COLORS.muted,
  },
  statsInlineCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
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
  screenRow: {
    flexDirection: "row",
    gap: 8,
  },
  screenBlock: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  screenLabel: {
    color: "#1f1b16",
    fontSize: 10,
  },
  screenValue: {
    color: "#14110c",
    fontSize: 12,
    fontWeight: "700",
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
  editEntriesButton: {
    position: "absolute",
    top: 28,
    right: 16,
    backgroundColor: COLORS.cardAlt,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    zIndex: 20,
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
  cardActions: {
    flexDirection: "column",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "stretch",
  },
  cardActionsOverlay: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 2,
    elevation: 2,
  },
  cardActionsLeft: {
    flexDirection: "row",
    gap: 6,
  },
  cardActionsRight: {
    flexDirection: "row",
    gap: 6,
  },
  cardActionsBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
  hiddenSection: {
    marginTop: 20,
  },
  hiddenToggle: {
    paddingVertical: 10,
  },
  hiddenToggleText: {
    color: COLORS.muted,
    fontWeight: "600",
  },
  permissionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
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
    position: "absolute",
    right: 16,
    bottom: 48,
    alignItems: "flex-end",
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
  languageOptionText: {
    color: COLORS.text,
    fontWeight: "600",
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
});
