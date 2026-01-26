
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  Pressable,
  Switch,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  StyleSheet,
  ActivityIndicator,
  Animated,
  NativeModules,
  Platform,
  PermissionsAndroid,
  Linking,
  AppState,
  BackHandler,
  Alert,
  Modal,
  useWindowDimensions,
  FlatList,
  InteractionManager,
} from "react-native";
const makeStorageFallback = () => {
  const memory = new Map();
  return {
    getItem: async (key) => (memory.has(key) ? memory.get(key) : null),
    setItem: async (key, value) => {
      memory.set(key, value);
      return value;
    },
    removeItem: async (key) => {
      memory.delete(key);
      return null;
    },
    multiRemove: async (keys = []) => {
      keys.forEach((key) => memory.delete(key));
      return null;
    },
  };
};

let AsyncStorage = makeStorageFallback();
try {
  const imported = require("@react-native-async-storage/async-storage");
  AsyncStorage = imported.default || imported;
} catch (error) {
  console.warn(
    "Native AsyncStorage module unavailable, falling back to in-memory storage.",
    error
  );
}
import Voice from "@react-native-voice/voice";
import { I18nextProvider, useTranslation } from "react-i18next";
import i18n from "./i18n";
import { getFunFactsForLanguage } from "./funFacts";
import {
  DEFAULT_WEEKDAY_LABELS,
  MONTH_LABELS,
  NUMBER_WORDS,
  WEEKDAY_LABELS_BY_LANG,
} from "./locales";

const InstaControl = NativeModules.InstaControl;
const STORAGE_KEYS = {
  sports: "@sports_v1",
  stats: "@stats_v1",
  settings: "@settings_v1",
  permissions: "@permissions_prompted_v1",
  accessibilityDisclosure: "@accessibility_disclosure_v1",
  usagePermissions: "@usage_permissions_prompted_v1",
  notificationsPermissions: "@notifications_permissions_prompted_v1",
  grayscalePermissions: "@grayscale_permissions_prompted_v1",
  motivationActions: "@motivation_actions_v1",
  motivationFunFactsUsed: "@motivation_fun_facts_used_v1",
  carryover: "@carryover_seconds_v1",
  carryoverDay: "@carryover_day_v1",
  usageSnapshot: "@usage_snapshot_v1",
  logs: "@logs_v1",
  tutorialSeen: "@tutorial_seen_v1",
  workouts: "@workouts_v1",
  sportColors: "@sport_color_links_v1",
};


const DEFAULT_SETTINGS = {
  controlledApps: [],
  language: "en",
  prefaceDelaySeconds: 10,
  grayscaleRestrictedApps: false,
  sportSortMode: "manual",
};

const SPEECH_LOCALES = {
  de: "de-DE",
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
};

const normalizeSpeechLocale = (locale) =>
  typeof locale === "string" ? locale.replace(/-/g, "_") : "";

const DEFAULT_ICON = "⭐";
const USER_FACTOR_OPTIONS = (() => {
  const options = [];
  let value = 1;
  while (value <= 1000) {
    options.push(Math.round(value));
    const step = Math.max(1, Math.round(Math.pow(value, 0.25)));
    value += step;
  }
  if (options[options.length - 1] !== 1000) {
    options.push(1000);
  }
  return Array.from(new Set(options));
})();
const DEFAULT_DIFFICULTY = 451;
const DEFAULT_DIFFICULTY_INDEX = (() => {
  let closestIndex = 0;
  let smallestDistance = Infinity;
  USER_FACTOR_OPTIONS.forEach((option, index) => {
    const distance = Math.abs(option - DEFAULT_DIFFICULTY);
    if (distance < smallestDistance) {
      smallestDistance = distance;
      closestIndex = index;
    }
  });
  return closestIndex;
})();
const DEFAULT_TIME_RATE = 0.5;
const DEFAULT_REPS_RATE = 0.5;
const ADMIN_FACTOR_TIME = 0.0025; // "Fix Factor" in UI; global base multiplier for time-based sports
const ADMIN_FACTOR_REPS = 0.055; // "Fix Factor" in UI; base multiplier for reps-based sports
const ADMIN_FACTOR_WEIGHTED = 0.0005; // "Fix Factor" in UI; base multiplier for weighted reps entries
const DEFAULT_WEIGHT_RATE = 0.04;
const WORKOUT_CONTINUE_WINDOW_MS = 30 * 60 * 1000;
const TUTORIAL_STRONG_HIGHLIGHT = "rgba(249, 115, 22, 0.2)";
const interpolateTemplate = (template = "", values = {}) =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : ""
  );

const getWorkoutEndTime = (session) => {
  if (!session) {
    return null;
  }
  if (typeof session.endTs === "number" && Number.isFinite(session.endTs)) {
    return session.endTs;
  }
  const startTs =
    typeof session.startTs === "number" && Number.isFinite(session.startTs)
      ? session.startTs
      : 0;
  const durationMs =
    typeof session.duration === "number" && Number.isFinite(session.duration)
      ? session.duration * 1000
      : 0;
  return startTs + durationMs;
};

const isWorkoutRecent = (session) => {
  const endTime = getWorkoutEndTime(session);
  if (typeof endTime !== "number" || !Number.isFinite(endTime)) {
    return false;
  }
  const elapsed = Date.now() - endTime;
  return elapsed >= 0 && elapsed <= WORKOUT_CONTINUE_WINDOW_MS;
};
const PRESET_KEYS = {};
const STANDARD_SPORT_TRANSLATIONS = {
  pushups: {
    de: "Liegestütze",
    en: "Push-Ups",
    es: "Flexiones",
    fr: "Pompes",
  },
  pullups: {
    de: "Klimmzüge",
    en: "Pull-Ups",
    es: "Dominadas",
    fr: "Tractions",
  },
};

const RAW_STANDARD_SPORTS = [
  {
    id: "jogging",
    labels: {
      de: "Joggen",
      en: "Jogging",
      es: "Trotar",
      fr: "Jogging",
    },
    aliases: ["Laufen", "Dauerlauf", "Running"],
    icon: "??",
    type: "time",
    defaultRateMinutes: 1,
    difficultyLevel: 4,
    category: "Kardio",
    muscleGroups: [
      "Beine (Quadrizeps, Beinbeuger, Waden)",
      "Ges??",
      "Core",
      "Herz-Kreislauf",
    ],
  },
  {
    id: "treadmill_running",
    labels: {
      de: "Laufband",
      en: "Treadmill Running",
      es: "Cinta de correr",
      fr: "Tapis de course",
    },
    aliases: ["Indoor Laufen"],
    icon: "??",
    type: "time",
    defaultRateMinutes: 1,
    difficultyLevel: 3,
    category: "Kardio",
    muscleGroups: ["Beine", "Ges??", "Core", "Herz-Kreislauf"],
  },
  {
    id: "treadmill_walking",
    labels: {
      de: "Laufband (Gehen)",
      en: "Walking (Treadmill)",
      es: "Caminar (cinta)",
      fr: "Marche (tapis)",
    },
    aliases: ["Walking", "Power Walking"],
    icon: "??",
    type: "time",
    defaultRateMinutes: 1,
    difficultyLevel: 2,
    category: "Kardio",
    muscleGroups: ["Beine", "Ges??", "Core", "Herz-Kreislauf"],
  },
  {
    id: "cycling",
    labels: {
      de: "Radfahren",
      en: "Cycling",
      es: "Ciclismo",
      fr: "Cyclisme",
    },
    aliases: ["Cycling"],
    icon: "??",
    type: "time",
    defaultRateMinutes: 1,
    difficultyLevel: 4,
    category: "Kardio",
    muscleGroups: ["Quadrizeps", "Ges??", "Waden", "Herz-Kreislauf"],
  },
  {
    id: "stationary_bike",
    labels: {
      de: "Fahrradergometer",
      en: "Stationary Bike",
      es: "Bicicleta est?tica",
      fr: "V?lo d'appartement",
    },
    aliases: ["Ergometer"],
    icon: "??",
    type: "time",
    defaultRateMinutes: 1,
    difficultyLevel: 3,
    category: "Kardio",
    muscleGroups: ["Beine", "Ges??", "Herz-Kreislauf"],
  },
  {
    id: "elliptical_trainer",
    labels: {
      de: "Crosstrainer",
      en: "Elliptical Trainer",
      es: "El?ptica",
      fr: "V?lo elliptique",
    },
    aliases: ["Ellipsentrainer"],
    icon: "??",
    type: "time",
    defaultRateMinutes: 1,
    difficultyLevel: 4,
    category: "Kardio",
    muscleGroups: ["Beine", "Arme", "Schultern", "Core", "Herz-Kreislauf"],
  },
  {
    id: "rowing_machine",
    labels: {
      de: "Ruderger?t",
      en: "Rowing Machine",
      es: "M?quina de remo",
      fr: "Rameur",
    },
    aliases: ["Indoor Rudern", "Ergometer Rudern"],
    icon: "??",
    type: "time",
    defaultRateMinutes: 1,
    difficultyLevel: 5,
    category: "Kardio",
    muscleGroups: [
      "R?cken",
      "Beine",
      "Ges??",
      "Arme",
      "Core",
      "Herz-Kreislauf",
    ],
  },
  {
    id: "jump_rope",
    labels: {
      de: "Seilspringen",
      en: "Jump Rope",
      es: "Saltar la cuerda",
      fr: "Corde ? sauter",
    },
    aliases: ["Jump Rope"],
    icon: "??",
    type: "time",
    defaultRateMinutes: 1,
    difficultyLevel: 4,
    category: "Kardio",
    muscleGroups: ["Waden", "Beine", "Schultern", "Herz-Kreislauf"],
  },
  {
    id: "stair_climber",
    labels: {
      de: "Stairmaster / Treppensteiger",
      en: "Stair Climber",
      es: "Escaladora",
      fr: "Stepper escalier",
    },
    aliases: ["Stepper (Ger?t)", "Stair Climber"],
    icon: "??",
    type: "time",
    defaultRateMinutes: 1,
    difficultyLevel: 4,
    category: "Kardio",
    muscleGroups: ["Quadrizeps", "Ges??", "Waden", "Herz-Kreislauf"],
  },
  {
    id: "chest_press_machine",
    labels: {
      de: "Brustpresse",
      en: "Chest Press",
      es: "Press de pecho",
      fr: "Presse pectorale",
    },
    aliases: ["Chest Press", "Maschinen-Bankdr?cken"],
    icon: "???",
    type: "reps",
    defaultRateMinutes: 1,
    difficultyLevel: 4,
    category: "Ger?te & Maschinen",
    muscleGroups: ["Brust", "Trizeps", "Schultern"],
  },
  {
    id: "pec_deck",
    labels: {
      de: "Butterfly",
      en: "Pec Deck / Machine Fly",
      es: "Peck deck / Aperturas en m?quina",
      fr: "Pec deck / ?cart? ? la machine",
    },
    aliases: ["Pec Deck", "Brust-Fly Maschine"],
    icon: "???",
    type: "reps",
    defaultRateMinutes: 1,
    difficultyLevel: 3,
    category: "Ger?te & Maschinen",
    muscleGroups: ["Brust", "vordere Schulter"],
  },
  {
    id: "reverse_pec_deck",
    labels: {
      de: "Reverse Butterfly",
      en: "Reverse Pec Deck / Rear Delt Machine",
      es: "Aperturas inversas en m?quina",
      fr: "Oiseau invers? machine",
    },
    aliases: ["Rear Delt Machine"],
    icon: "???",
    type: "reps",
    defaultRateMinutes: 1,
    difficultyLevel: 3,
    category: "Ger?te & Maschinen",
    muscleGroups: ["hintere Schulter", "oberer R?cken"],
  },
  {
    id: "leg_extension",
    labels: {
      de: "Beinstrecker",
      en: "Leg Extension",
      es: "Extensi?n de piernas",
      fr: "Extension des jambes",
    },
    aliases: ["Leg Extension"],
    icon: "??",
    type: "reps",
    defaultRateMinutes: 1,
    difficultyLevel: 3,
    category: "Ger?te & Maschinen",
    muscleGroups: ["Quadrizeps"],
  },
  {
    id: "leg_curl",
    labels: {
      de: "Beinbeuger",
      en: "Leg Curl",
      es: "Curl femoral",
      fr: "Leg curl",
    },
    aliases: ["Leg Curl"],
    icon: "??",
    type: "reps",
    defaultRateMinutes: 1,
    difficultyLevel: 3,
    category: "Ger?te & Maschinen",
    muscleGroups: ["Beinbeuger"],
  },
  {
    id: "ab_crunch_machine",
    labels: {
      de: "Bauchmaschine",
      en: "Ab Crunch Machine",
      es: "M?quina de abdominales",
      fr: "Machine ? abdominaux",
    },
    aliases: ["Ab Crunch Machine"],
    icon: "???",
    type: "reps",
    defaultRateMinutes: 1,
    difficultyLevel: 3,
    category: "Ger?te & Maschinen",
    muscleGroups: ["Bauch / Core"],
  },
  {
    id: "back_extension_machine",
    labels: {
      de: "R?ckenstrecker-Maschine",
      en: "Back Extension Machine",
      es: "M?quina de extensi?n lumbar",
      fr: "Machine d?extension lombaire",
    },
    aliases: ["Back Extension Machine"],
    icon: "???",
    type: "reps",
    defaultRateMinutes: 1,
    difficultyLevel: 3,
    category: "Ger?te & Maschinen",
    muscleGroups: ["R?ckenstrecker", "Ges?? (sekund?r)"],
  },
  {
    id: "biceps_curl_machine",
    labels: {
      de: "Bizepsmaschine",
      en: "Biceps Curl Machine",
      es: "M?quina de curl de b?ceps",
      fr: "Machine curl biceps",
    },
    aliases: ["Biceps Curl Machine", "Preacher Curl Machine"],
    icon: "???",
    type: "reps",
    defaultRateMinutes: 1,
    difficultyLevel: 3,
    category: "Ger?te & Maschinen",
    muscleGroups: ["Bizeps", "Unterarme (sekund?r)"],
  },
  {
    id: "triceps_extension_machine",
    labels: {
      de: "Trizepsmaschine",
      en: "Triceps Extension Machine",
      es: "M?quina de tr?ceps",
      fr: "Machine triceps",
    },
    aliases: ["Triceps Extension Machine"],
    icon: "???",
    type: "reps",
    defaultRateMinutes: 1,
    difficultyLevel: 3,
    category: "Ger?te & Maschinen",
    muscleGroups: ["Trizeps"],
  },
  {
    id: "cable_machine",
    labels: {
      de: "Kabelzug (Station)",
      en: "Cable Machine",
      es: "M?quina de poleas",
      fr: "Poulie",
    },
    aliases: ["Seilzug", "Cable Machine"],
    icon: "???",
    type: "reps",
    defaultRateMinutes: 1,
    difficultyLevel: 3,
    category: "Ger?te & Maschinen",
    muscleGroups: ["variabel (je nach ?bung)"],
  },
  {
    id: "lat_pulldown",
    labels: {
      de: "Latzug",
      en: "Lat Pulldown",
      es: "Jal?n al pecho",
      fr: "Tirage vertical",
    },
    aliases: ["Lat Pulldown"],
    icon: "???",
    type: "reps",
    defaultRateMinutes: 1,
    difficultyLevel: 4,
    category: "Ger?te & Maschinen",
    muscleGroups: ["R?cken (Lat)", "Bizeps", "hintere Schulter"],
  },
  {
    id: "seated_row_machine",
    labels: {
      de: "Rudermaschine (sitzend)",
      en: "Seated Row",
      es: "Remo sentado (m?quina)",
      fr: "Tirage horizontal (machine)",
    },
    aliases: ["Seated Row Machine"],
    icon: "???",
    type: "reps",
    defaultRateMinutes: 1,
    difficultyLevel: 4,
    category: "Ger?te & Maschinen",
    muscleGroups: ["R?cken", "Bizeps", "hintere Schulter"],
  },
  {
    id: "shoulder_press_machine",
    labels: {
      de: "Schulterpresse (Maschine)",
      en: "Shoulder Press Machine",
      es: "Press de hombros (m?quina)",
      fr: "D?velopp? ?paules (machine)",
    },
    aliases: ["Machine Shoulder Press"],
    icon: "???",
    type: "reps",
    defaultRateMinutes: 1,
    difficultyLevel: 4,
    category: "Ger?te & Maschinen",
    muscleGroups: ["Schultern", "Trizeps"],
  },
  {
    id: "leg_press",
    labels: {
      de: "Beinpresse",
      en: "Leg Press",
      es: "Prensa de piernas",
      fr: "Presse ? cuisses",
    },
    aliases: ["Leg Press"],
    icon: "???",
    type: "reps",
    defaultRateMinutes: 1,
    difficultyLevel: 5,
    category: "Ger?te & Maschinen",
    muscleGroups: ["Quadrizeps", "Ges??", "Beinbeuger (sekund?r)"],
  },
  {
    id: "calf_raise_machine",
    labels: {
      de: "Wadenmaschine",
      en: "Calf Raise Machine",
      es: "M?quina de gemelos",
      fr: "Machine ? mollets",
    },
    aliases: ["Calf Raise Machine"],
    icon: "???",
    type: "reps",
    defaultRateMinutes: 1,
    difficultyLevel: 3,
    category: "Ger?te & Maschinen",
    muscleGroups: ["Waden"],
  },
  {
    id: "hip_abductor_adductor_machine",
    labels: {
      de: "Ab-/Adduktorenmaschine",
      en: "Hip Abductor/Adductor Machine",
      es: "M?quina abductores/aductores",
      fr: "Machine abducteurs/adducteurs",
    },
    aliases: ["Hip Abductor/Adductor Machine"],
    icon: "???",
    type: "reps",
    defaultRateMinutes: 1,
    difficultyLevel: 3,
    category: "Ger?te & Maschinen",
    muscleGroups: [
      "Abduktoren (Ges??/seitliche H?fte)",
      "Adduktoren (innere Oberschenkel)",
    ],
  },
  {
    id: "biceps_curl",
    labels: {
      de: "Bizepscurls",
      en: "Biceps Curl",
      es: "Curl de b?ceps",
      fr: "Curl biceps",
    },
    aliases: ["Curl", "Kurzhantelcurls", "Langhantelcurls"],
    icon: "??",
    type: "reps",
    defaultRateMinutes: 1,
    difficultyLevel: 3,
    category: "Freihanteln",
    muscleGroups: ["Bizeps", "Unterarme (sekund?r)"],
  },
  {
    id: "triceps_extension_overhead",
    labels: {
      de: "Trizepsdr?cken (?ber Kopf / Strecken)",
      en: "Triceps Extension",
      es: "Extensi?n de tr?ceps",
      fr: "Extension triceps",
    },
    aliases: ["Triceps Extension", "French Press"],
    icon: "??",
    type: "reps",
    defaultRateMinutes: 1,
    difficultyLevel: 3,
    category: "Freihanteln",
    muscleGroups: ["Trizeps"],
  },
  {
    id: "lateral_raise",
    labels: {
      de: "Seitheben",
      en: "Lateral Raise",
      es: "Elevaciones laterales",
      fr: "?l?vations lat?rales",
    },
    aliases: ["Lateral Raises"],
    icon: "??",
    type: "reps",
    defaultRateMinutes: 1,
    difficultyLevel: 3,
    category: "Freihanteln",
    muscleGroups: ["seitliche Schulter"],
  },
  {
    id: "barbell_row",
    labels: {
      de: "Rudern (Kurzhantel/Langhantel)",
      en: "Row (Dumbbell/Barbell)",
      es: "Remo (mancuerna/barra)",
      fr: "Rowing (halt?re/barre)",
    },
    aliases: ["Row", "Bent-Over Row"],
    icon: "???",
    type: "reps",
    defaultRateMinutes: 1,
    difficultyLevel: 5,
    category: "Freihanteln",
    muscleGroups: ["R?cken", "Bizeps", "hintere Schulter"],
  },
  {
    id: "squat",
    labels: {
      de: "Kniebeuge",
      en: "Squat",
      es: "Sentadilla",
      fr: "Squat",
    },
    aliases: ["Squat"],
    icon: "???",
    type: "reps",
    defaultRateMinutes: 1,
    difficultyLevel: 6,
    category: "Freihanteln",
    muscleGroups: ["Quadrizeps", "Ges??", "Core"],
  },
  {
    id: "deadlift",
    labels: {
      de: "Kreuzheben",
      en: "Deadlift",
      es: "Peso muerto",
      fr: "Soulev? de terre",
    },
    aliases: ["Deadlift"],
    icon: "???",
    type: "reps",
    defaultRateMinutes: 1,
    difficultyLevel: 6,
    category: "Freihanteln",
    muscleGroups: ["R?ckenstrecker", "Ges??", "Beinbeuger", "Core"],
  },
  {
    id: "bench_press",
    labels: {
      de: "Bankdr?cken",
      en: "Bench Press",
      es: "Press de banca",
      fr: "D?velopp? couch?",
    },
    aliases: ["Bench Press"],
    icon: "???",
    type: "reps",
    defaultRateMinutes: 1,
    difficultyLevel: 5,
    category: "Freihanteln",
    muscleGroups: ["Brust", "Trizeps", "Schultern"],
  },
  {
    id: "overhead_press",
    labels: {
      de: "Schulterdr?cken",
      en: "Overhead Press",
      es: "Press militar",
      fr: "D?velopp? militaire",
    },
    aliases: ["Overhead Press", "Military Press"],
    icon: "???",
    type: "reps",
    defaultRateMinutes: 1,
    difficultyLevel: 5,
    category: "Freihanteln",
    muscleGroups: ["Schultern", "Trizeps", "Core"],
  },
  {
    id: "pushups",
    labels: {
      de: "Liegest?tze",
      en: "Push-Ups",
      es: "Flexiones",
      fr: "Pompes",
    },
    aliases: ["Push-Ups"],
    icon: "??",
    type: "reps",
    defaultRateMinutes: 1,
    difficultyLevel: 4,
    category: "Eigengewicht",
    muscleGroups: ["Brust", "Schultern", "Trizeps", "Core"],
  },
  {
    id: "pullups",
    labels: {
      de: "Klimmz?ge",
      en: "Pull-Ups",
      es: "Dominadas",
      fr: "Tractions",
    },
    aliases: ["Pull-Ups", "Chin-Ups"],
    icon: "???",
    type: "reps",
    defaultRateMinutes: 1,
    difficultyLevel: 5,
    category: "Eigengewicht",
    muscleGroups: ["R?cken", "Bizeps", "Schultern"],
  },
  {
    id: "dips",
    labels: {
      de: "Dips",
      en: "Dips",
      es: "Fondos",
      fr: "Dips",
    },
    aliases: ["Trizeps-Dips"],
    icon: "???",
    type: "reps",
    defaultRateMinutes: 1,
    difficultyLevel: 5,
    category: "Eigengewicht",
    muscleGroups: ["Trizeps", "Brust", "Schultern"],
  },
  {
    id: "plank",
    labels: {
      de: "Plank",
      en: "Plank",
      es: "Plancha",
      fr: "Gainage",
    },
    aliases: ["Unterarmst?tz"],
    icon: "??",
    type: "time",
    defaultRateMinutes: 1,
    difficultyLevel: 3,
    category: "Eigengewicht",
    muscleGroups: ["Core", "R?ckenstrecker"],
  },
  {
    id: "hyperextensions",
    labels: {
      de: "Hyperextensions (ohne Maschine m?glich)",
      en: "Back Extensions",
      es: "Extensiones lumbares",
      fr: "Extensions lombaires",
    },
    aliases: ["R?ckenstrecken", "Back Extensions"],
    icon: "??",
    type: "reps",
    defaultRateMinutes: 1,
    difficultyLevel: 3,
    category: "Eigengewicht",
    muscleGroups: ["R?ckenstrecker", "Ges??", "Beinbeuger (sekund?r)"],
  },
  {
    id: "hanging_leg_raises",
    labels: {
      de: "Hanging Leg Raises",
      en: "Hanging Leg Raises",
      es: "Elevaciones de piernas colgado",
      fr: "Relev?s de jambes suspendu",
    },
    aliases: ["Beinheben h?ngend"],
    icon: "??",
    type: "reps",
    defaultRateMinutes: 1,
    difficultyLevel: 4,
    category: "Eigengewicht",
    muscleGroups: ["Core", "H?ftbeuger"],
  },
  {
    id: "swimming",
    labels: {
      de: "Schwimmen",
      en: "Swimming",
      es: "Nataci?n",
      fr: "Natation",
    },
    icon: "??",
    type: "time",
    defaultRateMinutes: 1,
    difficultyLevel: 5,
    category: "Weitere Sportarten",
    muscleGroups: ["Ganzk?rper", "Herz-Kreislauf"],
  },
  {
    id: "yoga",
    labels: {
      de: "Yoga",
      en: "Yoga",
      es: "Yoga",
      fr: "Yoga",
    },
    icon: "??",
    type: "time",
    defaultRateMinutes: 1,
    difficultyLevel: 3,
    category: "Weitere Sportarten",
    muscleGroups: ["Core", "Beweglichkeit", "Stabilisierung"],
  },
  {
    id: "pilates",
    labels: {
      de: "Pilates",
      en: "Pilates",
      es: "Pilates",
      fr: "Pilates",
    },
    icon: "??",
    type: "time",
    defaultRateMinutes: 1,
    difficultyLevel: 4,
    category: "Weitere Sportarten",
    muscleGroups: ["Core", "R?cken", "H?fte"],
  },
  {
    id: "hiit",
    labels: {
      de: "HIIT",
      en: "HIIT",
      es: "Entrenamiento HIIT",
      fr: "HIIT",
    },
    aliases: ["Intervalltraining"],
    icon: "?",
    type: "time",
    defaultRateMinutes: 1,
    difficultyLevel: 6,
    category: "Weitere Sportarten",
    muscleGroups: ["Ganzk?rper", "Herz-Kreislauf"],
  },
  {
    id: "hiking",
    labels: {
      de: "Wandern",
      en: "Hiking",
      es: "Senderismo",
      fr: "Randonn?e",
    },
    icon: "??",
    type: "time",
    defaultRateMinutes: 1,
    difficultyLevel: 4,
    category: "Weitere Sportarten",
    muscleGroups: ["Beine", "Ges??", "Herz-Kreislauf"],
  },
];



const TEMPLATE_ICON_KEYWORDS = [
  {
    icon: "🏋️",
    keywords: [
      "bench",
      "press",
      "squat",
      "deadlift",
      "row",
      "curl",
      "dip",
      "fly",
      "extension",
      "shrug",
      "tricep",
      "bicep",
      "good morning",
      "pressdown",
      "kickback",
      "pull",
    ],
  },
  {
    icon: "🤸",
    keywords: [
      "push-up",
      "push up",
      "jump",
      "burpee",
      "clap",
      "pike",
      "planche",
      "force",
      "plyo",
      "skater",
      "bear",
      "crab",
      "craw",
      "wheel",
    ],
  },
  {
    icon: "🏃",
    keywords: [
      "run",
      "sprint",
      "jog",
      "hill",
      "treadmill",
      "cycling",
      "bike",
      "row",
      "assault",
      "climb",
      "stair",
      "rope",
      "agility",
      "shuttle",
      "cone",
      "interval",
      "sled",
    ],
  },
  {
    icon: "🧘",
    keywords: [
      "plank",
      "yoga",
      "pilates",
      "stretch",
      "pose",
      "thread",
      "boat",
      "sun",
      "cat",
      "cow",
      "hollow",
      "dragon",
    ],
  },
  {
    icon: "🚴",
    keywords: ["cycle", "bike", "stationary", "assault", "spin"],
  },
  {
    icon: "⚡",
    keywords: ["agility", "speed", "explosive", "power"],
  },
  {
    icon: "🏊",
    keywords: ["swim", "water", "stroke"],
  },
  {
    icon: "🥊",
    keywords: ["battle rope", "boxing", "punch", "slug", "slam"],
  },
];

const isPlaceholderIcon = (icon) =>
  !icon || icon.includes("?") || icon === DEFAULT_ICON;

const deriveTemplateIcon = (entry) => {
  if (!isPlaceholderIcon(entry.icon)) {
    return entry.icon;
  }
  const candidate = (entry.labels?.en || entry.id || "")
    .toLowerCase()
    .replace(/\s+/g, " ");
  for (const { icon, keywords } of TEMPLATE_ICON_KEYWORDS) {
    if (keywords.some((keyword) => candidate.includes(keyword))) {
      return icon;
    }
  }
  return DEFAULT_ICON;
};

const mergeTranslatedLabels = (entry) => {
  const translations = STANDARD_SPORT_TRANSLATIONS[entry.id] || {};
  return {
    ...entry.labels,
    ...translations,
  };
};

const LEGACY_DIFFICULTY_MIN = 1;
const LEGACY_DIFFICULTY_MAX = 10;
const LEGACY_DIFFICULTY_MIN_SCALE = 400;
const LEGACY_DIFFICULTY_MAX_SCALE = 600;

const mapLegacyDifficultyToNewScale = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_DIFFICULTY;
  }
  const clamped = Math.max(
    LEGACY_DIFFICULTY_MIN,
    Math.min(LEGACY_DIFFICULTY_MAX, parsed)
  );
  if (LEGACY_DIFFICULTY_MAX === LEGACY_DIFFICULTY_MIN) {
    return LEGACY_DIFFICULTY_MIN_SCALE;
  }
  const ratio =
    (clamped - LEGACY_DIFFICULTY_MIN) /
    (LEGACY_DIFFICULTY_MAX - LEGACY_DIFFICULTY_MIN);
  const scaled =
    LEGACY_DIFFICULTY_MIN_SCALE +
    ratio * (LEGACY_DIFFICULTY_MAX_SCALE - LEGACY_DIFFICULTY_MIN_SCALE);
  return Math.round(scaled);
};

const normalizeAliasList = (aliases) => {
  const seen = new Set();
  const normalized = [];
  const addAlias = (value) => {
    if (!value || typeof value !== "string") {
      return;
    }
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    normalized.push(trimmed);
  };
  (Array.isArray(aliases) ? aliases : []).forEach(addAlias);
  return normalized;
};

const SPORT_ID_MIGRATIONS = {
  running_outdoor: "jogging",
};

const LEGACY_JOGGING_NAMES = new Set([
  "Jogging / Running",
  "Jogging",
  "Running",
  "Joggen",
  "Trotar / Correr",
  "Correr",
  "Jogging / Course ? pied",
  "Course ? pied",
]);

const migrateSportsList = (sportsList = []) => {
  let changed = false;
  const byId = new Map();
  const migrated = [];

  sportsList.forEach((sport) => {
    if (!sport || !sport.id) {
      return;
    }
    const mappedId = SPORT_ID_MIGRATIONS[sport.id] || sport.id;
    let next = mappedId === sport.id ? { ...sport } : { ...sport, id: mappedId };
    if (mappedId !== sport.id) {
      changed = true;
    }

    if (mappedId === "jogging") {
      const name = typeof next.name === "string" ? next.name.trim() : "";
      if (name && LEGACY_JOGGING_NAMES.has(name) && name !== "Jogging") {
        next = { ...next, name: "Jogging" };
        changed = true;
      }
      const aliases = normalizeAliasList(next.aliases || []);
      if (!aliases.includes("Running")) {
        aliases.push("Running");
        next = { ...next, aliases };
        changed = true;
      } else if (aliases.length !== (next.aliases || []).length) {
        next = { ...next, aliases };
        changed = true;
      }
    }

    if (byId.has(mappedId)) {
      const existing = byId.get(mappedId);
      const mergedAliases = normalizeAliasList([
        ...(existing.aliases || []),
        ...(next.aliases || []),
      ]);
      if (mergedAliases.length !== (existing.aliases || []).length) {
        existing.aliases = mergedAliases;
        changed = true;
      }
      if (!existing.name && next.name) {
        existing.name = next.name;
        changed = true;
      }
      return;
    }

    byId.set(mappedId, next);
    migrated.push(next);
  });

  return { list: migrated, changed };
};

const buildStandardSportAliases = (sport) => {
  const combined = [];
  if (Array.isArray(sport.aliases)) {
    combined.push(...sport.aliases);
  }
  Object.values(sport.labels || {}).forEach((label) => combined.push(label));
  if (typeof sport.name === "string") {
    combined.push(sport.name);
  }
  if (typeof sport.id === "string") {
    combined.push(sport.id.replace(/_/g, " "));
  }
  return normalizeAliasList(combined);
};

const STANDARD_SPORTS = RAW_STANDARD_SPORTS.map((sport) => {
  const labels = mergeTranslatedLabels(sport);
  return {
    ...sport,
    difficultyLevel: mapLegacyDifficultyToNewScale(sport.difficultyLevel),
    icon: deriveTemplateIcon(sport),
    labels,
    aliases: buildStandardSportAliases({ ...sport, labels }),
  };
});
const STANDARD_SPORT_IDS = new Set(STANDARD_SPORTS.map((sport) => sport.id));
const getStandardSportLabel = (entry, language) =>
  entry.labels?.[language] || entry.labels?.en || entry.id;
const STANDARD_SPORT_BY_ID = new Map(
  STANDARD_SPORTS.map((sport) => [sport.id, sport])
);

const normalizeTextForSearch = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const stripNonAlphanumeric = (value) => value.replace(/[^a-z0-9]+/g, "");

const splitSearchTokens = (value) =>
  (value || "").split(/\s+/).filter((token) => token.length > 0);

const getLabelRoot = (label) => {
  if (!label || typeof label !== "string") {
    return "";
  }
  const tokens = label
    .split(/[\s-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  return tokens[0] || "";
};

const getLabelCandidates = (entry, language = "en") => {
  const labels = entry.labels || {};
  const seen = new Set();
  const candidates = [];
  const addLabel = (text) => {
    if (!text || typeof text !== "string") {
      return;
    }
    const trimmed = text.trim();
    if (!trimmed || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    candidates.push(trimmed);
  };
  const addAliases = (list) => {
    if (!Array.isArray(list)) {
      return;
    }
    list.forEach(addLabel);
  };
  addLabel(labels?.[language]);
  addLabel(labels?.en);
  Object.values(labels || {}).forEach(addLabel);
  addAliases(entry.aliases);
  addLabel(entry.name);
  addLabel(entry.id);
  return candidates;
};

const matchLabelScore = (
  normalizedLabel,
  compactLabel,
  searchLower,
  searchCompact
) => {
  if (!searchLower && !searchCompact) {
    return { score: 0, index: 0, candidate: normalizedLabel };
  }
  if (searchLower) {
    if (normalizedLabel.startsWith(searchLower)) {
      return { score: 0, index: 0, candidate: normalizedLabel };
    }
    const normalizedIndex = normalizedLabel.indexOf(searchLower);
    if (normalizedIndex !== -1) {
      return {
        score: 2,
        index: normalizedIndex,
        candidate: normalizedLabel,
      };
    }
  }
  if (searchCompact) {
    if (compactLabel.startsWith(searchCompact)) {
      return { score: 1, index: 0, candidate: normalizedLabel };
    }
    const compactIndex = compactLabel.indexOf(searchCompact);
    if (compactIndex !== -1) {
      return {
        score: 3,
        index: compactIndex,
        candidate: normalizedLabel,
      };
    }
  }
  return null;
};

const getSportMatchScore = (
  entry,
  searchLower,
  searchCompact,
  language = "en"
) => {
  const candidates = getLabelCandidates(entry, language);
  let bestMatch = null;
  for (const candidate of candidates) {
    const normalizedLabel = normalizeTextForSearch(candidate);
    const compactLabel = stripNonAlphanumeric(normalizedLabel);
    const match = matchLabelScore(
      normalizedLabel,
      compactLabel,
      searchLower,
      searchCompact
    );
    if (match === null) {
      continue;
    }
    if (
      !bestMatch ||
      match.score < bestMatch.score ||
      (match.score === bestMatch.score && match.index < bestMatch.index)
    ) {
      bestMatch = match;
      if (match.score === 0 && match.index === 0) {
        break;
      }
    }
  }
  return bestMatch;
};

const scoreAndSortSportsBySearch = (sportsList, searchLower, language = "en") => {
  if (!searchLower) {
    return sportsList;
  }
  const searchCompact = stripNonAlphanumeric(searchLower);
  const scored = sportsList
    .map((sport) => ({
      sport,
      match: getSportMatchScore(sport, searchLower, searchCompact, language),
    }))
    .filter((item) => item.match)
    .sort((a, b) => {
      const scoreDiff = a.match.score - b.match.score;
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      const indexDiff = a.match.index - b.match.index;
      if (indexDiff !== 0) {
        return indexDiff;
      }
      const distanceA =
        Math.abs((a.match.candidate?.length || 0) - searchLower.length);
      const distanceB =
        Math.abs((b.match.candidate?.length || 0) - searchLower.length);
      if (distanceA !== distanceB) {
        return distanceA - distanceB;
      }
      const nameA = String(a.sport.name || a.sport.id || "");
      const nameB = String(b.sport.name || b.sport.id || "");
      return nameA.localeCompare(nameB);
    })
    .map(({ sport }) => sport);
  return scored;
};

const createDefaultPresetSports = () => [];

const PRESET_IDS_TO_REMOVE = new Set(["pullups", "pushups_alt"]);

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

const SPORT_COLOR_POOL = [
  "#f97316",
  "#fb923c",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#0ea5e9",
  "#38bdf8",
  "#60a5fa",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
  "#f472b6",
  "#f43f5e",
  "#ef4444",
];

const ensureSportColorLinks = (sportsList = [], existing = {}) => {
  const safeExisting =
    existing && typeof existing === "object" ? existing : {};
  const next = {};
  let changed = false;
  const validIds = new Set(sportsList.map((sport) => sport.id));

  sportsList.forEach((sport) => {
    const current = safeExisting[sport.id];
    const isValid =
      Number.isInteger(current) &&
      current >= 0 &&
      current < SPORT_COLOR_POOL.length;
    const colorId = isValid
      ? current
      : Math.floor(Math.random() * SPORT_COLOR_POOL.length);
    if (!isValid) {
      changed = true;
    }
    next[sport.id] = colorId;
  });

  if (!changed) {
    Object.keys(safeExisting).forEach((sportId) => {
      if (!validIds.has(sportId)) {
        changed = true;
      }
    });
  }

  return { map: next, changed };
};

const addWordBreaks = (label = "") =>
  String(label)
    .split(" ")
    .map((word) =>
      word.length > 12 ? word.split("").join("\u200b") : word
    )
    .join(" ");

const formatFactorValue = (value) => {
  if (!Number.isFinite(value)) {
    return "-";
  }
  const fixed = Number(value).toFixed(4);
  return fixed.replace(/\.?0+$/, "");
};

const SportTitleSlots = ({ sport, sportLabel }) => {
  const [leftWidth, setLeftWidth] = useState(0);
  const [rightWidth, setRightWidth] = useState(0);
  const slotWidth = Math.max(leftWidth, rightWidth);
  const slotStyle = slotWidth ? { width: slotWidth } : undefined;
  const displayLabel = useMemo(
    () => addWordBreaks(sportLabel),
    [sportLabel]
  );

  const handleLeftLayout = useCallback(
    (event) => setLeftWidth(event.nativeEvent.layout.width),
    []
  );
  const handleRightLayout = useCallback(
    (event) => setRightWidth(event.nativeEvent.layout.width),
    []
  );

  return (
    <View style={styles.sportTitleCenterRow}>
      <View style={[styles.titleSideSlot, slotStyle]} onLayout={handleLeftLayout}>
        <Text style={styles.sportIcon}>{sport.icon || DEFAULT_ICON}</Text>
      </View>
      <View style={styles.sportTitleTextColumn}>
        <View style={styles.sportTitleTextRow}>
          <Text style={styles.sportName} numberOfLines={2} ellipsizeMode="tail">
            {displayLabel}
          </Text>
        </View>
      </View>
      <View
        style={[styles.titleSideSlot, slotStyle]}
        onLayout={handleRightLayout}
      />
    </View>
  );
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
        label: DEFAULT_WEEKDAY_LABELS[index],
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

const getRollingStats = (logs, sportId, sport) => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const sportLogs = logs[sportId] || {};
  let reps = 0;
  let seconds = 0;
  let km = 0;
  let screenSeconds = 0;
  Object.values(sportLogs).forEach((dayLogs) => {
    (dayLogs || []).forEach((entry) => {
      if (!entry || !entry.ts || entry.ts < cutoff) {
        return;
      }
      reps += entry.reps || 0;
      seconds += entry.seconds || 0;
      km += entry.km || 0;
      screenSeconds += resolveEntryScreenSeconds(sport, entry);
    });
  });
  return { reps, seconds, km, screenSeconds };
};

const getWeeklyStats = (stats, sportId) => {
  const weekKeys = getWeekKeys();
  return weekKeys.map(({ key, label }) => ({
    key,
    label,
    dayStats: (stats[sportId] || {})[key] || { reps: 0, seconds: 0, km: 0 },
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

const formatWeightValue = (value) => {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return `${Math.round(value)}`;
};

const formatDistanceValue = (value, maxDecimals = 2) => {
  if (!Number.isFinite(value)) {
    return "0";
  }
  const factor = Math.pow(10, maxDecimals);
  const rounded = Math.round(value * factor) / factor;
  const text = rounded.toFixed(maxDecimals);
  return text.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
};

const computeKmPerHour = (km, seconds) => {
  if (!Number.isFinite(km) || km <= 0) {
    return 0;
  }
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 0;
  }
  return (km * 3600) / seconds;
};

const formatKmPerHour = (km, seconds) =>
  formatDistanceValue(computeKmPerHour(km, seconds), 1);

const flattenSportEntries = (logs, sportId) => {
  const sportLog = (logs || {})[sportId] || {};
  return Object.values(sportLog || {}).flatMap((dayEntries) => dayEntries || []);
};

const getRecentWeightEntriesForSport = (logs, sportId, limit = 5) => {
  if (!sportId) {
    return [];
  }
  const allEntries = flattenSportEntries(logs, sportId);
  const weightEntries = allEntries.filter(
    (entry) =>
      entry &&
      Number.isFinite(entry.weight) &&
      Number.isFinite(entry.reps) &&
      entry.weight > 0 &&
      entry.reps > 0
  );
  return weightEntries
    .sort((a, b) => (b.ts || 0) - (a.ts || 0))
    .slice(0, limit);
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

const scaleKmForSeconds = (km, fromSeconds, toSeconds) => {
  if (!Number.isFinite(km) || km <= 0) {
    return 0;
  }
  if (!Number.isFinite(fromSeconds) || fromSeconds <= 0) {
    return km;
  }
  const ratio = Math.max(0, toSeconds) / fromSeconds;
  return Math.max(0, km * ratio);
};

const parsePositiveInteger = (value) => {
  const parsed = Number.parseInt(String(value).replace(",", "."), 10);
  if (Number.isNaN(parsed)) {
    return 0;
  }
  return Math.max(0, parsed);
};

const getDifficultyOptionIndex = (value) => {
  const parsed = Number.parseFloat(String(value));
  if (!Number.isFinite(parsed)) {
    return DEFAULT_DIFFICULTY_INDEX;
  }
  let closestIndex = 0;
  let smallestDistance = Infinity;
  USER_FACTOR_OPTIONS.forEach((option, index) => {
    const distance = Math.abs(option - parsed);
    if (distance < smallestDistance) {
      smallestDistance = distance;
      closestIndex = index;
    }
  });
  return closestIndex;
};

const clampDifficultyIndex = (index) =>
  Math.max(0, Math.min(USER_FACTOR_OPTIONS.length - 1, index));

const clampDifficultyLevel = (value) =>
  USER_FACTOR_OPTIONS[getDifficultyOptionIndex(value)];

const difficultyLevelForSport = (sport) => {
  if (!sport) {
    return DEFAULT_DIFFICULTY;
  }
  const fallbackWeightFactor =
    Number.isFinite(Number(sport.weightFactor)) &&
    sport.weightFactor !== undefined
      ? Number(sport.weightFactor)
      : undefined;
  const rawDifficulty =
    Number.isFinite(Number(sport.difficultyLevel)) &&
    sport.difficultyLevel !== undefined
      ? Number(sport.difficultyLevel)
      : undefined;
  const legacyIdentifier =
    typeof sport.id === "string"
      ? sport.id
      : typeof sport.standardSportId === "string"
      ? sport.standardSportId
      : null;
  const isLegacyStandard =
    rawDifficulty !== undefined &&
    Number(rawDifficulty) <= LEGACY_DIFFICULTY_MAX &&
    legacyIdentifier &&
    STANDARD_SPORT_IDS.has(legacyIdentifier);
  const candidateDifficulty = isLegacyStandard
    ? mapLegacyDifficultyToNewScale(rawDifficulty)
    : rawDifficulty;
  const selected =
    candidateDifficulty ?? fallbackWeightFactor ?? DEFAULT_DIFFICULTY;
  return clampDifficultyLevel(selected);
};

const defaultCategoryForSport = (sport) => {
  if (!sport) {
    return "General";
  }
  if (sport.type === "time") {
    return "Cardio";
  }
  if (sport.weightExercise) {
    return "Strength (Weighted)";
  }
  return "Strength";
};

const deriveSportCategory = (sport) => {
  if (!sport) {
    return defaultCategoryForSport(sport);
  }
  const explicitCategory =
    typeof sport.category === "string" ? sport.category.trim() : "";
  if (explicitCategory) {
    return explicitCategory;
  }
  return defaultCategoryForSport(sport);
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
  const userFactor = difficultyLevelForSport(sport);
  if (sport.type === "reps") {
    const value = (dayStats.reps || 0) * ADMIN_FACTOR_REPS * userFactor;
    return Math.max(0, Math.round(value));
  }
  const value = (dayStats.seconds || 0) * ADMIN_FACTOR_TIME * userFactor;
  return Math.max(0, Math.round(value));
};

const screenSecondsForEntry = (sport, entry) => {
  if (!sport || !entry) {
    return 0;
  }
  const userFactor = difficultyLevelForSport(sport);
  if (sport.type === "reps" && sport.weightExercise) {
    const reps = parsePositiveInteger(entry.reps);
    const weight = parsePositiveNumber(entry.weight);
    const value = weight * reps * userFactor * ADMIN_FACTOR_WEIGHTED;
    return Math.max(0, Math.round(value));
  }
  if (sport.type === "reps") {
    const reps = parsePositiveInteger(entry.reps);
    const value = reps * ADMIN_FACTOR_REPS * userFactor;
    return Math.max(0, Math.round(value));
  }
  const seconds = parsePositiveNumber(entry.seconds);
  const value = seconds * ADMIN_FACTOR_TIME * userFactor;
  return Math.max(0, Math.round(value));
};

const resolveEntryScreenSeconds = (sport, entry) => {
  if (!entry) {
    return 0;
  }
  if (Number.isFinite(entry.screenSeconds) && entry.screenSeconds >= 0) {
    return entry.screenSeconds;
  }
  return screenSecondsForEntry(sport, entry);
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
        totalSeconds += resolveEntryScreenSeconds(sport, entry);
      });
    });
  });
  return Math.max(0, Math.floor(totalSeconds));
};

const migrateLogsForSportIds = (logs, mapping = {}) => {
  if (!logs) {
    return { logs: {}, changed: false };
  }
  let changed = false;
  const nextLogs = {};
  Object.entries(logs).forEach(([sportId, sportLogs]) => {
    const mappedId = mapping[sportId] || sportId;
    if (mappedId !== sportId) {
      changed = true;
    }
    if (!nextLogs[mappedId]) {
      nextLogs[mappedId] = sportLogs || {};
      return;
    }
    const merged = { ...(nextLogs[mappedId] || {}) };
    Object.entries(sportLogs || {}).forEach(([dayKey, entries]) => {
      if (!merged[dayKey]) {
        merged[dayKey] = entries || [];
      } else {
        merged[dayKey] = [...(merged[dayKey] || []), ...(entries || [])];
      }
    });
    nextLogs[mappedId] = merged;
    changed = true;
  });
  return { logs: nextLogs, changed };
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
          if (sport.type === "time") {
            const normalizedKm = parsePositiveNumber(nextEntry.km);
            if (normalizedKm !== (nextEntry.km || 0)) {
              nextEntry.km = normalizedKm;
              changed = true;
            }
          } else if (nextEntry.km) {
            nextEntry.km = 0;
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

const buildStatsFromLogs = (logs, sports = []) => {
  const sportsMap = new Map(sports.map((sport) => [sport.id, sport]));
  const nextStats = {};
  Object.entries(logs || {}).forEach(([sportId, sportLogs]) => {
    const sport = sportsMap.get(sportId);
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
      const km = dayEntries.reduce((sum, entry) => sum + (entry.km || 0), 0);
      const screenSeconds = dayEntries.reduce(
        (sum, entry) => sum + resolveEntryScreenSeconds(sport, entry),
        0
      );
      if (reps <= 0 && seconds <= 0 && km <= 0 && screenSeconds <= 0) {
        return;
      }
      nextSportStats[dayKey] = {
        reps,
        seconds,
        km,
        screenSeconds,
      };
    });
    if (Object.keys(nextSportStats).length > 0) {
      nextStats[sportId] = nextSportStats;
    }
  });
  return nextStats;
};

const groupEntriesByWindow = (entries, sportOrType, weightMode = false) => {
  const sorted = [...entries].sort((a, b) => a.ts - b.ts);
  const groups = [];
  const resolvedType =
    typeof sportOrType === "string" ? sportOrType : sportOrType?.type;
  const resolvedWeightMode =
    typeof sportOrType === "string"
      ? weightMode
      : !!sportOrType?.weightExercise;
  const windowMs =
    resolvedType === "reps"
      ? resolvedWeightMode
        ? 5 * 60 * 1000
        : 15 * 1000
      : 30 * 60 * 1000;
  sorted.forEach((entry) => {
    const last = groups[groups.length - 1];
    const gapMs = last ? entry.ts - last.endTs : null;
    const splitOnGap =
      resolvedType === "reps" && !resolvedWeightMode
        ? gapMs >= windowMs
        : gapMs > windowMs;
    if (!last || splitOnGap) {
      groups.push({
        startTs: entry.ts,
        endTs: entry.ts,
        reps: entry.reps || 0,
        seconds: entry.seconds || 0,
        km: entry.km || 0,
        kmSeconds: entry.km ? entry.seconds || 0 : 0,
      });
    } else {
      last.endTs = entry.ts;
      last.reps += entry.reps || 0;
      last.seconds += entry.seconds || 0;
      if (entry.km) {
        last.km += entry.km || 0;
        last.kmSeconds += entry.seconds || 0;
      }
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
  if (!sport) {
    return DEFAULT_TIME_RATE;
  }
  if (sport.weightExercise && sport.type === "reps") {
    return DEFAULT_WEIGHT_RATE;
  }
  if (sport.id === "pushups") {
    return DEFAULT_REPS_RATE * 1.2;
  }
  if (sport.id === "pullups") {
    return DEFAULT_REPS_RATE * 1.4;
  }
  if (sport.id === "pushups_alt") {
    return DEFAULT_REPS_RATE * 0.85;
  }
  if (sport.id === "jogging") {
    return DEFAULT_TIME_RATE * 1.2;
  }
  if (sport.type === "reps") {
    return DEFAULT_REPS_RATE;
  }
  return DEFAULT_TIME_RATE;
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
    const difficultyLevel = difficultyLevelForSport(sport);
    const category = deriveSportCategory(sport);
    const next = {
      ...sport,
      name,
      presetKey,
      icon: sport.icon || defaultIconForSport(sport),
      aliases: Array.isArray(sport.aliases) ? sport.aliases : [],
      screenSecondsPerUnit:
        sport.screenSecondsPerUnit ?? defaultScreenSecondsPerUnit(sport),
      difficultyLevel,
      category,
      nonDeletable: sport.nonDeletable ?? false,
    };
    if (
      !sport.icon ||
      sport.screenSecondsPerUnit == null ||
      presetKey ||
      !Number.isFinite(Number(sport.difficultyLevel))
    ) {
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

function AppContent() {
  const { width, height } = useWindowDimensions();
  const { t } = useTranslation();
  const [sports, setSports] = useState([]);
  const [sportColorLinks, setSportColorLinks] = useState({});
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
  const [isFormulaModalOpen, setIsFormulaModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPrefaceSettingsOpen, setIsPrefaceSettingsOpen] = useState(false);
  const [isAppsSettingsOpen, setIsAppsSettingsOpen] = useState(false);
  const [isWorkoutOpen, setIsWorkoutOpen] = useState(false);
  const [isScreenTimeDetailsOpen, setIsScreenTimeDetailsOpen] =
    useState(false);
  const [prefaceDelayInput, setPrefaceDelayInput] = useState("");
  const [currentWorkout, setCurrentWorkout] = useState(null);
  const [workoutHistory, setWorkoutHistory] = useState([]);
  const [workoutDetailId, setWorkoutDetailId] = useState(null);
  const [isWorkoutDetailOpen, setIsWorkoutDetailOpen] = useState(false);
  const [workoutRunning, setWorkoutRunning] = useState(false);
  const [workoutSeconds, setWorkoutSeconds] = useState(0);
  const [workoutSessionCount, setWorkoutSessionCount] = useState(0);
  /*
  const workoutTrackingMode = workoutRunning && isWorkoutOpen;
  */
  const workoutTrackingMode = false;
  const [showHidden, setShowHidden] = useState(false);
  const [sportSearch, setSportSearch] = useState("");
  const [sportSortMode, setSportSortMode] = useState("manual");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("reps");
  const [newIcon, setNewIcon] = useState("");
  const [newRateMinutes, setNewRateMinutes] = useState("1");
  const [newWeightExercise, setNewWeightExercise] = useState(false);
  const [newDifficultyLevel, setNewDifficultyLevel] = useState(
    DEFAULT_DIFFICULTY
  );
  const [selectedStandardSportId, setSelectedStandardSportId] = useState(null);
  const [isCustomSportMode, setIsCustomSportMode] = useState(true);
  const adjustDifficultyLevel = useCallback((delta) => {
    setNewDifficultyLevel((current) => {
      const currentIndex = getDifficultyOptionIndex(current);
      const nextIndex = clampDifficultyIndex(currentIndex + delta);
      return USER_FACTOR_OPTIONS[nextIndex];
    });
  }, []);
  const newDifficultyIndex = getDifficultyOptionIndex(newDifficultyLevel);
  const difficultyFillPercent =
    (newDifficultyIndex /
      Math.max(1, USER_FACTOR_OPTIONS.length - 1)) *
    100;
  const [showIconInput, setShowIconInput] = useState(false);
  const [customSuggestionUsed, setCustomSuggestionUsed] = useState(false);
  const [infoModalKey, setInfoModalKey] = useState(null);
  const scrollViewRef = useRef(null);
  const homeScrollRef = useRef(null);
  const screenTimeDetailsScrollRef = useRef(null);
  const homeScrollYRef = useRef(0);
  const screenTimeDetailsScrollYRef = useRef(0);
  const [installedApps, setInstalledApps] = useState([]);
  const [appSearch, setAppSearch] = useState("");
  const [appSearchInput, setAppSearchInput] = useState("");
  const [appSearchBusy, setAppSearchBusy] = useState(false);
  const [appsLoading, setAppsLoading] = useState(false);
  const [appsUsageLoading, setAppsUsageLoading] = useState(false);
  const [appsInitialLoadComplete, setAppsInitialLoadComplete] = useState(false);
  const [appToggleLoading, setAppToggleLoading] = useState({});
  const [appUsageMap, setAppUsageMap] = useState({});
  const [usageState, setUsageState] = useState({
    remainingSeconds: 0,
    usedSeconds: 0,
    day: todayKey(),
    remainingBySport: {},
    entryCount: 0,
    carryoverSeconds: 0,
    usedByApp: {},
  });
  const [screenTimeEntries, setScreenTimeEntries] = useState([]);
  const [needsAccessibility, setNeedsAccessibility] = useState(true);
  const [accessibilityDisclosureVisible, setAccessibilityDisclosureVisible] =
    useState(false);
  const [permissionsPrompted, setPermissionsPrompted] = useState(false);
  const [accessibilityDisclosureAccepted, setAccessibilityDisclosureAccepted] =
    useState(false);
  const [usagePermissionsPrompted, setUsagePermissionsPrompted] = useState(false);
  const [usageAccessGranted, setUsageAccessGranted] = useState(false);
  const [notificationsPrompted, setNotificationsPrompted] = useState(false);
  const [notificationsGranted, setNotificationsGranted] = useState(false);
  const [grayscalePermissionsPrompted, setGrayscalePermissionsPrompted] =
    useState(false);
  const [permissionsPanelOpen, setPermissionsPanelOpen] = useState(false);
  const [permissionsPanelTouched, setPermissionsPanelTouched] = useState(false);
  const [permissionsCheckTick, setPermissionsCheckTick] = useState(0);
  const [dismissedMotivationActionId, setDismissedMotivationActionId] =
    useState(null);
  const [completedMotivationActionIds, setCompletedMotivationActionIds] =
    useState([]);
  const [usedFunFactIds, setUsedFunFactIds] = useState([]);
  const [activeFunFactId, setActiveFunFactId] = useState(null);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [statsRange, setStatsRange] = useState("month");
  const [infoHint, setInfoHint] = useState(null);
  const [infoAnchors, setInfoAnchors] = useState({});
  const [infoCardWidth, setInfoCardWidth] = useState(0);
  const [tutorialStepIndex, setTutorialStepIndex] = useState(null);
  const [tutorialTarget, setTutorialTarget] = useState(null);
  const [tutorialCardHeight, setTutorialCardHeight] = useState(0);
  const [tutorialSeen, setTutorialSeen] = useState(false);
  const [tutorialWaitingForSportCreation, setTutorialWaitingForSportCreation] =
    useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceError, setVoiceError] = useState(null);
  const [manualTimeMinutes, setManualTimeMinutes] = useState("");
  const [manualTimeSeconds, setManualTimeSeconds] = useState("");
  const [manualTimeKm, setManualTimeKm] = useState("");
  const [manualRepsInput, setManualRepsInput] = useState("");
  const [isAppActive, setIsAppActive] = useState(
    AppState.currentState === "active"
  );
  const [weightEntryWeight, setWeightEntryWeight] = useState("");
  const [weightEntryReps, setWeightEntryReps] = useState("");
  const intervalRef = useRef(null);
  const sessionStartRef = useRef(null);
  const runningRef = useRef(false);
  const workoutStartRef = useRef(null);
  const workoutIntervalRef = useRef(null);
  const sportDetailScrollRef = useRef(null);
  const manualRepsInputRef = useRef(null);
  const manualTimeMinutesRef = useRef(null);
  const manualTimeSecondsRef = useRef(null);
  const manualTimeKmRef = useRef(null);
  const weightEntryWeightRef = useRef(null);
  const weightEntryRepsRef = useRef(null);
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
  const tutorialWorkoutStartRef = useRef(null);
  const tutorialStatsNavRef = useRef(null);
  const tutorialWorkoutTimerRef = useRef(null);
  const tutorialAddSportRef = useRef(null);
  const tutorialSportNameRef = useRef(null);
  const tutorialSportIconRef = useRef(null);
  const tutorialSportTypeRef = useRef(null);
  const tutorialSportDifficultyRef = useRef(null);
  const tutorialSportWeightRef = useRef(null);
  const tutorialSportSaveRef = useRef(null);
  const tutorialSettingsCardRef = useRef(null);
  const tutorialStatsSummaryRef = useRef(null);
  const tutorialOverlayRef = useRef(null);
  const tutorialHeaderButtonRef = useRef(null);
  const tutorialAppsBackRef = useRef(null);
  const [overlayOffset, setOverlayOffset] = useState({ x: 0, y: 0 });
  const tutorialAppsButtonRef = useRef(null);
  const tutorialAppsScreenRef = useRef(null);
  const tutorialSamplePushupRef = useRef({
    entryId: null,
    cleaned: false,
    sportId: null,
    entry: null,
  });
  const tutorialFingerScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(tutorialFingerScale, {
          toValue: 1.15,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(tutorialFingerScale, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [tutorialFingerScale]);
  const storageErrorAlertedRef = useRef(false);
  const handleStorageError = useCallback(
    (contextLabel, error) => {
      console.warn("Storage save failed", contextLabel, error);
      if (storageErrorAlertedRef.current) {
        return;
      }
      storageErrorAlertedRef.current = true;
      Alert.alert(
        t("label.storageErrorTitle"),
        interpolateTemplate(t("label.storageErrorBody"), {
          context: contextLabel,
        })
      );
    },
    [t]
  );
  const persistStorageValue = useCallback(
    async (key, value, contextLabel) => {
      try {
        await AsyncStorage.setItem(key, value);
      } catch (error) {
        handleStorageError(contextLabel, error);
      }
    },
    [handleStorageError]
  );
  const markMotivationActionCompleted = useCallback(
    (actionId) => {
      if (!actionId) {
        return;
      }
      setCompletedMotivationActionIds((current) => {
        if (current.includes(actionId)) {
          return current;
        }
        const next = [...current, actionId];
        persistStorageValue(
          STORAGE_KEYS.motivationActions,
          JSON.stringify(next),
          "motivation actions"
        );
        return next;
      });
    },
    [persistStorageValue]
  );
  const markFunFactUsed = useCallback(
    (nextUsedIds) => {
      setUsedFunFactIds(nextUsedIds);
      persistStorageValue(
        STORAGE_KEYS.motivationFunFactsUsed,
        JSON.stringify(nextUsedIds),
        "motivation fun facts"
      );
    },
    [persistStorageValue]
  );
  const repsShort = t("label.repsShort");
  const voiceStatusText = voiceError
    ? voiceError
    : voiceEnabled
    ? voiceListening
      ? t("label.voiceListening")
      : t("label.voiceIdle")
    : "";
  const trimmedSportSearch = newName.trim();
  const normalizedSportSearch = normalizeTextForSearch(trimmedSportSearch);
  const standardSportSuggestions = useMemo(() => {
    if (!normalizedSportSearch) {
      return STANDARD_SPORTS;
    }
    const searchCompact = stripNonAlphanumeric(normalizedSportSearch);
    const searchTokens = splitSearchTokens(normalizedSportSearch);
    const singleWordSearch = searchTokens.length === 1;
    const scoredMatches = STANDARD_SPORTS.map((entry) => {
      const match = getSportMatchScore(
        entry,
        normalizedSportSearch,
        searchCompact,
        language
      );
      if (match === null) {
        return null;
      }
      return { entry, match };
    })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.match.score !== b.match.score) {
          return a.match.score - b.match.score;
        }
        if (a.match.index !== b.match.index) {
          return a.match.index - b.match.index;
        }
        const labelA = getStandardSportLabel(a.entry, language);
        const labelB = getStandardSportLabel(b.entry, language);
        return labelA.localeCompare(labelB);
      });
    const prefixMatches = singleWordSearch
      ? scoredMatches.filter((item) => item.match.index === 0)
      : scoredMatches;
    const shouldDedupRoots = singleWordSearch && normalizedSportSearch.length <= 2;
    if (!shouldDedupRoots) {
      return prefixMatches.slice(0, 6).map((item) => item.entry);
    }
    const dedupedMatches = [];
    const seenRoots = new Set();
    prefixMatches.forEach((item) => {
      const candidateRoot = getLabelRoot(item.match.candidate);
      if (candidateRoot && seenRoots.has(candidateRoot)) {
        return;
      }
      if (candidateRoot) {
        seenRoots.add(candidateRoot);
      }
      dedupedMatches.push(item);
    });
    return dedupedMatches.slice(0, 6).map((item) => item.entry);
  }, [language, normalizedSportSearch]);
  const showCustomSuggestionButton =
    trimmedSportSearch.length > 0 && standardSportSuggestions.length === 0;
  const customSuggestionLabel = interpolateTemplate(
    t("label.useAsCustomSport"),
    { term: trimmedSportSearch }
  );
  const handleSportNameChange = (value) => {
    setNewName(value);
    setSelectedStandardSportId(null);
    setIsCustomSportMode(true);
    setCustomSuggestionUsed(false);
  };
  const applyStandardSport = (entry) => {
    const label = getStandardSportLabel(entry, language);
    setNewName(label);
    setNewType(entry.type);
    setNewRateMinutes(
      String(
        entry.defaultRateMinutes ?? getDefaultRateMinutes(entry.type)
      )
    );
    setNewIcon(entry.icon || DEFAULT_ICON);
    setNewWeightExercise(!!entry.weightExercise);
    setNewDifficultyLevel(
      clampDifficultyLevel(entry.difficultyLevel ?? DEFAULT_DIFFICULTY)
    );
    setShowIconInput(false);
    setSelectedStandardSportId(entry.id);
    setIsCustomSportMode(false);
    setCustomSuggestionUsed(false);
  };
  const handleUseSearchAsCustom = () => {
    setIsCustomSportMode(true);
    setSelectedStandardSportId(null);
    setShowIconInput(false);
    setNewName(trimmedSportSearch);
    setCustomSuggestionUsed(true);
    setNewDifficultyLevel(DEFAULT_DIFFICULTY);
  };

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    if (!language) {
      return;
    }
    i18n.changeLanguage(language);
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
    if (!sport) {
      return "";
    }
    if (sport.presetKey) {
      return t(`sport.${sport.presetKey}`);
    }
    if (sport.standardSportId) {
      const standardSport = STANDARD_SPORT_BY_ID.get(sport.standardSportId);
      if (standardSport) {
        return getStandardSportLabel(standardSport, language);
      }
    }
    return sport.name;
  };

  const getSportAccentColor = (sportId) => {
    const colorId = sportColorLinks?.[sportId];
    if (!Number.isInteger(colorId)) {
      return COLORS.accent;
    }
    return SPORT_COLOR_POOL[colorId % SPORT_COLOR_POOL.length] || COLORS.accent;
  };

  const scrollToInput = useCallback((inputRef) => {
    const input = inputRef?.current;
    const scrollView = sportDetailScrollRef.current;
    if (!input || !scrollView?.scrollTo) {
      return;
    }
    const measureTarget =
      scrollView.getInnerViewNode?.() || scrollView;
    setTimeout(() => {
      try {
        input.measureLayout(
          measureTarget,
          (_x, y) => {
            scrollView.scrollTo({
              y: Math.max(0, y - 24),
              animated: true,
            });
          },
          () => {}
        );
      } catch (error) {
        // no-op for platforms that can't measure
      }
    }, 80);
  }, []);

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
      const grayscalePermissionsRaw = await AsyncStorage.getItem(
        STORAGE_KEYS.grayscalePermissions
      );
      const sportColorsRaw = await AsyncStorage.getItem(
        STORAGE_KEYS.sportColors
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
      const { list: migratedSports, changed: sportsMigrated } =
        migrateSportsList(baseSports);
      const { normalized, changed } = normalizeSports(migratedSports);
      setSports(normalized);
      if (changed || sportsMigrated || !parsedSports.length) {
        await AsyncStorage.setItem(
          STORAGE_KEYS.sports,
          JSON.stringify(normalized)
        );
      }
      let parsedSportColors = {};
      if (sportColorsRaw) {
        try {
          parsedSportColors = JSON.parse(sportColorsRaw) || {};
        } catch (error) {
          console.warn("Failed to parse sport colors", error);
        }
      }
      const { map: normalizedSportColors, changed: colorsChanged } =
        ensureSportColorLinks(normalized, parsedSportColors);
      setSportColorLinks(normalizedSportColors);
      if (colorsChanged || !sportColorsRaw) {
        await AsyncStorage.setItem(
          STORAGE_KEYS.sportColors,
          JSON.stringify(normalizedSportColors)
        );
      }
      const parsedLogs = logsRaw ? JSON.parse(logsRaw) : {};
      const { logs: migratedLogs, changed: logsMigrated } =
        migrateLogsForSportIds(parsedLogs, SPORT_ID_MIGRATIONS);
      const { normalized: normalizedLogs, changed: logsChanged } = normalizeLogs(
        migratedLogs,
        normalized
      );
      const rebuiltStats = buildStatsFromLogs(normalizedLogs, normalized);
      setStats(rebuiltStats);
      const statsJson = JSON.stringify(rebuiltStats);
      if (statsJson !== statsRaw) {
        await AsyncStorage.setItem(STORAGE_KEYS.stats, statsJson);
      }
      setLogs(normalizedLogs);
      if (logsChanged || logsMigrated) {
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
      setSportSortMode(
        parsedSettings.sportSortMode || DEFAULT_SETTINGS.sportSortMode
      );
      if (InstaControl?.setAppLanguage) {
        InstaControl.setAppLanguage(
          parsedSettings.language || DEFAULT_SETTINGS.language
        );
      }
      if (InstaControl?.setGrayscaleRestrictedApps) {
        InstaControl.setGrayscaleRestrictedApps(
          !!parsedSettings.grayscaleRestrictedApps
        );
      }
      setPermissionsPrompted(permissionsRaw === "true");
      setAccessibilityDisclosureAccepted(
        accessibilityDisclosureRaw === "true"
      );
      setUsagePermissionsPrompted(usagePermissionsRaw === "true");
      setNotificationsPrompted(!!notificationsPermissionsRaw);
      setGrayscalePermissionsPrompted(grayscalePermissionsRaw === "true");
      setNotificationsGranted(false);
      setTutorialSeen(tutorialSeenRaw === "true");
      setWorkoutHistory(workoutsRaw ? JSON.parse(workoutsRaw) : []);
      const motivationActionsRaw = await AsyncStorage.getItem(
        STORAGE_KEYS.motivationActions
      );
      let parsedCompletedMotivationActions = [];
      if (motivationActionsRaw) {
        try {
          const parsed = JSON.parse(motivationActionsRaw);
          if (Array.isArray(parsed)) {
            parsedCompletedMotivationActions = parsed;
          }
        } catch (error) {
          console.warn(
            "Failed to parse completed motivation actions",
            error
          );
        }
      }
      setCompletedMotivationActionIds(parsedCompletedMotivationActions);
      const motivationFunFactsRaw = await AsyncStorage.getItem(
        STORAGE_KEYS.motivationFunFactsUsed
      );
      let parsedUsedFunFacts = [];
      if (motivationFunFactsRaw) {
        try {
          const parsed = JSON.parse(motivationFunFactsRaw);
          if (Array.isArray(parsed)) {
            parsedUsedFunFacts = parsed;
          }
        } catch (error) {
          console.warn("Failed to parse used fun facts", error);
        }
      }
      setUsedFunFactIds(parsedUsedFunFacts);
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
    checkUsageAccess();
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

  const notificationsSupported =
    Platform.OS === "android" && Number(Platform.Version) >= 33;

  useEffect(() => {
    if (!notificationsSupported || !notificationsGranted || !workoutRunning) {
      InstaControl?.clearWorkoutNotification?.();
      return;
    }
    const title = t("label.workoutRunning");
    const timerText = formatSeconds(workoutSeconds);
    InstaControl?.showWorkoutNotification?.(title, timerText);
  }, [notificationsSupported, notificationsGranted, workoutRunning, workoutSeconds, t]);

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
    const { map: normalizedSportColors, changed } = ensureSportColorLinks(
      nextSports,
      sportColorLinks
    );
    if (changed) {
      setSportColorLinks(normalizedSportColors);
      await persistStorageValue(
        STORAGE_KEYS.sportColors,
        JSON.stringify(normalizedSportColors),
        t("menu.sports")
      );
    }
    await persistStorageValue(
      STORAGE_KEYS.sports,
      JSON.stringify(nextSports),
      t("menu.sports")
    );
  };

  const saveStats = async (nextStats) => {
    setStats(nextStats);
    await persistStorageValue(
      STORAGE_KEYS.stats,
      JSON.stringify(nextStats),
      t("menu.stats")
    );
  };

  const saveLogs = async (nextLogs) => {
    setLogs(nextLogs);
    await persistStorageValue(
      STORAGE_KEYS.logs,
      JSON.stringify(nextLogs),
      t("label.recentActivity")
    );
  };

  const saveSettings = async (nextSettings) => {
    setSettings(nextSettings);
    await persistStorageValue(
      STORAGE_KEYS.settings,
      JSON.stringify(nextSettings),
      t("menu.settings")
    );
  };

  const updateSportSortMode = async (nextMode) => {
    setSportSortMode(nextMode);
    if (settings?.sportSortMode === nextMode) {
      return;
    }
    await saveSettings({ ...settings, sportSortMode: nextMode });
  };

  const updateDayStat = (sportId, updater) => {
    const day = todayKey();
    setStats((prev) => {
      const nextStats = { ...prev };
      const sportStats = { ...(nextStats[sportId] || {}) };
      const dayStats = {
        reps: 0,
        seconds: 0,
        km: 0,
        screenSeconds: 0,
        ...(sportStats[day] || {}),
      };
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
      const sport = sports.find((item) => item.id === sportId);
      const repsTotal = dayEntries.reduce((sum, entry) => sum + (entry.reps || 0), 0);
      const secondsTotal = dayEntries.reduce(
        (sum, entry) => sum + (entry.seconds || 0),
        0
      );
      const kmTotal = dayEntries.reduce((sum, entry) => sum + (entry.km || 0), 0);
      const screenSecondsTotal = dayEntries.reduce(
        (sum, entry) => sum + resolveEntryScreenSeconds(sport, entry),
        0
      );
      if (
        repsTotal <= 0 &&
        secondsTotal <= 0 &&
        kmTotal <= 0 &&
        screenSecondsTotal <= 0
      ) {
        delete sportStats[dayKey];
      } else {
        sportStats[dayKey] = {
          reps: repsTotal,
          seconds: secondsTotal,
          km: kmTotal,
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
    const screenSeconds = resolveEntryScreenSeconds(sport, entry);
    InstaControl.upsertScreenTimeEntry(
      entry.id,
      sport.id,
      entry.ts,
      screenSeconds
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
      km: sport.type === "time" ? parsePositiveNumber(entry.km) : 0,
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
    return nextEntry;
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
            const previousSeconds = entry.seconds || 0;
            entry.seconds = reduced;
            entry.km = scaleKmForSeconds(entry.km || 0, previousSeconds, reduced);
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
          const previousSeconds = entry.seconds || 0;
          entry.seconds = nextSeconds;
          entry.km = scaleKmForSeconds(entry.km || 0, previousSeconds, nextSeconds);
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
        km: 0,
        screenSeconds: 0,
        ...(sportStats[dayKey] || {}),
      };
      const updated = updater(current);
      if (
        (updated.reps || 0) <= 0 &&
        (updated.seconds || 0) <= 0 &&
        (updated.km || 0) <= 0
      ) {
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
  const { normalized: normalizedSports } = normalizeSports(nextSports);
  await AsyncStorage.multiRemove([
      STORAGE_KEYS.sports,
      STORAGE_KEYS.stats,
      STORAGE_KEYS.settings,
      STORAGE_KEYS.carryover,
      STORAGE_KEYS.carryoverDay,
      STORAGE_KEYS.usageSnapshot,
      STORAGE_KEYS.logs,
      STORAGE_KEYS.tutorialSeen,
      STORAGE_KEYS.workouts,
    ]);
  await saveSports(normalizedSports);
    await saveStats({});
    await saveLogs({});
    await saveSettings(DEFAULT_SETTINGS);
    sessionStartRef.current = null;
    workoutStartRef.current = null;
    setRunning(false);
    setSessionSeconds(0);
    setWorkoutRunning(false);
    setWorkoutSeconds(0);
    setWorkoutSessionCount(0);
    setCurrentWorkout(null);
    setWorkoutHistory([]);
    setWorkoutDetailId(null);
    setLanguage(DEFAULT_SETTINGS.language);
    setSportSortMode(DEFAULT_SETTINGS.sportSortMode);
    setSelectedSportId(null);
    setStatsSportId(null);
    setStatsDayKey(null);
    setOverallStatsOpen(false);
    setOverallDayKey(null);
    setStatsEditMode(false);
    setPermissionsPrompted(true);
    setUsagePermissionsPrompted(true);
    setAccessibilityDisclosureAccepted(true);
    setNotificationsPrompted(true);
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
    if (InstaControl?.setControlledApps) {
      InstaControl.setControlledApps([]);
    }
    if (InstaControl?.clearAppData) {
      InstaControl.clearAppData();
    }
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
      setNewDifficultyLevel(difficultyLevelForSport(sport));
      setSelectedStandardSportId(sport.standardSportId ?? null);
      setIsCustomSportMode(!sport.standardSportId);
    } else {
      setEditingSportId(null);
      setNewName("");
      setNewType("reps");
      setNewIcon("");
      setNewRateMinutes(String(getDefaultRateMinutes("reps")));
      setNewWeightExercise(false);
      setNewDifficultyLevel(DEFAULT_DIFFICULTY);
      setSelectedStandardSportId(null);
      setIsCustomSportMode(true);
      maybeAdvanceTutorial("openAddSport");
    }
    setShowIconInput(false);
    setIsSportModalOpen(true);
  };

  const closeSportModal = () => {
    setIsSportModalOpen(false);
    setEditingSportId(null);
    setShowIconInput(false);
    setCustomSuggestionUsed(false);
  };

  const handleIncreaseDifficulty = () => {
    if (!motivationSport) {
      return;
    }
    openSportModal(motivationSport);
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
    const parsedDifficulty = clampDifficultyLevel(newDifficultyLevel);
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
          weightExercise: weightMode,
          difficultyLevel: parsedDifficulty,
          standardSportId: selectedStandardSportId ?? sport.standardSportId,
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
        difficultyLevel: parsedDifficulty,
        standardSportId: selectedStandardSportId ?? undefined,
      };
      await saveSports([newSport, ...sports]);
      markMotivationActionCompleted("newSport");
      if (tutorialActive && tutorialStep?.id === "createSportSave") {
        setTutorialWaitingForSportCreation(true);
        maybeAdvanceTutorial("saveSport");
      }
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

  const openWorkoutDetail = (sessionId) => {
    setWorkoutDetailId(sessionId);
    setIsWorkoutDetailOpen(true);
  };

  const closeWorkoutDetail = () => {
    setIsWorkoutDetailOpen(false);
    setWorkoutDetailId(null);
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
      const noAppsControlled =
        !settings?.controlledApps || settings.controlledApps.length === 0;
      const fallbackRemaining = noAppsControlled
        ? rollingScreenSecondsTotal(logs, sports)
        : 0;
      setUsageState({
        remainingSeconds:
          Math.max(state.remainingSeconds || 0, fallbackRemaining),
        usedSeconds: state.usedSeconds || 0,
        day: state.day || todayKey(),
        remainingBySport: state.remainingBySport || {},
        entryCount: state.entryCount || 0,
        carryoverSeconds: state.carryoverSeconds || 0,
        usedByApp: state.usedByApp || {},
      });
    }
  };

  const refreshScreenTimeEntries = useCallback(async () => {
    if (!InstaControl?.getScreenTimeEntries) {
      setScreenTimeEntries([]);
      return;
    }
    try {
      const entries = await InstaControl.getScreenTimeEntries();
      setScreenTimeEntries(entries || []);
    } catch (error) {
      console.warn("getScreenTimeEntries failed", error);
      setScreenTimeEntries([]);
    }
  }, []);

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

  const showPermissionInstruction = (titleKey, bodyKey) => {
    Alert.alert(t(titleKey), t(bodyKey));
  };

  const showWidgetInstructions = useCallback(() => {
    Alert.alert(t("label.widget"), t("label.widgetInstructions"));
  }, [t]);

  const requestWidgetPin = useCallback(
    (widgetId, widgetLabel) => {
      if (InstaControl?.requestPinWidget) {
        InstaControl.requestPinWidget(widgetId, widgetLabel);
        return;
      }
      showWidgetInstructions();
    },
    [showWidgetInstructions]
  );

  const openAccessibilitySettingsDirect = async () => {
    if (InstaControl?.openAccessibilitySettings) {
      InstaControl.openAccessibilitySettings();
    } else {
      showPermissionInstruction("label.accessibilityTitle", "label.accessibilitySteps");
      await openAppSettingsFallback();
    }
  };

  const openAccessibilitySettings = async () => {
    await openAccessibilitySettingsDirect();
    await AsyncStorage.setItem(STORAGE_KEYS.permissions, "true");
    setPermissionsPrompted(true);
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
    } else {
      showPermissionInstruction("label.usageAccessTitle", "label.usageAccessSteps");
      await openAppSettingsFallback();
    }
    await AsyncStorage.setItem(STORAGE_KEYS.usagePermissions, "true");
    setUsagePermissionsPrompted(true);
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
    if (InstaControl?.setGrayscaleRestrictedApps) {
      InstaControl.setGrayscaleRestrictedApps(
        !!settings.grayscaleRestrictedApps
      );
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
    if (needsAccessibility === false && accessibilityDisclosureVisible) {
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
    const handler = () => {
      if (isScreenTimeDetailsOpen) {
        setIsScreenTimeDetailsOpen(false);
        return true;
      }
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
      /*
      if (isWorkoutOpen) {
        setIsWorkoutOpen(false);
        return true;
      }
      */
      if (isPrefaceSettingsOpen) {
        setIsPrefaceSettingsOpen(false);
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
      /*
      if (workoutRunning) {
        handleWorkoutStop();
      }
      */
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
    isScreenTimeDetailsOpen,
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

  useEffect(() => {
    setWeightEntryWeight("");
    setWeightEntryReps("");
  }, [selectedSportId]);

  const loadInstalledApps = async () => {
    if (!InstaControl?.getInstalledApps) {
      setAppsInitialLoadComplete(true);
      return;
    }
    setAppsLoading(true);
    try {
      const hasUsageAccess = await checkUsageAccess();
      const apps = await InstaControl.getInstalledApps();
      setInstalledApps(apps || []);
      if (!hasUsageAccess || !InstaControl?.getAppUsageStats) {
        setAppUsageMap({});
        return;
      }
      setAppsUsageLoading(true);
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
    } finally {
      setAppsLoading(false);
      setAppsUsageLoading(false);
      setAppsInitialLoadComplete(true);
    }
  };

  const toggleControlledApp = (packageName) => {
    setAppToggleLoading((prev) => ({ ...prev, [packageName]: true }));
    InteractionManager.runAfterInteractions(async () => {
      try {
        const current = settings.controlledApps || [];
        const exists = current.includes(packageName);
        const nextApps = exists
          ? current.filter((pkg) => pkg !== packageName)
          : [packageName, ...current];
        await saveSettings({ ...settings, controlledApps: nextApps });
        if (InstaControl?.setControlledApps) {
          InstaControl.setControlledApps(nextApps);
        }
      } catch (error) {
        console.warn("toggleControlledApp failed", packageName, error);
      } finally {
        setAppToggleLoading((prev) => {
          const next = { ...prev };
          delete next[packageName];
          return next;
        });
      }
    });
  };

  const toggleGrayscaleRestrictedApps = async () => {
    const nextEnabled = !settings.grayscaleRestrictedApps;
    const nextSettings = {
      ...settings,
      grayscaleRestrictedApps: nextEnabled,
    };
    if (!nextEnabled) {
      if (InstaControl?.setGrayscaleRestrictedApps) {
        InstaControl.setGrayscaleRestrictedApps(false);
      }
      await saveSettings(nextSettings);
      return;
    }
    if (Platform.OS === "android" && InstaControl?.canWriteSecureSettings) {
      let canWrite = false;
      try {
        canWrite = await InstaControl.canWriteSecureSettings();
      } catch (error) {
        console.warn("canWriteSecureSettings failed", error);
      }
      if (!canWrite) {
        if (!grayscalePermissionsPrompted) {
          Alert.alert(
            t("label.grayscalePermissionTitle"),
            t("label.grayscalePermissionBody"),
            [
              { text: t("label.later"), style: "cancel" },
              {
                text: t("label.openAccessibilitySettings"),
                onPress: openAccessibilitySettingsDirect,
              },
            ]
          );
          await AsyncStorage.setItem(
            STORAGE_KEYS.grayscalePermissions,
            "true"
          );
          setGrayscalePermissionsPrompted(true);
        }
      }
    }
    if (InstaControl?.setGrayscaleRestrictedApps) {
      InstaControl.setGrayscaleRestrictedApps(true);
    }
    await saveSettings(nextSettings);
  };

  const openPrefaceSettings = () => {
    const delay = Number.isFinite(settings.prefaceDelaySeconds)
      ? settings.prefaceDelaySeconds
      : DEFAULT_SETTINGS.prefaceDelaySeconds;
    setPrefaceDelayInput(String(delay));
    setIsPrefaceSettingsOpen(true);
  };

  const handleHomeScroll = useCallback((event) => {
    const offset = event?.nativeEvent?.contentOffset?.y;
    if (Number.isFinite(offset)) {
      homeScrollYRef.current = offset;
    }
  }, []);

  const handleScreenTimeDetailsScroll = useCallback((event) => {
    const offset = event?.nativeEvent?.contentOffset?.y;
    if (Number.isFinite(offset)) {
      screenTimeDetailsScrollYRef.current = offset;
    }
  }, []);

  useEffect(() => {
    if (!isScreenTimeDetailsOpen) {
      return;
    }
    const node = screenTimeDetailsScrollRef.current;
    if (!node || typeof node.scrollTo !== "function") {
      return;
    }
    const y = screenTimeDetailsScrollYRef.current || 0;
    const raf = requestAnimationFrame(() => {
      node.scrollTo({ y, animated: false });
    });
    return () => cancelAnimationFrame(raf);
  }, [isScreenTimeDetailsOpen]);

  useEffect(() => {
    if (
      isScreenTimeDetailsOpen ||
      isSettingsOpen ||
      overallStatsOpen ||
      isPrefaceSettingsOpen ||
      isAppsSettingsOpen ||
      selectedSportId ||
      statsSportId ||
      statsDayKey ||
      overallDayKey
    ) {
      return;
    }
    const node = homeScrollRef.current;
    if (!node || typeof node.scrollTo !== "function") {
      return;
    }
    const y = homeScrollYRef.current || 0;
    const raf = requestAnimationFrame(() => {
      node.scrollTo({ y, animated: false });
    });
    return () => cancelAnimationFrame(raf);
  }, [
    isScreenTimeDetailsOpen,
    isSettingsOpen,
    overallStatsOpen,
    isPrefaceSettingsOpen,
    isAppsSettingsOpen,
    selectedSportId,
    statsSportId,
    statsDayKey,
    overallDayKey,
  ]);

  const openHome = () => {
    setIsSettingsOpen(false);
    setOverallStatsOpen(false);
    setIsPrefaceSettingsOpen(false);
    // setIsWorkoutOpen(false);
    setIsScreenTimeDetailsOpen(false);
    setSelectedSportId(null);
    setStatsSportId(null);
    setStatsDayKey(null);
    setOverallDayKey(null);
    setStatsEditMode(false);
  };

  /*
  const openWorkout = () => {
    setIsSettingsOpen(false);
    setOverallStatsOpen(false);
    setIsPrefaceSettingsOpen(false);
    setIsScreenTimeDetailsOpen(false);
    setSelectedSportId(null);
    setStatsSportId(null);
    setStatsDayKey(null);
    setOverallDayKey(null);
    setStatsEditMode(false);
    setWorkoutDetailId(null);
    setIsWorkoutOpen(true);
    maybeAdvanceTutorial("openWorkout");
  };
  */
  const openWorkout = () => {};

  const openStatsOverview = () => {
    setIsSettingsOpen(false);
    setIsPrefaceSettingsOpen(false);
    // setIsWorkoutOpen(false);
    setIsScreenTimeDetailsOpen(false);
    setSelectedSportId(null);
    setStatsSportId(null);
    setStatsDayKey(null);
    setOverallDayKey(null);
    setStatsEditMode(false);
    setOverallStatsOpen(true);
    maybeAdvanceTutorial("openStats");
  };

  const openSportStats = (sportId) => {
    setIsSettingsOpen(false);
    setIsPrefaceSettingsOpen(false);
    setSelectedSportId(null);
    setStatsDayKey(null);
    setOverallDayKey(null);
    setStatsEditMode(false);
    setOverallStatsOpen(false);
    setIsScreenTimeDetailsOpen(false);
    setStatsSportId(sportId);
  };

  const openSettings = () => {
    setOverallStatsOpen(false);
    setIsPrefaceSettingsOpen(false);
    // setIsWorkoutOpen(false);
    setIsScreenTimeDetailsOpen(false);
    setSelectedSportId(null);
    setStatsSportId(null);
    setStatsDayKey(null);
    setOverallDayKey(null);
    setStatsEditMode(false);
    setIsSettingsOpen(true);
    refreshUsageState();
    maybeAdvanceTutorial("openSettings");
  };

  const handleSelectSport = (sportId) => {
    setSelectedSportId(sportId);
    maybeAdvanceTutorial("openSport");
  };

  const openScreenTimeDetails = () => {
    setIsSettingsOpen(false);
    setOverallStatsOpen(false);
    setIsPrefaceSettingsOpen(false);
    // setIsWorkoutOpen(false);
    setSelectedSportId(null);
    setStatsSportId(null);
    setStatsDayKey(null);
    setOverallDayKey(null);
    setStatsEditMode(false);
    setIsScreenTimeDetailsOpen(true);
    refreshUsageState();
    refreshScreenTimeEntries();
    loadInstalledApps();
  };

  const handleBackFromSport = () => {
    setSelectedSportId(null);
    // setWorkoutSessionCount(0);
    maybeAdvanceTutorial("backHome");
  };

  const openAppsSettings = () => {
    setAppsInitialLoadComplete(false);
    setIsAppsSettingsOpen(true);
    setAppSearch("");
    setAppSearchInput("");
    maybeAdvanceTutorial("openApps");
  };

  const startTutorial = () => {
    tutorialSamplePushupRef.current = {
      entryId: null,
      cleaned: false,
      sportId: null,
      entry: null,
    };
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
    tutorialSamplePushupRef.current = {
      entryId: null,
      cleaned: false,
      sportId: null,
      entry: null,
    };
    await maybePromptNotifications();
  };

  const completeTutorial = async () => {
    await finishTutorial();
  };

  const renderTutorialHeaderButton = () => {
    if (!completedGettingStarted) {
      return null;
    }
    return (
      <Pressable
        ref={tutorialHeaderButtonRef}
        style={styles.tutorialHeaderButton}
        onPress={startTutorial}
      >
        <Text style={styles.tutorialHeaderText}>{t("label.tutorial")}</Text>
      </Pressable>
    );
  };

  const MainNavIcon = ({ type, active }) => {
    const strokeColor = active ? COLORS.background : COLORS.muted;
    const fillColor = active ? COLORS.background : "transparent";
    if (type === "home") {
      return (
        <View style={styles.mainNavIconWrapper}>
          <View
            style={[
              styles.navIconRoof,
              { borderColor: strokeColor, borderBottomColor: "transparent" },
            ]}
          />
          <View
            style={[
              styles.navIconHouse,
              { borderColor: strokeColor, backgroundColor: "transparent" },
            ]}
          />
        </View>
      );
    }
    if (type === "workout") {
      return (
        <View style={styles.mainNavIconWrapper}>
          <View style={[styles.navIconDumbbellBar, { backgroundColor: strokeColor }]} />
          <View style={styles.navIconDumbbellEnds}>
            <View style={[styles.navIconCircle, { borderColor: strokeColor }]} />
            <View style={[styles.navIconCircle, { borderColor: strokeColor }]} />
          </View>
        </View>
      );
    }
    if (type === "stats") {
      return (
        <View style={styles.mainNavIconWrapper}>
          <View style={styles.navIconBars}>
            <View style={[styles.navIconBar, { height: 12, backgroundColor: strokeColor }]} />
            <View style={[styles.navIconBar, { height: 16, backgroundColor: strokeColor }]} />
            <View style={[styles.navIconBar, { height: 8, backgroundColor: strokeColor }]} />
          </View>
        </View>
      );
    }
    // settings or default
    return (
      <View style={styles.mainNavIconWrapper}>
        <View
          style={[
            styles.navIconGear,
            { borderColor: strokeColor, backgroundColor: fillColor },
          ]}
        />
        <View
          style={[
            styles.navIconGearCenter,
            { backgroundColor: strokeColor },
          ]}
        />
      </View>
    );
  };

  const ActionGlyph = ({ type, color = COLORS.muted }) => {
    if (type === "stats") {
      return (
        <View style={styles.actionGlyphBars}>
          {[10, 14, 8].map((height, index) => (
            <View
              key={index}
              style={[styles.actionGlyphBar, { height, backgroundColor: color }]}
            />
          ))}
        </View>
      );
    }
    if (type === "edit") {
      return (
        <View style={[styles.actionGlyphBox, { borderColor: color }]}>
          <View style={[styles.actionGlyphBoxDot, { backgroundColor: color }]} />
        </View>
      );
    }
    if (type === "hide") {
      return (
        <View style={[styles.actionGlyphEye, { borderColor: color }]}>
          <View style={[styles.actionGlyphEyePupil, { backgroundColor: color }]} />
        </View>
      );
    }
    if (type === "delete") {
      return (
        <View style={styles.actionGlyphCross}>
          <View
            style={[
              styles.actionGlyphCrossLine,
              { backgroundColor: color, transform: [{ rotate: "45deg" }] },
            ]}
          />
          <View
            style={[
              styles.actionGlyphCrossLine,
              { backgroundColor: color, transform: [{ rotate: "-45deg" }] },
            ]}
          />
        </View>
      );
    }
    return null;
  };

  const WidgetGlyph = ({ color = COLORS.text }) => (
    <View style={styles.widgetGlyphGrid}>
      {Array.from({ length: 4 }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.widgetGlyphSquare,
            { backgroundColor: color },
          ]}
        />
      ))}
    </View>
  );

  const InfoGlyph = ({ type, color = COLORS.text }) => {
    if (type === "earned") {
      return (
        <View style={styles.infoGlyph}>
          <View style={[styles.infoGlyphStopwatch, { borderColor: color }]} />
          <View
            style={[styles.infoGlyphStopwatchKnob, { backgroundColor: color }]}
          />
        </View>
      );
    }
    if (type === "remaining") {
      return (
        <View style={[styles.infoGlyph, styles.infoGlyphHourglassWrapper]}>
          <View
            style={[
              styles.infoGlyphHourglassTop,
              { borderBottomColor: color },
            ]}
          />
          <View
            style={[
              styles.infoGlyphHourglassBottom,
              { borderTopColor: color },
            ]}
          />
        </View>
      );
    }
    if (type === "carryover") {
      return (
        <View style={styles.infoGlyph}>
          <View
            style={[styles.infoGlyphCarryoverCircle, { borderColor: color }]}
          />
          <View
            style={[
              styles.infoGlyphCarryoverArrow,
              { borderColor: color, transform: [{ rotate: "45deg" }] },
            ]}
          />
          <View
            style={[
              styles.infoGlyphCarryoverArrow,
              { borderColor: color, transform: [{ rotate: "-45deg" }] },
            ]}
          />
        </View>
      );
    }
    return null;
  };

  const renderMainNav = (active) => (
    <View style={styles.mainNav}>
      <Pressable
        style={[
          styles.mainNavButton,
          active === "home" && styles.mainNavButtonActive,
        ]}
        onPress={openHome}
      >
        <MainNavIcon type="home" active={active === "home"} />
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
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
          active === "stats" && styles.mainNavButtonActive,
        ]}
        ref={tutorialStatsNavRef}
        onPress={openStatsOverview}
      >
        <MainNavIcon type="stats" active={active === "stats"} />
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
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
        <MainNavIcon type="settings" active={active === "settings"} />
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
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

  /*
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
  */
  const renderWorkoutBanner = () => null;

  const savePrefaceSettings = async () => {
    const parsed = Math.max(0, Number.parseInt(prefaceDelayInput, 10) || 0);
    const nextSettings = { ...settings, prefaceDelaySeconds: parsed };
    await saveSettings(nextSettings);
    if (InstaControl?.setPrefaceDelaySeconds) {
      InstaControl.setPrefaceDelaySeconds(parsed);
    }
    setIsPrefaceSettingsOpen(false);
  };

  const renderPrefaceSettingsModal = () => {
    if (!isPrefaceSettingsOpen) {
      return null;
    }
    return (
      <Modal
        visible={isPrefaceSettingsOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setIsPrefaceSettingsOpen(false)}
      >
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
      </Modal>
    );
  };

  const renderSportModal = () => {
    if (!isSportModalOpen) {
      return null;
    }
    return (
      <Modal
        visible={isSportModalOpen}
        animationType="fade"
        transparent
        onRequestClose={closeSportModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingSportId ? t("label.editSport") : t("label.addSport")}
            </Text>
            <View
              style={styles.createSportField}
              ref={tutorialSportNameRef}
              collapsable={false}
            >
              <TextInput
                style={styles.searchInput}
                value={newName}
                onChangeText={handleSportNameChange}
                placeholder={t("label.searchSports")}
                placeholderTextColor="#7a7a7a"
              />
              {!editingSportId ? (
                <View style={styles.standardSuggestionWindow}>
                  <Text style={styles.suggestionsHeader}>
                    {t("label.sportSuggestions")}
                  </Text>
                  <View style={styles.suggestionListContainer}>
                    <ScrollView
                      contentContainerStyle={styles.suggestionList}
                      showsVerticalScrollIndicator={false}
                    >
                      {standardSportSuggestions.length > 0 ? (
                        standardSportSuggestions.map((entry) => {
                          const label = getStandardSportLabel(entry, language);
                          const isActive = entry.id === selectedStandardSportId;
                          return (
                            <Pressable
                              key={entry.id}
                              style={[
                                styles.suggestionItem,
                                isActive && styles.suggestionItemActive,
                              ]}
                              onPress={() => applyStandardSport(entry)}
                            >
                              <View style={styles.suggestionMain}>
                                <Text style={styles.suggestionIcon}>
                                  {entry.icon || DEFAULT_ICON}
                                </Text>
                                <View>
                                  <Text style={styles.suggestionLabel}>{label}</Text>
                                  <Text style={styles.suggestionMeta}>
                                    {entry.type === "reps"
                                      ? t("label.reps")
                                      : t("label.timeBased")}
                                  </Text>
                                </View>
                              </View>
                            </Pressable>
                          );
                        })
                      ) : (
                        <Text style={styles.helperText}>
                          {t("label.noSportSuggestions")}
                        </Text>
                      )}
                    </ScrollView>
                  </View>
                  {showCustomSuggestionButton ? (
                    <Pressable
                      style={({ pressed }) => [
                        styles.customSuggestionButton,
                        (pressed || customSuggestionUsed) &&
                          styles.customSuggestionButtonActive,
                      ]}
                      onPress={handleUseSearchAsCustom}
                    >
                      {({ pressed }) => (
                        <Text
                          style={[
                            styles.customSuggestionButtonText,
                            (pressed || customSuggestionUsed) &&
                              styles.customSuggestionButtonTextActive,
                          ]}
                        >
                          {customSuggestionLabel}
                        </Text>
                      )}
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
            <View
              style={styles.createSportField}
              ref={tutorialSportIconRef}
              collapsable={false}
            >
              {isCustomSportMode ? (
                <>
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
                </>
              ) : (
                <View style={styles.iconRow}>
                  <Text style={styles.helperText}>
                    {t("label.iconPlaceholder")}: {newIcon || DEFAULT_ICON}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.typeHeaderRow}>
              <Text style={styles.typeHeaderTitle}>
                {t("label.typePickerTitle")}
              </Text>
              <Pressable
                style={styles.infoButton}
                onPress={() =>
                  setInfoModalKey((prev) => (prev === "type" ? null : "type"))
                }
              >
                <Text style={styles.infoButtonText}>?</Text>
              </Pressable>
            </View>
            <View
              style={styles.createSportField}
              ref={tutorialSportTypeRef}
              collapsable={false}
            >
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
            </View>
            <View
              style={[styles.sliderSection, styles.createSportField]}
              ref={tutorialSportDifficultyRef}
              collapsable={false}
            >
              <View style={styles.difficultyHeaderRow}>
                <Text style={styles.rateLabel}>{t("label.difficultyLabel")}</Text>
                <View style={styles.difficultyHeaderActions}>
                  <Text style={styles.difficultyHeaderValue}>
                    {newDifficultyLevel}
                  </Text>
                  <Pressable
                    style={styles.infoButton}
                    onPress={() =>
                      setInfoModalKey((prev) =>
                        prev === "difficulty" ? null : "difficulty"
                      )
                    }
                  >
                    <Text style={styles.infoButtonText}>?</Text>
                  </Pressable>
                </View>
              </View>
              <View style={styles.difficultyBarWrapper}>
                <View style={styles.difficultyBarTrack}>
                  <View
                    style={[
                      styles.difficultyBarFill,
                      {
                        width: `${difficultyFillPercent}%`,
                      },
                    ]}
                  />
                </View>
              </View>
              <View style={styles.difficultyButtonsRow}>
                <Pressable
                  style={styles.difficultyButton}
                  onPress={() => adjustDifficultyLevel(-1)}
                >
                  <Text style={styles.difficultyButtonText}>-</Text>
                </Pressable>
                <Pressable
                  style={styles.difficultyButton}
                  onPress={() => adjustDifficultyLevel(1)}
                >
                  <Text style={styles.difficultyButtonText}>+</Text>
                </Pressable>
              </View>
            </View>
            {newType === "reps" ? (
              <View
                style={styles.weightToggleRow}
                ref={tutorialSportWeightRef}
                collapsable={false}
              >
                <Pressable
                  style={[
                    styles.weightToggleButton,
                    newWeightExercise && styles.weightToggleButtonActive,
                  ]}
                  onPress={() => setNewWeightExercise((prev) => !prev)}
                >
                  <View
                    style={[
                      styles.weightToggleIcon,
                      newWeightExercise && styles.weightToggleIconActive,
                    ]}
                  >
                    {newWeightExercise ? (
                      <Text style={styles.weightToggleIconText}>✓</Text>
                    ) : null}
                  </View>
                  <Text style={styles.weightToggleLabel}>
                    {t("label.weightExercise")}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.infoButton}
                  onPress={() =>
                    setInfoModalKey((prev) => (prev === "weight" ? null : "weight"))
                  }
                >
                  <Text style={styles.infoButtonText}>?</Text>
                </Pressable>
              </View>
            ) : null}
            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryButton} onPress={closeSportModal}>
                <Text style={styles.secondaryButtonText}>{t("label.cancel")}</Text>
              </Pressable>
              <Pressable
                style={styles.primaryButton}
                onPress={saveSportModal}
                ref={tutorialSportSaveRef}
                collapsable={false}
              >
                <Text style={styles.primaryButtonText}>{t("label.save")}</Text>
              </Pressable>
            </View>
          </View>
          {tutorialOverlayInModal ? (
            <View style={styles.tutorialPortal} pointerEvents="box-none">
              {renderTutorialOverlay()}
            </View>
          ) : null}
        </View>
      </Modal>
    );
  };

  const renderInfoModal = () => {
    if (!infoModalKey) {
      return null;
    }
    return (
      <Modal
        visible={!!infoModalKey}
        animationType="fade"
        transparent
        onRequestClose={() => setInfoModalKey(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setInfoModalKey(null)}
        >
          <Pressable
            style={styles.modalCard}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={styles.modalTitle}>
              {infoModalKey === "type"
                ? t("label.typeInfoTitle")
                : infoModalKey === "difficulty"
                ? t("label.difficultyLabel")
                : t("label.weightExerciseInfoTitle")}
            </Text>
            <Text style={styles.modalSubtitle}>
              {infoModalKey === "type"
                ? t("label.typeHelp")
                : infoModalKey === "difficulty"
                ? t("label.difficultyDescription")
                : t("label.weightExerciseInfoBody")}
            </Text>
            {infoModalKey === "difficulty" ? (
              <View style={styles.difficultyFormulaList}>
                <View style={styles.difficultyFormulaRow}>
                  <Text style={styles.difficultyFormulaLabel}>
                    {t("label.formulaTimeBased")}
                  </Text>
                  <Text style={styles.difficultyFormulaValue}>
                    {t("label.formulaTimeUnit")} ×{" "}
                    {formatFactorValue(ADMIN_FACTOR_TIME)} ×{" "}
                    {t("label.formulaUserFactor")}
                  </Text>
                </View>
                <View style={styles.difficultyFormulaRow}>
                  <Text style={styles.difficultyFormulaLabel}>
                    {t("label.formulaRepsBased")}
                  </Text>
                  <Text style={styles.difficultyFormulaValue}>
                    {repsShort} × {formatFactorValue(ADMIN_FACTOR_REPS)} ×{" "}
                    {t("label.formulaUserFactor")}
                  </Text>
                </View>
                <View style={styles.difficultyFormulaRow}>
                  <Text style={styles.difficultyFormulaLabel}>
                    {t("label.formulaWeighted")}
                  </Text>
                  <Text style={styles.difficultyFormulaValue}>
                    {t("label.weightUnit")} × {repsShort} ×{" "}
                    {t("label.formulaUserFactor")} ×{" "}
                    {formatFactorValue(ADMIN_FACTOR_WEIGHTED)}
                  </Text>
                </View>
              </View>
            ) : null}
            <View style={styles.modalActions}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => setInfoModalKey(null)}
              >
                <Text style={styles.secondaryButtonText}>{t("label.close")}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
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
      const km = parsePositiveNumber(manualTimeKm);
      const entry = addLogEntry(selectedSport, {
        ts: Date.now(),
        seconds: elapsed,
        km,
      });
      const addedSeconds =
        entry?.screenSeconds ??
        screenSecondsForEntry(selectedSport, {
          seconds: elapsed,
        });
      updateDayStat(selectedSport.id, (dayStats) => ({
        ...dayStats,
        seconds: dayStats.seconds + elapsed,
        km: (dayStats.km || 0) + km,
        screenSeconds: (dayStats.screenSeconds || 0) + addedSeconds,
      }));
    }
    setSessionSeconds(0);
    sessionStartRef.current = null;
    setManualTimeKm("");
  };

  const handleManualTimeLog = () => {
    const currentSport = selectedSportRef.current;
    if (!currentSport || currentSport.type !== "time") {
      return;
    }
    const minutes = Math.max(0, Number.parseInt(manualTimeMinutes, 10) || 0);
    const seconds = Math.max(0, Number.parseInt(manualTimeSeconds, 10) || 0);
    const totalSeconds = minutes * 60 + seconds;
    if (totalSeconds <= 0) {
      return;
    }
    const km = parsePositiveNumber(manualTimeKm);
    const timestamp = Date.now();
    const entryPayload = { ts: timestamp, seconds: totalSeconds, km };
    const loggedEntry = addLogEntry(currentSport, entryPayload);
    const addedSeconds =
      loggedEntry?.screenSeconds ??
      screenSecondsForEntry(currentSport, entryPayload);
    updateDayStat(currentSport.id, (dayStats) => ({
      ...dayStats,
      seconds: (dayStats.seconds || 0) + totalSeconds,
      km: (dayStats.km || 0) + km,
      screenSeconds: (dayStats.screenSeconds || 0) + addedSeconds,
    }));
    setManualTimeMinutes("");
    setManualTimeSeconds("");
    setManualTimeKm("");
    maybeAdvanceTutorial("trackAction");
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

  const handleContinueWorkout = useCallback(
    (session) => {
      if (workoutRunning || !session) {
        return;
      }
      const now = Date.now();
      const exercises = (session.exercises || []).map((entry) => ({
        ...entry,
      }));
      setCurrentWorkout({
        id: `workout-${now}`,
        startTs: now,
        exercises,
      });
      workoutStartRef.current = now;
      setWorkoutSeconds(0);
      setWorkoutSessionCount(0);
      setWorkoutRunning(true);
      setWorkoutDetailId(null);
    },
    [workoutRunning]
  );

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
    const sportMap = new Map(sports.map((sport) => [sport.id, sport]));
    let total = 0;
    Object.entries(logs || {}).forEach(([sportId, sportLogs]) => {
      const sport = sportMap.get(sportId);
      if (!sport) {
        return;
      }
      Object.values(sportLogs || {}).forEach((dayEntries) => {
        (dayEntries || []).forEach((entry) => {
          if (!entry || !entry.ts) {
            return;
          }
          if (entry.ts < startTs || entry.ts > endTs) {
            return;
          }
          total += resolveEntryScreenSeconds(sport, entry);
        });
      });
    });
    return Math.max(0, Math.floor(total));
  };

  const handleWorkoutExercisePress = (sport) => {
    if (!workoutRunning) {
      Alert.alert(
        t("label.startWorkout"),
        t("label.startWorkoutFirst"),
        [{ text: t("label.close"), style: "cancel" }],
        { cancelable: true }
      );
      return;
    }
    const exerciseEntry = {
      ts: Date.now(),
    };
    if (sport.type === "reps") {
      exerciseEntry.reps = 1;
    }
    if (sport.type === "time" && Number.isFinite(sport.defaultRateMinutes)) {
      exerciseEntry.seconds = Math.max(1, sport.defaultRateMinutes * 60);
    }
    const loggedEntry = addLogEntry(sport, exerciseEntry);
    const addedSeconds =
      loggedEntry?.screenSeconds ??
      screenSecondsForEntry(sport, exerciseEntry);
    updateDayStat(sport.id, (dayStats) => ({
      ...dayStats,
      reps: dayStats.reps + (exerciseEntry.reps || 0),
      seconds: dayStats.seconds + (exerciseEntry.seconds || 0),
      screenSeconds: (dayStats.screenSeconds || 0) + addedSeconds,
    }));
    setWorkoutSessionCount((prev) => prev + 1);
    recordWorkoutExercise(sport);
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

const getSpeechLocale = () => {
  const preferred = normalizeSpeechLocale(SPEECH_LOCALES[language]);
  if (preferred) {
    return preferred;
  }
  return normalizeSpeechLocale("en-US");
};

  const cleanupTutorialSamplePushup = useCallback(
    (sport, entry) => {
      if (!sport || !entry?.id || tutorialSamplePushupRef.current.cleaned) {
        return;
      }
      const dayKey = dateKeyFromDate(entry.ts || Date.now());
      let nextDayEntries = null;
      setLogs((prev) => {
        const nextLogs = { ...prev };
        const sportLogs = { ...(nextLogs[sport.id] || {}) };
        const dayEntries = [...(sportLogs[dayKey] || [])];
        const filtered = dayEntries.filter((item) => item.id !== entry.id);
        nextDayEntries = filtered;
        if (filtered.length === 0) {
          delete sportLogs[dayKey];
        } else {
          sportLogs[dayKey] = filtered;
        }
        if (Object.keys(sportLogs).length === 0) {
          delete nextLogs[sport.id];
        } else {
          nextLogs[sport.id] = sportLogs;
        }
        AsyncStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(nextLogs));
        return nextLogs;
      });
      if (nextDayEntries !== null) {
        syncDayStatsFromEntries(sport.id, dayKey, nextDayEntries);
      }
      removeScreenTimeEntry(entry.id);
      refreshUsageState();
      tutorialSamplePushupRef.current.cleaned = true;
    },
    [refreshUsageState, syncDayStatsFromEntries]
  );

  useEffect(() => {
    if (tutorialStep?.id !== "samplePushupInfo") {
      return;
    }
    const info = tutorialSamplePushupRef.current;
    if (!info?.entry || info.cleaned) {
      return;
    }
    const sport = sports.find((item) => item.id === info.sportId);
    if (!sport) {
      return;
    }
    cleanupTutorialSamplePushup(sport, info.entry);
  }, [tutorialStep, cleanupTutorialSamplePushup, sports]);

  const incrementReps = () => {
    const currentSport = selectedSportRef.current;
    if (!currentSport || currentSport.type !== "reps") {
      return;
    }
    /*
    if (workoutTrackingMode) {
      recordWorkoutExercise(currentSport);
      setWorkoutSessionCount((prev) => prev + 1);
    }
    */
    const entry = addLogEntry(currentSport, {
      ts: Date.now(),
      reps: 1,
    });
    const addedSeconds =
      entry?.screenSeconds ??
      screenSecondsForEntry(currentSport, { reps: 1 });
    updateDayStat(currentSport.id, (dayStats) => ({
      ...dayStats,
      reps: dayStats.reps + 1,
      screenSeconds: (dayStats.screenSeconds || 0) + addedSeconds,
    }));
    if (
      tutorialActive &&
      tutorialStep?.id === "track" &&
      !tutorialSamplePushupRef.current.entryId &&
      entry
    ) {
      tutorialSamplePushupRef.current = {
        entryId: entry.id,
        cleaned: false,
        sportId: currentSport.id,
        entry,
      };
    }
    maybeAdvanceTutorial("trackAction");
  };

  const handleManualRepsLog = () => {
    const currentSport = selectedSportRef.current;
    if (!currentSport || currentSport.type !== "reps") {
      return;
    }
    const reps = Math.max(0, Number.parseInt(manualRepsInput, 10) || 0);
    if (reps <= 0) {
      return;
    }
    /*
    if (workoutTrackingMode) {
      recordWorkoutExercise(currentSport);
      setWorkoutSessionCount((prev) => prev + 1);
    }
    */
    const timestamp = Date.now();
    const entryPayload = { ts: timestamp, reps };
    const entry = addLogEntry(currentSport, entryPayload);
    const addedSeconds =
      entry?.screenSeconds ??
      screenSecondsForEntry(currentSport, entryPayload);
    updateDayStat(currentSport.id, (dayStats) => ({
      ...dayStats,
      reps: (dayStats.reps || 0) + reps,
      screenSeconds: (dayStats.screenSeconds || 0) + addedSeconds,
    }));
    setManualRepsInput("");
    maybeAdvanceTutorial("trackAction");
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

  const openAppSettingsFallback = async () => {
    try {
      await Linking.openSettings();
    } catch (error) {
      console.warn("Failed to open settings fallback", error);
    }
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
    if (!voiceEnabledRef.current) {
      return;
    }
    const error = event?.error;
    const errorCode = error?.code;
    const trimmedMessage =
      typeof error?.message === "string" ? error.message.trim() : "";
    const languageUnsupported = errorCode === "10" || errorCode === "11";
    if (languageUnsupported) {
      setVoiceError(t("label.voiceUnavailable"));
      setVoiceEnabled(false);
      return;
    }
    const message =
      trimmedMessage.length > 0 ? trimmedMessage : t("label.voiceError");
    setVoiceError(message);
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
  const normalizedSportSearchTerm = normalizeTextForSearch(sportSearch);
  const sportLastUsageMap = useMemo(() => {
    const map = new Map();
    Object.entries(logs || {}).forEach(([sportId, sportLogs]) => {
      let latest = 0;
      Object.values(sportLogs || {}).forEach((dayLogs) => {
        (dayLogs || []).forEach((entry) => {
          const ts = entry?.ts || 0;
          if (ts > latest) {
            latest = ts;
          }
        });
      });
      map.set(sportId, latest);
    });
    return map;
  }, [logs]);

  const filteredActiveSports = useMemo(() => {
    const base = scoreAndSortSportsBySearch(
      activeSports,
      normalizedSportSearchTerm,
      language
    );
    if (sportSortMode === "manual") {
      return base;
    }
    if (sportSortMode === "alpha") {
      return [...base].sort((a, b) =>
        getSportLabel(a).localeCompare(getSportLabel(b), language)
      );
    }
    if (sportSortMode === "recent") {
      return [...base].sort((a, b) => {
        const tsA = sportLastUsageMap.get(a.id) || 0;
        const tsB = sportLastUsageMap.get(b.id) || 0;
        if (tsA !== tsB) {
          return tsB - tsA;
        }
        return getSportLabel(a).localeCompare(getSportLabel(b), language);
      });
    }
    return base;
  }, [
    activeSports,
    normalizedSportSearchTerm,
    language,
    sportSortMode,
    sportLastUsageMap,
  ]);
  const filteredHiddenSports = useMemo(() => {
    const base = scoreAndSortSportsBySearch(
      hiddenSports,
      normalizedSportSearchTerm,
      language
    );
    if (sportSortMode === "manual") {
      return base;
    }
    if (sportSortMode === "alpha") {
      return [...base].sort((a, b) =>
        getSportLabel(a).localeCompare(getSportLabel(b), language)
      );
    }
    if (sportSortMode === "recent") {
      return [...base].sort((a, b) => {
        const tsA = sportLastUsageMap.get(a.id) || 0;
        const tsB = sportLastUsageMap.get(b.id) || 0;
        if (tsA !== tsB) {
          return tsB - tsA;
        }
        return getSportLabel(a).localeCompare(getSportLabel(b), language);
      });
    }
    return base;
  }, [
    hiddenSports,
    normalizedSportSearchTerm,
    language,
    sportSortMode,
    sportLastUsageMap,
  ]);
  const selectedSport = sports.find((sport) => sport.id === selectedSportId);
  const tutorialSportId = activeSports[0]?.id;
  const motivationSport = activeSports[0] ?? null;
  /*
  const workoutWeightSummary = (() => {
    if (
      !selectedSport ||
      !selectedSport.weightExercise ||
      !workoutRunning ||
      !currentWorkout
    ) {
      return { total: 0, last: null };
    }
    const startTs = workoutStartRef.current || currentWorkout.startTs;
    if (!startTs) {
      return { total: 0, last: null };
    }
    const now = Date.now();
    const entries = flattenSportEntries(logs, selectedSport.id);
    let total = 0;
    let last = null;
    entries.forEach((entry) => {
      if (!entry || !Number.isFinite(entry.weight) || !entry.reps) {
        return;
      }
      const timestamp = entry.ts || 0;
      if (timestamp < startTs || timestamp > now) {
        return;
      }
      total += entry.weight * entry.reps;
      if (!last || timestamp > (last.ts || 0)) {
        last = entry;
      }
    });
    return { total: Math.round(total), last };
  })();
  const weightWorkoutTotal = workoutWeightSummary.total || 0;
  const lastWorkoutWeightEntry = workoutWeightSummary.last;
  */
  const weightWorkoutTotal = 0;
  const lastWorkoutWeightEntry = null;
  const recentWeightEntries = useMemo(() => {
    if (!selectedSport || !selectedSport.weightExercise) {
      return [];
    }
    return getRecentWeightEntriesForSport(logs, selectedSport.id);
  }, [logs, selectedSport?.id]);
  const statsSport = sports.find((sport) => sport.id === statsSportId);
  const rollingEarnedSeconds = useMemo(
    () => rollingScreenSecondsTotal(logs, sports),
    [logs, sports]
  );
  const totalRemainingSeconds =
    (usageState.remainingSeconds || 0) +
    (usageState.carryoverSeconds || 0);
  const remainingBySportList = useMemo(() => {
    const entries = Object.entries(usageState.remainingBySport || {});
    return entries
      .map(([sportId, seconds]) => {
        const sport = sports.find((item) => item.id === sportId);
        return {
          sportId,
          seconds: Number(seconds) || 0,
          label: sport ? getSportLabel(sport) : sportId,
          icon: sport?.icon || DEFAULT_ICON,
        };
      })
      .filter((entry) => entry.seconds > 0)
      .sort((a, b) => b.seconds - a.seconds);
  }, [sports, usageState.remainingBySport, language]);
  const earnedBySportList = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return sports
      .map((sport) => {
        const entries = flattenSportEntries(logs, sport.id);
        const totalSeconds = entries.reduce(
          (sum, entry) => {
            if (!entry?.ts || entry.ts < cutoff) {
              return sum;
            }
            return sum + resolveEntryScreenSeconds(sport, entry);
          },
          0
        );
        return {
          sportId: sport.id,
          label: getSportLabel(sport),
          icon: sport.icon || DEFAULT_ICON,
          totalSeconds,
        };
      })
      .filter((entry) => entry.totalSeconds > 0)
      .sort((a, b) => b.totalSeconds - a.totalSeconds);
  }, [logs, sports, language]);
  const logEntryById = useMemo(() => {
    const map = {};
    Object.values(logs || {}).forEach((sportLog) => {
      Object.values(sportLog || {}).forEach((dayEntries) => {
        (dayEntries || []).forEach((entry) => {
          if (entry?.id) {
            map[entry.id] = entry;
          }
        });
      });
    });
    return map;
  }, [logs]);
  const usageByAppList = useMemo(() => {
    const usedByApp = usageState.usedByApp || {};
    return (settings.controlledApps || [])
      .map((pkg) => {
        const app = installedApps.find((entry) => entry.packageName === pkg);
        return {
          key: pkg,
          label: app?.label || pkg,
          seconds: Number(usedByApp[pkg] || 0),
        };
      })
      .filter((entry) => entry.seconds > 0 && entry.label)
      .sort((a, b) => b.seconds - a.seconds);
  }, [installedApps, settings.controlledApps, usageState.usedByApp]);
  const screenTimeEntryRows = useMemo(() => {
    return (screenTimeEntries || [])
      .map((entry, index) => {
        const sport = sports.find((item) => item.id === entry.sportId);
        const logEntry = entry?.id ? logEntryById[entry.id] : null;
        const createdAt = Number(entry.createdAt || 0);
        const remainingSeconds = Number(entry.remainingSeconds || 0);
        const originalSeconds = Number(entry.originalSeconds || 0);
        const dayKey = createdAt
          ? dateKeyFromDate(new Date(createdAt))
          : todayKey();
        return {
          key: entry.id || `${entry.sportId || "entry"}-${index}`,
          sportId: entry.sportId || null,
          label: sport ? getSportLabel(sport) : t("label.screenTime"),
          icon: sport?.icon || DEFAULT_ICON,
          createdAt,
          dayKey,
          remainingSeconds,
          originalSeconds,
          reps: Number.isFinite(logEntry?.reps) ? logEntry.reps : 0,
          seconds: Number.isFinite(logEntry?.seconds) ? logEntry.seconds : 0,
          weight: Number.isFinite(logEntry?.weight) ? logEntry.weight : 0,
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [screenTimeEntries, sports, language, t, logEntryById]);
  const screenTimeEntryCutoff = Date.now() - 24 * 60 * 60 * 1000;
  const currentScreenTimeEntries = screenTimeEntryRows.filter(
    (entry) =>
      entry.createdAt >= screenTimeEntryCutoff && entry.remainingSeconds > 0
  );
  const carryoverScreenTimeEntries = screenTimeEntryRows.filter(
    (entry) =>
      entry.createdAt < screenTimeEntryCutoff && entry.remainingSeconds > 0
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
        requiresAction: false,
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
        id: "samplePushupInfo",
        titleKey: "tutorial.step.samplePushupInfo.title",
        bodyKey: "tutorial.step.samplePushupInfo.body",
        targetRef: tutorialTrackingAreaRef,
        hideHighlight: true,
        centerCard: true,
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
      steps.push({
        id: "createSport",
        titleKey: "tutorial.step.createSport.title",
        bodyKey: "tutorial.step.createSport.body",
        hideHighlight: true,
        centerCard: true,
        requiresAction: false,
        blocksTouches: true,
        renderInModal: true,
      });
      steps.push({
        id: "createSportName",
        titleKey: "tutorial.step.createSportName.title",
        bodyKey: "tutorial.step.createSportName.body",
        targetRef: tutorialSportNameRef,
        highlightColor: TUTORIAL_STRONG_HIGHLIGHT,
        blocksTouches: true,
        renderInModal: true,
      });
      steps.push({
        id: "createSportIcon",
        titleKey: "tutorial.step.createSportIcon.title",
        bodyKey: "tutorial.step.createSportIcon.body",
        targetRef: tutorialSportIconRef,
        highlightColor: TUTORIAL_STRONG_HIGHLIGHT,
        blocksTouches: true,
        renderInModal: true,
      });
      steps.push({
        id: "createSportType",
        titleKey: "tutorial.step.createSportType.title",
        bodyKey: "tutorial.step.createSportType.body",
        targetRef: tutorialSportTypeRef,
        highlightColor: TUTORIAL_STRONG_HIGHLIGHT,
        blocksTouches: true,
        renderInModal: true,
      });
      steps.push({
        id: "createSportDifficulty",
        titleKey: "tutorial.step.createSportDifficulty.title",
        bodyKey: "tutorial.step.createSportDifficulty.body",
        targetRef: tutorialSportDifficultyRef,
        highlightColor: TUTORIAL_STRONG_HIGHLIGHT,
        blocksTouches: true,
        renderInModal: true,
      });
      steps.push({
        id: "createSportWeight",
        titleKey: "tutorial.step.createSportWeight.title",
        bodyKey: "tutorial.step.createSportWeight.body",
        targetRef: tutorialSportWeightRef,
        highlightColor: TUTORIAL_STRONG_HIGHLIGHT,
        blocksTouches: true,
        renderInModal: true,
      });
      steps.push({
        id: "createSportSave",
        titleKey: "tutorial.step.createSportSave.title",
        bodyKey: "tutorial.step.createSportSave.body",
        targetRef: tutorialSportSaveRef,
        actionId: "saveSport",
        requiresAction: true,
        blocksTouches: true,
        renderInModal: true,
      });
    }
    /*
    steps.push({
      id: "workout",
      titleKey: "tutorial.step.workout.title",
      bodyKey: "tutorial.step.workout.body",
      targetRef: tutorialWorkoutStartRef,
      actionId: "openWorkout",
      requiresAction: true,
    });
    steps.push({
      id: "workoutDetail",
      titleKey: "tutorial.step.workoutDetail.title",
      bodyKey: "tutorial.step.workoutDetail.body",
      targetRef: tutorialWorkoutTimerRef,
      blocksTouches: true,
    });
    */
    steps.push({
      id: "statsNav",
      titleKey: "tutorial.step.stats.title",
      bodyKey: "tutorial.step.stats.body",
      targetRef: tutorialStatsNavRef,
      actionId: "openStats",
      requiresAction: true,
    });
    steps.push({
      id: "statsDetail",
      titleKey: "tutorial.step.statsDetail.title",
      bodyKey: "tutorial.step.statsDetail.body",
      targetRef: tutorialStatsSummaryRef,
      blocksTouches: true,
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
      steps.push({
        id: "openAppsInfo",
        titleKey: "tutorial.step.openAppsInfo.title",
        bodyKey: "tutorial.step.openAppsInfo.body",
        targetRef: tutorialAppsScreenRef,
      });
      steps.push({
        id: "chooseAppAction",
        titleKey: "tutorial.step.chooseAppAction.title",
        targetRef: tutorialAppsScreenRef,
        hideHighlight: true,
        maskColor: "transparent",
        blocksTouches: false,
        cardDock: "top",
        inlineAction: true,
        actionLabelKey: "tutorial.cta.done",
      });
      steps.push({
        id: "chooseAppBack",
        titleKey: "tutorial.step.back.title",
        bodyKey: "tutorial.step.back.body",
        targetRef: tutorialAppsBackRef,
        actionId: "backFromApps",
        requiresAction: true,
      });
    }
    steps.push({
      id: "finish",
      titleKey: "tutorial.step.finish.title",
      bodyKey: "tutorial.step.finish.body",
      targetRef: tutorialHeaderButtonRef,
    });
    return steps;
  }, [activeSports.length, trackBodyKey]);
  const tutorialActive = tutorialStepIndex !== null;
  const tutorialStep = tutorialActive ? tutorialSteps[tutorialStepIndex] : null;
  const isTutorialLastStep =
    tutorialStepIndex !== null &&
    tutorialStepIndex === tutorialSteps.length - 1;
  const tutorialOverlayInRoot =
    tutorialActive && !tutorialStep?.renderInModal;
  const tutorialOverlayInModal =
    tutorialActive && tutorialStep?.renderInModal && isSportModalOpen;
  useEffect(() => {
    if (
      !tutorialWaitingForSportCreation ||
      !tutorialActive ||
      activeSports.length === 0
    ) {
      return;
    }
    setTutorialWaitingForSportCreation(false);
    setTutorialStepIndex(1);
  }, [activeSports.length, tutorialActive, tutorialWaitingForSportCreation]);
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
        groups: groupEntriesByWindow(sorted, sport),
        latestTs,
      });
    });
    groups.sort((a, b) => b.latestTs - a.latestTs);
    return groups;
  }, [logs, sports]);
  const micIcon = "\uD83C\uDFA4";
  const tooltipWidth =
    infoCardWidth > 0 ? Math.min(220, Math.max(180, infoCardWidth - 24)) : 200;

  const gridPadding = 16;
  const gridGap = 12;
  const gridWidth = Math.max(0, width - gridPadding * 2);
  const columnCount = width >= 900 ? 3 : width >= 520 ? 2 : 1;
  const cardWidth = Math.max(
    0,
    Math.floor((gridWidth - gridGap * (columnCount - 1)) / columnCount)
  );
  const titleWidth = Math.max(140, cardWidth - 64 * 2 - 24);
  const highestAppUsageMs = useMemo(() => {
    const values = Object.values(appUsageMap || {});
    if (values.length === 0) {
      return 0;
    }
    return Math.max(
      ...values.map((value) => (Number.isFinite(value) ? Number(value) : 0))
    );
  }, [appUsageMap]);
  const highestAppUsageMinutes = Math.max(
    0,
    Math.round(highestAppUsageMs / 60000)
  );
  const showMotivationAlert = (titleKey, bodyKey) => {
    Alert.alert(t(titleKey), t(bodyKey));
  };
  const funFacts = useMemo(
    () => getFunFactsForLanguage(language),
    [language]
  );
  const selectRandomFunFact = useCallback(() => {
    if (!funFacts.length) {
      setActiveFunFactId(null);
      return;
    }
    const validIds = new Set(funFacts.map((fact) => fact.id));
    const cleanedUsedIds = usedFunFactIds.filter((id) => validIds.has(id));
    const usedSet = new Set(cleanedUsedIds);
    const availableFacts = funFacts.filter((fact) => !usedSet.has(fact.id));
    const pool = availableFacts.length ? availableFacts : funFacts;
    const selected = pool[Math.floor(Math.random() * pool.length)];
    if (!selected) {
      setActiveFunFactId(null);
      return;
    }
    const nextUsedIds = availableFacts.length
      ? Array.from(new Set([...cleanedUsedIds, selected.id]))
      : [selected.id];
    setActiveFunFactId(selected.id);
    if (nextUsedIds.length !== usedFunFactIds.length) {
      markFunFactUsed(nextUsedIds);
    } else if (!usedSet.has(selected.id)) {
      markFunFactUsed(nextUsedIds);
    }
  }, [funFacts, markFunFactUsed, usedFunFactIds]);

  const motivationActions = useMemo(() => {
    const defaultSport = motivationSport ?? activeSports[0];
    return [
      {
        id: "startSport",
        icon: "Start",
        titleKey: "label.motivationStartSportTitle",
        bodyKey: "label.motivationStartSportBody",
        actionLabelKey: "label.motivationActionStartSport",
        action: () => openSportModal(),
      },
      {
        id: "difficulty",
        icon: "Diff",
        titleKey: "label.motivationDifficultyTitle",
        bodyKey: "label.motivationDifficultyBody",
        actionLabelKey: "label.motivationActionDifficulty",
        action: handleIncreaseDifficulty,
        disabled: !motivationSport,
      },
      /*
      {
        id: "workout",
        icon: "Work",
        titleKey: "label.motivationWorkoutTitle",
        bodyKey: "label.motivationWorkoutBody",
        actionLabelKey: "label.motivationActionWorkout",
        action: () => openWorkout(),
      },
      */
      {
        id: "stats",
        icon: "Stats",
        titleKey: "label.motivationStatsTitle",
        bodyKey: "label.motivationStatsBody",
        actionLabelKey: "label.motivationActionStats",
        action: () => openStatsOverview(),
      },
      {
        id: "newSport",
        icon: "New",
        titleKey: "label.motivationNewSportTitle",
        bodyKey: "label.motivationNewSportBody",
        actionLabelKey: "label.motivationActionNewSport",
        action: () => openSportModal(),
      },
      {
        id: "widget",
        icon: "Widget",
        titleKey: "label.motivationWidgetTitle",
        bodyKey: "label.motivationWidgetBody",
        actionLabelKey: "label.motivationActionWidget",
        action: () =>
          requestWidgetPin("overall", t("label.todayScreenTime")),
      },
      {
        id: "notifications",
        icon: "Notif",
        titleKey: "label.motivationNotificationsTitle",
        bodyKey: "label.motivationNotificationsBody",
        actionLabelKey: "label.motivationActionNotifications",
        action: openNotificationSettings,
      },
      {
        id: "apps",
        icon: "Apps",
        titleKey: "label.motivationAppsTitle",
        bodyKey: "label.motivationAppsBody",
        actionLabelKey: "label.motivationActionApps",
        action: openAppsSettings,
        bodyParams: { minutes: highestAppUsageMinutes },
      },
      {
        id: "settings",
        icon: "Set",
        titleKey: "label.motivationSettingsTitle",
        bodyKey: "label.motivationSettingsBody",
        actionLabelKey: "label.motivationActionSettings",
        action: openSettings,
      },
      {
        id: "preface",
        icon: "Pref",
        titleKey: "label.motivationPrefaceTitle",
        bodyKey: "label.motivationPrefaceBody",
        actionLabelKey: "label.motivationActionPreface",
        action: openPrefaceSettings,
      },
      {
        id: "voice",
        icon: "Voice",
        titleKey: "label.motivationVoiceTitle",
        bodyKey: "label.motivationVoiceBody",
        actionLabelKey: "label.motivationActionVoice",
        action: toggleVoice,
      },
      {
        id: "language",
        icon: "Lang",
        titleKey: "label.motivationLanguageTitle",
        bodyKey: "label.motivationLanguageBody",
        actionLabelKey: "label.motivationActionLanguage",
        action: () => setShowLanguageMenu(true),
      },
      {
        id: "tutorial",
        icon: "Tut",
        titleKey: "label.motivationTutorialTitle",
        bodyKey: "label.motivationTutorialBody",
        actionLabelKey: "label.motivationActionTutorial",
        action: startTutorial,
      },
      {
        id: "history",
        icon: "Hist",
        titleKey: "label.motivationHistoryTitle",
        bodyKey: "label.motivationHistoryBody",
        actionLabelKey: "label.motivationActionHistory",
        action: () =>
          showMotivationAlert("label.motivationHistoryTitle", "label.motivationHistoryBody"),
      },
      {
        id: "logWeight",
        icon: "Weight",
        titleKey: "label.motivationLogWeightTitle",
        bodyKey: "label.motivationLogWeightBody",
        actionLabelKey: "label.motivationActionLogWeight",
        action: () =>
          showMotivationAlert("label.motivationLogWeightTitle", "label.motivationLogWeightBody"),
      },
      {
        id: "challenge",
        icon: "Goal",
        titleKey: "label.motivationChallengeTitle",
        bodyKey: "label.motivationChallengeBody",
        actionLabelKey: "label.motivationActionChallenge",
        action: () =>
          showMotivationAlert("label.motivationChallengeTitle", "label.motivationChallengeBody"),
      },
    ];
  }, [
    activeSports,
    handleIncreaseDifficulty,
    openAppsSettings,
    openNotificationSettings,
    openPrefaceSettings,
    openSettings,
    openSportModal,
    openStatsOverview,
    openWorkout,
    requestWidgetPin,
    setShowLanguageMenu,
    showMotivationAlert,
    startTutorial,
    toggleVoice,
    motivationSport,
    highestAppUsageMinutes,
  ]);
  const motivationActionMap = useMemo(
    () => new Map(motivationActions.map((item) => [item.id, item])),
    [motivationActions]
  );
  const completedMotivationActionIdsSet = useMemo(
    () => new Set(completedMotivationActionIds),
    [completedMotivationActionIds]
  );

  const recommendedActionId = useMemo(() => {
    const hasSports = activeSports.length > 0;
    const hasEntries = (usageState.entryCount || 0) > 0;
    const candidateId = (() => {
      if (!hasSports || !hasEntries) {
        return "startSport";
      }
      if (highestAppUsageMinutes >= 45) {
        return "apps";
      }
      const usedSeconds = usageState.usedSeconds || 0;
      const remainingSeconds = usageState.remainingSeconds || 0;
      /*
      if (remainingSeconds < 10 * 60 && usedSeconds > 0) {
        return "workout";
      }
      */
      const totalSeconds = usedSeconds + remainingSeconds;
      const usageRatio = totalSeconds > 0 ? usedSeconds / totalSeconds : 0;
      if (usageRatio >= 0.7 && remainingSeconds < 30 * 60) {
        return "difficulty";
      }
      if (highestAppUsageMinutes >= 25) {
        return "notifications";
      }
      return "stats";
    })();
    const isActionAvailable = (id) => {
      const action = motivationActionMap.get(id);
      return !!action && !action.disabled;
    };
    if (
      candidateId &&
      !completedMotivationActionIdsSet.has(candidateId) &&
      isActionAvailable(candidateId)
    ) {
      return candidateId;
    }
    const fallback = motivationActions.find(
      (action) =>
        !completedMotivationActionIdsSet.has(action.id) &&
        !action.disabled
    );
    return fallback ? fallback.id : null;
  }, [
    activeSports.length,
    highestAppUsageMinutes,
    usageState.entryCount,
    usageState.remainingSeconds,
    usageState.usedSeconds,
    completedMotivationActionIdsSet,
    motivationActionMap,
    motivationActions,
  ]);

  useEffect(() => {
    if (
      dismissedMotivationActionId &&
      dismissedMotivationActionId !== recommendedActionId
    ) {
      setDismissedMotivationActionId(null);
    }
  }, [recommendedActionId, dismissedMotivationActionId]);

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }
    if (!activeFunFactId) {
      selectRandomFunFact();
      return;
    }
    if (!funFacts.some((fact) => fact.id === activeFunFactId)) {
      selectRandomFunFact();
    }
  }, [activeFunFactId, funFacts, hasLoaded, selectRandomFunFact]);

  useEffect(() => {
    if (!hasLoaded || !permissionsPanelOpen || missingPermissions) {
      return;
    }
    selectRandomFunFact();
  }, [hasLoaded, missingPermissions, permissionsPanelOpen, selectRandomFunFact]);

  const activeFunFact = funFacts.find((fact) => fact.id === activeFunFactId);
  const activeQuoteTitle = t("label.motivationQuoteStartTitle");
  const activeQuoteBody = activeFunFact ? activeFunFact.text : "";

  const activeAction = recommendedActionId
    ? motivationActionMap.get(recommendedActionId)
    : null;
  const activeActionTitle = activeAction ? t(activeAction.titleKey) : "";
  const activeActionBody = activeAction
    ? interpolateTemplate(
        t(activeAction.bodyKey),
        activeAction.bodyParams ?? {}
      )
    : "";
  const activeActionLabel = t(
    activeAction?.actionLabelKey ?? "label.motivationActionDefault"
  );
  const shouldShowMotivationAction =
    activeAction &&
    recommendedActionId &&
    !completedMotivationActionIdsSet.has(recommendedActionId) &&
    (!dismissedMotivationActionId ||
      dismissedMotivationActionId !== recommendedActionId);
  const showMotivationBlock = missingPermissions || shouldShowMotivationAction;

  const handleMotivationAction = (actionItem) => {
    if (!actionItem?.action) {
      return;
    }
    if (actionItem.id === recommendedActionId) {
      setDismissedMotivationActionId(actionItem.id);
    }
    markMotivationActionCompleted(actionItem.id);
    actionItem.action();
  };

  useEffect(() => {
    if (usageState.entryCount > 0) {
      markMotivationActionCompleted("startSport");
    }
    /*
    if (isWorkoutOpen || workoutRunning) {
      markMotivationActionCompleted("workout");
    }
    */
    if (overallStatsOpen) {
      markMotivationActionCompleted("stats");
    }
    if (isSettingsOpen) {
      markMotivationActionCompleted("settings");
    }
    if (isPrefaceSettingsOpen) {
      markMotivationActionCompleted("preface");
    }
    if (isAppsSettingsOpen) {
      markMotivationActionCompleted("apps");
    }
    if (showLanguageMenu) {
      markMotivationActionCompleted("language");
    }
    if (notificationsPrompted) {
      markMotivationActionCompleted("notifications");
    }
    if (voiceEnabled) {
      markMotivationActionCompleted("voice");
    }
    if (tutorialActive) {
      markMotivationActionCompleted("tutorial");
    }
  }, [
    usageState.entryCount,
    isWorkoutOpen,
    workoutRunning,
    overallStatsOpen,
    isSettingsOpen,
    isPrefaceSettingsOpen,
    isAppsSettingsOpen,
    showLanguageMenu,
    notificationsPrompted,
    voiceEnabled,
    tutorialActive,
    markMotivationActionCompleted,
  ]);

  useEffect(() => {
    if (
      !isSportModalOpen ||
      !editingSportId ||
      !motivationSport ||
      motivationSport.id !== editingSportId
    ) {
      return;
    }
    markMotivationActionCompleted("difficulty");
  }, [
    isSportModalOpen,
    editingSportId,
    motivationSport?.id,
    markMotivationActionCompleted,
  ]);

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
    isSportModalOpen,
  ]);
  useEffect(() => {
    lastTutorialTargetRef.current = null;
    setTutorialTarget(null);
    setTutorialCardHeight(0);
  }, [tutorialStepIndex]);

  useEffect(() => {
    if (!tutorialActive) {
      setOverlayOffset((prev) =>
        prev.x === 0 && prev.y === 0 ? prev : { x: 0, y: 0 }
      );
      return;
    }
    let raf = null;
    let cancelled = false;
    const measureOverlay = () => {
      if (cancelled) {
        return;
      }
      const node = tutorialOverlayRef.current;
      if (!node?.measureInWindow) {
        raf = requestAnimationFrame(measureOverlay);
        return;
      }
      node.measureInWindow((x, y) => {
        if (cancelled) {
          return;
        }
        setOverlayOffset((prev) =>
          prev.x === x && prev.y === y ? prev : { x, y }
        );
      });
    };
    raf = requestAnimationFrame(measureOverlay);
    return () => {
      cancelled = true;
      if (raf) {
        cancelAnimationFrame(raf);
      }
    };
  }, [tutorialActive, tutorialStepIndex, width, height]);

  useEffect(() => {
    if (
      !tutorialTarget ||
      !scrollViewRef.current ||
      typeof scrollViewRef.current.scrollTo !== "function"
    ) {
      return;
    }
    let raf = null;
    let cancelled = false;
    const ensureVisible = () => {
      scrollViewRef.current.measureInWindow((scrollX, scrollY, scrollWidth, scrollHeight) => {
        if (cancelled) {
          return;
        }
        const margin = 32;
        const targetTop = tutorialTarget.y;
        const targetBottom = tutorialTarget.y + (tutorialTarget.height || 0);
        const visibleTop = scrollY + margin;
        const visibleBottom = scrollY + scrollHeight - margin;
        if (targetTop >= visibleTop && targetBottom <= visibleBottom) {
          return;
        }
        const centerOffset =
          targetTop - scrollY - scrollHeight / 2 + (tutorialTarget.height || 0) / 2;
        const desiredY = Math.max(centerOffset, 0);
        scrollViewRef.current.scrollTo({ y: desiredY, animated: true });
      });
    };
    raf = requestAnimationFrame(ensureVisible);
    return () => {
      cancelled = true;
      if (raf) {
        cancelAnimationFrame(raf);
      }
    };
  }, [tutorialTarget, tutorialStepIndex]);

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
    const usesTarget = !tutorialStep.hideHighlight && hasTarget;
    const effectiveTarget = usesTarget ? target : null;
    const hasEffectiveTarget = !!effectiveTarget;
    const basePadding = 14;
    const paddingByStep = {
      "tutorial.step.track.title": 8,
      "tutorial.step.addSport.title": 10,
      "tutorial.step.createSportName.title": 6,
      "tutorial.step.createSportIcon.title": 6,
      "tutorial.step.createSportType.title": 6,
      "tutorial.step.createSportDifficulty.title": 6,
      "tutorial.step.createSportWeight.title": 6,
      "tutorial.step.createSportSave.title": 8,
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
    const highlightScaleByStep = {
      "tutorial.step.track.title": 0.7,
      "tutorial.step.samplePushupInfo.title": 0.7,
    };
    const highlightScale = highlightScaleByStep[tutorialStep.titleKey] ?? 1;
    const safeTargetWidth = effectiveTarget?.width ?? 0;
    const safeTargetHeight = effectiveTarget?.height ?? 0;
    const baseWidth = Math.max(safeTargetWidth + highlightPadding * 2, minHighlightWidth);
    const baseHeight = Math.max(
      safeTargetHeight + highlightPadding * 2,
      minHighlightHeight
    );
    const forcedHighlightWidthByStep = {
      "tutorial.step.track.title": width - 32,
    };
    const forcedHighlightLeftByStep = {
      "tutorial.step.track.title": 16,
    };
    const baseHighlightWidth =
      hasEffectiveTarget ? Math.max(baseWidth * highlightScale, minHighlightWidth) : 64;
    const forcedWidth = forcedHighlightWidthByStep[tutorialStep.titleKey];
    const highlightWidth = forcedWidth
      ? Math.min(Math.max(forcedWidth, 64), Math.max(width - 32, 0))
      : baseHighlightWidth;
    const highlightHeight =
      hasEffectiveTarget
        ? Math.max(baseHeight * highlightScale, minHighlightHeight)
        : 64;
    const offsetYByStep = {
      "tutorial.step.back.title": -8,
      "tutorial.step.openSettings.title": -2,
      "tutorial.step.workout.title": -4,
      "tutorial.step.stats.title": -4,
      "tutorial.step.chooseAppAction.title": height * 0.05,
    };
    const offsetXByStep = {
      // Additional horizontal adjustments can be added here.
    };
    const overlayX = overlayOffset?.x ?? 0;
    const overlayY = overlayOffset?.y ?? 0;
    const desiredLeft = hasEffectiveTarget
      ? effectiveTarget.x -
        highlightPadding -
        overlayX +
        (offsetXByStep[tutorialStep.titleKey] ?? 0)
      : (width - highlightWidth) / 2;
    const desiredTop = hasEffectiveTarget
      ? effectiveTarget.y -
        highlightPadding -
        overlayY +
        (offsetYByStep[tutorialStep.titleKey] ?? 0)
      : (height - highlightHeight) / 2;
    const horizontalMax = Math.max(width - highlightWidth, 0);
    const verticalMax = Math.max(height - highlightHeight, 0);
    const forcedLeft = forcedHighlightLeftByStep[tutorialStep.titleKey];
    const highlightLeft =
      forcedLeft !== undefined
        ? Math.min(Math.max(forcedLeft, 0), horizontalMax)
        : Math.min(Math.max(desiredLeft, 0), horizontalMax);
    const highlightTop = Math.min(
      Math.max(desiredTop, 0),
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
    const safeCenterTop = Math.max(
      16,
      Math.min((height - estimatedCardHeight) / 2, height - estimatedCardHeight - 16)
    );
    const safeCenterLeft = Math.max(
      16,
      Math.min((width - cardWidth) / 2, width - cardWidth - 16)
    );
    let cardTop = preferBelow
      ? centerY + highlightHeight / 2 + 12
      : centerY - highlightHeight / 2 - 12 - estimatedCardHeight;
    cardTop = Math.min(maxTop, Math.max(16, cardTop));
    const cardLeft = Math.min(
      width - cardWidth - 16,
      Math.max(16, centerX - cardWidth / 2)
    );
    const cardDock = tutorialStep.cardDock;
    const dockTop = Math.min(16, Math.max(0, height - estimatedCardHeight - 16));
    const dockLeft = Math.min(16, Math.max(0, width - cardWidth - 16));
    const finalCardTop =
      cardDock === "top"
        ? dockTop
        : tutorialStep.centerCard
        ? safeCenterTop
        : cardTop;
    const finalCardLeft =
      cardDock === "top"
        ? dockLeft
        : tutorialStep.centerCard
        ? safeCenterLeft
        : cardLeft;
    const highlightBottom = highlightTop + highlightHeight;
    const highlightRight = highlightLeft + highlightWidth;
    const pointerSize = 56;
    const pointerSpacing = 12;
    const pointerCenterX = highlightLeft + highlightWidth / 2;
    const pointerTop = Math.min(
      Math.max(
        highlightBottom - pointerSize + 8,
        pointerSpacing
      ),
      height - pointerSize - pointerSpacing
    );
    const pointerLeft = Math.min(
      Math.max(pointerCenterX - pointerSize / 2, pointerSpacing),
      width - pointerSize - pointerSpacing
    );
    const showHighlight = hasEffectiveTarget && !tutorialStep.hideHighlight;
    const shouldBlockTouches =
      tutorialStep.blocksTouches ?? !tutorialStep.requiresAction;
    const showPointer = tutorialStep.requiresAction && hasEffectiveTarget;
    const highlightBackground =
      tutorialStep.highlightColor ??
      (tutorialStep.requiresAction
        ? "rgba(249, 115, 22, 0.12)"
        : "rgba(249, 115, 22, 0.06)");
    const defaultMaskColor = tutorialStep.requiresAction
      ? "rgba(2, 6, 23, 0.72)"
      : "rgba(2, 6, 23, 0.54)";
    const maskColor = tutorialStep.maskColor ?? defaultMaskColor;
    const blockingResponder = { onStartShouldSetResponder: () => true };
    const touchProps = shouldBlockTouches
      ? { ...blockingResponder, pointerEvents: "auto" }
      : { pointerEvents: "none" };
    const bodyText = tutorialStep.bodyKey ? t(tutorialStep.bodyKey) : null;
    const actionLabelKey = tutorialStep.actionLabelKey;
    const defaultActionLabel = isTutorialLastStep
      ? t("tutorial.cta.done")
      : t("tutorial.cta.next");
    const actionLabel = actionLabelKey
      ? t(actionLabelKey)
      : defaultActionLabel;
    const actionHandler = isTutorialLastStep ? completeTutorial : advanceTutorial;
    const showInlineAction = !!tutorialStep.inlineAction;
    const showFooterAction = !tutorialStep.requiresAction && !showInlineAction;
    const renderBlockingAreas = () => {
      if (!hasEffectiveTarget) {
        return (
          <View
            style={[
              styles.tutorialBackdrop,
              StyleSheet.absoluteFillObject,
              { backgroundColor: maskColor },
            ]}
            {...(shouldBlockTouches ? blockingResponder : {})}
            pointerEvents={shouldBlockTouches ? "auto" : "none"}
          />
        );
      }
      return (
        <>
          <View
            style={[
              styles.tutorialBlockingLayer,
              {
                left: 0,
                right: 0,
                top: 0,
                height: highlightTop,
                backgroundColor: maskColor,
              },
            ]}
            {...touchProps}
          />
          <View
            style={[
              styles.tutorialBlockingLayer,
              {
                left: 0,
                right: 0,
                top: highlightBottom,
                bottom: 0,
                backgroundColor: maskColor,
              },
            ]}
            {...touchProps}
          />
          <View
            style={[
              styles.tutorialBlockingLayer,
              {
                left: 0,
                top: highlightTop,
                width: highlightLeft,
                height: highlightHeight,
                backgroundColor: maskColor,
              },
            ]}
            {...touchProps}
          />
          <View
            style={[
              styles.tutorialBlockingLayer,
              {
                top: highlightTop,
                left: highlightRight,
                right: 0,
                height: highlightHeight,
                backgroundColor: maskColor,
              },
            ]}
            {...touchProps}
          />
        </>
      );
    };

    return (
      <View
        style={styles.tutorialOverlay}
        pointerEvents="box-none"
        ref={tutorialOverlayRef}
      >
        {renderBlockingAreas()}
          {showHighlight ? (
            <View
              style={[
                styles.tutorialHighlight,
                {
                  width: highlightWidth,
                  height: highlightHeight,
                  left: highlightLeft,
                  top: highlightTop,
                  backgroundColor: highlightBackground,
                },
              ]}
              pointerEvents="none"
            />
          ) : null}
        {showPointer ? (
          <Animated.View
            style={[
              styles.tutorialPointer,
              {
                left: pointerLeft,
                top: pointerTop,
                transform: [{ scale: tutorialFingerScale }],
              },
            ]}
            pointerEvents="none"
          >
            <Text style={styles.tutorialPointerText}>👆</Text>
          </Animated.View>
        ) : null}
        <Pressable style={styles.tutorialExitButton} onPress={finishTutorial}>
          <Text style={styles.tutorialExitText}>{t("tutorial.cta.exit")}</Text>
        </Pressable>
        <View
          style={[
            styles.tutorialCard,
            { width: cardWidth, left: finalCardLeft, top: finalCardTop },
          ]}
          onLayout={(event) => {
            const nextHeight = event.nativeEvent.layout.height;
            if (Math.abs(nextHeight - tutorialCardHeight) > 1) {
              setTutorialCardHeight(nextHeight);
            }
          }}
        >
          <View
            style={[
              styles.tutorialTitleRow,
              showInlineAction && styles.tutorialTitleRowInline,
            ]}
          >
            <Text style={styles.tutorialTitle}>{t(tutorialStep.titleKey)}</Text>
            {showInlineAction ? (
              <Pressable
                style={[
                  styles.tutorialActionButton,
                  styles.tutorialActionPrimary,
                  styles.tutorialInlineActionButton,
                ]}
                onPress={actionHandler}
              >
                <Text style={styles.tutorialActionPrimaryText}>{actionLabel}</Text>
              </Pressable>
            ) : null}
          </View>
          {bodyText ? (
            <Text style={styles.tutorialBody}>{bodyText}</Text>
          ) : null}
          {showFooterAction ? (
            <View style={styles.tutorialActions}>
              <Pressable
                style={[styles.tutorialActionButton, styles.tutorialActionPrimary]}
                onPress={actionHandler}
              >
                <Text style={styles.tutorialActionPrimaryText}>{actionLabel}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  const todayStats = useMemo(() => {
    if (!selectedSport) {
      return { reps: 0, seconds: 0 };
    }
    return getRollingStats(logs, selectedSport.id, selectedSport);
  }, [logs, selectedSport]);

  /*
  const workoutDisplayReps = workoutTrackingMode
    ? workoutSessionCount
    : todayStats.reps;
  */
  const workoutDisplayReps = todayStats.reps;

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

  const showGettingStartedSection = Platform.OS === "android";
  const accessibilityMissing = needsAccessibility !== false;
  const usageAccessMissing = usageAccessGranted !== true;
  const missingPermissions = accessibilityMissing || usageAccessMissing;
  const showPermissionPrompt =
    showGettingStartedSection && missingPermissions;
  const completedGettingStarted =
    !missingPermissions &&
    (permissionsPrompted ||
      usagePermissionsPrompted ||
      accessibilityDisclosureAccepted);

  const prevMissingPermissionsRef = useRef(missingPermissions);
  useEffect(() => {
    if (prevMissingPermissionsRef.current !== missingPermissions) {
      setPermissionsPanelTouched(false);
    }
    prevMissingPermissionsRef.current = missingPermissions;
  }, [missingPermissions]);

  useEffect(() => {
    if (permissionsPanelTouched || !showMotivationBlock) {
      return;
    }
    if (missingPermissions) {
      setPermissionsPanelOpen(true);
      return;
    }
    if (shouldShowMotivationAction) {
      setPermissionsPanelOpen(false);
    }
  }, [
    permissionsPanelTouched,
    showMotivationBlock,
    missingPermissions,
    shouldShowMotivationAction,
  ]);

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
  useEffect(() => {
    if (appSearchInput === appSearch) {
      setAppSearchBusy(false);
      return;
    }
    setAppSearchBusy(true);
    const handle = setTimeout(() => {
      setAppSearch(appSearchInput);
      setAppSearchBusy(false);
    }, 200);
    return () => clearTimeout(handle);
  }, [appSearchInput, appSearch]);

  const appSearchTerm = useMemo(() => appSearch.trim().toLowerCase(), [
    appSearch,
  ]);

  const filteredApps = useMemo(() => {
    if (!appSearchTerm) {
      return installedApps;
    }
    return installedApps.filter((app) => {
      const label = (app.label || "").toLowerCase();
      const pkg = (app.packageName || "").toLowerCase();
      return label.includes(appSearchTerm) || pkg.includes(appSearchTerm);
    });
  }, [installedApps, appSearchTerm]);

  const sortedApps = useMemo(() => {
    const appsToSort = [...filteredApps];
    return appsToSort.sort((a, b) => {
      const aUsage = appUsageMap[a.packageName] || 0;
      const bUsage = appUsageMap[b.packageName] || 0;
      if (bUsage !== aUsage) {
        return bUsage - aUsage;
      }
      return (a.label || "").localeCompare(b.label || "");
    });
  }, [filteredApps, appUsageMap]);

  const controlledApps = settings.controlledApps || [];
  const grayscaleRestrictedApps = !!settings.grayscaleRestrictedApps;

  const renderAppRowItem = useCallback(
    ({ item: app }) => {
      const enabled = controlledApps.includes(app.packageName);
      const usageMinutes = Math.floor(
        (appUsageMap[app.packageName] || 0) / 60000
      );
      const grayscaleActive = grayscaleRestrictedApps && enabled;
      const isToggling = !!appToggleLoading[app.packageName];
      return (
        <Pressable
          style={[
            styles.appRow,
            isToggling && styles.appRowDisabled,
            enabled && styles.appRowActive,
            grayscaleActive && styles.appRowGrayscale,
          ]}
          disabled={appsLoading || isToggling}
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
            {appsUsageLoading ? "..." : `${usageMinutes} min`}
          </Text>
          {isToggling ? (
            <ActivityIndicator
              size="small"
              color={COLORS.accent}
              style={styles.appToggleSpinner}
            />
          ) : (
            <Text
              style={[
                styles.appToggle,
                enabled && styles.appToggleActive,
                grayscaleActive && styles.grayscaleText,
              ]}
            >
              {enabled ? t("label.active") : t("label.off")}
            </Text>
          )}
        </Pressable>
      );
    },
    [
      appsLoading,
      appToggleLoading,
      appsUsageLoading,
      appUsageMap,
      controlledApps,
      grayscaleRestrictedApps,
      toggleControlledApp,
      t,
    ]
  );

  const renderAppListHeader = useCallback(
    () => (
      <View style={styles.appsHeaderWrap}>
        <View style={styles.headerRow}>
          <Pressable
            style={styles.backButton}
            ref={tutorialAppsBackRef}
            onPress={() => {
              setIsAppsSettingsOpen(false);
              maybeAdvanceTutorial("backFromApps");
            }}
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
              value={appSearchInput}
              onChangeText={setAppSearchInput}
              placeholder={t("label.searchApps")}
              placeholderTextColor="#7a7a7a"
            />
            {appsLoading ? (
              <View style={styles.appsStatusRow}>
                <ActivityIndicator size="small" color={COLORS.accent} />
                <Text style={styles.appsStatusText}>
                  {t("label.loadApps")}
                </Text>
              </View>
            ) : null}
            {appSearchBusy ? (
              <View style={styles.appsStatusRow}>
                <ActivityIndicator size="small" color={COLORS.accent} />
                <Text style={styles.appsStatusText}>
                  {t("label.searchApps")}
                </Text>
              </View>
            ) : null}
          </>
        )}
      </View>
    ),
    [
      appSearchInput,
      appSearchBusy,
      appsLoading,
      maybeAdvanceTutorial,
      setIsAppsSettingsOpen,
      setAppSearchInput,
      t,
    ]
  );

  const renderAppListEmpty = useCallback(() => {
    if (Platform.OS !== "android" || appsLoading || sortedApps.length > 0) {
      return null;
    }
    return <Text style={styles.helperText}>{t("label.noApps")}</Text>;
  }, [appsLoading, sortedApps.length, t]);

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
      // setWorkoutSessionCount(0);
      setIsFormulaModalOpen(false);
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
      const dayStats = getRollingStats(logs, sport.id, sport);
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
  const renderAppContent = () => {
    if (overallStatsOpen) {
    const allKeys = Object.values(stats || {}).reduce((acc, sportStats) => {
      Object.keys(sportStats || {}).forEach((key) => acc.add(key));
      return acc;
    }, new Set());
    const weekdayLabels =
      WEEKDAY_LABELS_BY_LANG[language] || DEFAULT_WEEKDAY_LABELS;
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
          const groups = groupEntriesByWindow(dayLogs, sport);
          return groups.map((group, index) => ({
            key: `${sport.id}-${group.startTs}-${index}`,
            sport,
            group,
          }));
        })
        .sort((a, b) => (b.group.startTs || 0) - (a.group.startTs || 0));
      return (
    <SafeAreaView style={styles.container}>
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
        >
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
                const hasKm = sport.type === "time" && (group.km || 0) > 0;
                const kmSeconds = group.kmSeconds || group.seconds || 0;
                const valueText =
                  sport.type === "reps"
                    ? `${group.reps} ${repsShort}`
                    : hasKm
                    ? `${formatSeconds(group.seconds)} · ${formatDistanceValue(
                        group.km
                      )} ${t("label.kmUnit")} · ${formatKmPerHour(
                        group.km,
                        kmSeconds
                      )} ${t("label.kmhUnit")}`
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
        <ScrollView ref={scrollViewRef} contentContainerStyle={styles.scrollContent}>
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
          <View style={styles.infoCard} ref={tutorialStatsSummaryRef}>
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
    const sportStats = stats[statsSport.id] || {};
    const sportKeys = new Set(Object.keys(sportStats || {}));
    const months = getMonthsForCalendar(sportKeys);
    const weekdayLabels =
      WEEKDAY_LABELS_BY_LANG[language] || DEFAULT_WEEKDAY_LABELS;
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
      const groups = groupEntriesByWindow(dayLogs, statsSport).sort(
        (a, b) => (b.startTs || 0) - (a.startTs || 0)
      );
      const sortedEntries = [...dayLogs].sort(
        (a, b) => (b.ts || 0) - (a.ts || 0)
      );
      return (
        <SafeAreaView style={styles.container}>
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.scrollContent}
          >
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
                const hasKm =
                  statsSport.type === "time" && (group.km || 0) > 0;
                const kmSeconds = group.kmSeconds || group.seconds || 0;
                const valueText =
                  statsSport.type === "reps"
                    ? `${group.reps} ${repsShort}`
                    : hasKm
                    ? `${formatSeconds(group.seconds)} · ${formatDistanceValue(
                        group.km
                      )} ${t("label.kmUnit")} · ${formatKmPerHour(
                        group.km,
                        kmSeconds
                      )} ${t("label.kmhUnit")}`
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
                  const hasKm = statsSport.type === "time" && (entry.km || 0) > 0;
                  const baseValue =
                    statsSport.type === "reps"
                      ? `${entry.reps || 0} ${repsShort}`
                      : hasKm
                      ? `${formatSeconds(entry.seconds || 0)} · ${formatDistanceValue(
                          entry.km || 0
                        )} ${t("label.kmUnit")} · ${formatKmPerHour(
                          entry.km || 0,
                          entry.seconds || 0
                        )} ${t("label.kmhUnit")}`
                      : formatSeconds(entry.seconds || 0);
                  const earnedSeconds = resolveEntryScreenSeconds(statsSport, entry);
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
        <ScrollView
          ref={(node) => {
            scrollViewRef.current = node;
            screenTimeDetailsScrollRef.current = node;
          }}
          contentContainerStyle={styles.scrollContent}
          onScroll={handleScreenTimeDetailsScroll}
          scrollEventThrottle={16}
        >
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
                            if (statsEditMode) {
                              if (hasValue) {
                                openEditEntry(key);
                              }
                              return;
                            }
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
                            <View style={styles.calendarEditOverlay} pointerEvents="none">
                              <Text style={styles.calendarEditMinus}>-</Text>
                            </View>
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
    const userFactor = difficultyLevelForSport(selectedSport); // Screen Time Faktor (userFactor)
    // Admin factor is displayed as "Fix Factor" in the UI.
    const adminFactor = isWeightMode
      ? ADMIN_FACTOR_WEIGHTED
      : isReps
      ? ADMIN_FACTOR_REPS
      : ADMIN_FACTOR_TIME;
    const formulaBaseLabel = isWeightMode
      ? `${t("label.weightUnit")} × ${repsShort}`
      : isReps
      ? repsShort
      : t("label.formulaTimeUnit");
    const combinedFactor = adminFactor * userFactor;
    const formulaShort = `${formulaBaseLabel} × ${formatFactorValue(
      adminFactor
    )} × ${formatFactorValue(userFactor)}`;
    const formulaBadgeValue = `${formulaBaseLabel} × ${formatFactorValue(
      combinedFactor
    )}`;
    const userFactorDeltaPercent = Math.round((userFactor - 1) * 100);
    const userFactorPercentText = `${userFactorDeltaPercent > 0 ? "+" : ""}${userFactorDeltaPercent}%`;
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
      const loggedEntry = addLogEntry(selectedSport, entry);
      const addedSeconds =
        loggedEntry?.screenSeconds ??
        screenSecondsForEntry(selectedSport, entry);
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
            <View style={styles.iconButtonContent}>
              <ActionGlyph type="stats" color={COLORS.text} />
              <Text style={styles.iconButtonText}>{t("menu.stats")}</Text>
            </View>
          </Pressable>
        </View>
        <KeyboardAvoidingView
          style={styles.flexGrow}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
        >
          <ScrollView
            ref={sportDetailScrollRef}
            contentContainerStyle={styles.sportDetailScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable
              style={styles.statsCard}
              onPress={() => setStatsSportId(selectedSport.id)}
            >
              <View style={styles.counterRow}>
                <View style={[styles.counterBlock, styles.statsCounterBlock]}>
                  <Text style={[styles.counterLabel, styles.statsCounterLabel]}>
                    {t("label.today")}
                  </Text>
                  <Text
                    style={[
                      styles.counterValueSmall,
                      styles.statsCounterValueSmall,
                    ]}
                  >
                    {selectedSport.type === "reps"
                      ? `${todayStats.reps}`
                      : formatSeconds(todayStats.seconds || 0)}
                  </Text>
                  <Text style={[styles.counterUnit, styles.statsCounterUnit]}>
                    {selectedSport.type === "reps"
                      ? repsShort
                      : t("label.timeUnit")}
                  </Text>
                </View>
              </View>
            </Pressable>
            <Pressable
              style={styles.editSportButton}
              onPress={() => openSportModal(selectedSport)}
            >
              <View style={styles.editSportButtonContent}>
                <ActionGlyph type="edit" color={COLORS.text} />
                <Text style={styles.editSportButtonText}>
                  {t("label.editSport")}
                </Text>
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
                  styles.voiceButton,
                  voiceEnabled && styles.voiceButtonActive,
                ]}
                onPress={toggleVoice}
              >
                <View style={styles.voiceButtonContent}>
                  <Text style={styles.voiceButtonIcon}>{micIcon}</Text>
                  <Text
                    style={[
                      styles.voiceButtonLabel,
                      voiceEnabled && styles.voiceButtonLabelActive,
                    ]}
                  >
                    {voiceEnabled
                      ? t("label.voiceListening")
                      : t("label.voiceIdle")}
                  </Text>
                </View>
                {voiceStatusText ? (
                  <Text
                    style={[
                      styles.voiceButtonStatus,
                      voiceError && styles.voiceButtonStatusError,
                    ]}
                  >
                    {voiceStatusText}
                  </Text>
                ) : null}
              </Pressable>
              <Text style={styles.voiceHint}>{t("label.voiceHint")}</Text>
            </View>
              <View style={styles.manualEntryContainer}>
                <Text style={styles.manualEntryLabel}>
                  {t("label.manualRepsEntryTitle")}
                </Text>
                <TextInput
                  style={[styles.input, styles.manualRepsInput]}
                  ref={manualRepsInputRef}
                  value={manualRepsInput}
                  onChangeText={setManualRepsInput}
                  onFocus={() => scrollToInput(manualRepsInputRef)}
                  placeholder={t("label.manualRepsEntryPlaceholder")}
                  placeholderTextColor="#7a7a7a"
                  keyboardType="number-pad"
                />
              <Pressable
                style={[
                  styles.primaryButton,
                  styles.detailPrimaryButton,
                  styles.manualEntryButton,
                ]}
                onPress={handleManualRepsLog}
              >
                <Text
                  style={[
                    styles.primaryButtonText,
                    styles.detailPrimaryButtonText,
                  ]}
                >
                  {t("label.manualRepsEntryButton")}
                </Text>
              </Pressable>
              <Text style={styles.manualEntryHelper}>
                {t("label.manualRepsEntryHint")}
              </Text>
            </View>
              </Pressable>
            ) : isWeightMode ? (
              <View style={styles.weightEntryArea} ref={tutorialTrackingAreaRef}>
            {/*
            <View style={styles.weightSummaryRow}>
              <View style={styles.weightSummaryColumn}>
                <Text style={styles.weightSummaryLabel}>{t("label.weightLastSet")}</Text>
                <Text style={styles.weightSummaryValue}>
                  {lastWorkoutWeightEntry
                    ? `${formatWeightValue(lastWorkoutWeightEntry.weight)} × ${lastWorkoutWeightEntry.reps}`
                    : t("label.weightEntryPreview")}
                </Text>
              </View>
              <View style={styles.weightSummaryColumn}>
                <Text style={styles.weightSummaryLabel}>{t("label.weightWorkoutTotal")}</Text>
                <Text style={styles.weightSummaryValue}>
                  {weightWorkoutTotal > 0
                    ? `${formatWeightValue(weightWorkoutTotal)} ${t("label.weightUnit")}`
                    : "-"}
                </Text>
              </View>
            </View>
            */}
            <View style={styles.weightFieldsRow}>
              <View style={styles.weightField}>
                <Text style={styles.weightFieldLabel}>
                  {t("label.weightEntryWeight")}
                </Text>
                <TextInput
                  style={[styles.input, styles.weightFieldInput]}
                  ref={weightEntryWeightRef}
                  value={weightEntryWeight}
                  onChangeText={setWeightEntryWeight}
                  onFocus={() => scrollToInput(weightEntryWeightRef)}
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
                  ref={weightEntryRepsRef}
                  value={weightEntryReps}
                  onChangeText={setWeightEntryReps}
                  onFocus={() => scrollToInput(weightEntryRepsRef)}
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
              style={[
                styles.primaryButton,
                styles.detailPrimaryButton,
                styles.fullWidthButton,
              ]}
              onPress={logWeightSet}
            >
              <Text
                style={[
                  styles.primaryButtonText,
                  styles.detailPrimaryButtonText,
                ]}
              >
                {t("label.weightEntryButton")}
              </Text>
            </Pressable>
            {/*
            {recentWeightEntries.length > 0 ? (
              <View style={styles.weightHistoryCard}>
                <Text style={styles.sectionTitle}>{t("label.weightHistory")}</Text>
                {recentWeightEntries.map((entry, index) => (
                  <View
                    key={entry.id || entry.ts}
                    style={[
                      styles.weightHistoryRow,
                      index === recentWeightEntries.length - 1 &&
                        styles.weightHistoryRowLast,
                    ]}
                  >
                    <Text style={styles.weightHistoryTime}>
                      {formatTime(entry.ts || Date.now())}
                    </Text>
                    <Text style={styles.weightHistorySet}>
                      {formatWeightValue(entry.weight)} × {entry.reps}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            */}
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
                <Pressable
                  style={[styles.primaryButton, styles.detailPrimaryButton]}
                  onPress={handleStart}
                >
                  <Text
                    style={[
                      styles.primaryButtonText,
                      styles.detailPrimaryButtonText,
                    ]}
                  >
                    {t("label.start")}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.dangerButton, styles.detailDangerButton]}
                  onPress={handleStop}
                >
                  <Text
                    style={[
                      styles.primaryButtonText,
                      styles.detailPrimaryButtonText,
                    ]}
                  >
                    {t("label.stop")}
                  </Text>
                </Pressable>
              )}
            </View>
            {running ? (
              <Text style={[styles.helperText, styles.trackingHelperText]}>
                {t("label.runningSession")}: {formatSeconds(sessionSeconds)}
              </Text>
            ) : null}
            <View style={styles.manualEntryContainer}>
              <Text style={styles.manualEntryLabel}>
                {t("label.manualTimeEntryTitle")}
              </Text>
                <View style={styles.manualTimeInputsRow}>
                  <View style={styles.manualTimeInputWrap}>
                    <Text style={styles.manualTimeInputLabel}>
                      {t("label.manualTimeEntryMinutes")}
                    </Text>
                    <TextInput
                      style={[styles.input, styles.manualTimeInput]}
                      ref={manualTimeMinutesRef}
                      value={manualTimeMinutes}
                      onChangeText={setManualTimeMinutes}
                      onFocus={() => scrollToInput(manualTimeMinutesRef)}
                      placeholder={t("label.manualTimeEntryMinutes")}
                      placeholderTextColor="#7a7a7a"
                      keyboardType="number-pad"
                      maxLength={3}
                    />
                  </View>
                  <View style={styles.manualTimeInputWrap}>
                    <Text style={styles.manualTimeInputLabel}>
                      {t("label.manualTimeEntrySeconds")}
                    </Text>
                    <TextInput
                      style={[styles.input, styles.manualTimeInput]}
                      ref={manualTimeSecondsRef}
                      value={manualTimeSeconds}
                      onChangeText={setManualTimeSeconds}
                      onFocus={() => scrollToInput(manualTimeSecondsRef)}
                      placeholder={t("label.manualTimeEntrySeconds")}
                      placeholderTextColor="#7a7a7a"
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                  </View>
                </View>
                <View style={styles.manualTimeInputsRow}>
                  <View style={styles.manualTimeInputWrap}>
                    <Text style={styles.manualTimeInputLabel}>
                      {t("label.distanceKm")}
                    </Text>
                    <TextInput
                      style={[styles.input, styles.manualTimeInput]}
                      ref={manualTimeKmRef}
                      value={manualTimeKm}
                      onChangeText={setManualTimeKm}
                      onFocus={() => scrollToInput(manualTimeKmRef)}
                      placeholder="5.0"
                      placeholderTextColor="#7a7a7a"
                      keyboardType="decimal-pad"
                      maxLength={6}
                    />
                  </View>
                </View>
              <Text style={styles.manualEntryHelper}>
                {t("label.distanceKmHint")}
              </Text>
              <Pressable
                style={[
                  styles.primaryButton,
                  styles.detailPrimaryButton,
                  styles.manualEntryButton,
                ]}
                onPress={handleManualTimeLog}
              >
                <Text
                  style={[
                    styles.primaryButtonText,
                    styles.detailPrimaryButtonText,
                  ]}
                >
                  {t("label.manualTimeEntryButton")}
                </Text>
              </Pressable>
              <Text style={styles.manualEntryHelper}>
                {t("label.manualTimeEntryHint")}
              </Text>
            </View>
              </View>
            )}
            <View style={styles.formulaBadgeWrap} pointerEvents="box-none">
              <Pressable
                style={styles.formulaBadge}
                onPress={() => setIsFormulaModalOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={t("label.formulaTitle")}
              >
                <View style={styles.formulaBadgeHeader}>
                  <Text style={styles.formulaBadgeTitle}>
                    {t("label.formulaBadge")}
                  </Text>
                  <Text style={styles.formulaBadgeChevron}>›</Text>
                </View>
                <Text style={styles.formulaBadgeValue}>{formulaBadgeValue}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        <Modal
          visible={isFormulaModalOpen}
          animationType="slide"
          transparent
          onRequestClose={() => setIsFormulaModalOpen(false)}
        >
          <View style={styles.formulaModalOverlay}>
            <View style={styles.formulaModalCard}>
              <View style={styles.formulaModalHeader}>
                <Text style={styles.sectionTitle}>
                  {t("label.formulaTitle")}
                </Text>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => setIsFormulaModalOpen(false)}
                >
                  <Text style={styles.secondaryButtonText}>
                    {t("label.close")}
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.formulaDetailText}>
                {t("label.formulaIntro")}
              </Text>
              <Text style={styles.formulaEquation}>
                {t("label.screenTime")}: {formulaShort}
              </Text>
              <View style={styles.formulaFactorsRow}>
                <View style={styles.formulaFactorCard}>
                  <Text style={styles.formulaFactorLabel}>
                    {t("label.formulaAdminFactor")}
                  </Text>
                  <Text style={styles.formulaFactorValue}>
                    {formatFactorValue(adminFactor)}
                  </Text>
                </View>
                <View style={styles.formulaFactorCard}>
                  <Text style={styles.formulaFactorLabel}>
                    {t("label.formulaUserFactor")}
                  </Text>
                  <Text style={styles.formulaFactorValue}>
                    {formatFactorValue(userFactor)}
                  </Text>
                </View>
              </View>
              <Text style={styles.formulaDetailText}>
                {t("label.formulaAdminInfo")}
              </Text>
              <Text style={styles.formulaDetailText}>
                {t("label.formulaUserEffect", {
                  percent: userFactorPercentText,
                })}
              </Text>
              <Pressable
                style={[styles.primaryButton, styles.fullWidthButton]}
                onPress={() => {
                  setIsFormulaModalOpen(false);
                  openSportModal(selectedSport);
                }}
              >
                <Text style={styles.primaryButtonText}>
                  {t("label.formulaEditButton")}
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  if (isScreenTimeDetailsOpen) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.headerRow}>
            <View style={styles.workoutHeaderLeft}>
              <Pressable style={styles.backButton} onPress={openHome}>
                <Text style={styles.backText}>{t("label.back")}</Text>
              </Pressable>
              <View style={styles.headerTitleBlock}>
                <View style={styles.titleWrap}>
                  <Text style={styles.title}>{t("app.title")}</Text>
                  <View style={styles.titleDecoration} />
                </View>
                <Text style={styles.subtitle}>
                  {t("label.screenTimeDetailsTitle")}
                </Text>
              </View>
            </View>
            {renderTutorialHeaderButton()}
          </View>
          {renderMainNav("home")}
          <Text style={styles.sectionTitle}>{t("label.breakdownSummary")}</Text>
          <View style={styles.infoCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t("label.screenTime")}</Text>
              <Text style={styles.detailValue}>
                {formatScreenTime(rollingEarnedSeconds)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t("label.used")}</Text>
              <Text style={styles.detailValue}>
                {formatScreenTime(usageState.usedSeconds || 0)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t("label.remainingCurrent")}</Text>
              <Text style={styles.detailValue}>
                {formatScreenTime(usageState.remainingSeconds || 0)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t("label.carryover")}</Text>
              <Text style={styles.detailValue}>
                {formatScreenTime(usageState.carryoverSeconds || 0)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t("label.remaining")}</Text>
              <Text style={[styles.detailValue, styles.detailValueStrong]}>
                {formatScreenTime(totalRemainingSeconds)}
              </Text>
            </View>
          </View>
          <Text style={styles.sectionTitle}>
            {t("label.remainingBySport")}
          </Text>
          <View style={styles.infoCard}>
            {remainingBySportList.length === 0 ? (
              <Text style={styles.helperText}>
                {t("label.noRemainingBySport")}
              </Text>
            ) : (
              remainingBySportList.map((entry) => (
                <View key={entry.sportId} style={styles.detailListItem}>
                  <View style={styles.detailListLeft}>
                    <Text style={styles.detailListIcon}>{entry.icon}</Text>
                    <Text style={styles.detailListLabel}>{entry.label}</Text>
                  </View>
                  <Text style={styles.detailListValue}>
                    {formatScreenTime(entry.seconds)}
                  </Text>
                </View>
              ))
            )}
          </View>
          <Text style={styles.sectionTitle}>
            {t("label.screenTimeEntriesCurrent")}
          </Text>
          <View style={styles.infoCard}>
            {currentScreenTimeEntries.length === 0 ? (
              <Text style={styles.helperText}>
                {t("label.noScreenTimeEntriesCurrent")}
              </Text>
            ) : (
              currentScreenTimeEntries.map((entry) => (
                <View key={entry.key} style={styles.detailEntryRow}>
                  <View style={styles.detailEntryLeft}>
                    <Text style={styles.detailListIcon}>{entry.icon}</Text>
                    <View>
                      <Text style={styles.detailListLabel}>{entry.label}</Text>
                      <Text style={styles.detailEntryMeta}>
                        {formatDateLabel(entry.dayKey)} ·{" "}
                        {formatTime(entry.createdAt || Date.now())}
                      </Text>
                      {entry.reps > 0 ? (
                        <Text style={styles.detailEntryMeta}>
                          {t("label.reps")}: {entry.reps}
                        </Text>
                      ) : null}
                      {entry.weight > 0 ? (
                        <Text style={styles.detailEntryMeta}>
                          {t("label.weightEntryWeight")}:{" "}
                          {formatWeightValue(entry.weight)}
                        </Text>
                      ) : null}
                      {entry.seconds > 0 ? (
                        <Text style={styles.detailEntryMeta}>
                          {t("label.timeUnit")}: {formatSeconds(entry.seconds)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.detailEntryRight}>
                    <Text style={styles.detailEntryValue}>
                      {formatScreenTime(entry.originalSeconds)}
                    </Text>
                    <Text style={styles.detailEntrySubValue}>
                      {t("label.screenTime")}
                    </Text>
                    <Text style={styles.detailEntrySubValue}>
                      {t("label.remaining")}:{" "}
                      {formatScreenTime(entry.remainingSeconds)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
          <Text style={styles.sectionTitle}>
            {t("label.screenTimeEntriesCarryover")}
          </Text>
          <View style={styles.infoCard}>
            <Text style={styles.helperText}>
              {t("label.carryoverEntriesHint")}
            </Text>
            {carryoverScreenTimeEntries.length === 0 ? (
              <Text style={styles.helperText}>
                {t("label.noScreenTimeEntriesCarryover")}
              </Text>
            ) : (
              carryoverScreenTimeEntries.map((entry) => (
                <View key={entry.key} style={styles.detailEntryRow}>
                  <View style={styles.detailEntryLeft}>
                    <Text style={styles.detailListIcon}>{entry.icon}</Text>
                    <View>
                      <Text style={styles.detailListLabel}>{entry.label}</Text>
                      <Text style={styles.detailEntryMeta}>
                        {formatDateLabel(entry.dayKey)} ·{" "}
                        {formatTime(entry.createdAt || Date.now())}
                      </Text>
                      {entry.reps > 0 ? (
                        <Text style={styles.detailEntryMeta}>
                          {t("label.reps")}: {entry.reps}
                        </Text>
                      ) : null}
                      {entry.weight > 0 ? (
                        <Text style={styles.detailEntryMeta}>
                          {t("label.weightEntryWeight")}:{" "}
                          {formatWeightValue(entry.weight)}
                        </Text>
                      ) : null}
                      {entry.seconds > 0 ? (
                        <Text style={styles.detailEntryMeta}>
                          {t("label.timeUnit")}: {formatSeconds(entry.seconds)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.detailEntryRight}>
                    <Text style={styles.detailEntryValue}>
                      {formatScreenTime(entry.originalSeconds)}
                    </Text>
                    <Text style={styles.detailEntrySubValue}>
                      {t("label.screenTime")}
                    </Text>
                    <Text style={styles.detailEntrySubValue}>
                      {t("label.remaining")}:{" "}
                      {formatScreenTime(entry.remainingSeconds)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
          <Text style={styles.sectionTitle}>{t("label.earnedBySport")}</Text>
          <View style={styles.infoCard}>
            {earnedBySportList.length === 0 ? (
              <Text style={styles.helperText}>
                {t("label.noEarnedBySport")}
              </Text>
            ) : (
              earnedBySportList.map((entry) => (
                <View key={entry.sportId} style={styles.detailListItem}>
                  <View style={styles.detailListLeft}>
                    <Text style={styles.detailListIcon}>{entry.icon}</Text>
                    <Text style={styles.detailListLabel}>{entry.label}</Text>
                  </View>
                  <Text style={styles.detailListValue}>
                    {formatScreenTime(entry.totalSeconds)}
                  </Text>
                </View>
              ))
            )}
          </View>
          <Text style={styles.sectionTitle}>{t("label.usageBreakdown")}</Text>
          <View style={styles.infoCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t("label.used")}</Text>
              <Text style={styles.detailValue}>
                {formatScreenTime(usageState.usedSeconds || 0)}
              </Text>
            </View>
            {usageByAppList.length === 0 ? (
              <Text style={styles.helperText}>{t("label.noUsageData")}</Text>
            ) : (
              usageByAppList.map((entry) => (
                <View key={entry.key} style={styles.detailListItem}>
                  <Text style={styles.detailListLabel}>{entry.label}</Text>
                  <Text style={styles.detailListValue}>
                    {formatScreenTime(entry.seconds)}
                  </Text>
                </View>
              ))
            )}
          </View>
          <Text style={styles.sectionTitle}>{t("label.carryover")}</Text>
          <View style={styles.infoCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t("label.carryover")}</Text>
              <Text style={styles.detailValue}>
                {formatScreenTime(usageState.carryoverSeconds || 0)}
              </Text>
            </View>
            <Text style={styles.helperText}>{t("label.carryoverHint")}</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /*
  if (isWorkoutOpen) {
    const recentWorkouts = [...workoutHistory].sort(
      (a, b) => (b.startTs || 0) - (a.startTs || 0)
    );
    const workoutDetail = workoutHistory.find(
      (entry) => entry.id === workoutDetailId
    );
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.headerRow}>
            <View style={styles.workoutHeaderLeft}>
              <Pressable style={styles.backButton} onPress={openHome}>
                <Text style={styles.backText}>{t("label.back")}</Text>
              </Pressable>
              <View style={styles.headerTitleBlock}>
                <View style={styles.titleWrap}>
                  <Text style={styles.title}>{t("app.title")}</Text>
                  <View style={styles.titleDecoration} />
                </View>
                <Text style={styles.subtitle}>{t("menu.workout")}</Text>
              </View>
            </View>
            {renderTutorialHeaderButton()}
          </View>
          {renderMainNav("home")}
          {renderWorkoutBanner()}
          <View
            style={[styles.infoCard, styles.workoutTimerCard]}
            ref={tutorialWorkoutTimerRef}
          >
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
                  style={[
                    styles.workoutListItem,
                    !workoutRunning && styles.workoutListItemDisabled,
                  ]}
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
            <View style={styles.workoutHistoryList}>
              {recentWorkouts.map((session) => (
                <View key={session.id} style={styles.workoutHistoryListItem}>
                  <View style={styles.workoutHistoryRowWrapper}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.workoutHistoryRow,
                        pressed && styles.workoutHistoryRowPressed,
                      ]}
                      onPress={() => openWorkoutDetail(session.id)}
                    >
                      <View style={styles.workoutHistoryRowMain}>
                        <View>
                          <Text style={styles.workoutHistoryRowTitle}>
                            {formatDateLabel(
                              dateKeyFromDate(
                                new Date(session.startTs || Date.now())
                              )
                            )}
                          </Text>
                          <Text style={styles.workoutHistoryRowMeta}>
                            {formatTime(session.startTs || Date.now())} ·{" "}
                            {formatSeconds(session.duration || 0)}
                          </Text>
                        </View>
                        <Text style={styles.workoutHistoryRowArrow}>›</Text>
                      </View>
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
                  <Text style={styles.workoutHistoryRowStats}>
                    {t("label.screenTime")}:{" "}
                    {formatScreenTime(session.screenSeconds || 0)}
                  </Text>
                  {isWorkoutRecent(session) ? (
                    <Pressable
                      style={[
                        styles.workoutHistoryContinueButton,
                        workoutRunning &&
                          styles.workoutHistoryContinueButtonDisabled,
                      ]}
                      onPress={() => handleContinueWorkout(session)}
                      disabled={workoutRunning}
                    >
                      <Text style={styles.workoutHistoryContinueButtonText}>
                        {t("label.continueWorkout")}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          )}
          <Modal
            visible={isWorkoutDetailOpen && Boolean(workoutDetail)}
            animationType="slide"
            transparent
            onRequestClose={closeWorkoutDetail}
          >
            <View style={styles.workoutDetailModalOverlay}>
              <View style={styles.workoutDetailModalCard}>
                <View style={styles.workoutDetailModalHeader}>
                  <Text style={styles.sectionTitle}>
                    {t("label.workoutDetail")}
                  </Text>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={closeWorkoutDetail}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {t("label.close")}
                    </Text>
                  </Pressable>
                </View>
                <Text style={styles.workoutDetailText}>
                  {formatTime(workoutDetail?.startTs || Date.now())} ·{" "}
                  {t("label.workoutDuration")}:{" "}
                  {formatSeconds(workoutDetail?.duration || 0)}
                </Text>
                <Text style={styles.workoutDetailText}>
                  {t("label.screenTime")}:{" "}
                  {formatScreenTime(workoutDetail?.screenSeconds || 0)}
                </Text>
                {(workoutDetail?.exercises || []).length === 0 ? (
                  <Text style={styles.helperText}>{t("label.noEntries")}</Text>
                ) : (
                  (workoutDetail?.exercises || []).map((entry) => {
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
              </View>
            </View>
          </Modal>
        </ScrollView>
      </SafeAreaView>
    );
  }
  */

  if (isAppsSettingsOpen) {
    if (!appsInitialLoadComplete) {
      return (
        <SafeAreaView style={styles.container}>
          {renderAppListHeader()}
          <View style={styles.appsInitialLoader}>
            <ActivityIndicator size="large" color={COLORS.accent} />
            <Text style={styles.appsInitialLoaderText}>
              {t("label.loadApps")}
            </Text>
          </View>
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={styles.container}>
        {renderAppListHeader()}
        <FlatList
          ref={(node) => {
            scrollViewRef.current = node;
            tutorialAppsScreenRef.current = node;
          }}
          contentContainerStyle={styles.scrollContent}
          data={sortedApps}
          keyExtractor={(app) => app.packageName}
          renderItem={renderAppRowItem}
          ListEmptyComponent={renderAppListEmpty}
          extraData={grayscaleRestrictedApps}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
          windowSize={6}
        />
        {appsLoading ? (
          <View style={styles.appsLoadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color={COLORS.accent} />
            <Text style={styles.appsLoadingOverlayText}>
              {t("label.loadApps")}
            </Text>
          </View>
        ) : null}
      </SafeAreaView>
    );
  }

  if (isSettingsOpen) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
        >
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
              style={[styles.secondaryButton, styles.widgetButton]}
              onPress={() =>
                requestWidgetPin("overall", t("label.todayScreenTime"))
              }
            >
              <View style={styles.widgetButtonContent}>
                <WidgetGlyph color={COLORS.text} />
                <Text
                  style={[styles.secondaryButtonText, styles.widgetButtonText]}
                >
                  {t("label.widgetOverall")}
                </Text>
              </View>
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
              {accessibilityMissing
                ? t("label.accessibilityMissing")
                : t("label.accessibilityActive")}
            </Text>
            <Text style={styles.helperText}>
              {t("label.usageAccessTitle")}:{" "}
              {usageAccessMissing
                ? t("label.usageAccessMissing")
                : t("label.usageAccessActive")}
            </Text>
            {accessibilityMissing ? (
              <Pressable
                style={styles.primaryButton}
                onPress={requestAccessibilityAccess}
              >
                <Text style={styles.primaryButtonText}>
                  {t("label.permissionNeeded")}
                </Text>
              </Pressable>
            ) : null}
            {usageAccessMissing ? (
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
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
        <ScrollView
          ref={(node) => {
            scrollViewRef.current = node;
            homeScrollRef.current = node;
          }}
          contentContainerStyle={styles.scrollContent}
          onScroll={handleHomeScroll}
          scrollEventThrottle={16}
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
        {/* {renderWorkoutBanner()} */}
        {showMotivationBlock ? (
          <View
            style={[
              styles.permissionCardLarge,
              !permissionsPanelOpen && styles.permissionCardCollapsed,
            ]}
          >
              <Pressable
                style={styles.permissionHeaderRow}
                onPress={() => {
                  setPermissionsPanelTouched(true);
                  setPermissionsPanelOpen((prev) => !prev);
                }}
              >
              <View>
                {missingPermissions ? (
                  <>
                    <Text style={styles.permissionTitle}>
                      {t("label.gettingStarted")}
                    </Text>
                    <Text style={styles.permissionSubtitle}>
                      {t("label.permissionsNeeded")}
                    </Text>
                    <Text style={styles.permissionHint}>
                      {t("label.permissionsHint")}
                    </Text>
                  </>
                ) : permissionsPanelOpen ? (
                  <>
                    <Text style={styles.motivationQuoteTitle}>
                      {activeQuoteTitle}
                    </Text>
                    <Text style={styles.motivationQuoteBody}>
                      {activeQuoteBody}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.permissionCollapsedText}>
                    {t("label.motivationCollapsedHint")}
                  </Text>
                )}
              </View>
              <Text style={styles.permissionToggle}>
                {permissionsPanelOpen ? "-" : "+"}
              </Text>
            </Pressable>
            {missingPermissions ? (
              <View style={styles.permissionReminder}>
                <Text style={styles.permissionReminderText}>
                  {t("label.permissionsReminder")}
                </Text>
              </View>
            ) : null}
            {permissionsPanelOpen &&
              (missingPermissions || shouldShowMotivationAction) && (
                <View style={styles.permissionList}>
                  {missingPermissions ? (
                    <>
                      <View
                        style={[
                          styles.permissionItem,
                          !accessibilityMissing && styles.permissionItemGranted,
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
                        {!accessibilityMissing ? null : (
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
                          !usageAccessMissing && styles.permissionItemGranted,
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
                        {usageAccessMissing ? (
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
                        ) : null}
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={styles.motivationCardTitle}>
                        {activeActionTitle}
                      </Text>
                      <Text style={styles.motivationCardBody}>
                        {activeActionBody}
                      </Text>
                      <Pressable
                        style={[
                          styles.motivationActionButton,
                          activeAction?.disabled &&
                            styles.motivationActionButtonDisabled,
                        ]}
                        onPress={() => handleMotivationAction(activeAction)}
                        disabled={activeAction?.disabled}
                      >
                        <Text style={styles.motivationActionText}>
                          {activeActionLabel}
                        </Text>
                      </Pressable>
                    </>
                  )}
                </View>
              )}
          </View>
        ) : null}
        {/*
        <View style={styles.workoutStartRow}>
          <Pressable
            ref={tutorialWorkoutStartRef}
            style={[styles.primaryButton, styles.fullWidthButton]}
            onPress={openWorkout}
          >
            <Text style={styles.primaryButtonText}>
              {t("label.startWorkout")}
            </Text>
          </Pressable>
        </View>
        */}
        <TextInput
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
          placeholder={t("label.searchSports")}
          placeholderTextColor="#7a7a7a"
          value={sportSearch}
          onChangeText={setSportSearch}
          clearButtonMode="while-editing"
        />
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
        <View style={styles.sortRow}>
          <Pressable
            style={[
              styles.sortButton,
              sportSortMode === "alpha" && styles.sortButtonActive,
            ]}
            onPress={() => updateSportSortMode("alpha")}
          >
            <Text
              style={[
                styles.sortButtonText,
                sportSortMode === "alpha" && styles.sortButtonTextActive,
              ]}
            >
              {t("label.sortAlpha")}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.sortButton,
              sportSortMode === "recent" && styles.sortButtonActive,
            ]}
            onPress={() => updateSportSortMode("recent")}
          >
            <Text
              style={[
                styles.sortButtonText,
                sportSortMode === "recent" && styles.sortButtonTextActive,
              ]}
            >
              {t("label.sortRecent")}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.sortButton,
              sportSortMode === "manual" && styles.sortButtonActive,
            ]}
            onPress={() => updateSportSortMode("manual")}
          >
            <Text
              style={[
                styles.sortButtonText,
                sportSortMode === "manual" && styles.sortButtonTextActive,
              ]}
            >
              {t("label.sortManual")}
            </Text>
          </Pressable>
        </View>
        {activeSports.length === 0 ? (
          <Text style={styles.helperText}>{t("label.noSports")}</Text>
        ) : null}
        {activeSports.length > 0 && filteredActiveSports.length === 0 ? (
          <Text style={styles.helperText}>{t("label.noSportsMatch")}</Text>
        ) : null}
        <View style={styles.sportsGrid}>
          {filteredActiveSports.map((sport) => {
            const daily = getRollingStats(logs, sport.id, sport);
            const sportLabel = getSportLabel(sport);
            const sportAccentColor = getSportAccentColor(sport.id);
            return (
              <View
                key={sport.id}
                style={[
                  styles.sportCard,
                  { width: cardWidth, borderTopColor: sportAccentColor },
                ]}
                ref={sport.id === tutorialSportId ? tutorialFirstSportRef : undefined}
              >
                <View style={styles.sportTopRow}>
                  <View style={styles.sportTopIconsLeft}>
                    <Pressable
                      style={styles.iconAction}
                      onPress={() => setStatsSportId(sport.id)}
                    >
                      <ActionGlyph type="stats" color={COLORS.text} />
                    </Pressable>
                    <Pressable
                      style={styles.iconAction}
                      onPress={() => openSportModal(sport)}
                    >
                      <ActionGlyph type="edit" color={COLORS.text} />
                    </Pressable>
                  </View>
                  <View style={[styles.sportTopTitleCenter, { width: titleWidth }]}>
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
                      <ActionGlyph type="hide" color={COLORS.text} />
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
                        <ActionGlyph type="delete" color={COLORS.text} />
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
                            onPress={() => requestWidgetPin(sport.id, sportLabel)}
                          >
                            <View style={styles.widgetButtonContent}>
                              <WidgetGlyph color={COLORS.text} />
                              <Text
                                style={[
                                  styles.secondaryButtonText,
                                  styles.widgetButtonText,
                                ]}
                              >
                                {t("label.widget")}
                              </Text>
                            </View>
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
                            {sportSortMode === "manual" ? (
                              <View style={styles.moveButtonColumn}>
                                <Pressable
                                  style={styles.iconAction}
                                  onPress={() => moveSport(sport.id, -1)}
                                >
                                  <Text style={styles.iconActionText}>↑</Text>
                                </Pressable>
                                <Pressable
                                  style={[styles.iconAction, styles.moveButtonArrow]}
                                  onPress={() => moveSport(sport.id, 1)}
                                >
                                  <Text style={styles.iconActionText}>↓</Text>
                                </Pressable>
                              </View>
                            ) : null}
                          </View>
                        </View>
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
              {showHidden ? t("label.hiddenHide") : t("label.hiddenShow")} ({filteredHiddenSports.length})
            </Text>
            <Text style={styles.hiddenToggleIcon}>{showHidden ? "v" : ">"}</Text>
          </Pressable>
          {showHidden
            ? filteredHiddenSports.map((sport) => {
                const daily = getRollingStats(logs, sport.id, sport);
                const sportLabel = getSportLabel(sport);
                const sportAccentColor = getSportAccentColor(sport.id);
                return (
                  <View
                    key={sport.id}
                    style={[
                      styles.sportCard,
                      styles.hiddenCard,
                      { width: cardWidth, borderTopColor: sportAccentColor },
                    ]}
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
                      <View
                        style={[styles.sportTopTitleCenter, { width: titleWidth }]}
                      >
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
                        onPress={() => requestWidgetPin(sport.id, sportLabel)}
                      >
                        <View style={styles.widgetButtonContent}>
                          <WidgetGlyph color={COLORS.text} />
                          <Text
                            style={[
                              styles.secondaryButtonText,
                              styles.widgetButtonText,
                            ]}
                          >
                            {t("label.widget")}
                          </Text>
                        </View>
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
                              {sportSortMode === "manual" ? (
                                <View style={styles.moveButtonColumn}>
                                  <Pressable
                                    style={styles.iconAction}
                                    onPress={() => moveSport(sport.id, -1)}
                                  >
                                    <Text style={styles.iconActionText}>↑</Text>
                                  </Pressable>
                                  <Pressable
                                    style={[styles.iconAction, styles.moveButtonArrow]}
                                    onPress={() => moveSport(sport.id, 1)}
                                  >
                                    <Text style={styles.iconActionText}>↓</Text>
                                  </Pressable>
                                </View>
                              ) : null}
                            </View>
                          </View>
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
          style={[styles.infoCard, styles.infoCardNoAlpha, styles.infoCardMain]}
          ref={tutorialScreenTimeRef}
          onLayout={(event) => setInfoCardWidth(event.nativeEvent.layout.width)}
          onPress={() => {
            setInfoHint(null);
            maybeAdvanceTutorial("overviewCard");
          }}
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
              <InfoGlyph type="earned" color={COLORS.text} />
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
              <InfoGlyph type="remaining" color={COLORS.text} />
              <Text style={styles.infoValue}>
                {formatScreenTime(totalRemainingSeconds)}
              </Text>
              <Text style={styles.infoLabel}>{t("label.remaining")}</Text>
              <Text style={styles.infoSubLabel}>
                {t("label.carryoverInline")}:{" "}
                {formatScreenTime(usageState.carryoverSeconds || 0)}
              </Text>
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
                  width: tooltipWidth,
                },
              ]}
              onPress={() => setInfoHint(null)}
            >
              <Text style={styles.infoTooltipTitle}>{infoHint.title}</Text>
              <Text style={styles.infoTooltipText}>{infoHint.body}</Text>
              <Pressable
                onPress={(event) => {
                  event.stopPropagation?.();
                  setInfoHint(null);
                  openScreenTimeDetails();
                }}
              >
                <Text style={styles.infoTooltipLink}>
                  {t("label.moreInfo")}
                </Text>
              </Pressable>
            </Pressable>
          ) : null}
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

  return (
    <I18nextProvider i18n={i18n}>
      <View style={{ flex: 1 }}>
        {renderAppContent()}
        {tutorialOverlayInRoot ? (
          <View style={styles.tutorialPortal} pointerEvents="box-none">
            {renderTutorialOverlay()}
          </View>
        ) : null}
        {renderPrefaceSettingsModal()}
        {renderSportModal()}
        {renderInfoModal()}
      </View>
    </I18nextProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  flexGrow: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 68,
    paddingBottom: 220,
  },
  sportDetailScrollContent: {
    paddingTop: 6,
    paddingHorizontal: 16,
    paddingBottom: 120,
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
  workoutHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
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
    flexWrap: "nowrap",
    justifyContent: "space-between",
    marginBottom: 12,
    width: "100%",
  },
  workoutStartRow: {
    marginBottom: 12,
  },
  mainNavButton: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: 4,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    gap: 4,
  },
  mainNavButtonActive: {
    backgroundColor: COLORS.accent,
  },
  mainNavText: {
    color: COLORS.text,
    fontWeight: "700",
    fontSize: 12,
    textAlign: "center",
    flexShrink: 1,
  },
  mainNavTextActive: {
    color: COLORS.ink,
  },
  mainNavIconWrapper: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  actionGlyphBars: {
    flexDirection: "row",
    width: 18,
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  actionGlyphBar: {
    width: 4,
    borderRadius: 2,
  },
  actionGlyphBox: {
    width: 16,
    height: 16,
    borderWidth: 2,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  actionGlyphBoxDot: {
    width: 6,
    height: 6,
    borderRadius: 1,
  },
  actionGlyphEye: {
    width: 16,
    height: 10,
    borderWidth: 2,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionGlyphEyePupil: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  actionGlyphCross: {
    width: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  actionGlyphCrossLine: {
    position: "absolute",
    width: 2,
    height: 16,
  },
  mainNavIconWrapper: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  navIconRoof: {
    width: 20,
    height: 10,
    borderLeftWidth: 2,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: COLORS.muted,
    borderBottomWidth: 0,
  },
  navIconHouse: {
    width: 18,
    height: 12,
    borderWidth: 2,
    borderColor: COLORS.muted,
    borderTopWidth: 0,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  navIconDumbbellBar: {
    width: 16,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: COLORS.muted,
    marginBottom: 4,
  },
  navIconDumbbellEnds: {
    flexDirection: "row",
    width: 22,
    justifyContent: "space-between",
  },
  navIconCircle: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 2,
    borderColor: COLORS.muted,
  },
  navIconBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    width: 22,
  },
  navIconBar: {
    width: 4,
    borderRadius: 2,
  },
  navIconGear: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderRadius: 9,
    borderColor: COLORS.muted,
    justifyContent: "center",
    alignItems: "center",
  },
  navIconGearCenter: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.muted,
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
  sortRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  sortButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: COLORS.cardAlt,
    borderWidth: 1,
    borderColor: COLORS.cardAlt,
  },
  sortButtonActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  sortButtonText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  sortButtonTextActive: {
    color: COLORS.white,
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
  iconButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  iconButtonText: {
    color: COLORS.text,
    fontWeight: "600",
  },
  trackingArea: {
    flex: 1,
    marginTop: 12,
    marginBottom: 16,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  weightEntryArea: {
    marginTop: 12,
    marginBottom: 16,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.2)",
    padding: 18,
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
  weightSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  weightSummaryColumn: {
    flex: 1,
  },
  weightSummaryLabel: {
    color: COLORS.muted,
    fontSize: 12,
    marginBottom: 4,
  },
  weightSummaryValue: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: "700",
  },
  weightHistoryCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: COLORS.cardAlt,
  },
  weightHistoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148, 163, 184, 0.2)",
  },
  weightHistoryRowLast: {
    borderBottomWidth: 0,
  },
  weightHistoryTime: {
    color: COLORS.muted,
    fontSize: 12,
  },
  weightHistorySet: {
    color: COLORS.text,
    fontWeight: "600",
  },
  counterValue: {
    fontSize: 54,
    color: COLORS.text,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.4,
  },
  plusSign: {
    fontSize: 72,
    color: COLORS.accent,
    marginTop: 12,
  },
  helperText: {
    marginTop: 12,
    color: COLORS.muted,
    textAlign: "center",
    lineHeight: 18,
  },
  trackingHelperText: {
    textAlign: "center",
  },
  voiceRow: {
    marginTop: 16,
    alignItems: "center",
    width: "100%",
    gap: 8,
  },
  voiceButton: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.3)",
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  voiceButtonActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent,
  },
  voiceButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  voiceButtonIcon: {
    fontSize: 26,
  },
  voiceButtonLabel: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "600",
  },
  voiceButtonLabelActive: {
    color: COLORS.white,
  },
  voiceButtonStatus: {
    marginTop: 4,
    color: COLORS.muted,
    fontSize: 13,
    textAlign: "center",
  },
  voiceButtonStatusError: {
    color: COLORS.danger,
  },
  voiceHint: {
    color: COLORS.muted,
    textAlign: "center",
    fontSize: 13,
    maxWidth: "70%",
  },
  manualEntryContainer: {
    marginTop: 18,
    width: "100%",
    alignItems: "stretch",
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.2)",
  },
  manualEntryLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  manualEntryButton: {
    alignSelf: "stretch",
    marginTop: 6,
  },
  manualEntryHelper: {
    marginTop: 6,
    color: COLORS.muted,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
  },
  manualRepsInput: {
    textAlign: "center",
  },
  manualTimeInputsRow: {
    flexDirection: "row",
    gap: 12,
  },
  manualTimeInputWrap: {
    flex: 1,
  },
  manualTimeInputLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  manualTimeInput: {
    marginBottom: 0,
    textAlign: "center",
  },
  timerRow: {
    flexDirection: "row",
    marginTop: 24,
  },
  sportCard: {
    backgroundColor: "rgba(30, 41, 59, 0.9)",
    borderRadius: 12,
    padding: 8,
    marginBottom: 4,
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
    marginBottom: 6,
    alignItems: "stretch",
  },
  sportBodyPressable: {
    flexGrow: 1,
  },
  sportName: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    textAlign: "center",
    paddingHorizontal: 6,
    flexWrap: "wrap",
    flexShrink: 1,
    width: "100%",
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
    gap: 6,
  },
  sportGridRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  sportGridColumnLeft: {
    width: "25%",
    alignItems: "flex-start",
    justifyContent: "center",
  },
  sportGridColumnCenter: {
    width: "45%",
    alignItems: "center",
    justifyContent: "center",
  },
  sportGridColumnRight: {
    width: "30%",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  sportCounterCenter: {
    alignItems: "center",
    justifyContent: "center",
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
    marginBottom: 0,
    justifyContent: "center",
  },
  counterBlock: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 6,
    paddingVertical: 6,
    alignItems: "center",
  },
  statsCounterBlock: {
    maxWidth: 220,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255, 255, 255, 0.96)",
  },
  counterLabel: {
    color: "#1f1b16",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  statsCounterLabel: {
    fontSize: 11,
    letterSpacing: 0.8,
  },
  counterValueSmall: {
    color: "#14110c",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 2,
  },
  statsCounterValueSmall: {
    fontSize: 22,
  },
  counterUnit: {
    color: "#3a332a",
    fontSize: 10,
    marginTop: 2,
  },
  statsCounterUnit: {
    fontSize: 11,
  },
  rateLabel: {
    color: COLORS.muted,
    marginBottom: 6,
  },
  statsCard: {
    marginTop: 8,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
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
  calendarEditOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239, 68, 68, 0.18)",
    borderRadius: 6,
  },
  calendarEditMinus: {
    color: "rgba(239, 68, 68, 0.85)",
    fontSize: 18,
    fontWeight: "800",
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
  tutorialPortal: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: "box-none",
    zIndex: 50,
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
  difficultyFormulaList: {
    marginTop: 4,
    gap: 8,
  },
  difficultyFormulaRow: {
    backgroundColor: COLORS.cardAlt,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.3)",
  },
  difficultyFormulaLabel: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
    textAlign: "center",
  },
  difficultyFormulaValue: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
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
  motivationQuoteTitle: {
    color: COLORS.text,
    fontWeight: "700",
    fontSize: 15,
    marginBottom: 4,
  },
  motivationQuoteBody: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  motivationCardTitle: {
    color: COLORS.text,
    fontWeight: "700",
    fontSize: 15,
    marginBottom: 4,
  },
  motivationCardBody: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 14,
    marginBottom: 2,
  },
  motivationActionButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
    marginTop: 6,
  },
  motivationActionButtonDisabled: {
    opacity: 0.5,
  },
  motivationActionText: {
    color: COLORS.background,
    fontWeight: "700",
  },
  aiInfoWrapper: {
    marginTop: 12,
  },
  inlineInfoPopup: {
    marginTop: 8,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.cardAlt,
    backgroundColor: COLORS.card,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  inlineInfoPopupTitle: {
    color: COLORS.text,
    fontWeight: "700",
    marginBottom: 6,
  },
  inlineInfoPopupText: {
    color: COLORS.muted,
    fontSize: 13,
    marginBottom: 10,
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
    width: 64,
    justifyContent: "flex-start",
    alignItems: "center",
  },
  sportTopTitleCenter: {
    flex: 1,
    alignItems: "center",
  },
  sportTopIconsRight: {
    flexDirection: "row",
    gap: 6,
    width: 64,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  sportTitleCenterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    justifyContent: "center",
  },
  sportTitleTextColumn: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  sportTitleTextRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    minWidth: 0,
    flexWrap: "wrap",
    width: "100%",
  },
  sportCategory: {
    color: COLORS.muted,
    fontSize: 12,
    textTransform: "capitalize",
    marginLeft: 6,
    flexShrink: 0,
  },
  titleSideSlot: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
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
    minWidth: 90,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: COLORS.white,
  },
  widgetButton: {
    minWidth: 70,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  widgetButtonContent: {
    alignItems: "center",
  },
  widgetGlyphGrid: {
    width: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  widgetGlyphSquare: {
    width: 6,
    height: 6,
    margin: 1,
    borderRadius: 1,
  },
  moveButtonColumn: {
    justifyContent: "flex-end",
    alignItems: "flex-end",
    gap: 2,
  },
  moveButtonArrow: {
    marginTop: 2,
  },
  moveActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    width: "100%",
  },
  earnedTimeTextRight: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 0,
    textAlign: "left",
    flex: 1,
    flexWrap: "wrap",
    flexShrink: 1,
  },
  primaryButton: {
    backgroundColor: COLORS.ember,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 5,
    alignItems: "center",
  },
  detailPrimaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
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
  detailPrimaryButtonText: {
    fontSize: 13,
    letterSpacing: 0.2,
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
  editSportButton: {
    alignSelf: "center",
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(30, 41, 59, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
  },
  editSportButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  editSportButtonText: {
    color: COLORS.text,
    fontWeight: "600",
    fontSize: 12,
    letterSpacing: 0.2,
  },
  widgetButtonText: {
    textAlign: "center",
    fontSize: 11,
    lineHeight: 14,
  },
  dangerButton: {
    backgroundColor: COLORS.danger,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 5,
  },
  detailDangerButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
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
  standardSuggestionWindow: {
    marginBottom: 12,
    height: 150,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.4)",
    padding: 12,
    backgroundColor: COLORS.card,
  },
  suggestionsHeader: {
    marginBottom: 6,
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  suggestionListContainer: {
    flex: 1,
  },
  suggestionList: {
    gap: 6,
  },
  suggestionItem: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 10,
  },
  suggestionItemActive: {
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  suggestionMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  suggestionIcon: {
    fontSize: 18,
  },
  suggestionLabel: {
    color: COLORS.text,
    fontWeight: "600",
  },
  suggestionMeta: {
    color: COLORS.muted,
    fontSize: 11,
  },
  customSuggestionButton: {
    marginTop: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.cardAlt,
    paddingVertical: 8,
    alignItems: "center",
  },
  customSuggestionButtonText: {
    color: COLORS.accent,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  customSuggestionButtonActive: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  customSuggestionButtonTextActive: {
    color: COLORS.background,
  },
  typeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  typeHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  typeHeaderTitle: {
    color: COLORS.text,
    fontWeight: "600",
  },
  infoButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.cardAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  infoButtonText: {
    color: COLORS.text,
    fontWeight: "700",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  weightToggleButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.cardAlt,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  weightToggleButtonActive: {
    borderColor: COLORS.accent,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
  },
  weightToggleIcon: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  weightToggleIconActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent,
  },
  weightToggleIconText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "700",
  },
  weightToggleLabel: {
    color: COLORS.text,
    fontWeight: "600",
  },
  sliderSection: {
    marginBottom: 12,
    marginTop: 10,
  },
  difficultyHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  difficultyHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  difficultyHeaderValue: {
    color: COLORS.text,
    fontWeight: "700",
    fontSize: 16,
  },
  difficultyBarWrapper: {
    marginTop: 10,
    marginBottom: 4,
  },
  difficultyBarTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(148, 163, 184, 0.2)",
    overflow: "hidden",
  },
  difficultyBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: COLORS.accent,
  },
  difficultyButtonsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  difficultyButton: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.cardAlt,
    paddingVertical: 10,
    alignItems: "center",
  },
  difficultyButtonText: {
    color: COLORS.text,
    fontWeight: "700",
    fontSize: 18,
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
    padding: 20,
    marginBottom: 20,
    minHeight: 200,
    borderWidth: 1,
    borderColor: COLORS.accentDark,
  },
  permissionCardCollapsed: {
    justifyContent: "center",
    minHeight: 48,
    paddingVertical: 6,
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
  permissionCollapsedText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "600",
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
    marginTop: 6,
    gap: 4,
  },
  permissionItem: {
    backgroundColor: COLORS.cardAlt,
    borderRadius: 12,
    padding: 10,
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
  infoCardNoAlpha: {
    backgroundColor: COLORS.cardSolid,
  },
  infoCardMain: {
    position: "relative",
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
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  workoutListItem: {
    borderRadius: 10,
    backgroundColor: COLORS.cardAlt,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    flexGrow: 1,
    flexBasis: "31%",
    minWidth: 140,
  },
  workoutListItemDisabled: {
    opacity: 0.4,
  },
  workoutListItemMain: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  workoutListItemMeta: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },
  workoutHistoryList: {
    marginBottom: 12,
    gap: 8,
  },
  workoutHistoryListItem: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.3)",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  workoutHistoryRowWrapper: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  workoutHistoryRow: {
    flex: 1,
    borderRadius: 10,
    padding: 6,
  },
  workoutHistoryRowPressed: {
    opacity: 0.6,
  },
  workoutHistoryRowTitle: {
    color: COLORS.text,
    fontWeight: "700",
  },
  workoutHistoryRowMeta: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 2,
  },
  workoutHistoryRowStats: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 6,
  },
  workoutHistoryContinueButton: {
    marginTop: 8,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: "center",
    backgroundColor: COLORS.accent,
  },
  workoutHistoryContinueButtonDisabled: {
    opacity: 0.6,
  },
  workoutHistoryContinueButtonText: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 12,
  },
  workoutHistoryRowMain: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  workoutHistoryRowArrow: {
    color: COLORS.accent,
    fontSize: 20,
    fontWeight: "700",
  },
  workoutHistoryDelete: {
    padding: 6,
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
  workoutDetailModalOverlay: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    padding: 24,
  },
  workoutDetailModalCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 18,
  },
  workoutDetailModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  formulaBadgeWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 14,
    alignItems: "center",
    zIndex: 6,
  },
  formulaBadge: {
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.cardAlt,
    minWidth: 220,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  formulaBadgeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  formulaBadgeTitle: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  formulaBadgeChevron: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: "700",
  },
  formulaBadgeValue: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  formulaModalOverlay: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    padding: 24,
  },
  formulaModalCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 18,
  },
  formulaModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  formulaEquation: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  formulaDetailText: {
    color: COLORS.muted,
    marginBottom: 10,
  },
  formulaFactorsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  formulaFactorCard: {
    flex: 1,
    backgroundColor: COLORS.cardAlt,
    borderRadius: 12,
    padding: 12,
  },
  formulaFactorLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
  },
  formulaFactorValue: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: "700",
  },
  fixedTimers: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    zIndex: 10,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardAlt,
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
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  infoGlyph: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  infoGlyphStopwatch: {
    width: 16,
    height: 16,
    borderWidth: 2,
    borderRadius: 8,
  },
  infoGlyphStopwatchKnob: {
    position: "absolute",
    width: 6,
    height: 3,
    top: -4,
    borderRadius: 1,
  },
  infoGlyphHourglassWrapper: {
    position: "relative",
    width: 16,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  infoGlyphHourglassTop: {
    position: "absolute",
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 8,
    borderStyle: "solid",
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "transparent",
  },
  infoGlyphHourglassBottom: {
    position: "absolute",
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderStyle: "solid",
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "transparent",
    bottom: 0,
  },
  infoGlyphCarryoverCircle: {
    position: "absolute",
    width: 18,
    height: 18,
    borderWidth: 2,
    borderRadius: 9,
  },
  infoGlyphCarryoverArrow: {
    position: "absolute",
    width: 10,
    height: 10,
    borderTopWidth: 2,
    borderRightWidth: 2,
    top: 4,
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
  infoSubLabel: {
    marginTop: 2,
    color: COLORS.muted,
    fontSize: 10,
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
    lineHeight: 16,
    textAlign: "center",
    flexWrap: "wrap",
  },
  infoTooltipLink: {
    marginTop: 8,
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
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
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  detailLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  detailValue: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "700",
  },
  detailValueStrong: {
    color: COLORS.accent,
  },
  detailListItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  detailListLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailListIcon: {
    fontSize: 14,
  },
  detailListLabel: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "600",
  },
  detailListValue: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  detailEntryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  detailEntryLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  detailEntryRight: {
    alignItems: "flex-end",
  },
  detailEntryMeta: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 2,
  },
  detailEntryValue: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "700",
  },
  detailEntrySubValue: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 2,
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
  permissionReminder: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "rgba(59, 130, 246, 0.08)",
  },
  permissionReminderText: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 18,
  },
  appRow: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  appRowDisabled: {
    opacity: 0.6,
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
  appToggleSpinner: {
    marginTop: 8,
  },
  appToggleActive: {
    color: COLORS.success,
  },
  appsStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  appsStatusText: {
    color: COLORS.muted,
    fontSize: 12,
  },
  appsHeaderWrap: {
    paddingTop: 68,
    paddingHorizontal: 16,
  },
  appsLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(2, 6, 23, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  appsLoadingOverlayText: {
    color: COLORS.white,
    marginTop: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  appsInitialLoader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  appsInitialLoaderText: {
    color: COLORS.text,
    marginTop: 12,
    fontWeight: "600",
    textAlign: "center",
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
    top: 72,
    right: 12,
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
    backgroundColor: "transparent",
    borderRadius: 8,
  },
  tutorialPointer: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(249, 115, 22, 0.12)",
    borderWidth: 1,
    borderColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  tutorialPointerText: {
    fontSize: 28,
  },
  tutorialCard: {
    position: "absolute",
    backgroundColor: COLORS.cardDark,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(249, 115, 22, 0.35)",
    shadowColor: "#f97316",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  tutorialTitle: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  tutorialBody: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
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
  tutorialTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tutorialTitleRowInline: {
    gap: 8,
  },
  tutorialInlineActionButton: {
    marginLeft: 12,
  },
});

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: COLORS.cardDark,
  },
  title: {
    color: COLORS.accent,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  message: {
    color: COLORS.text,
    textAlign: "center",
  },
});

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("App initialization failed", error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <SafeAreaView style={errorStyles.container}>
          <Text style={errorStyles.title}>App konnte nicht geladen werden</Text>
          <Text style={errorStyles.message}>{error.message}</Text>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AppContent />
    </AppErrorBoundary>
  );
}
