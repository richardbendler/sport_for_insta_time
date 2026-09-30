// iOS counterpart of the Android InstaControl native module. It exposes the
// same screen-time methods App.js already uses (upsertScreenTimeEntry,
// getUsageState, ...) and drives the Screen Time APIs through
// react-native-device-activity:
// - no earned time left      -> selected apps are shielded
// - earned time available    -> shield lifted, DeviceActivity monitoring with
//                               minute thresholds; the monitor extension
//                               re-shields when the budget is used up, even
//                               if the app is not running
// - app comes to foreground  -> reached thresholds are booked as usage

const store = require("./screenTimeStore");
const plan = require("./budgetPlan");

const STORAGE_KEY = "@ios_screen_time_state_v1";
const SELECTION_ID = "restrictedapps";
const MIN_IOS_MAJOR_VERSION = 16;

const AUTH_APPROVED = 2;
const AUTH_DENIED = 1;

const createController = ({ deviceActivity, storage, platformVersion, now = () => Date.now() }) => {
  let state = null;
  let loading = null;
  let queue = Promise.resolve();
  let shieldTexts = null;

  const iosMajor = parseInt(String(platformVersion || "0"), 10) || 0;

  const isSupported = () =>
    !!deviceActivity &&
    iosMajor >= MIN_IOS_MAJOR_VERSION &&
    typeof deviceActivity.startMonitoring === "function";

  const load = async () => {
    if (state) {
      return state;
    }
    if (!loading) {
      loading = (async () => {
        let parsed = null;
        try {
          const raw = await storage.getItem(STORAGE_KEY);
          parsed = raw ? JSON.parse(raw) : null;
        } catch (error) {
          parsed = null;
        }
        const base = store.createState();
        state = {
          ...base,
          ...(parsed || {}),
          entries: Array.isArray(parsed?.entries) ? parsed.entries : [],
          monitor: parsed?.monitor || null,
          blocked: !!parsed?.blocked,
        };
        return state;
      })();
    }
    return loading;
  };

  const save = async () => {
    if (!state) {
      return;
    }
    try {
      await storage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn("iosScreenTime: failed to persist state", error);
    }
  };

  // Serializes all operations so a sync never interleaves with an update.
  const enqueue = (task) => {
    const run = queue.then(task, task);
    queue = run.catch(() => {});
    return run;
  };

  const getAuthorizationStatus = () => {
    if (!isSupported()) {
      return 0;
    }
    try {
      return deviceActivity.getAuthorizationStatus();
    } catch (error) {
      return 0;
    }
  };

  const isAuthorized = () => getAuthorizationStatus() === AUTH_APPROVED;

  const getSelectionToken = () => {
    if (!isSupported()) {
      return null;
    }
    try {
      return deviceActivity.getFamilyActivitySelectionId(SELECTION_ID) || null;
    } catch (error) {
      return null;
    }
  };

  const getSelectionSummary = () => {
    const empty = { applicationCount: 0, categoryCount: 0, webDomainCount: 0, total: 0 };
    if (!getSelectionToken()) {
      return empty;
    }
    try {
      const meta = deviceActivity.activitySelectionMetadata({
        activitySelectionId: SELECTION_ID,
      });
      if (!meta) {
        return empty;
      }
      const applicationCount = meta.applicationCount || 0;
      const categoryCount = meta.categoryCount || 0;
      const webDomainCount = meta.webDomainCount || 0;
      return {
        applicationCount,
        categoryCount,
        webDomainCount,
        total: applicationCount + categoryCount + webDomainCount,
      };
    } catch (error) {
      return empty;
    }
  };

  const applyShieldTexts = () => {
    if (!shieldTexts || !isSupported()) {
      return;
    }
    const notification = {
      title: shieldTexts.notificationTitle,
      body: shieldTexts.notificationBody,
      sound: "default",
    };
    deviceActivity.updateShield(
      {
        title: shieldTexts.title,
        subtitle: shieldTexts.subtitle,
        primaryButtonLabel: shieldTexts.primaryButtonLabel,
        secondaryButtonLabel: shieldTexts.secondaryButtonLabel,
        iconSystemName: "figure.run",
        backgroundBlurStyle: 2,
        titleColor: { red: 255, green: 255, blue: 255 },
        subtitleColor: { red: 226, green: 232, blue: 240 },
        primaryButtonBackgroundColor: { red: 245, green: 158, blue: 11 },
        primaryButtonLabelColor: { red: 15, green: 23, blue: 42 },
        secondaryButtonLabelColor: { red: 226, green: 232, blue: 240 },
      },
      {
        // The shield cannot open the app directly, so the primary button
        // sends a notification that leads back into the app.
        primary: {
          behavior: "close",
          actions: [{ type: "sendNotification", payload: notification }],
        },
        secondary: {
          behavior: "close",
        },
      },
      "sportForScreenTime"
    );
  };

  const setShieldTexts = (texts) => {
    shieldTexts = texts || null;
    try {
      applyShieldTexts();
    } catch (error) {
      console.warn("iosScreenTime: updateShield failed", error);
    }
  };

  const stopCurrentMonitor = () => {
    const monitor = state.monitor;
    if (!monitor) {
      return;
    }
    // Remove the configured actions first: stopping an activity may fire
    // intervalDidEnd, which would otherwise re-shield right after a new
    // budget was granted.
    try {
      deviceActivity.cleanUpAfterActivity(monitor.activityName);
    } catch (error) {
      // ignore
    }
    try {
      deviceActivity.stopMonitoring([monitor.activityName]);
    } catch (error) {
      // ignore
    }
    state.monitor = null;
  };

  const stopForeignMonitors = () => {
    try {
      const activities = deviceActivity.getActivities() || [];
      const stale = activities.filter(
        (name) =>
          plan.isBudgetActivity(name) && name !== state.monitor?.activityName
      );
      if (stale.length > 0) {
        stale.forEach((name) => deviceActivity.cleanUpAfterActivity(name));
        deviceActivity.stopMonitoring(stale);
      }
    } catch (error) {
      // ignore
    }
  };

  const shield = () => {
    deviceActivity.resetBlocks("sportForScreenTime");
    deviceActivity.blockSelection(
      { activitySelectionId: SELECTION_ID },
      "sportForScreenTime"
    );
    state.blocked = true;
  };

  const unshield = () => {
    deviceActivity.resetBlocks("sportForScreenTime");
    state.blocked = false;
  };

  // Books thresholds reached since the last sync as consumed screen time.
  const bookUsage = (timestamp) => {
    const monitor = state.monitor;
    if (!monitor) {
      return 0;
    }
    let events = [];
    try {
      events = deviceActivity.getEvents(monitor.activityName) || [];
    } catch (error) {
      events = [];
    }
    const usedMinutes = plan.usedMinutesFromEvents(events, monitor.activityName);
    const usedSeconds = Math.min(usedMinutes * 60, monitor.budgetSeconds);
    const delta = usedSeconds - (monitor.bookedSeconds || 0);
    if (delta > 0) {
      store.consumeSeconds(state, timestamp, delta);
      monitor.bookedSeconds = usedSeconds;
    }
    if (usedSeconds >= monitor.budgetSeconds) {
      // The final threshold fired and the extension shielded the apps.
      monitor.exhausted = true;
    }
    if (plan.intervalEndedFromEvents(events, monitor.activityName)) {
      // The day window is over; the extension already shielded the apps.
      try {
        deviceActivity.cleanUpAfterActivity(monitor.activityName);
      } catch (error) {
        // ignore
      }
      state.monitor = null;
      state.blocked = true;
    }
    return delta > 0 ? delta : 0;
  };

  const startMonitor = async (remainingSeconds, token, timestamp) => {
    const budgetMinutes = plan.budgetMinutesFor(remainingSeconds);
    const activityName = plan.createActivityName(timestamp);
    const thresholds = plan.thresholdMinutesFor(budgetMinutes);
    const blockActions = [
      { type: "blockSelection", familyActivitySelectionId: SELECTION_ID },
    ];
    if (shieldTexts?.usedUpTitle) {
      blockActions.push({
        type: "sendNotification",
        payload: {
          title: shieldTexts.usedUpTitle,
          body: shieldTexts.usedUpBody,
          sound: "default",
        },
      });
    }
    deviceActivity.configureActions({
      activityName,
      callbackName: "eventDidReachThreshold",
      eventName: String(budgetMinutes),
      actions: blockActions,
    });
    const warningMinute = budgetMinutes - plan.WARNING_BEFORE_MINUTES;
    if (warningMinute >= 1 && shieldTexts?.warningTitle) {
      deviceActivity.configureActions({
        activityName,
        callbackName: "eventDidReachThreshold",
        eventName: String(warningMinute),
        actions: [
          {
            type: "sendNotification",
            payload: {
              title: shieldTexts.warningTitle,
              body: shieldTexts.warningBody,
              sound: "default",
            },
          },
        ],
      });
    }
    deviceActivity.configureActions({
      activityName,
      callbackName: "intervalDidEnd",
      actions: [
        { type: "blockSelection", familyActivitySelectionId: SELECTION_ID },
      ],
    });
    await deviceActivity.startMonitoring(
      activityName,
      plan.DAILY_SCHEDULE,
      thresholds.map((minutes) => ({
        eventName: String(minutes),
        familyActivitySelection: token,
        threshold: plan.thresholdComponents(minutes),
        includesPastActivity: false,
      }))
    );
    state.monitor = {
      activityName,
      startedAt: timestamp,
      day: store.todayKey(timestamp),
      budgetSeconds: budgetMinutes * 60,
      grantedSeconds: Math.max(0, Math.floor(remainingSeconds)),
      bookedSeconds: 0,
    };
  };

  // Brings shield and monitoring in line with the earned screen time.
  const isShieldActive = () => {
    try {
      return !!deviceActivity.isShieldActive();
    } catch (error) {
      return false;
    }
  };

  const reconcile = async () => {
    const timestamp = now();
    bookUsage(timestamp);
    const token = getSelectionToken();
    const hasSelection = !!token && getSelectionSummary().total > 0;
    if (!isAuthorized() || !hasSelection) {
      if (state.monitor) {
        stopCurrentMonitor();
      }
      if (state.blocked && isAuthorized()) {
        unshield();
      }
      return;
    }
    const { remainingSeconds } = store.getTotals(state, timestamp);
    if (remainingSeconds <= 0) {
      stopCurrentMonitor();
      stopForeignMonitors();
      shield();
      return;
    }
    const monitor = state.monitor;
    const expectedRemaining = monitor
      ? monitor.grantedSeconds - (monitor.bookedSeconds || 0)
      : null;
    const upToDate =
      monitor &&
      monitor.day === store.todayKey(timestamp) &&
      monitor.selectionToken === token &&
      Math.abs(expectedRemaining - remainingSeconds) < 60 &&
      !monitor.exhausted &&
      !state.blocked &&
      !isShieldActive();
    if (upToDate) {
      return;
    }
    stopCurrentMonitor();
    stopForeignMonitors();
    await startMonitor(remainingSeconds, token, timestamp);
    state.monitor.selectionToken = token;
    unshield();
  };

  const withState = (task, { persist = true, sync = true } = {}) =>
    enqueue(async () => {
      await load();
      const result = await task();
      if (sync && isSupported()) {
        try {
          await reconcile();
        } catch (error) {
          console.warn("iosScreenTime: reconcile failed", error);
        }
      }
      if (persist) {
        await save();
      }
      return result;
    });

  const buildUsageState = () => {
    const timestamp = now();
    const totals = store.getTotals(state, timestamp);
    const breakdown = store.getBreakdown(state, timestamp);
    return {
      remainingSeconds: totals.remainingSeconds,
      usedSeconds: store.getUsedSecondsToday(state, timestamp),
      day: store.todayKey(timestamp),
      carryoverSeconds: breakdown.carryoverSeconds,
      entryCount: totals.entryCount,
      remainingBySport: totals.remainingBySport,
      usedByApp: {},
      creditPenaltyMultiplier: 1,
      creditLockExpiresAt: 0,
    };
  };

  // App.js polls getUsageState every few seconds; only talk to the Screen
  // Time APIs every SYNC_INTERVAL_MS unless something changed.
  const SYNC_INTERVAL_MS = 15000;
  let lastSyncAt = 0;

  return {
    SELECTION_ID,
    isSupported,
    getAuthorizationStatus,
    isAuthorized,
    getSelectionSummary,
    setShieldTexts,
    isBlocked: () => !!state?.blocked,

    requestAuthorization: async () => {
      if (!isSupported()) {
        return 0;
      }
      await deviceActivity.requestAuthorization("individual");
      const status = await deviceActivity.pollAuthorizationStatus({
        pollIntervalMs: 500,
        maxAttempts: 20,
      });
      await withState(async () => {}, { persist: true, sync: true });
      return status;
    },

    syncNow: () => {
      lastSyncAt = now();
      return withState(async () => {}).then(() => buildUsageState());
    },

    upsertScreenTimeEntry: (entryId, sportId, createdAt, totalSeconds) =>
      withState(async () => {
        store.upsertEntry(
          state,
          { entryId, sportId, createdAt, totalSeconds },
          now()
        );
      }),

    removeScreenTimeEntry: (entryId) =>
      withState(async () => {
        store.removeEntry(state, entryId);
      }),

    clearScreenTimeEntriesForSport: (sportId) =>
      withState(async () => {
        store.clearEntriesForSport(state, sportId);
      }),

    clearAllScreenTimeEntries: () =>
      withState(async () => {
        store.clearAllEntries(state);
      }),

    clearAppData: () =>
      enqueue(async () => {
        await load();
        if (isSupported()) {
          try {
            stopCurrentMonitor();
            stopForeignMonitors();
            unshield();
          } catch (error) {
            // ignore
          }
        }
        state = { ...store.createState(), monitor: null, blocked: false };
        await save();
      }),

    getUsageState: () => {
      const shouldSync = now() - lastSyncAt >= SYNC_INTERVAL_MS;
      if (shouldSync) {
        lastSyncAt = now();
      }
      return withState(async () => {}, {
        persist: shouldSync,
        sync: shouldSync,
      }).then(() => buildUsageState());
    },

    getScreenTimeEntries: () =>
      withState(
        async () =>
          store.getEntries(state, now()).map((entry) => ({
            id: entry.id,
            sportId: entry.sportId || "",
            createdAt: entry.createdAt,
            lastDecayAt: entry.lastDecayAt,
            remainingSeconds: entry.remainingSeconds,
            originalSeconds: entry.originalSeconds,
            decayCount: entry.decayCount,
          })),
        { persist: false, sync: false }
      ),

    setAppLanguage: () => {},
  };
};

module.exports = { createController, SELECTION_ID, STORAGE_KEY };
