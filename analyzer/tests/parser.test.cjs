const test = require("node:test");
const assert = require("node:assert/strict");
const Parser = require("../parser.js");

function addRun(lines, { offset, node, name, level, defense = true }) {
  lines.push(`${offset.toFixed(1)} Game [Info]: EliteAlertMission at ${node}`);
  lines.push(`${(offset + .1).toFixed(1)} Game [Info]: Level=${level}`);
  lines.push(`${(offset + 1).toFixed(1)} ThemedSquadOverlay.lua: Mission name: ${name}`);
  if (defense) lines.push(`${(offset + 2).toFixed(1)} WaveDefend.lua: Starting wave 1 (32 simultaneous)`);
  else lines.push(`${(offset + 2).toFixed(1)} TerritoryMission.lua: control captured`);
  for (let index = 0; index < 48; index += 1) {
    const time = offset + 3 + index * .8;
    const npc = index < 7 ? "CorpusEliteShieldDroneAgent" : "ChargerAgent";
    lines.push(`${time.toFixed(1)} AI [Info]: OnAgentCreated /Npc/${npc}${index + 1} AI [Info]: MonitoredTicking ${index + 1}`);
    if (defense && index < 12) {
      const point = 293 + index % 2;
      const x = point === 293 ? 47 : 15;
      const z = point === 293 ? 50 : 64.5;
      lines.push(`${(time + .01).toFixed(2)} WaveDefend.lua: Spawned a /Npc/ChargerAgent${index + 1} @ Vector(0,0,0), spawn point: /LayerGrnDefenseOne/NpcSpawnPoint${point} @ Vector(${x},0,${z})`);
    }
  }
  if (defense) {
    lines.push(`${(offset + 42).toFixed(1)} WaveDefend.lua: Defense wave: 1`);
    lines.push(`${(offset + 43).toFixed(1)} Created /Lotus/Interface/DefenseReward.swf`);
  }
}

test("parses multiple local Arbitration runs and retains structured spawn points", async () => {
  const lines = [];
  addRun(lines, {
    offset: 1,
    node: "SolNode130",
    name: "Arbitration: Lares (Mercury) - Defense",
    level: "/Lotus/Levels/GrineerAsteroidRelight/GrnDefenseOne.level",
  });
  addRun(lines, {
    offset: 100,
    node: "SolNode224",
    name: "Arbitration: Odin (Mercury) - Interception",
    level: "/Lotus/Levels/GrineerGalleon/GrnInterception.level",
    defense: false,
  });

  const runs = Parser.parseText(lines.join("\n"));
  assert.equal(runs.length, 2);
  assert.equal(runs[0].nodeKey, "SolNode130");
  assert.equal(runs[0].node, "Lares");
  assert.equal(Object.keys(runs[0].spawnPoints).length, 2);
  assert.equal(runs[1].missionType, "INTERCEPTION");

  const payload = await Parser.buildContribution(runs[0]);
  assert.equal(payload.schema, "arbi-solnode-spawns/v1");
  assert.equal(payload.sol_node, "SolNode130");
  assert.equal(payload.spawn_points.length, 2);
  assert.equal(payload.run_offset_seconds, runs[0].startTime);
  assert.match(payload.run_hash, /^(?:[a-f0-9]{64}|test-[a-f0-9]{8})$/);
  const serialized = JSON.stringify(payload);
  assert.doesNotMatch(serialized, /Squad|player|Mission name|OnAgentCreated/i);
  assert.doesNotMatch(serialized, /npc_types|wave_counts/i);
});

test("streaming parser ignores non-Arbitration mission noise", async () => {
  const lines = [
    "1.0 ThemedSquadOverlay.lua: Mission name: Kronia Relay (Saturn)",
  ];
  for (let index = 0; index < 80; index += 1) {
    lines.push(`${(2 + index * .1).toFixed(1)} AI [Info]: OnAgentCreated /Npc/ChargerAgent${index} AI [Info]: MonitoredTicking ${index}`);
  }
  addRun(lines, {
    offset: 100,
    node: "SolNode130",
    name: "Arbitration: Lares (Mercury) - Defense",
    level: "/Lotus/Levels/GrineerAsteroidRelight/GrnDefenseOne.level",
  });
  lines.push("144.0 AI [Info]: OnAgentCreated /Npc/SummonMotorcycleAgent1 AI [Info]: MonitoredTicking 49");
  lines.push("200.0 ThemedSquadOverlay.lua: Mission name: Kronia Relay (Saturn)");
  for (let index = 0; index < 80; index += 1) {
    lines.push(`${(201 + index * .1).toFixed(1)} AI [Info]: OnAgentCreated /Npc/ChargerAgent${index} AI [Info]: MonitoredTicking ${index}`);
  }

  const text = lines.join("\n");
  const blob = new Blob([text]);
  Object.defineProperty(blob, "name", { value: "EE.log" });
  const progress = [];
  const runs = await Parser.parseFile(blob, (value) => progress.push(value));
  assert.equal(runs.length, 1);
  assert.equal(runs[0].nodeKey, "SolNode130");
  assert.equal(runs[0].rawEnemySpawns, 48);
  assert.equal(runs[0].droneKills, 7);
  assert.equal(Object.keys(runs[0].enemyTypes).some((name) => /summon.*motorcycle/i.test(name)), false);
  assert.equal(progress.at(-1), 1);
});

test("calculates time at 15+ active enemies inside an individual phase", () => {
  const run = {
    startTime: 0,
    endTime: 10,
    liveCounts: [[0, 6], [2, 16], [6, 22], [9, 4], [10, 4]],
    pauseIntervals: [],
  };
  assert.equal(Parser.helpers.calculateRangeSaturation(run, 0, 10), 70);
  assert.equal(Parser.helpers.calculateRangeSaturation(run, 0, 5), 60);
  assert.equal(Parser.helpers.calculateRangeSaturation(run, 5, 10), 80);
});

test("calculates time-weighted enemy occupancy for Defense waves", () => {
  const run = {
    startTime: 0,
    endTime: 10,
    simCap: 30,
    liveCounts: [[0, 6, 30], [2, 16, 30], [6, 22, 30], [9, 4, 30], [10, 4, 30]],
    pauseIntervals: [],
  };
  assert.ok(Math.abs(Parser.helpers.calculateRangeOccupancy(run, 0, 10) - 48.6666667) < .0001);
  assert.ok(Math.abs(Parser.helpers.calculateRangeOccupancy(run, 0, 5) - 40) < .0001);
  assert.ok(Math.abs(Parser.helpers.calculateRangeOccupancy(run, 5, 10) - 57.3333333) < .0001);
});

test("matches each Defense wave to one end marker", () => {
  const phases = Parser.helpers.calculateWavePhases({
    waveStarts: { 1: 10, 2: 30, 3: 50 },
    waveEnds: [8, 20, 40, 60],
    lastReward: 0,
  });
  assert.deepEqual(phases, [
    { label: 1, from: 10, to: 20, seconds: 10 },
    { label: 2, from: 30, to: 40, seconds: 10 },
    { label: 3, from: 50, to: 60, seconds: 10 },
  ]);
});

test("accepts warning-prefixed Defense wave end timestamps", () => {
  const lines = [
    "1.0 Game [Info]: EliteAlertMission at ClanNode6",
    "1.1 Game [Info]: Level=/Lotus/Levels/Proc/Corpus/CorpusIcePlanetDefense/CPkY.lp",
    "2.0 ThemedSquadOverlay.lua: Mission name: Arbitration: Larzac (Europa) - Defense",
    "3.0 WaveDefend.lua: Defense wave: 1",
  ];
  for (let index = 0; index < 40; index += 1) {
    const npc = index < 5 ? "CorpusEliteShieldDroneAgent" : "ChargerAgent";
    lines.push(`${(4 + index * .1).toFixed(1)} AI [Info]: OnAgentCreated /Npc/${npc}${index + 1} AI [Info]: MonitoredTicking ${index % 20}`);
  }
  lines.push("!10.0 Script [Info]: WaveDefend.lua: _SleepBetweenWaves(3)");

  const [run] = Parser.parseText(lines.join("\n"));
  assert.ok(run);
  assert.deepEqual(run.waveDurations, [[1, 7]]);
});
