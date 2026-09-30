// In-memory stand-in for react-native-device-activity that mimics the
// behaviour of the native module and the DeviceActivityMonitor extension
// closely enough to exercise the controller logic in Node.

const createFakeDeviceActivity = ({ authorized = true, selection = "token-a" } = {}) => {
  const userDefaults = {};
  const monitors = new Map();
  const blocklist = new Set();
  const notifications = [];
  const usageByActivity = new Map();
  let authStatus = authorized ? 2 : 0;
  let clock = 0;

  const selections = () => userDefaults.familyActivitySelectionIds || {};

  const recordEvent = (activityName, callbackName, eventName) => {
    const key = eventName
      ? `events_${activityName}_${callbackName}_${eventName}`
      : `events_${activityName}_${callbackName}`;
    userDefaults[key] = clock;
  };

  const runActions = (activityName, callbackName, eventName) => {
    const key = eventName
      ? `actions_for_${activityName}_${callbackName}_${eventName}`
      : `actions_for_${activityName}_${callbackName}`;
    (userDefaults[key] || []).forEach((action) => {
      if (action.type === "blockSelection") {
        const token = selections()[action.familyActivitySelectionId];
        if (token) {
          blocklist.add(token);
        }
      } else if (action.type === "sendNotification") {
        notifications.push(action.payload);
      }
    });
  };

  const api = {
    // --- library surface used by the controller ---
    getAuthorizationStatus: () => authStatus,
    requestAuthorization: async () => {
      authStatus = 2;
    },
    pollAuthorizationStatus: async () => authStatus,
    getFamilyActivitySelectionId: (id) => selections()[id],
    activitySelectionMetadata: ({ activitySelectionId }) => {
      const token = selections()[activitySelectionId];
      return token
        ? { applicationCount: token.split(",").length, categoryCount: 0, webDomainCount: 0 }
        : { applicationCount: 0, categoryCount: 0, webDomainCount: 0 };
    },
    updateShield: (config, actions) => {
      userDefaults.shieldConfiguration = config;
      userDefaults.shieldActions = actions;
    },
    configureActions: ({ activityName, callbackName, eventName, actions }) => {
      const key = eventName
        ? `actions_for_${activityName}_${callbackName}_${eventName}`
        : `actions_for_${activityName}_${callbackName}`;
      userDefaults[key] = actions;
    },
    cleanUpAfterActivity: (activityName) => {
      Object.keys(userDefaults).forEach((key) => {
        if (
          key.startsWith(`actions_for_${activityName}`) ||
          key.startsWith(`events_${activityName}`)
        ) {
          delete userDefaults[key];
        }
      });
    },
    startMonitoring: async (activityName, schedule, events) => {
      if (monitors.has(activityName)) {
        throw new Error(`already monitoring ${activityName}`);
      }
      events.forEach((event) => {
        if (!event.familyActivitySelection) {
          throw new Error("event without selection");
        }
        if (/_/.test(event.eventName) || /_/.test(activityName)) {
          throw new Error("names must not contain underscores");
        }
      });
      monitors.set(activityName, { schedule, events });
      usageByActivity.set(activityName, 0);
      recordEvent(activityName, "intervalDidStart");
    },
    // Real devices may report intervalDidEnd when monitoring is stopped.
    stopMonitoring: (names) => {
      (names || [...monitors.keys()]).forEach((name) => {
        if (!monitors.has(name)) {
          return;
        }
        monitors.delete(name);
        runActions(name, "intervalDidEnd");
        recordEvent(name, "intervalDidEnd");
      });
    },
    getActivities: () => [...monitors.keys()],
    getEvents: (activityName) =>
      Object.keys(userDefaults)
        .filter((key) => key.startsWith("events_"))
        .map((key) => {
          const [, name, callbackName, eventName] = key.split("_");
          return { activityName: name, callbackName, eventName, lastCalledAt: new Date(userDefaults[key]) };
        })
        .filter((event) => !activityName || event.activityName === activityName),
    resetBlocks: () => blocklist.clear(),
    blockSelection: ({ activitySelectionId }) => {
      const token = selections()[activitySelectionId];
      if (token) {
        blocklist.add(token);
      }
    },
    isShieldActive: () => blocklist.size > 0,

    // --- test helpers ---
    selectApps: (token) => {
      userDefaults.familyActivitySelectionIds = {
        ...selections(),
        restrictedapps: token,
      };
    },
    setAuthorized: (value) => {
      authStatus = value ? 2 : 1;
    },
    setClock: (value) => {
      clock = value;
    },
    // Simulates the user spending `minutes` in the selected apps while the
    // given (or only) monitor is active; fires thresholds like the extension.
    useApps: (minutes, activityName) => {
      const name = activityName || [...monitors.keys()][0];
      const monitor = monitors.get(name);
      if (!monitor || blocklist.size > 0) {
        return 0;
      }
      const before = usageByActivity.get(name);
      const after = before + minutes;
      usageByActivity.set(name, after);
      monitor.events
        .map((event) => ({
          name: event.eventName,
          total: (event.threshold.hour || 0) * 60 + (event.threshold.minute || 0),
        }))
        .filter((event) => event.total > before && event.total <= after)
        .sort((a, b) => a.total - b.total)
        .forEach((event) => {
          runActions(name, "eventDidReachThreshold", event.name);
          recordEvent(name, "eventDidReachThreshold", event.name);
        });
      return after;
    },
    endDay: () => {
      [...monitors.keys()].forEach((name) => {
        monitors.delete(name);
        runActions(name, "intervalDidEnd");
        recordEvent(name, "intervalDidEnd");
      });
    },
    isBlocked: () => blocklist.size > 0,
    blockedTokens: () => [...blocklist],
    monitors,
    notifications,
    userDefaults,
  };
  if (selection) {
    api.selectApps(selection);
  }
  return api;
};

const createMemoryStorage = () => {
  const data = {};
  return {
    getItem: async (key) => (key in data ? data[key] : null),
    setItem: async (key, value) => {
      data[key] = value;
    },
    data,
  };
};

module.exports = { createFakeDeviceActivity, createMemoryStorage };
