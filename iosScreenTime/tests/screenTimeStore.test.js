const test = require("node:test");
const assert = require("node:assert/strict");
const store = require("../screenTimeStore");

const DAY = store.DAY_MS;
const T0 = new Date(2026, 8, 30, 10, 0, 0).getTime();

const withEntry = (seconds, createdAt = T0, id = "e1", sportId = "pushups") => {
  const state = store.createState();
  store.upsertEntry(state, { entryId: id, sportId, createdAt, totalSeconds: seconds }, createdAt);
  return state;
};

test("upsert adds an entry and totals count it per sport", () => {
  const state = withEntry(600);
  const totals = store.getTotals(state, T0);
  assert.equal(totals.remainingSeconds, 600);
  assert.equal(totals.entryCount, 1);
  assert.deepEqual(totals.remainingBySport, { pushups: 600 });
});

test("upsert with the same id updates instead of duplicating", () => {
  const state = withEntry(600);
  store.upsertEntry(state, { entryId: "e1", sportId: "pushups", createdAt: T0, totalSeconds: 300 }, T0);
  assert.equal(store.getTotals(state, T0).remainingSeconds, 300);
  assert.equal(state.entries.length, 1);
});

test("upsert with zero seconds removes the entry", () => {
  const state = withEntry(600);
  store.upsertEntry(state, { entryId: "e1", sportId: "pushups", createdAt: T0, totalSeconds: 0 }, T0);
  assert.equal(store.getTotals(state, T0).remainingSeconds, 0);
  assert.equal(state.entries.length, 0);
});

test("remaining time halves once per elapsed day, like on Android", () => {
  const state = withEntry(800);
  assert.equal(store.getTotals(state, T0 + DAY - 1).remainingSeconds, 800);
  assert.equal(store.getTotals(state, T0 + DAY).remainingSeconds, 400);
  assert.equal(store.getTotals(state, T0 + 2 * DAY).remainingSeconds, 200);
  assert.equal(store.getTotals(state, T0 + 3 * DAY + 5).remainingSeconds, 100);
});

test("an old entry synced later starts with its decay already applied", () => {
  const state = store.createState();
  store.upsertEntry(state, { entryId: "old", sportId: "run", createdAt: T0 - 2 * DAY, totalSeconds: 800 }, T0);
  assert.equal(store.getTotals(state, T0).remainingSeconds, 200);
});

test("entries older than 30 days are dropped", () => {
  const state = withEntry(1_000_000);
  assert.equal(store.getTotals(state, T0 + 31 * DAY).remainingSeconds, 0);
  assert.equal(state.entries.length, 0);
});

test("consumption takes from the oldest entry first and tracks daily usage", () => {
  const state = store.createState();
  store.upsertEntry(state, { entryId: "a", sportId: "s1", createdAt: T0, totalSeconds: 100 }, T0);
  store.upsertEntry(state, { entryId: "b", sportId: "s2", createdAt: T0 + 1000, totalSeconds: 100 }, T0 + 1000);
  const consumed = store.consumeSeconds(state, T0 + 2000, 150);
  assert.equal(consumed, 150);
  const totals = store.getTotals(state, T0 + 2000);
  assert.equal(totals.remainingSeconds, 50);
  assert.deepEqual(totals.remainingBySport, { s2: 50 });
  assert.equal(store.getUsedSecondsToday(state, T0 + 2000), 150);
});

test("consumption never goes below zero", () => {
  const state = withEntry(60);
  assert.equal(store.consumeSeconds(state, T0, 500), 60);
  assert.equal(store.getTotals(state, T0).remainingSeconds, 0);
});

test("daily usage resets on a new day", () => {
  const state = withEntry(600);
  store.consumeSeconds(state, T0, 100);
  assert.equal(store.getUsedSecondsToday(state, T0), 100);
  assert.equal(store.getUsedSecondsToday(state, T0 + DAY), 0);
});

test("breakdown reports carryover from entries older than a day", () => {
  const state = withEntry(800);
  store.upsertEntry(state, { entryId: "new", sportId: "run", createdAt: T0 + DAY + 1, totalSeconds: 300 }, T0 + DAY + 1);
  const breakdown = store.getBreakdown(state, T0 + DAY + 1);
  assert.equal(breakdown.carryoverSeconds, 400);
  assert.equal(breakdown.totalTodaySeconds, 300);
});

test("clear helpers remove the expected entries", () => {
  const state = store.createState();
  store.upsertEntry(state, { entryId: "a", sportId: "s1", createdAt: T0, totalSeconds: 100 }, T0);
  store.upsertEntry(state, { entryId: "b", sportId: "s2", createdAt: T0, totalSeconds: 100 }, T0);
  store.clearEntriesForSport(state, "s1");
  assert.deepEqual(state.entries.map((e) => e.id), ["b"]);
  store.removeEntry(state, "b");
  assert.equal(state.entries.length, 0);
  store.upsertEntry(state, { entryId: "c", sportId: "s2", createdAt: T0, totalSeconds: 100 }, T0);
  store.clearAllEntries(state);
  assert.equal(state.entries.length, 0);
});
