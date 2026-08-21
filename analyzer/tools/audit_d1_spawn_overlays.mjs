#!/usr/bin/env node

/**
 * Replay the reduced coordinate rows collected in D1 through the Analyzer's
 * production spawn-alignment code. This is deliberately read-only: Wrangler
 * receives one SELECT and the script never writes to D1 or the local catalog.
 */

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const toolDir = dirname(fileURLToPath(import.meta.url));
const analyzerDir = resolve(toolDir, "..");
const repoDir = resolve(analyzerDir, "..");
const wranglerConfig = resolve(repoDir, "workers", "wrangler-analyzer.jsonc");
const catalogPath = resolve(analyzerDir, "minimaps", "catalog.js");
const database = "arbi-analyzer-spawns";

const deriveSupplements = process.argv.includes("--derive-supplements");
const requestedGroups = process.argv.slice(2).filter((argument) => argument !== "--derive-supplements");
const safeGroup = /^[a-z0-9+_~-]+$/;
if (requestedGroups.some((group) => !safeGroup.test(group))) {
  throw new Error("Tileset group arguments may contain only lowercase route characters.");
}

await import(`${pathToFileURL(catalogPath).href}?audit=${Date.now()}`);
const bundle = globalThis.ArbitrationMinimapCatalog;
const Alignment = require(resolve(analyzerDir, "spawn-alignment.js"));
if (!bundle?.catalog || !bundle?.nodes) throw new Error("Could not load the minimap catalog.");

const where = requestedGroups.length
  ? `WHERE tileset_group IN (${requestedGroups.map((group) => `'${group}'`).join(",")})`
  : "";
const sql = `
  SELECT run_hash, tileset_group, sol_node, level_path, mission_type,
         spawn_point_count, observed_spawn_events, received_at, payload_json
  FROM analyzer_spawn_runs
  ${where}
  ORDER BY tileset_group, sol_node, received_at
`.replace(/\s+/g, " ").trim();

const command = process.platform === "win32" ? process.execPath : "npx";
const npxArgs = process.platform === "win32"
  ? [resolve(dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js")]
  : [];
const query = spawnSync(command, [...npxArgs,
  "--", "wrangler", "d1", "execute", database,
  "--remote", "--config", wranglerConfig,
  "--command", sql, "--json",
], {
  cwd: dirname(wranglerConfig),
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
if (query.error) throw query.error;
if (query.status !== 0) throw new Error(query.stderr || query.stdout || "D1 query failed.");

const response = JSON.parse(query.stdout);
const rows = response.flatMap((part) => part.results || []);
let failures = 0;
const supplementInputs = new Map();

function distance(left, right) {
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
}

for (const row of rows) {
  const payload = JSON.parse(row.payload_json);
  const points = payload.spawn_points.map((point) => ({
    key: point.point_key,
    ident: point.point_key,
    x: Number(point.position[0]),
    y: Number(point.position[1]),
    z: Number(point.position[2]),
    count: Number(point.count),
  }));
  const groupIds = bundle.nodes[row.sol_node] || [];
  const candidates = groupIds.map((groupId) => {
    const config = bundle.catalog[groupId];
    const display = Alignment.verifyDisplayPositions(points, config);
    const subset = Alignment.matchingSubset(points, config);
    const matchedCount = display.matchedCount ?? subset.matches.length;
    return {
      groupId,
      config,
      mode: display.mode,
      displayed: display.matches.length,
      matched: matchedCount,
      coverage: points.length ? matchedCount / points.length : 0,
      refs: Object.values(config?.spawnPoints || {}).reduce((sum, positions) => sum + positions.length, 0),
      mapped: subset.mapped || [],
    };
  }).sort((left, right) => right.displayed - left.displayed || right.matched - left.matched);
  const best = candidates[0] || {
    groupId: "(unmapped)", mode: "none", displayed: 0, matched: 0, coverage: 0, refs: 0,
  };
  const passes = best.displayed === points.length && points.length > 0;
  if (!passes) failures += 1;
  if (deriveSupplements && best.mapped.length && best.matched >= 24) {
    const references = Object.values(best.config.spawnPoints || {}).flat();
    const inputs = supplementInputs.get(best.groupId) || [];
    for (const item of best.mapped) {
      if (references.some((reference) => distance(reference, item.position) <= .25)) continue;
      inputs.push({
        position: item.position,
        runHash: row.run_hash,
        pointKey: item.point.key,
      });
    }
    supplementInputs.set(best.groupId, inputs);
  }
  const shortHash = String(row.run_hash).slice(0, 10);
  console.log([
    passes ? "PASS" : "FAIL",
    row.tileset_group,
    row.sol_node,
    row.mission_type,
    `${points.length} observed`,
    `${best.refs} refs`,
    `${best.matched} matched (${(best.coverage * 100).toFixed(1)}%)`,
    `mode=${best.mode}`,
    `run=${shortHash}`,
    row.level_path,
  ].join(" | "));
}

console.log(`\n${rows.length} D1 coordinate run(s) audited; ${failures} overlay failure(s).`);
if (deriveSupplements) {
  for (const [groupId, inputs] of supplementInputs) {
    const clusters = [];
    for (const input of inputs) {
      let cluster = clusters.find((candidate) => distance(candidate.center, input.position) <= .25);
      if (!cluster) {
        cluster = { center: [...input.position], positions: [], runs: new Set(), keys: new Set() };
        clusters.push(cluster);
      }
      cluster.positions.push(input.position);
      cluster.runs.add(input.runHash);
      cluster.keys.add(input.pointKey);
      cluster.center = cluster.center.map((_, axis) =>
        cluster.positions.reduce((sum, position) => sum + position[axis], 0) / cluster.positions.length,
      );
    }
    clusters.sort((left, right) =>
      left.center[0] - right.center[0]
      || left.center[1] - right.center[1]
      || left.center[2] - right.center[2],
    );
    console.log(`\n${groupId}: ${clusters.length} Analyzer-only D1 supplement candidate(s)`);
    clusters.forEach((cluster, index) => {
      const position = cluster.center.map((value) => Number(value.toFixed(4)));
      console.log(`${String(index + 1).padStart(3, "0")} | runs=${cluster.runs.size} | keys=${cluster.keys.size} | ${JSON.stringify(position)}`);
    });
    const config = bundle.catalog[groupId];
    const supplemented = {
      ...config,
      spawnPoints: {
        ...config.spawnPoints,
        ...Object.fromEntries(clusters.map((cluster, index) => [
          `d1-runtime-${index + 1}`,
          [cluster.center.map((value) => Number(value.toFixed(4)))],
        ])),
      },
    };
    const validation = rows
      .filter((row) => (bundle.nodes[row.sol_node] || []).includes(groupId))
      .map((row) => {
        const payload = JSON.parse(row.payload_json);
        const points = payload.spawn_points.map((point) => ({
          key: point.point_key,
          ident: point.point_key,
          x: Number(point.position[0]),
          y: Number(point.position[1]),
          z: Number(point.position[2]),
          count: Number(point.count),
        }));
        const result = Alignment.verifyDisplayPositions(points, supplemented);
        return result.matches.length === points.length;
      });
    console.log(`Supplement simulation: ${validation.filter(Boolean).length}/${validation.length} run(s) pass.`);
  }
}
process.exitCode = failures ? 2 : 0;
