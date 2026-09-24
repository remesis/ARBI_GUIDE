const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "analyzer.js"), "utf8");
const names = [
  "finiteAverage", "comparisonIntervals", "singleRunTilesetAverages",
  "fillMissingTilesetAverages", "ensureTilesetAverages", "runAverageDeltas",
  "renderSavedRunList", "savedRunSnapshot", "reviveSavedRun",
];
const helpers = names.map(name => {
  const text = source.match(new RegExp(`  (?:async )?function ${name}\\([^]*?\\n  \\}`))?.[0];
  assert.ok(text, name);
  return text;
}).join("\n");
const omittedFields = source.match(/  const SAVED_RUN_OMITTED_FIELDS = new Set\(\[[^]*?\n  \]\);/)?.[0];
assert.ok(omittedFields);

function run(id = "one", nodeKey = "SolNode123") {
  return {
    savedRunId: id, runFingerprint: id, nodeKey, node: "Test node",
    missionType: "DEFENSE", totalDuration: 600, activeDuration: 550,
    rotations: 2, droneKills: 100, enemySpawns: 900, avgDroneInterval: 5,
    saturation: { abovePercent: 12, threshold: 15 }, actualVitus: "42",
    sourceDate: new Date("2026-08-01T00:00:00Z"), clientFreshBlessing: true,
  };
}

function response(rate = 5, nodeKey = "SolNode123") {
  return { ok: true, status: 200, json: async () => ({
    schema: "arbi-analyzer-node-average/v1", sol_node: nodeKey,
    expected_ve_per_minute: rate, collected_runs: rate * 10,
    drones_per_comparison_interval: rate * 10,
    enemies_per_comparison_interval: rate * 100,
    enemies_per_minute: rate * 20,
    duration_seconds_per_comparison_interval: rate * 60,
    drone_interval_seconds: rate,
    high_enemy_percent: rate * 2, high_enemy_threshold: 15,
  }) };
}

const settle = () => new Promise(resolve => setImmediate(resolve));

function harness(fetchImpl, runs = [run()]) {
  const calls = [], renders = [], toasts = [];
  const toggle = { setAttribute() {} }, list = {};
  let buttons = [];
  const context = {
    state: {
      savedRuns: runs.map(value => ({ id: value.savedRunId, run: value })),
      savedRunsExpanded: true, activeSavedId: "", showTilesetAverages: true,
      vitusCardStyle: "original",
    },
    tilesetAverageRequests: new Map(),
    TILESET_AVERAGE_ENDPOINT: "/api/analyzer/spawns/averages",
    INITIAL_RUN_MIN_SECONDS: 300,
    fetch: (...args) => { calls.push(args); return fetchImpl(...args); },
    displayedRunIs: value => context.state.savedRuns.find(record => record.id === context.state.activeSavedId)?.run === value,
    document: { activeElement: null, body: { classList: { remove() {} } } },
    renderReport: value => {
      renders.push(value);
      // Match the report's normal lazy-load guard, including the redraw after
      // a successful response. Reopening must not generate a second request.
      if (context.state.showTilesetAverages && !value.tilesetAveragesLoaded && !value.tilesetAveragesLoading) {
        void context.ensureTilesetAverages(value);
      }
    },
    renderRunList() {}, focusActualVitusEntry() {}, setupAnalyzerTooltips() {},
    showToast: (...args) => toasts.push(args),
    $: selector => selector === "#savedRunsToggle" ? toggle : list,
    $$: selector => {
      if (selector !== "[data-saved-open]") return [];
      buttons = context.state.savedRuns.map(record => ({
        dataset: { savedOpen: record.id },
        addEventListener(type, callback) { this.click = callback; },
      }));
      return buttons;
    },
    normalizedRunDate: value => value.sourceDate || null,
    localRunDate: () => "date", h: String, duration: String, fmt: String,
    cleanVitusDigits: value => String(value || "").replace(/\D/g, ""),
    Parser: { helpers: { calculateMissionSaturation: value => value.saturation } },
  };
  vm.createContext(context);
  vm.runInContext(`${omittedFields}\n${helpers}`, context);
  context.renderSavedRunList();
  return {
    context, calls, renders, toasts,
    open: id => buttons.find(button => button.dataset.savedOpen === (id || runs[0].savedRunId)).click(),
  };
}

test("each saved-run opening refreshes all comparisons without changing saved facts", async () => {
  const saved = run();
  let rate = 5;
  const h = harness(async () => response(rate), [saved]);
  const facts = JSON.stringify(h.context.savedRunSnapshot(saved));
  h.open();
  await settle();
  assert.equal(h.calls.length, 1);
  assert.equal(saved.tilesetAverageVitusRate, 5);
  assert.equal(h.context.runAverageDeltas(saved, 100).enemies, -100);
  rate = 7;
  h.open();
  await settle();
  assert.equal(h.calls.length, 2);
  assert.equal(saved.tilesetAverageVitusRate, 7);
  assert.equal(saved.tilesetAverageRunCount, 70);
  assert.equal(h.context.runAverageDeltas(saved, 100).enemies, -500);
  assert.equal(saved.tilesetAverages.droneIntervalSeconds, 7);
  assert.equal(saved.tilesetAverages.highEnemyPercent, 14);
  assert.equal(JSON.stringify(h.context.savedRunSnapshot(saved)), facts);
  assert.equal(h.context.tilesetAverageRequests.size, 0);
  for (const [url, options] of h.calls) {
    assert.equal(url, "/api/analyzer/spawns/averages?sol_node=SolNode123");
    assert.equal(options.method, "GET");
    assert.equal(options.cache, "no-store");
    assert.equal(options.body, undefined);
  }
});

test("concurrent opens share one request, but later same-node opens refetch", async () => {
  let resolve;
  const h = harness(() => new Promise(done => { resolve = done; }), [run(), run("two")]);
  h.open("one");
  h.open("one");
  h.open("two");
  assert.equal(h.calls.length, 1);
  resolve(response());
  await settle();
  for (const { run: value } of h.context.state.savedRuns) assert.equal(value.tilesetAverageVitusRate, 5);
  assert.equal(h.renders.length, 4); // Three opens, then only the visible run redraws.
  h.open("one");
  assert.equal(h.calls.length, 2);
  resolve(response(8));
  await settle();
  assert.equal(h.context.state.savedRuns[0].run.tilesetAverageVitusRate, 8);
});

test("a slow response cannot replace the run selected in the meantime", async () => {
  const pending = new Map();
  const h = harness(url => new Promise(resolve => pending.set(url, resolve)), [run(), run("two", "SolNode456")]);
  h.open("one");
  h.open("two");
  pending.get("/api/analyzer/spawns/averages?sol_node=SolNode456")(response(9, "SolNode456"));
  await settle();
  const renderCount = h.renders.length;
  pending.get("/api/analyzer/spawns/averages?sol_node=SolNode123")(response(5));
  await settle();
  assert.equal(h.renders.length, renderCount);
  assert.equal(h.renders.at(-1).savedRunId, "two");
});

test("failed refresh preserves prior comparisons, warns, and retries on reopening", async () => {
  let fail = false;
  const saved = run();
  const h = harness(async () => {
    if (fail) throw new Error("offline");
    return response(6);
  }, [saved]);
  h.open();
  await settle();
  fail = true;
  h.open();
  await settle();
  assert.equal(saved.tilesetAverageVitusRate, 6);
  assert.equal(saved.tilesetAveragesLoading, false);
  assert.match(h.toasts.at(-1)[0], /last available averages/);
  assert.equal(h.context.tilesetAverageRequests.size, 0);
  fail = false;
  h.open();
  await settle();
  assert.equal(h.calls.length, 3);
});

test("HTTP, invalid JSON, schema and node errors never become cached benchmarks", async () => {
  for (const bad of [
    { ok: false, status: 503 },
    { ok: true, status: 200, json: async () => { throw new Error("invalid JSON"); } },
    { ok: true, status: 200, json: async () => ({ schema: "old", sol_node: "SolNode123", expected_ve_per_minute: 5 }) },
    response(5, "SolNode456"), response(0),
  ]) {
    let current = bad;
    const h = harness(async () => current);
    h.open();
    await settle();
    assert.equal(h.context.state.savedRuns[0].run.tilesetAverages, undefined);
    assert.match(h.toasts.at(-1)[0], /unavailable right now/);
    current = response();
    h.open();
    await settle();
    assert.equal(h.calls.length, 2);
    assert.equal(h.context.state.savedRuns[0].run.tilesetAverageVitusRate, 5);
  }
});

test("an absent benchmark clears a previous Vitus rate and can recover later", async () => {
  let current = response();
  const saved = run();
  const h = harness(async () => current, [saved]);
  h.open();
  await settle();
  current = { ok: false, status: 404 };
  h.open();
  await settle();
  assert.equal(saved.tilesetAverageVitusRate, null);
  assert.equal(saved.tilesetAverageRunCount, 0);
  assert.equal(saved.tilesetAverages.isSingleRunFallback, true);
  assert.equal(h.context.runAverageDeltas(saved, 100).enemies, 0);
  current = response(8);
  h.open();
  await settle();
  assert.equal(saved.tilesetAverageVitusRate, 8);
  assert.equal(saved.tilesetAverages.isSingleRunFallback, false);
});

test("saved runs refresh even with the comparison display toggled off", async () => {
  const h = harness(async () => response());
  h.context.state.showTilesetAverages = false;
  h.open();
  await settle();
  assert.equal(h.calls.length, 1);
  assert.equal(h.context.state.showTilesetAverages, false);
  assert.equal(h.context.state.savedRuns[0].run.tilesetAverageVitusRate, 5);
});

test("invalid node identifiers do not send a request", async () => {
  for (const nodeKey of ["", "arbitrary", "SolNode123&extra=private"]) {
    const h = harness(async () => response(), [run("one", nodeKey)]);
    h.open();
    await settle();
    assert.equal(h.calls.length, 0);
    assert.equal(h.context.state.savedRuns[0].run.tilesetAveragesLoaded, true);
  }
});

test("old saved average values and loading flags are discarded when revived", () => {
  const h = harness(async () => response());
  const saved = {
    ...run(), tilesetAverages: { rate: 999 }, tilesetAverageVitusRate: 999,
    tilesetAverageRunCount: 999, tilesetAveragesLoaded: true, tilesetAveragesLoading: true,
  };
  const restored = h.context.reviveSavedRun({ id: "one", run: saved });
  for (const key of Object.keys(saved).filter(key => key.startsWith("tilesetAverage"))) {
    assert.equal(restored[key], undefined);
    assert.equal(h.context.savedRunSnapshot(saved)[key], undefined);
  }
  assert.equal(restored.actualVitus, "42");
  assert.equal(restored.runFingerprint, "one");
});
