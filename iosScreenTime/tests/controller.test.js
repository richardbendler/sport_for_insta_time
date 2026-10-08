const test = require("node:test");
const assert = require("node:assert/strict");
const { createController, STORAGE_KEY } = require("../controller");
const plan = require("../budgetPlan");
const { createFakeDeviceActivity, createMemoryStorage } = require("./fakeDeviceActivity");

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const T0 = new Date(2026, 8, 30, 10, 0, 0).getTime();

const TEXTS = {
  title: "Zeit für Sport",
  subtitle: "Verdiene dir Bildschirmzeit.",
  primaryButtonLabel: "Zur App",
  secondaryButtonLabel: "Schließen",
  notificationTitle: "Los geht's",
  notificationBody: "Öffne die App",
  usedUpTitle: "Bildschirmzeit aufgebraucht",
  usedUpBody: "Mach Sport",
  warningTitle: "Noch 5 Minuten",
  warningBody: "Bald gesperrt",
};

const setup = ({ authorized = true, selection = "token-a", storage } = {}) => {
  let clock = T0;
  const da = createFakeDeviceActivity({ authorized, selection });
  let store = storage;
  if (!store) {
    // Daily free time is covered by the store tests; keep these budgets exact.
    store = createMemoryStorage();
    store.data[STORAGE_KEY] = JSON.stringify({ dailyFreeMinutes: 0 });
  }
  const controller = createController({
    deviceActivity: da,
    storage: store,
    platformVersion: "17.5",
    now: () => clock,
  });
  controller.setShieldTexts(TEXTS);
  const advance = (ms) => {
    clock += ms;
    da.setClock(clock);
  };
  da.setClock(clock);
  return { da, storage: store, controller, advance, now: () => clock };
};

const earn = (controller, id, seconds, createdAt) =>
  controller.upsertScreenTimeEntry(id, "pushups", createdAt, seconds);

test("unsupported iOS versions and missing module disable the feature", () => {
  const storage = createMemoryStorage();
  assert.equal(
    createController({ deviceActivity: createFakeDeviceActivity(), storage, platformVersion: "15.8" }).isSupported(),
    false
  );
  assert.equal(
    createController({ deviceActivity: null, storage, platformVersion: "17.0" }).isSupported(),
    false
  );
  assert.equal(
    createController({ deviceActivity: createFakeDeviceActivity(), storage, platformVersion: "16.0" }).isSupported(),
    true
  );
});

test("without earned time the selected apps are shielded", async () => {
  const { da, controller } = setup();
  await controller.syncNow();
  assert.equal(da.isBlocked(), true);
  assert.equal(da.monitors.size, 0);
});

test("nothing is shielded while Screen Time access is missing", async () => {
  const { da, controller } = setup({ authorized: false });
  await controller.syncNow();
  assert.equal(da.isBlocked(), false);
  assert.equal(da.monitors.size, 0);
});

test("nothing is shielded while no apps are selected", async () => {
  const { da, controller } = setup({ selection: null });
  await controller.syncNow();
  assert.equal(da.isBlocked(), false);
  assert.equal(da.monitors.size, 0);
});

test("a workout lifts the shield and starts minute thresholds", async () => {
  const { da, controller, now } = setup();
  await controller.syncNow();
  await earn(controller, "w1", 10 * 60, now());
  assert.equal(da.isBlocked(), false);
  assert.equal(da.monitors.size, 1);
  const [name, monitor] = [...da.monitors.entries()][0];
  assert.ok(plan.isBudgetActivity(name));
  assert.deepEqual(
    monitor.events.map((event) => Number(event.eventName)),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  );
  assert.ok(monitor.events.every((event) => event.includesPastActivity === false));
  assert.ok(da.userDefaults[`actions_for_${name}_eventDidReachThreshold_10`]);
});

test("usage is booked from thresholds and the monitor keeps running", async () => {
  const { da, controller, now, advance } = setup();
  await earn(controller, "w1", 10 * 60, now());
  const name = [...da.monitors.keys()][0];
  advance(5 * MIN);
  da.useApps(4);
  const state = await controller.syncNow();
  assert.equal(state.remainingSeconds, 6 * 60);
  assert.equal(state.usedSeconds, 4 * 60);
  assert.deepEqual([...da.monitors.keys()], [name]);
  assert.equal(da.isBlocked(), false);
});

test("the extension re-shields when the budget is used up, with a warning first", async () => {
  const { da, controller, now, advance } = setup();
  await earn(controller, "w1", 10 * 60, now());
  advance(MIN);
  da.useApps(5);
  assert.equal(da.isBlocked(), false);
  assert.equal(da.notifications.at(-1).title, TEXTS.warningTitle);
  da.useApps(5);
  assert.equal(da.isBlocked(), true);
  assert.equal(da.notifications.at(-1).title, TEXTS.usedUpTitle);
  const state = await controller.syncNow();
  assert.equal(state.remainingSeconds, 0);
  assert.equal(da.isBlocked(), true);
  assert.equal(da.monitors.size, 0);
});

test("a new workout while shielded unblocks despite intervalDidEnd of the old monitor", async () => {
  const { da, controller, now, advance } = setup();
  await earn(controller, "w1", 2 * 60, now());
  da.useApps(2);
  await controller.syncNow();
  assert.equal(da.isBlocked(), true);
  advance(MIN);
  await earn(controller, "w2", 5 * 60, now());
  assert.equal(da.isBlocked(), false);
  assert.equal(da.monitors.size, 1);
});

test("adding time while a monitor runs restarts it without shielding", async () => {
  const { da, controller, now, advance } = setup();
  await earn(controller, "w1", 10 * 60, now());
  const first = [...da.monitors.keys()][0];
  advance(MIN);
  da.useApps(3);
  await earn(controller, "w2", 5 * 60, now());
  assert.equal(da.isBlocked(), false);
  const [second, monitor] = [...da.monitors.entries()][0];
  assert.notEqual(first, second);
  assert.equal(Number(monitor.events.at(-1).eventName), 12);
  const state = await controller.getUsageState();
  assert.equal(state.remainingSeconds, 12 * 60);
});

test("changing the app selection replaces the shielded apps", async () => {
  const { da, controller } = setup();
  await controller.syncNow();
  assert.deepEqual(da.blockedTokens(), ["token-a"]);
  da.selectApps("token-b");
  await controller.syncNow();
  assert.deepEqual(da.blockedTokens(), ["token-b"]);
});

test("changing the selection while time is left restarts monitoring for the new apps", async () => {
  const { da, controller, now } = setup();
  await earn(controller, "w1", 10 * 60, now());
  da.selectApps("token-b");
  await controller.syncNow();
  const monitor = [...da.monitors.values()][0];
  assert.ok(monitor.events.every((event) => event.familyActivitySelection === "token-b"));
});

test("at midnight the shield comes back and the next day starts with decayed time", async () => {
  const { da, controller, now, advance } = setup();
  await earn(controller, "w1", 20 * 60, now());
  da.endDay();
  assert.equal(da.isBlocked(), true);
  advance(DAY);
  const state = await controller.syncNow();
  assert.equal(state.remainingSeconds, 10 * 60);
  assert.equal(da.isBlocked(), false);
  assert.equal(da.monitors.size, 1);
});

test("large budgets use coarser steps after the first hour and warn 5 minutes before", async () => {
  const { da, controller, now } = setup();
  await earn(controller, "w1", 150 * 60, now());
  const monitor = [...da.monitors.values()][0];
  const minutes = monitor.events.map((event) => Number(event.eventName));
  assert.equal(minutes.at(-1), 150);
  assert.ok(minutes.includes(145));
  assert.ok(minutes.includes(60) && minutes.includes(65) && !minutes.includes(61));
  assert.ok(minutes.length < 90);
  const last = monitor.events.at(-1).threshold;
  assert.deepEqual(last, { hour: 2, minute: 30 });
});

test("rounded budgets never lose earned seconds", async () => {
  const { da, controller, now, advance } = setup();
  await earn(controller, "w1", 140, now());
  advance(MIN);
  da.useApps(2);
  assert.equal(da.isBlocked(), true);
  let state = await controller.syncNow();
  assert.equal(state.remainingSeconds, 20);
  assert.equal(da.isBlocked(), false);
  da.useApps(1);
  state = await controller.syncNow();
  assert.equal(state.remainingSeconds, 0);
  assert.equal(da.isBlocked(), true);
});

test("state survives an app restart", async () => {
  const first = setup();
  await earn(first.controller, "w1", 10 * 60, first.now());
  first.da.useApps(3);
  await first.controller.syncNow();
  assert.ok(first.storage.data[STORAGE_KEY]);
  const second = createController({
    deviceActivity: first.da,
    storage: first.storage,
    platformVersion: "17.5",
    now: () => first.now(),
  });
  const state = await second.syncNow();
  assert.equal(state.remainingSeconds, 7 * 60);
  assert.equal(first.da.monitors.size, 1);
  first.da.useApps(2);
  const after = await second.syncNow();
  assert.equal(after.remainingSeconds, 5 * 60);
});

test("usage polling only syncs every 15 seconds", async () => {
  const { da, controller, now, advance } = setup();
  await earn(controller, "w1", 10 * 60, now());
  await controller.getUsageState();
  da.useApps(2);
  let state = await controller.getUsageState();
  assert.equal(state.remainingSeconds, 10 * 60);
  advance(16 * 1000);
  state = await controller.getUsageState();
  assert.equal(state.remainingSeconds, 8 * 60);
});

test("usage state has the shape App.js expects", async () => {
  const { controller, now } = setup();
  await earn(controller, "w1", 60, now());
  const state = await controller.getUsageState();
  for (const key of [
    "remainingSeconds",
    "usedSeconds",
    "day",
    "carryoverSeconds",
    "entryCount",
    "remainingBySport",
    "usedByApp",
    "creditPenaltyMultiplier",
    "creditLockExpiresAt",
  ]) {
    assert.ok(key in state, key);
  }
  const entries = await controller.getScreenTimeEntries();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].sportId, "pushups");
});

test("clearing app data lifts the shield and stops monitoring", async () => {
  const { da, controller, now } = setup();
  await earn(controller, "w1", 10 * 60, now());
  await controller.clearAppData();
  assert.equal(da.isBlocked(), false);
  assert.equal(da.monitors.size, 0);
});

test("authorization request enables blocking right away", async () => {
  const { da, controller } = setup({ authorized: false });
  await controller.syncNow();
  assert.equal(da.isBlocked(), false);
  await controller.requestAuthorization();
  assert.equal(da.isBlocked(), true);
});

test("shield texts are passed to the shield with a notification action", () => {
  const { da } = setup();
  assert.equal(da.userDefaults.shieldConfiguration.title, TEXTS.title);
  assert.equal(da.userDefaults.shieldActions.primary.actions[0].type, "sendNotification");
});

test("deselecting all apps lifts the shield", async () => {
  const { da, controller } = setup();
  await controller.syncNow();
  assert.equal(da.isBlocked(), true);
  da.selectApps("");
  await controller.syncNow();
  assert.equal(da.isBlocked(), false);
  assert.equal(da.monitors.size, 0);
});

test("finished day windows are cleaned up from shared storage", async () => {
  const { da, controller, now, advance } = setup();
  await earn(controller, "w1", 20 * 60, now());
  const first = [...da.monitors.keys()][0];
  da.endDay();
  advance(DAY);
  await controller.syncNow();
  assert.ok(!Object.keys(da.userDefaults).some((key) => key.includes(first)));
});
