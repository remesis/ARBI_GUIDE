const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "analyzer.js"), "utf8");
const summarySource = source.match(/  function formatParseSummary\([^]*?\n  \}/)?.[0];
const importSource = source.match(/  async function importFile\([^]*?\n  \}/)?.[0];
assert.ok(summarySource);
assert.ok(importSource);
const format = vm.runInNewContext(`${summarySource}; formatParseSummary;`);

test("parse summary shows decimal mb/gb, adaptive time precision, and singular/plural runs", () => {
  assert.equal(format(120_400_000, 2345, 1), "120.4mb Parsed in 2.3s - 1 run found.");
  assert.equal(format(9_396_793_612, 126_789, 3), "9.4gb Parsed in 126.8s - 3 runs found.");
  assert.equal(format(999_900_000, 150, 2), "999.9mb Parsed in 0.150s - 2 runs found.");
  assert.equal(format(1_000_000_000, 1500, 1), "1.0gb Parsed in 1.5s - 1 run found.");
  assert.equal(format(45_000, 0, 1), "0.0mb Parsed in 0.000s - 1 run found.");
});

test("subsecond times use three decimals and switch to one at a full second", () => {
  assert.equal(format(1e6, 1, 1), "1.0mb Parsed in 0.001s - 1 run found.");
  assert.equal(format(1e6, 237.6, 1), "1.0mb Parsed in 0.238s - 1 run found.");
  assert.equal(format(1e6, 999, 1), "1.0mb Parsed in 0.999s - 1 run found.");
  assert.equal(format(1e6, 1000, 1), "1.0mb Parsed in 1.0s - 1 run found.");
});

function createImportHarness(parse) {
  const status = {}, input = {value: "selected.log"};
  const events = [];
  let now = 1000;
  const context = {
    performance: {now: () => now},
    $: selector => selector === "#parseStatus" ? status : input,
    Parser: {parseFile: async (file, progress) => {
      now += 2345;
      progress(1);
      return parse(file);
    }},
    prepareRuns: async () => { now += 40_000; events.push("prepared"); },
    showToast: () => {},
    reportSpawnMetrics: () => {events.push("submitted");},
    focusActualVitusEntry: () => {events.push("focused");},
    RESOURCE_BLESSING_SECONDS: 10800,
  };
  vm.createContext(context);
  vm.runInContext(`${summarySource}\n${importSource}`, context);
  return {status, input, events, importFile: context.importFile};
}

test("successful import measures parsing only, preserves contributions and drop focus", async () => {
  const harness = createImportHarness(() => [{blessedDroneKills: 5}]);
  await harness.importFile({name: "EE.log", size: 120_400_000, lastModified: 0}, true);
  assert.equal(harness.status.className, "parse-status success");
  assert.equal(harness.status.textContent, "120.4mb Parsed in 2.3s - 1 run found.");
  assert.equal(harness.input.value, "");
  assert.deepEqual(harness.events, ["prepared", "submitted", "focused"]);
});

test("each import measures its own duration and uses the selected file's size", async () => {
  const harness = createImportHarness(() => [{}, {}, {}]);
  await harness.importFile({name: "first.log", size: 2e9, lastModified: 0});
  assert.equal(harness.status.textContent, "2.0gb Parsed in 2.3s - 3 runs found.");
  await harness.importFile({name: "second.log.gz", size: 12e6, lastModified: 0});
  assert.equal(harness.status.textContent, "12.0mb Parsed in 2.3s - 3 runs found.");
});

test("empty or failed parsing retains the existing error state", async () => {
  for (const parse of [() => [], () => {throw new Error("Cannot read this file.");}]) {
    const harness = createImportHarness(parse);
    await harness.importFile({name: "EE.log", size: 10e6, lastModified: 0});
    assert.equal(harness.status.className, "parse-status error");
    assert.doesNotMatch(harness.status.textContent, /Parsed in/);
    assert.equal(harness.input.value, "");
    assert.deepEqual(harness.events, []);
  }
});
