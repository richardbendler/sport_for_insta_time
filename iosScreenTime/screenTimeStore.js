// JS port of android/.../ScreenTimeStore.kt so iOS books earned screen time
// the same way: every workout creates an entry, entries lose half of their
// remaining time per elapsed day and are consumed oldest first.
// All functions work on a plain state object and never do any IO.

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DECAY_DAYS = 30;
const DAILY_FREE_PREFIX = "daily_free_";
const DEFAULT_DAILY_FREE_MINUTES = 10;
const DAILY_FREE_MAX_MINUTES = 240;

const createState = () => ({
  entries: [],
  usedSeconds: 0,
  lastDay: "",
  dailyFreeMinutes: DEFAULT_DAILY_FREE_MINUTES,
});

const pad = (value) => String(value).padStart(2, "0");

const todayKey = (now) => {
  const date = new Date(now);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const ensureToday = (state, now) => {
  const today = todayKey(now);
  if (state.lastDay !== today) {
    state.usedSeconds = 0;
    state.lastDay = today;
  }
  return today;
};

const clampDailyFreeMinutes = (value) => {
  const numeric = Math.floor(Number(value));
  if (!Number.isFinite(numeric)) {
    return DEFAULT_DAILY_FREE_MINUTES;
  }
  return Math.max(0, Math.min(DAILY_FREE_MAX_MINUTES, numeric));
};

const startOfDay = (now) => {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

// Free screen time granted every day; it expires at midnight instead of
// carrying over like earned time.
const ensureDailyFreeEntry = (state, now) => {
  const todayId = `${DAILY_FREE_PREFIX}${todayKey(now)}`;
  state.entries = state.entries.filter(
    (entry) => !String(entry.id).startsWith(DAILY_FREE_PREFIX) || entry.id === todayId
  );
  const minutes = clampDailyFreeMinutes(state.dailyFreeMinutes);
  if (minutes <= 0 || state.entries.some((entry) => entry.id === todayId)) {
    return;
  }
  const dayStart = startOfDay(now);
  state.entries.push({
    id: todayId,
    sportId: null,
    createdAt: dayStart,
    remainingSeconds: minutes * 60,
    lastDecayAt: dayStart,
    originalSeconds: minutes * 60,
    decayCount: 0,
  });
};

const setDailyFreeMinutes = (state, minutes, now) => {
  const safeMinutes = clampDailyFreeMinutes(minutes);
  state.dailyFreeMinutes = safeMinutes;
  const todayId = `${DAILY_FREE_PREFIX}${todayKey(now)}`;
  const existing = state.entries.find((entry) => entry.id === todayId);
  if (!existing) {
    ensureDailyFreeEntry(state, now);
    return;
  }
  if (safeMinutes <= 0) {
    state.entries = state.entries.filter((entry) => entry !== existing);
    return;
  }
  const usedSeconds = Math.max(0, existing.originalSeconds - existing.remainingSeconds);
  existing.originalSeconds = safeMinutes * 60;
  existing.remainingSeconds = Math.max(0, existing.originalSeconds - usedSeconds);
};

const applyDecay = (state, now) => {
  ensureDailyFreeEntry(state, now);
  let changed = false;
  state.entries = state.entries.filter((entry) => {
    const elapsedDays = Math.max(0, Math.floor((now - entry.createdAt) / DAY_MS));
    const targetHalves = Math.min(elapsedDays, MAX_DECAY_DAYS);
    const missingHalves = targetHalves - entry.decayCount;
    if (missingHalves > 0) {
      let remaining = entry.remainingSeconds;
      for (let i = 0; i < missingHalves; i += 1) {
        remaining = Math.floor(remaining / 2);
      }
      entry.remainingSeconds = elapsedDays > MAX_DECAY_DAYS ? 0 : remaining;
      entry.decayCount = targetHalves;
      entry.lastDecayAt = entry.createdAt + entry.decayCount * DAY_MS;
      changed = true;
    } else if (elapsedDays > MAX_DECAY_DAYS && entry.remainingSeconds > 0) {
      entry.remainingSeconds = 0;
      entry.decayCount = targetHalves;
      entry.lastDecayAt = entry.createdAt + entry.decayCount * DAY_MS;
      changed = true;
    }
    if (entry.remainingSeconds <= 0 && now - entry.createdAt >= DAY_MS) {
      changed = true;
      return false;
    }
    return true;
  });
  return changed;
};

const upsertEntry = (state, { entryId, sportId, createdAt, totalSeconds }, now) => {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  applyDecay(state, now);
  const existing = state.entries.find((entry) => entry.id === entryId);
  if (safeSeconds <= 0) {
    if (existing) {
      state.entries = state.entries.filter((entry) => entry !== existing);
    }
    return;
  }
  if (existing) {
    existing.originalSeconds = safeSeconds;
    if (existing.remainingSeconds > safeSeconds) {
      existing.remainingSeconds = safeSeconds;
    }
    return;
  }
  const created = Number(createdAt) || now;
  state.entries.push({
    id: entryId,
    sportId: sportId || null,
    createdAt: created,
    remainingSeconds: safeSeconds,
    lastDecayAt: created,
    originalSeconds: safeSeconds,
    decayCount: 0,
  });
  // Entries created in the past (e.g. synced after an update) must start
  // with the decay they would already have received.
  applyDecay(state, now);
};

const removeEntry = (state, entryId) => {
  state.entries = state.entries.filter((entry) => entry.id !== entryId);
};

const clearEntriesForSport = (state, sportId) => {
  state.entries = state.entries.filter((entry) => entry.sportId !== sportId);
};

const clearAllEntries = (state) => {
  state.entries = [];
};

const getTotals = (state, now) => {
  applyDecay(state, now);
  const remainingBySport = {};
  let total = 0;
  let count = 0;
  state.entries.forEach((entry) => {
    if (entry.remainingSeconds <= 0) {
      return;
    }
    count += 1;
    total += entry.remainingSeconds;
    if (entry.sportId) {
      remainingBySport[entry.sportId] =
        (remainingBySport[entry.sportId] || 0) + entry.remainingSeconds;
    }
  });
  return { remainingSeconds: total, remainingBySport, entryCount: count };
};

const getBreakdown = (state, now) => {
  applyDecay(state, now);
  const cutoff = now - DAY_MS;
  let carryoverSeconds = 0;
  let totalTodaySeconds = 0;
  state.entries.forEach((entry) => {
    if (entry.createdAt >= cutoff) {
      totalTodaySeconds += entry.originalSeconds;
    } else if (entry.remainingSeconds > 0) {
      carryoverSeconds += entry.remainingSeconds;
    }
  });
  return { carryoverSeconds, totalTodaySeconds };
};

const consumeSeconds = (state, now, seconds) => {
  applyDecay(state, now);
  ensureToday(state, now);
  let remainingToConsume = Math.max(0, Math.floor(seconds));
  const sorted = [...state.entries].sort(
    (a, b) => a.createdAt - b.createdAt || String(a.id).localeCompare(String(b.id))
  );
  for (const entry of sorted) {
    if (remainingToConsume <= 0) {
      break;
    }
    if (entry.remainingSeconds <= 0) {
      continue;
    }
    const used = Math.min(entry.remainingSeconds, remainingToConsume);
    entry.remainingSeconds -= used;
    remainingToConsume -= used;
  }
  const consumed = Math.max(0, Math.floor(seconds)) - remainingToConsume;
  state.usedSeconds += consumed;
  state.entries = state.entries.filter(
    (entry) => entry.remainingSeconds > 0 || entry.createdAt >= now - DAY_MS
  );
  return consumed;
};

const getUsedSecondsToday = (state, now) => {
  ensureToday(state, now);
  return state.usedSeconds;
};

const getEntries = (state, now) => {
  applyDecay(state, now);
  return [...state.entries].sort((a, b) => b.createdAt - a.createdAt);
};

module.exports = {
  DAY_MS,
  DAILY_FREE_PREFIX,
  createState,
  setDailyFreeMinutes,
  todayKey,
  upsertEntry,
  removeEntry,
  clearEntriesForSport,
  clearAllEntries,
  getTotals,
  getBreakdown,
  consumeSeconds,
  getUsedSecondsToday,
  getEntries,
};
