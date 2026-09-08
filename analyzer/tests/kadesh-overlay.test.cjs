const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Alignment = require("../spawn-alignment.js");
require("../minimaps/catalog.js");
const layout = globalThis.ArbitrationMinimapCatalog.catalog["alator+kadesh+spear"];
const entrance = require("../minimaps/kadesh-entrance-spawns.json");
const arena = Object.entries(layout.spawnPoints)
  .filter(([id]) => !id.startsWith("entrance-"))
  .map(([, positions]) => positions[0]);
const source = fs.readFileSync(path.resolve(__dirname, "../analyzer.js"), "utf8");
const frameSource = source.match(/function minimapDisplayFrame\(config, verified\) \{[\s\S]*?\n  \}/)[0];
const context = {};
vm.runInNewContext(`${frameSource}; this.frame = minimapDisplayFrame;`, context);

function points(positions) {
  // Renumber and rotate/translate the whole mission independently of the map.
  return positions.map((p, i) => ({
    key: `/Layer0/Layer11/NpcSpawnPoint${i + 900}`,
    x: -p[2] - 92.375, y: p[1] + 7, z: -p[0] - 171.1975,
    count: i + 1,
  }));
}

test("Kadesh entrance positions are explicit references, not a relaxed match threshold", () => {
  assert.equal(entrance.length, 27);
  assert.equal(arena.length, 212);
  assert.equal(layout.proceduralSpawnExtras, undefined);
  const observed = points([...arena.slice(0, 206), ...entrance]);
  const aligned = Alignment.verifyDisplayPositions(observed, layout);
  assert.equal(aligned.mode, "transformed");
  assert.equal(aligned.matches.length, 233);
  for (const match of aligned.matches) assert.equal(match.point.count, observed.find(p => p.key === match.point.key).count);
  const unknown = [...observed, ...points([[500, 500, 500]])];
  assert.equal(Alignment.verifyDisplayPositions(unknown, layout).matches.length, 0);
});

test("ordinary Spear and Kadesh arena runs retain their original frame", () => {
  const aligned = Alignment.verifyDisplayPositions(points(arena.slice(0, 205)), layout);
  assert.equal(aligned.matches.length, 205);
  const frame = context.frame(layout, aligned.matches);
  assert.equal(frame.x, 0);
  assert.equal(frame.y, 0);
  assert.equal(frame.width, 1000);
  assert.equal(frame.height, 1000);
  assert.equal(frame.expanded, false);
  assert.equal(frame.imageStyle, "");
  const heights = arena.map(p => p[1]).sort((a,b) => a-b);
  assert.deepEqual(layout.elevationBands, [.2,.4,.6,.8].map(f => heights[Math.ceil(heights.length*f)-1]));
  const elevationSource = source.match(/function tileElevationBands\(config\) \{[\s\S]*?\n  \}/)[0];
  const elevationContext = { layout };
  vm.runInNewContext(`${elevationSource}; this.bands = tileElevationBands(layout);`, elevationContext);
  assert.deepEqual(Array.from(elevationContext.bands), layout.elevationBands);
});

test("extended frame keeps every verified spawn visible and preserves image calibration", () => {
  const verified = [...arena, ...entrance].map(position => ({ position }));
  const frame = context.frame(layout, verified);
  assert.equal(frame.expanded, true);
  assert.equal(frame.width, 1316);
  assert.equal(frame.height, 1000);
  const styles = Object.fromEntries([...frame.imageStyle.matchAll(/(left|top|width|height):([^;]+)%;/g)].map(m => [m[1], Number(m[2]) / 100]));
  for (const { position: p } of verified) {
    const [a,b,c,d,e,f] = layout.matrix;
    const x = a*p[0] + b*p[2] + c, y = d*p[0] + e*p[2] + f;
    assert.ok(x - 21 >= frame.x && x + 21 <= frame.x + frame.width);
    assert.ok(y - 21 >= frame.y && y + 21 <= frame.y + frame.height);
    for (const displayWidth of [300, 500, 900, 1400]) {
      const scale = displayWidth / frame.width;
      const imageX = (styles.left + x / layout.width * styles.width) * displayWidth;
      const imageY = (styles.top + y / layout.height * styles.height) * frame.height * scale;
      assert.ok(Math.abs(imageX - (x - frame.x) * scale) < 1e-8);
      assert.ok(Math.abs(imageY - (y - frame.y) * scale) < 1e-8);
    }
  }
});

test("unverified points cannot expand the frame and other maps do not opt in", () => {
  assert.equal(context.frame(layout, []).expanded, false);
  const other = { ...layout, fitObservedSpawns: false };
  assert.equal(context.frame(other, [{ position: [500, 0, 500] }]).expanded, false);
});

test("renderer shows the extended overlay with an explicit geometry note", () => {
  const renderSource = source.match(/function renderMinimap\(run, points\) \{[\s\S]*?\n  \}/)[0];
  const ctx = {
    MINIMAPS: { ClanNode8: [layout] }, SpawnAlignment: Alignment,
    h: s => String(s), fmt: n => String(n), tileElevationBands: () => [],
    spawnBubbleHeatColor: () => ({ fill: "green", compactFill: "green" }),
    spawnElevationLevel: () => 0, SPAWN_ELEVATION_COLORS: ["blue"],
    pointNumber: p => p.key.match(/\d+$/)[0], renderElevationLegend: () => "",
  };
  vm.runInNewContext(`${frameSource}; ${renderSource}; this.render = renderMinimap;`, ctx);
  const html = ctx.render({ nodeKey: "ClanNode8", node: "Kadesh" }, points([...arena.slice(0, 206), ...entrance]));
  assert.equal((html.match(/class="spawn-bubble"/g) || []).length, 233);
  assert.match(html, /viewBox="0 0 1316 1000"/);
  assert.match(html, /data-minimap-width="1316"/);
  assert.match(html, /entrance geometry is not mapped/);
  assert.doesNotMatch(html, /Spawn overlay unavailable/);
  const normal = ctx.render({ nodeKey: "ClanNode8", node: "Kadesh" }, points(arena.slice(0, 205)));
  assert.match(normal, /viewBox="0 0 1000 1000"/);
  assert.doesNotMatch(normal, /entrance geometry is not mapped/);
});
