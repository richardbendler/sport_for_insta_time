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
  { id: "pushups", name: "Liegestuetze", type: "reps", hidden: false },
  { id: "pullups", name: "Klimmzuege", type: "reps", hidden: false },
  { id: "pushups_alt", name: "Pushups", type: "reps", hidden: false },
  { id: "jogging", name: "Joggen", type: "time", hidden: false },
];

const DEFAULT_SETTINGS = {
  controlledApps: [],
};

const REPS_TO_MINUTES = 1;

const todayKey = () => new Date().toISOString().slice(0, 10);

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
    if (sport.type === "reps") {
      totalSeconds += dayStats.reps * REPS_TO_MINUTES * 60;
    } else {
      totalSeconds += dayStats.seconds || 0;
    }
  });
  return Math.max(0, Math.floor(totalSeconds));
};

export default function App() {
  const [sports, setSports] = useState([]);
  const [stats, setStats] = useState({});
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [selectedSportId, setSelectedSportId] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("reps");
  const [installedApps, setInstalledApps] = useState([]);
  const [usageState, setUsageState] = useState({
    allowanceSeconds: 0,
    usedSeconds: 0,
    day: todayKey(),
  });
  const [needsAccessibility, setNeedsAccessibility] = useState(false);
  const [permissionsPrompted, setPermissionsPrompted] = useState(false);

  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      await ensureDefaultSports();
      await ensureDefaultSettings();
      const sportsRaw = await AsyncStorage.getItem(STORAGE_KEYS.sports);
      const statsRaw = await AsyncStorage.getItem(STORAGE_KEYS.stats);
      const settingsRaw = await AsyncStorage.getItem(STORAGE_KEYS.settings);
      const permissionsRaw = await AsyncStorage.getItem(STORAGE_KEYS.permissions);
      setSports(sportsRaw ? JSON.parse(sportsRaw) : []);
      setStats(statsRaw ? JSON.parse(statsRaw) : {});
      setSettings(settingsRaw ? JSON.parse(settingsRaw) : DEFAULT_SETTINGS);
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

  const handleAddSport = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      return;
    }
    const newSport = {
      id: generateId(),
      name: trimmed,
      type: newType,
      hidden: false,
      createdAt: Date.now(),
    };
    await saveSports([newSport, ...sports]);
    setNewName("");
    setNewType("reps");
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
  }, [isSettingsOpen]);

  useEffect(() => {
    if (!selectedSportId) {
      setRunning(false);
      setSessionSeconds(0);
    }
  }, [selectedSportId]);

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

  const todayStats = useMemo(() => {
    if (!selectedSport) {
      return { reps: 0, seconds: 0 };
    }
    return getTodayStat(stats, selectedSport.id);
  }, [stats, selectedSport]);

  const showPermissionPrompt =
    Platform.OS === "android" && !permissionsPrompted && needsAccessibility;

  if (selectedSport) {
    const isReps = selectedSport.type === "reps";
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => setSelectedSportId(null)}
          >
            <Text style={styles.backText}>Zurueck</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{selectedSport.name}</Text>
        </View>
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
            <Text style={styles.helperText}>Tippe irgendwo</Text>
          </Pressable>
        ) : (
          <View style={styles.trackingArea}>
            <Text style={styles.counterValue}>
              {formatSeconds(todayStats.seconds + sessionSeconds)}
            </Text>
            <Text style={styles.helperText}>Heute</Text>
            <View style={styles.timerRow}>
              {!running ? (
                <Pressable style={styles.primaryButton} onPress={handleStart}>
                  <Text style={styles.primaryButtonText}>Start</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.dangerButton} onPress={handleStop}>
                  <Text style={styles.primaryButtonText}>Stop</Text>
                </Pressable>
              )}
            </View>
            {running ? (
              <Text style={styles.helperText}>
                Laufende Session: {formatSeconds(sessionSeconds)}
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
              <Text style={styles.backText}>Zurueck</Text>
            </Pressable>
            <Text style={styles.headerTitle}>Insta Controller</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>Heute verfuegbar</Text>
            <Text style={styles.cardValue}>
              {Math.floor(allowanceSeconds / 60)} min
            </Text>
            <Text style={styles.cardMeta}>
              Verbraucht: {Math.floor(usageState.usedSeconds / 60)} min
            </Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>Berechtigungen</Text>
            <Text style={styles.helperText}>
              Aktivere die Zugriffshilfe, damit die App Social Apps blockieren
              kann, wenn die Zeit aufgebraucht ist.
            </Text>
            <Pressable
              style={styles.primaryButton}
              onPress={openAccessibilitySettings}
            >
              <Text style={styles.primaryButtonText}>Zugriffshilfe oeffnen</Text>
            </Pressable>
            {needsAccessibility ? (
              <Text style={styles.warningText}>Zugriffshilfe fehlt</Text>
            ) : (
              <Text style={styles.successText}>Zugriffshilfe aktiv</Text>
            )}
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>Apps auswaehlen</Text>
            {Platform.OS !== "android" ? (
              <Text style={styles.helperText}>
                App-Auswahl ist nur auf Android verfuegbar.
              </Text>
            ) : (
              <View>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={loadInstalledApps}
                >
                  <Text style={styles.secondaryButtonText}>Apps laden</Text>
                </Pressable>
                {installedApps.length === 0 ? (
                  <Text style={styles.helperText}>
                    Keine Apps geladen. Tippe auf "Apps laden".
                  </Text>
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
                        {enabled ? "Aktiv" : "Aus"}
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
            <Text style={styles.title}>Sport gegen Insta Zeit</Text>
            <Text style={styles.subtitle}>Deine Sportarten</Text>
          </View>
          <Pressable
            style={styles.iconButton}
            onPress={() => {
              setIsSettingsOpen(true);
              loadInstalledApps();
              refreshUsageState();
            }}
          >
            <Text style={styles.iconButtonText}>Apps</Text>
          </Pressable>
        </View>
        {showPermissionPrompt ? (
          <View style={styles.permissionCard}>
            <Text style={styles.sectionTitle}>Zugriffshilfe noetig</Text>
            <Text style={styles.helperText}>
              Aktiviere die Zugriffshilfe, damit Social Apps gesperrt werden
              koennen.
            </Text>
            <Pressable
              style={styles.primaryButton}
              onPress={openAccessibilitySettings}
            >
              <Text style={styles.primaryButtonText}>Jetzt aktivieren</Text>
            </Pressable>
          </View>
        ) : null}
        {activeSports.length === 0 ? (
          <Text style={styles.helperText}>
            Keine aktiven Sportarten. Fuege neue hinzu.
          </Text>
        ) : null}
        {activeSports.map((sport) => (
          <View key={sport.id} style={styles.sportCard}>
            <View style={styles.sportInfo}>
              <Text style={styles.sportName}>{sport.name}</Text>
              <Text style={styles.sportMeta}>
                {sport.type === "reps"
                  ? "Wiederholungen"
                  : "Zeitbasiert"}
              </Text>
            </View>
            <View style={styles.cardActions}>
              <Pressable
                style={styles.primaryButton}
                onPress={() => setSelectedSportId(sport.id)}
              >
                <Text style={styles.primaryButtonText}>Tracken</Text>
              </Pressable>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => handleHideSport(sport.id, true)}
              >
                <Text style={styles.secondaryButtonText}>Ausblenden</Text>
              </Pressable>
              <Pressable
                style={styles.dangerButton}
                onPress={() => handleDeleteSport(sport.id)}
              >
                <Text style={styles.primaryButtonText}>Loeschen</Text>
              </Pressable>
            </View>
          </View>
        ))}
        <View style={styles.addCard}>
          <Text style={styles.addTitle}>Neue Sportart</Text>
          <TextInput
            style={styles.input}
            value={newName}
            onChangeText={setNewName}
            placeholder="Name (z.B. Situps)"
            placeholderTextColor="#7a7a7a"
          />
          <View style={styles.typeRow}>
            <Pressable
              style={[
                styles.typeButton,
                newType === "reps" && styles.typeButtonActive,
              ]}
              onPress={() => setNewType("reps")}
            >
              <Text
                style={[
                  styles.typeButtonText,
                  newType === "reps" && styles.typeButtonTextActive,
                ]}
              >
                Wiederholungen
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.typeButton,
                newType === "time" && styles.typeButtonActive,
              ]}
              onPress={() => setNewType("time")}
            >
              <Text
                style={[
                  styles.typeButtonText,
                  newType === "time" && styles.typeButtonTextActive,
                ]}
              >
                Zeitbasiert
              </Text>
            </Pressable>
          </View>
          <Pressable style={styles.primaryButton} onPress={handleAddSport}>
            <Text style={styles.primaryButtonText}>Hinzufuegen</Text>
          </Pressable>
        </View>
        <View style={styles.hiddenSection}>
          <Pressable
            style={styles.hiddenToggle}
            onPress={() => setShowHidden((s) => !s)}
          >
            <Text style={styles.hiddenToggleText}>
              {showHidden
                ? "Versteckte Sportarten verbergen"
                : "Versteckte Sportarten anzeigen"}{" "}
              ({hiddenSports.length})
            </Text>
          </Pressable>
          {showHidden
            ? hiddenSports.map((sport) => (
                <View key={sport.id} style={styles.hiddenCard}>
                  <View style={styles.sportInfo}>
                    <Text style={styles.sportName}>{sport.name}</Text>
                    <Text style={styles.sportMeta}>
                      {sport.type === "reps"
                        ? "Wiederholungen"
                        : "Zeitbasiert"}
                    </Text>
                  </View>
                  <View style={styles.cardActions}>
                    <Pressable
                      style={styles.secondaryButton}
                      onPress={() => handleHideSport(sport.id, false)}
                    >
                      <Text style={styles.secondaryButtonText}>
                        Einblenden
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.dangerButton}
                      onPress={() => handleDeleteSport(sport.id)}
                    >
                      <Text style={styles.primaryButtonText}>Loeschen</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f1114",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#f5f5f5",
  },
  subtitle: {
    fontSize: 16,
    color: "#b7b7b7",
    marginTop: 6,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#1f232a",
    marginRight: 12,
  },
  backText: {
    color: "#f5f5f5",
    fontWeight: "600",
  },
  headerTitle: {
    fontSize: 20,
    color: "#f5f5f5",
    fontWeight: "700",
  },
  iconButton: {
    backgroundColor: "#1f232a",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  iconButtonText: {
    color: "#f5f5f5",
    fontWeight: "600",
  },
  trackingArea: {
    flex: 1,
    margin: 20,
    borderRadius: 24,
    backgroundColor: "#151922",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  counterValue: {
    fontSize: 56,
    color: "#ffffff",
    fontWeight: "700",
  },
  plusSign: {
    fontSize: 72,
    color: "#4ade80",
    marginTop: 12,
  },
  helperText: {
    marginTop: 12,
    color: "#9aa0a6",
  },
  timerRow: {
    flexDirection: "row",
    marginTop: 24,
  },
  sportCard: {
    backgroundColor: "#151922",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  hiddenCard: {
    backgroundColor: "#14171d",
    borderRadius: 16,
    padding: 16,
    marginTop: 10,
  },
  sportInfo: {
    marginBottom: 12,
  },
  sportName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f5f5f5",
  },
  sportMeta: {
    marginTop: 4,
    color: "#8b8b8b",
  },
  cardActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  primaryButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: "#2b2f36",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  secondaryButtonText: {
    color: "#e5e7eb",
    fontWeight: "600",
  },
  dangerButton: {
    backgroundColor: "#ef4444",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  addCard: {
    backgroundColor: "#11151c",
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
  },
  addTitle: {
    fontSize: 16,
    color: "#f5f5f5",
    marginBottom: 12,
    fontWeight: "600",
  },
  input: {
    backgroundColor: "#1f232a",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#f5f5f5",
    marginBottom: 12,
  },
  typeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  typeButton: {
    flex: 1,
    backgroundColor: "#1f232a",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  typeButtonActive: {
    backgroundColor: "#2563eb",
  },
  typeButtonText: {
    color: "#cbd5f5",
    fontWeight: "600",
  },
  typeButtonTextActive: {
    color: "#ffffff",
  },
  hiddenSection: {
    marginTop: 24,
  },
  hiddenToggle: {
    paddingVertical: 10,
  },
  hiddenToggleText: {
    color: "#9aa0a6",
    fontWeight: "600",
  },
  permissionCard: {
    backgroundColor: "#151922",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: "#151922",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    color: "#9aa0a6",
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 28,
    color: "#ffffff",
    fontWeight: "700",
  },
  cardMeta: {
    marginTop: 6,
    color: "#9aa0a6",
  },
  sectionTitle: {
    fontSize: 16,
    color: "#f5f5f5",
    marginBottom: 8,
    fontWeight: "600",
  },
  warningText: {
    marginTop: 10,
    color: "#f59e0b",
    fontWeight: "600",
  },
  successText: {
    marginTop: 10,
    color: "#22c55e",
    fontWeight: "600",
  },
  appRow: {
    backgroundColor: "#1f232a",
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  appRowActive: {
    borderWidth: 1,
    borderColor: "#2563eb",
  },
  appLabel: {
    color: "#f5f5f5",
    fontWeight: "600",
  },
  appPackage: {
    color: "#9aa0a6",
    marginTop: 4,
    fontSize: 12,
  },
  appToggle: {
    marginTop: 8,
    color: "#9aa0a6",
    fontWeight: "600",
  },
  appToggleActive: {
    color: "#22c55e",
  },
});
