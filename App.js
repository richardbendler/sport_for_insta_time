
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
  BackHandler,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const InstaControl = NativeModules.InstaControl;

const STORAGE_KEYS = {
  sports: "@sports_v1",
  stats: "@stats_v1",
  settings: "@settings_v1",
  permissions: "@permissions_prompted_v1",
};

const DEFAULT_SPORTS = [
  {
    id: "pushups",
    name: "Liegestütze",
    type: "reps",
    hidden: false,
    icon: "💪",
    screenSecondsPerUnit: 60,
  },
  {
    id: "pullups",
    name: "Klimmzüge",
    type: "reps",
    hidden: false,
    icon: "🏋️",
    screenSecondsPerUnit: 90,
  },
  {
    id: "pushups_alt",
    name: "Situps",
    type: "reps",
    hidden: false,
    icon: "🧘",
    screenSecondsPerUnit: 45,
  },
  {
    id: "jogging",
    name: "Joggen",
    type: "time",
    hidden: false,
    icon: "🏃",
    screenSecondsPerUnit: 1.2,
  },
];

const DEFAULT_SETTINGS = {
  controlledApps: [],
  language: "de",
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
  pullups: "pullups",
  pushups_alt: "situps",
  jogging: "jogging",
};

const COLORS = {
  ink: "#100f0c",
  amber: "#f4b545",
  ember: "#e55c4f",
  olive: "#7fb069",
  background: "#100f0c",
  surface: "rgba(244, 226, 194, 0.12)",
  card: "rgba(244, 226, 194, 0.08)",
  cardAlt: "rgba(244, 226, 194, 0.18)",
  cardDark: "rgba(24, 22, 18, 0.9)",
  sportCard: "rgba(24, 22, 18, 0.9)",
  text: "#f4e2c2",
  muted: "rgba(244, 226, 194, 0.68)",
  accent: "#f4b545",
  accentDark: "rgba(244, 181, 69, 0.85)",
  success: "rgba(127, 176, 105, 0.9)",
  warning: "rgba(244, 181, 69, 0.9)",
  danger: "rgba(229, 92, 79, 0.9)",
  white: "#fff7ea",
};

const STRINGS = {
  de: {
    "app.title": "Sport für Screen Time",
    "menu.sports": "Deine Sportarten",
    "menu.apps": "Apps",
    "menu.settings": "Screen Controller",
    "menu.stats": "Statistik",
    "menu.language": "Sprache",
    "label.today": "Heute",
    "label.week": "Woche",
    "label.weekScreenTime": "Bildschirmzeit Woche",
    "label.screenTime": "Bildschirmzeit",
    "label.remaining": "Übrig",
    "label.editEntries": "Einträge bearbeiten",
    "label.deleteAllEntries": "Alle Einträge löschen",
    "label.deleteAllEntriesGlobal": "Alle Einträge löschen",
    "label.editEntry": "Eintrag bearbeiten",
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
    "label.apps": "Apps auswählen",
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
    "label.iconChoose": "Icon wählen",
    "label.iconPlaceholder": "Ein Icon",
    "label.addSport": "Neue Sportart",
    "label.reps": "Wiederholungen",
    "label.repsShort": "Wdh.",
    "label.timeUnit": "Zeit",
    "label.timeBased": "Zeitbasiert",
    "label.activateNow": "Jetzt aktivieren",
    "label.loadApps": "Apps laden",
    "label.androidOnly": "App-Auswahl ist nur auf Android verfügbar.",
    "label.accessibilityHint":
      "Aktiviere die Zugriffshilfe, damit Social Apps gesperrt werden können.",
    "label.settingsHint":
      "Aktiviere die Zugriffshilfe, damit die App Social Apps blockieren kann, wenn die Zeit aufgebraucht ist.",
    "label.tapAnywhere": "Tippe irgendwo",
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
    "menu.apps": "Apps",
    "menu.settings": "Screen Controller",
    "menu.stats": "Stats",
    "menu.language": "Language",
    "label.today": "Today",
    "label.week": "Week",
    "label.weekScreenTime": "Screen Time Week",
    "label.screenTime": "Screen Time",
    "label.remaining": "Remaining",
    "label.editEntries": "Edit entries",
    "label.deleteAllEntries": "Delete all entries",
    "label.deleteAllEntriesGlobal": "Delete all entries",
    "label.editEntry": "Edit entry",
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
    "label.apps": "Choose apps",
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
    "label.iconChoose": "Choose icon",
    "label.iconPlaceholder": "One icon",
    "label.addSport": "New sport",
    "label.reps": "Repetitions",
    "label.repsShort": "reps",
    "label.timeUnit": "Time",
    "label.timeBased": "Time-based",
    "label.activateNow": "Enable now",
    "label.loadApps": "Load apps",
    "label.androidOnly": "App selection is Android-only.",
    "label.accessibilityHint": "Enable accessibility to block social apps.",
    "label.settingsHint":
      "Enable accessibility so the app can block social apps when time is up.",
    "label.tapAnywhere": "Tap anywhere",
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
    "menu.apps": "Apps",
    "menu.settings": "Control de pantalla",
    "menu.stats": "Estadísticas",
    "menu.language": "Idioma",
    "label.today": "Hoy",
    "label.week": "Semana",
    "label.weekScreenTime": "Tiempo de pantalla semanal",
    "label.screenTime": "Tiempo de pantalla",
    "label.remaining": "Restante",
    "label.editEntries": "Editar entradas",
    "label.deleteAllEntries": "Borrar todas",
    "label.deleteAllEntriesGlobal": "Borrar todas",
    "label.editEntry": "Editar entrada",
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
    "label.apps": "Elegir apps",
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
    "label.iconChoose": "Elegir icono",
    "label.iconPlaceholder": "Un icono",
    "label.addSport": "Nuevo deporte",
    "label.reps": "Repeticiones",
    "label.repsShort": "rep.",
    "label.timeUnit": "Tiempo",
    "label.timeBased": "Por tiempo",
    "label.activateNow": "Activar ahora",
    "label.loadApps": "Cargar apps",
    "label.androidOnly": "La selección de apps es solo para Android.",
    "label.accessibilityHint":
      "Activa la accesibilidad para bloquear apps sociales.",
    "label.settingsHint":
      "Activa la accesibilidad para que la app bloquee redes sociales cuando se acabe el tiempo.",
    "label.tapAnywhere": "Toca en cualquier lugar",
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
    "menu.apps": "Apps",
    "menu.settings": "Contrôle écran",
    "menu.stats": "Statistiques",
    "menu.language": "Langue",
    "label.today": "Aujourd'hui",
    "label.week": "Semaine",
    "label.weekScreenTime": "Temps d’écran hebdo",
    "label.screenTime": "Temps d’écran",
    "label.remaining": "Restant",
    "label.editEntries": "Modifier les entrées",
    "label.deleteAllEntries": "Supprimer tout",
    "label.deleteAllEntriesGlobal": "Supprimer tout",
    "label.editEntry": "Modifier l’entrée",
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
    "label.apps": "Choisir les apps",
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
    "label.iconChoose": "Choisir une icône",
    "label.iconPlaceholder": "Une icône",
    "label.addSport": "Nouveau sport",
    "label.reps": "Répétitions",
    "label.repsShort": "rép.",
    "label.timeUnit": "Temps",
    "label.timeBased": "Basé sur le temps",
    "label.activateNow": "Activer",
    "label.loadApps": "Charger les apps",
    "label.androidOnly": "La sélection des apps est uniquement sur Android.",
    "label.accessibilityHint":
      "Activez l’accessibilité pour bloquer les apps sociales.",
    "label.settingsHint":
      "Activez l’accessibilité pour que l’app bloque les apps sociales quand le temps est écoulé.",
    "label.tapAnywhere": "Touchez n’importe où",
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

const screenSecondsForStats = (sport, dayStats) => {
  const rate = sport.screenSecondsPerUnit ?? 0;
  if (sport.type === "reps") {
    return dayStats.reps * rate;
  }
  return (dayStats.seconds || 0) * rate;
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
    const next = {
      ...sport,
      name,
      presetKey,
      icon: sport.icon || defaultIconForSport(sport),
      screenSecondsPerUnit:
        sport.screenSecondsPerUnit ?? defaultScreenSecondsPerUnit(sport),
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

const ensureDefaultSports = async () => {
  const existing = await AsyncStorage.getItem(STORAGE_KEYS.sports);
  if (!existing) {
    await AsyncStorage.setItem(
      STORAGE_KEYS.sports,
      JSON.stringify(DEFAULT_SPORTS)
    );
  }
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

const computeAllowanceSeconds = (stats, sports) => {
  const day = todayKey();
  let totalSeconds = 0;
  sports.forEach((sport) => {
    const sportStats = stats[sport.id] || {};
    const dayStats = sportStats[day] || { reps: 0, seconds: 0 };
    totalSeconds += screenSecondsForStats(sport, dayStats);
  });
  return Math.max(0, Math.floor(totalSeconds));
};
export default function App() {
  const [sports, setSports] = useState([]);
  const [stats, setStats] = useState({});
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [language, setLanguage] = useState(DEFAULT_SETTINGS.language);
  const [selectedSportId, setSelectedSportId] = useState(null);
  const [statsSportId, setStatsSportId] = useState(null);
  const [overallStatsOpen, setOverallStatsOpen] = useState(false);
  const [statsEditMode, setStatsEditMode] = useState(false);
  const [editEntryKey, setEditEntryKey] = useState(null);
  const [editEntryValue, setEditEntryValue] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("reps");
  const [newIcon, setNewIcon] = useState("");
  const [newRateMinutes, setNewRateMinutes] = useState("1");
  const [showIconInput, setShowIconInput] = useState(false);
  const [installedApps, setInstalledApps] = useState([]);
  const [usageState, setUsageState] = useState({
    allowanceSeconds: 0,
    usedSeconds: 0,
    day: todayKey(),
  });
  const [needsAccessibility, setNeedsAccessibility] = useState(false);
  const [permissionsPrompted, setPermissionsPrompted] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);

  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef(null);

  const t = (key) => {
    const dict = STRINGS[language] || STRINGS.de;
    return dict[key] ?? STRINGS.de[key] ?? key;
  };
  const repsShort = t("label.repsShort");

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

  const setAppLanguage = async (nextLanguage) => {
    const nextSettings = { ...settings, language: nextLanguage };
    await saveSettings(nextSettings);
    setLanguage(nextLanguage);
    setShowLanguageMenu(false);
  };

  useEffect(() => {
    const load = async () => {
      await ensureDefaultSports();
      await ensureDefaultSettings();
      const sportsRaw = await AsyncStorage.getItem(STORAGE_KEYS.sports);
      const statsRaw = await AsyncStorage.getItem(STORAGE_KEYS.stats);
      const settingsRaw = await AsyncStorage.getItem(STORAGE_KEYS.settings);
      const permissionsRaw = await AsyncStorage.getItem(STORAGE_KEYS.permissions);
      const parsedSports = sportsRaw ? JSON.parse(sportsRaw) : [];
      const { normalized, changed } = normalizeSports(parsedSports);
      setSports(normalized);
      if (changed) {
        await AsyncStorage.setItem(
          STORAGE_KEYS.sports,
          JSON.stringify(normalized)
        );
      }
      setStats(statsRaw ? JSON.parse(statsRaw) : {});
      const parsedSettings = settingsRaw
        ? { ...DEFAULT_SETTINGS, ...JSON.parse(settingsRaw) }
        : DEFAULT_SETTINGS;
      setSettings(parsedSettings);
      setLanguage(parsedSettings.language || DEFAULT_SETTINGS.language);
      setPermissionsPrompted(permissionsRaw === "true");
    };
    load();
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
  };

  const clearAllStats = async () => {
    await saveStats({});
  };

  const handleAddSport = async () => {
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
    setNewName("");
    setNewType("reps");
    setNewIcon("");
    setNewRateMinutes(String(getDefaultRateMinutes("reps")));
    setShowIconInput(false);
  };

  const handleHideSport = async (sportId, hidden) => {
    const nextSports = sports.map((sport) =>
      sport.id === sportId ? { ...sport, hidden } : sport
    );
    await saveSports(nextSports);
  };

  const handleDeleteSport = async (sportId) => {
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
  };

  const refreshUsageState = async () => {
    if (!InstaControl?.getUsageState) {
      return;
    }
    const state = await InstaControl.getUsageState();
    if (state) {
      setUsageState(state);
    }
  };

  const openAccessibilitySettings = async () => {
    if (InstaControl?.openAccessibilitySettings) {
      InstaControl.openAccessibilitySettings();
      await AsyncStorage.setItem(STORAGE_KEYS.permissions, "true");
      setPermissionsPrompted(true);
    }
  };

  const allowanceSeconds = useMemo(
    () => computeAllowanceSeconds(stats, sports),
    [stats, sports]
  );

  useEffect(() => {
    if (!InstaControl?.setControlledApps || !InstaControl?.setDailyAllowanceSeconds) {
      return;
    }
    InstaControl.setControlledApps(settings.controlledApps || []);
    InstaControl.setDailyAllowanceSeconds(allowanceSeconds);
    refreshUsageState();
  }, [settings, allowanceSeconds]);

  useEffect(() => {
    checkAccessibility();
  }, [isSettingsOpen, statsSportId]);

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
  }, [statsSportId, overallStatsOpen, selectedSportId, isSettingsOpen]);

  useEffect(() => {
    if (!statsSportId) {
      setStatsEditMode(false);
      setEditEntryKey(null);
      setEditEntryValue("");
    }
  }, [statsSportId]);

  const loadInstalledApps = async () => {
    if (!InstaControl?.getInstalledApps) {
      return;
    }
    const apps = await InstaControl.getInstalledApps();
    setInstalledApps(apps || []);
  };

  const toggleControlledApp = async (packageName) => {
    const current = settings.controlledApps || [];
    const exists = current.includes(packageName);
    const nextApps = exists
      ? current.filter((pkg) => pkg !== packageName)
      : [packageName, ...current];
    await saveSettings({ ...settings, controlledApps: nextApps });
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
      updateDayStat(selectedSport.id, (dayStats) => ({
        ...dayStats,
        seconds: dayStats.seconds + sessionSeconds,
      }));
    }
    setSessionSeconds(0);
  };

  const activeSports = sports.filter((sport) => !sport.hidden);
  const hiddenSports = sports.filter((sport) => sport.hidden);
  const selectedSport = sports.find((sport) => sport.id === selectedSportId);
  const statsSport = sports.find((sport) => sport.id === statsSportId);

  const todayStats = useMemo(() => {
    if (!selectedSport) {
      return { reps: 0, seconds: 0 };
    }
    return getTodayStat(stats, selectedSport.id);
  }, [stats, selectedSport]);

  const showPermissionPrompt =
    Platform.OS === "android" && !permissionsPrompted && needsAccessibility;

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }
    if (!InstaControl?.setWidgetSportData || !InstaControl?.updateWidgets) {
      return;
    }
    sports.forEach((sport) => {
      const dayStats = getTodayStat(stats, sport.id);
      const screenSeconds = screenSecondsForStats(sport, dayStats);
      const label = getSportLabel(sport);
      InstaControl.setWidgetSportData(
        sport.id,
        label,
        formatSportValue(sport.type, dayStats, repsShort),
        formatScreenTime(screenSeconds),
        t("label.screenTime"),
        sport.icon || DEFAULT_ICON
      );
    });
    InstaControl.updateWidgets();
  }, [sports, stats, language]);
  if (overallStatsOpen) {
    const allKeys = Object.values(stats || {}).reduce((acc, sportStats) => {
      Object.keys(sportStats || {}).forEach((key) => acc.add(key));
      return acc;
    }, new Set());
    const calendarDays = buildCalendarDaysFromKeys(allKeys);
    const monthMap = calendarDays.reduce((acc, day) => {
      const monthKey = day.key.slice(0, 7);
      if (!acc[monthKey]) {
        acc[monthKey] = {
          label: formatMonthLabel(day.date, language),
          days: [],
        };
      }
      acc[monthKey].days.push(day);
      return acc;
    }, {});
    const monthEntries = Object.keys(monthMap)
      .sort()
      .map((key) => ({ key, ...monthMap[key] }));
    const weekdayLabels = WEEKDAY_LABELS_BY_LANG[language] || WEEKDAY_LABELS;
    const dayTotals = calendarDays.reduce((acc, day) => {
      let total = 0;
      sports.forEach((sport) => {
        const sportStats = stats[sport.id] || {};
        const dayStats = sportStats[day.key];
        if (dayStats) {
          total += screenSecondsForStats(sport, dayStats);
        }
      });
      acc[day.key] = total;
      return acc;
    }, {});
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
          {monthEntries.map((month) => {
            const firstDay = month.days[0];
            const firstWeekday = (firstDay.date.getDay() + 6) % 7;
            const placeholders = Array.from({ length: firstWeekday }, (_, index) => (
              <View key={`spacer-${month.key}-${index}`} style={styles.calendarSpacer} />
            ));
            return (
              <View key={month.key} style={styles.calendarMonth}>
                <Text style={styles.calendarMonthTitle}>{month.label}</Text>
                <View style={styles.calendarHeaderRow}>
                  {weekdayLabels.map((label) => (
                    <Text key={`${month.key}-${label}`} style={styles.calendarWeekLabel}>
                      {label}
                    </Text>
                  ))}
                </View>
                <View style={styles.calendarGrid}>
                  {placeholders}
                  {month.days.map((day) => {
                    const totalSeconds = dayTotals[day.key] || 0;
                    const hasValue = totalSeconds > 0;
                    const displayValue = hasValue ? formatScreenTime(totalSeconds) : "-";
                    return (
                      <View key={day.key} style={styles.calendarCell}>
                        <Text style={styles.calendarDayText}>
                          {day.date.getDate()}
                        </Text>
                        <Text style={styles.calendarValueText}>{displayValue}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </ScrollView>
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
    const calendarDays = buildCalendarDays(sportStats);
    const monthMap = calendarDays.reduce((acc, day) => {
      const monthKey = day.key.slice(0, 7);
      if (!acc[monthKey]) {
        acc[monthKey] = {
          label: formatMonthLabel(day.date, language),
          days: [],
        };
      }
      acc[monthKey].days.push(day);
      return acc;
    }, {});
    const monthEntries = Object.keys(monthMap)
      .sort()
      .map((key) => ({ key, ...monthMap[key] }));
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
      } else {
        updateSpecificDayStat(statsSport.id, editEntryKey, (current) => ({
          ...current,
          seconds: nextValue * 60,
        }));
      }
      setEditEntryKey(null);
      setEditEntryValue("");
    };
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
          {monthEntries.map((month) => {
            const firstDay = month.days[0];
            const firstWeekday = (firstDay.date.getDay() + 6) % 7;
            const placeholders = Array.from({ length: firstWeekday }, (_, index) => (
              <View key={`spacer-${month.key}-${index}`} style={styles.calendarSpacer} />
            ));
            return (
              <View key={month.key} style={styles.calendarMonth}>
                <Text style={styles.calendarMonthTitle}>{month.label}</Text>
                <View style={styles.calendarHeaderRow}>
                  {weekdayLabels.map((label) => (
                    <Text key={`${month.key}-${label}`} style={styles.calendarWeekLabel}>
                      {label}
                    </Text>
                  ))}
                </View>
                <View style={styles.calendarGrid}>
                  {placeholders}
                  {month.days.map((day) => {
                    const dayStats = sportStats[day.key] || { reps: 0, seconds: 0 };
                    const hasValue =
                      statsSport.type === "reps"
                        ? dayStats.reps > 0
                        : (dayStats.seconds || 0) > 0;
                    const displayValue = hasValue
                      ? statsSport.type === "reps"
                        ? `${dayStats.reps}`
                        : formatSeconds(dayStats.seconds || 0)
                      : "-";
                    return (
                      <View key={day.key} style={styles.calendarCell}>
                        <Text style={styles.calendarDayText}>
                          {day.date.getDate()}
                        </Text>
                        <Text style={styles.calendarValueText}>{displayValue}</Text>
                        {statsEditMode && hasValue ? (
                          <Pressable
                            style={styles.calendarEditButton}
                            onPress={() => openEditEntry(day.key)}
                          >
                            <Text style={styles.calendarEditText}>−</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
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
                {formatScreenTime(
                  Math.max(
                    0,
                    screenSecondsForStats(selectedSport, todayStats) -
                      usageState.usedSeconds
                  )
                )}
              </Text>
            </View>
          </View>
        </Pressable>
        {isReps ? (
          <Pressable
            style={styles.trackingArea}
            onPress={() =>
              updateDayStat(selectedSport.id, (dayStats) => ({
                ...dayStats,
                reps: dayStats.reps + 1,
              }))
            }
          >
            <Text style={styles.counterValue}>{todayStats.reps}</Text>
            <Text style={styles.plusSign}>+</Text>
            <Text style={styles.helperText}>{t("label.tapAnywhere")}</Text>
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
              {Math.floor(allowanceSeconds / 60)} min
            </Text>
            <Text style={styles.cardMeta}>
              {t("label.used")}: {Math.floor(usageState.usedSeconds / 60)} min
            </Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>{t("label.permissions")}</Text>
            <Text style={styles.helperText}>{t("label.settingsHint")}</Text>
            <Pressable
              style={styles.primaryButton}
              onPress={openAccessibilitySettings}
            >
              <Text style={styles.primaryButtonText}>
                {t("label.permissionNeeded")}
              </Text>
            </Pressable>
            {needsAccessibility ? (
              <Text style={styles.warningText}>{t("label.accessibilityMissing")}</Text>
            ) : (
              <Text style={styles.successText}>{t("label.accessibilityActive")}</Text>
            )}
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>{t("label.apps")}</Text>
            {Platform.OS !== "android" ? (
              <Text style={styles.helperText}>{t("label.androidOnly")}</Text>
            ) : (
              <View>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={loadInstalledApps}
                >
                  <Text style={styles.secondaryButtonText}>{t("label.loadApps")}</Text>
                </Pressable>
                {installedApps.length === 0 ? (
                  <Text style={styles.helperText}>{t("label.noApps")}</Text>
                ) : null}
                {installedApps.map((app) => {
                  const enabled = settings.controlledApps.includes(
                    app.packageName
                  );
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
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>{t("app.title")}</Text>
            <Text style={styles.subtitle}>{t("menu.sports")}</Text>
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
              onPress={() => {
                setIsSettingsOpen(true);
                loadInstalledApps();
                refreshUsageState();
              }}
            >
              <Text style={styles.iconButtonText}>{t("menu.apps")}</Text>
            </Pressable>
          </View>
        </View>
        {showPermissionPrompt ? (
          <View style={styles.permissionCard}>
            <Text style={styles.sectionTitle}>{t("label.permissionNeeded")}</Text>
            <Text style={styles.helperText}>{t("label.accessibilityHint")}</Text>
            <Pressable
              style={styles.primaryButton}
              onPress={openAccessibilitySettings}
            >
              <Text style={styles.primaryButtonText}>{t("label.activateNow")}</Text>
            </Pressable>
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
              <View key={sport.id} style={styles.sportCard}>
                <View style={styles.cardActionsTop}>
                  <Pressable
                    style={styles.iconAction}
                    onPress={() => setStatsSportId(sport.id)}
                  >
                    <Text style={styles.iconActionText}>📅</Text>
                  </Pressable>
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
                          {formatScreenTime(
                            Math.max(
                              0,
                              screenSecondsForStats(sport, daily) -
                                usageState.usedSeconds
                            )
                          )}
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
                </View>
              </View>
            );
          })}
        </View>
        <View style={styles.addCard}>
          <Text style={styles.addTitle}>{t("label.addSport")}</Text>
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
              <Text style={styles.secondaryButtonText}>{t("label.iconChoose")}</Text>
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
            {newType === "reps" ? t("label.screenRateReps") : t("label.screenRateTime")}
          </Text>
          <TextInput
            style={styles.input}
            value={newRateMinutes}
            onChangeText={setNewRateMinutes}
            placeholder="1"
            keyboardType="decimal-pad"
            placeholderTextColor="#7a7a7a"
          />
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
          <Pressable style={styles.primaryButton} onPress={handleAddSport}>
            <Text style={styles.primaryButtonText}>{t("label.add")}</Text>
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
            ? hiddenSports.map((sport) => (
                <View key={sport.id} style={styles.hiddenCard}>
                  <View style={styles.sportInfo}>
                    <View style={styles.sportTitleRow}>
                      <Text style={styles.sportIcon}>{sport.icon || DEFAULT_ICON}</Text>
                      <Text style={styles.sportName} numberOfLines={1}>
                        {getSportLabel(sport)}
                      </Text>
                    </View>
                    <Text style={styles.sportMeta}>
                      {sport.type === "reps" ? t("label.reps") : t("label.timeBased")}
                    </Text>
                  </View>
                  <Pressable
                    style={styles.statsInlineCard}
                    onPress={() => setStatsSportId(sport.id)}
                  >
                    <View style={styles.counterRow}>
                      <View style={styles.counterBlock}>
                        <Text style={styles.counterLabel}>{t("label.today")}</Text>
                        <Text style={styles.counterValueSmall}>
                          {sport.type === "reps"
                            ? `${getTodayStat(stats, sport.id).reps}`
                            : formatSeconds(getTodayStat(stats, sport.id).seconds || 0)}
                        </Text>
                        <Text style={styles.counterUnit}>
                          {sport.type === "reps" ? repsShort : t("label.timeUnit")}
                        </Text>
                      </View>
                      <View style={styles.counterBlock}>
                        <Text style={styles.counterLabel}>{t("label.week")}</Text>
                        <Text style={styles.counterValueSmall}>
                          {sport.type === "reps"
                            ? `${computeWeeklyTotal(stats, sport)}`
                            : formatSeconds(computeWeeklyTotal(stats, sport))}
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
                          {formatScreenTime(
                            screenSecondsForStats(
                              sport,
                              getTodayStat(stats, sport.id)
                            )
                          )}
                        </Text>
                      </View>
                      <View style={styles.screenBlock}>
                        <Text style={styles.screenLabel}>{t("label.remaining")}</Text>
                        <Text style={styles.screenValue}>
                          {formatScreenTime(
                            Math.max(
                              0,
                              screenSecondsForStats(
                                sport,
                                getTodayStat(stats, sport.id)
                              ) - usageState.usedSeconds
                            )
                          )}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                  <View style={styles.cardActions}>
                    <Pressable
                      style={styles.secondaryButton}
                      onPress={() =>
                        confirmAction(t("label.confirmShow"), () =>
                          handleHideSport(sport.id, false)
                        )
                      }
                    >
                      <Text style={styles.secondaryButtonText}>
                        {t("label.show")}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.secondaryButton}
                      onPress={() =>
                        InstaControl?.requestPinWidget?.(sport.id, getSportLabel(sport))
                      }
                    >
                      <Text style={styles.secondaryButtonText}>
                        {t("label.widget")}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.dangerButton}
                      onPress={() =>
                        confirmAction(t("label.confirmDelete"), () =>
                          handleDeleteSport(sport.id)
                        )
                      }
                    >
                      <Text style={styles.primaryButtonText}>{t("label.delete")}</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            : null}
        </View>
      </ScrollView>
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
    paddingTop: 44,
    paddingBottom: 32,
  },
  title: {
    fontSize: 24,
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
    paddingTop: 36,
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
  headerActions: {
    alignItems: "flex-end",
    gap: 8,
  },
  sportsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
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
  timerRow: {
    flexDirection: "row",
    marginTop: 24,
  },
  sportCard: {
    backgroundColor: COLORS.sportCard,
    borderRadius: 8,
    padding: 10,
    paddingTop: 30,
    marginBottom: 10,
    width: "48%",
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(244, 181, 69, 0.35)",
  },
  hiddenCard: {
    backgroundColor: COLORS.cardAlt,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  sportInfo: {
    marginBottom: 12,
  },
  sportBodyPressable: {
    flexGrow: 1,
  },
  sportName: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
  },
  sportTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 30,
  },
  modalCard: {
    backgroundColor: COLORS.cardDark,
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
  cardActionsTop: {
    position: "absolute",
    right: 6,
    top: 6,
    flexDirection: "row",
    gap: 4,
    zIndex: 1,
  },
  iconAction: {
    backgroundColor: COLORS.cardAlt,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 3,
    minWidth: 22,
    alignItems: "center",
  },
  iconActionText: {
    color: COLORS.text,
    fontSize: 11,
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
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardAlt,
  },
  statLabel: {
    color: COLORS.muted,
    fontWeight: "600",
  },
  statValue: {
    color: COLORS.text,
    fontWeight: "600",
  },
  languageWrap: {
    position: "absolute",
    right: 16,
    bottom: 16,
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
    backgroundColor: COLORS.surface,
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
});
