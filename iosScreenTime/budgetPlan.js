// Planning helpers for the DeviceActivity monitor. The Screen Time API does
// not expose usage durations, so usage is reconstructed from threshold events
// that fire after N minutes of use of the selected apps.

// Minute resolution for the first hour, coarser afterwards to keep the
// number of registered events small.
const FINE_STEP_UNTIL_MINUTES = 60;
const COARSE_STEP_MINUTES = 5;
const WARNING_BEFORE_MINUTES = 5;

// Activity and event names end up in UserDefaults keys that the library
// splits on "_", so they must not contain underscores.
const ACTIVITY_PREFIX = "sfstbudget";

const budgetMinutesFor = (remainingSeconds) => {
  const seconds = Math.max(0, Math.floor(Number(remainingSeconds) || 0));
  if (seconds <= 0) {
    return 0;
  }
  return Math.max(1, Math.round(seconds / 60));
};

const thresholdMinutesFor = (budgetMinutes) => {
  if (budgetMinutes <= 0) {
    return [];
  }
  const minutes = new Set();
  for (let minute = 1; minute <= Math.min(budgetMinutes, FINE_STEP_UNTIL_MINUTES); minute += 1) {
    minutes.add(minute);
  }
  for (
    let minute = FINE_STEP_UNTIL_MINUTES + COARSE_STEP_MINUTES;
    minute < budgetMinutes;
    minute += COARSE_STEP_MINUTES
  ) {
    minutes.add(minute);
  }
  minutes.add(budgetMinutes);
  const warningMinute = budgetMinutes - WARNING_BEFORE_MINUTES;
  if (warningMinute >= 1) {
    minutes.add(warningMinute);
  }
  return [...minutes].sort((a, b) => a - b);
};

const thresholdComponents = (minutes) => ({
  hour: Math.floor(minutes / 60),
  minute: minutes % 60,
});

const createActivityName = (now) => `${ACTIVITY_PREFIX}${Math.floor(now)}`;

const isBudgetActivity = (name) =>
  typeof name === "string" && name.startsWith(ACTIVITY_PREFIX);

// Highest threshold (in minutes) reached for the given activity, based on
// the event history the monitor extension persisted.
const usedMinutesFromEvents = (events, activityName) => {
  let used = 0;
  (events || []).forEach((event) => {
    if (!event || event.activityName !== activityName) {
      return;
    }
    if (event.callbackName !== "eventDidReachThreshold") {
      return;
    }
    const minutes = Number(event.eventName);
    if (Number.isFinite(minutes) && minutes > used) {
      used = minutes;
    }
  });
  return used;
};

const intervalEndedFromEvents = (events, activityName) =>
  (events || []).some(
    (event) =>
      event &&
      event.activityName === activityName &&
      event.callbackName === "intervalDidEnd"
  );

// Whole-day window. Usage is only counted from the moment monitoring
// starts (includesPastActivity: false), and intervalDidEnd at midnight
// re-applies the shield until the app plans the next day.
const DAILY_SCHEDULE = {
  intervalStart: { hour: 0, minute: 0, second: 0 },
  intervalEnd: { hour: 23, minute: 59, second: 59 },
  repeats: false,
};

module.exports = {
  WARNING_BEFORE_MINUTES,
  DAILY_SCHEDULE,
  budgetMinutesFor,
  thresholdMinutesFor,
  thresholdComponents,
  createActivityName,
  isBudgetActivity,
  usedMinutesFromEvents,
  intervalEndedFromEvents,
};
