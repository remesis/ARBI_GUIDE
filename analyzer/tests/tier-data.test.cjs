const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const TierData = require("../tier-data.js");

test("matches tier-list nodes while ignoring presentation asterisks", () => {
  assert.deepEqual(TierData.findTier("Larzac"), { name: "B-Tier", color: [255, 234, 0] });
  assert.deepEqual(TierData.findTier("Casta"), { name: "A-Tier", color: [0, 242, 143] });
  assert.deepEqual(TierData.findTier("Stöfler"), { name: "D-Tier", color: [226, 85, 0] });
});

test("matches Special nodes and exposes the section subtitle", () => {
  assert.deepEqual(TierData.findTier("Mot"), {
    name: "Special",
    subname: "Survival / Disruption",
    color: [147, 112, 219],
  });
});

test("every listed tier node resolves to its owning tier", () => {
  Object.entries(TierData.TIERS).forEach(([tier, nodes]) => {
    nodes.forEach((node) => assert.equal(TierData.findTier(node.replace(/\*+$/, "")).name, tier));
  });
});

test("exports tier data to the browser before the Analyzer app loads", () => {
  const context = { window: {} };
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "tier-data.js"), "utf8"), context);
  assert.equal(context.window.ArbitrationTierData.findTier("Larzac").name, "B-Tier");

  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.ok(html.indexOf("tier-data.js") < html.indexOf("analyzer-20260820-82.js"));
});
