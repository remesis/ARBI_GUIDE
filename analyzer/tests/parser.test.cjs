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
  assert.equal(payload.schema, "arbi-analyzer-run/v2");
  assert.equal(payload.sol_node, "SolNode130");
  assert.equal(payload.spawn_points.length, 2);
  assert.equal(payload.run_offset_seconds, runs[0].startTime);
  assert.deepEqual(payload.run_metrics, {
    mission_seconds: runs[0].totalDuration,
    drone_kills: runs[0].droneKills,
    reward_cycles: runs[0].rotations,
    defense_waves: Object.keys(runs[0].waveStarts).length,
    four_member_majority: false,
  });
  assert.match(payload.run_hash, /^(?:[a-f0-9]{64}|test-[a-f0-9]{8})$/);
  const serialized = JSON.stringify(payload);
  assert.doesNotMatch(serialized, /Squad|player|Mission name|OnAgentCreated/i);
  assert.doesNotMatch(serialized, /npc_types|wave_counts/i);
});

test("retains spaced squad names and procedural layout component markers", () => {
  const lines = [
    "0.1 Game [Info]: 123period loadout loader finished.",
    "0.2 Game [Info]: Pinky Flooff loadout loader finished.",
    "1.0 Game [Info]: EliteAlertMission at ClanNode4",
    "2.0 ThemedSquadOverlay.lua: Mission name: Sinai (Jupiter) - Arbitration",
    "2.1 Sys [Error]: Required by object /Lotus/Levels/CorpusGasCityRemaster/GasSpawn02/Scope",
    "3.0 WaveDefend.lua: Defense wave: 1",
  ];
  for (let index = 0; index < 48; index += 1) {
    lines.push(`${4 + index}.0 AI [Info]: OnAgentCreated /Npc/ChargerAgent${index} AI [Info]: MonitoredTicking ${index}`);
  }

  const [run] = Parser.parseText(lines.join("\n"));
  assert.equal(run.host, "123period");
  assert.deepEqual(run.squadmates, ["Pinky Flooff"]);
  assert.deepEqual(run.levelComponents, ["/Lotus/Levels/CorpusGasCityRemaster/GasSpawn02.level"]);
});

test("large uncompressed files preserve parser results through ordered parallel scan parts", async () => {
  const sourceLines = [];
  addRun(sourceLines, {
    offset: 1,
    node: "SolNode130",
    name: "Arbitration: Lares (Mercury) - Defense",
    level: "/Lotus/Levels/GrineerAsteroidRelight/GrnDefenseOne.level",
  });
  const relevant = [];
  Parser.forEachRelevantLine(`${sourceLines.join("\n")}\n`, (line, token) => relevant.push(token, line));

  const workers = [];
  class FakeWorker {
    constructor() {
      workers.push(this);
      this.onmessage = null;
      this.onerror = null;
    }

    postMessage(message) {
      queueMicrotask(() => {
        this.onmessage({ data: { type: "progress", index: message.index, bytes: message.end - message.start } });
        this.onmessage({ data: { type: "result", index: message.index, lines: message.index === 0 ? relevant : [] } });
      });
    }

    terminate() {}
  }

  const originalWorker = global.Worker;
  global.Worker = FakeWorker;
  const progress = [];
  const fakeLargeFile = {
    name: "large-ee.log",
    size: 513 * 1024 * 1024,
    stream() {},
    slice() {
      return { arrayBuffer: async () => Uint8Array.of(10).buffer };
    },
  };
  try {
    const runs = await Parser.parseFile(fakeLargeFile, (value) => progress.push(value));
    assert.ok(workers.length >= 2);
    assert.equal(runs.length, 1);
    assert.equal(runs[0].node, "Lares");
    assert.equal(Object.keys(runs[0].spawnPoints).length, 2);
    assert.equal(progress.at(-1), 1);
  } finally {
    if (originalWorker === undefined) delete global.Worker;
    else global.Worker = originalWorker;
  }
});

test("classifies unranked Survival and Disruption nodes from stable SolNode metadata", () => {
  const lines = [];
  addRun(lines, {
    offset: 1,
    node: "SolNode100",
    name: "Elara (Jupiter) - Arbitration",
    level: "/Lotus/Levels/Proc/Corpus/CorpusGasCity/CorpusGasCitySurvival.level",
    defense: false,
  });
  addRun(lines, {
    offset: 100,
    node: "SolNode30",
    name: "Olympus (Mars) - Arbitration",
    level: "/Lotus/Levels/Proc/Grineer/GrineerSettlement/GrineerSettlementDisruption.level",
    defense: false,
  });

  const runs = Parser.parseText(lines.join("\n"));
  assert.equal(runs.length, 2);
  assert.equal(runs[0].node, "Elara");
  assert.equal(runs[0].missionType, "SURVIVAL");
  assert.equal(runs[0].saturation.threshold, 30);
  assert.deepEqual(runs[0].saturation.rows.slice(0, 6).map((row) => row.label), ["0-7", "8-14", "15-22", "23-29", "30-32", "33-35"]);
  assert.equal(runs[1].node, "Olympus");
  assert.equal(runs[1].missionType, "DISRUPTION");
  assert.equal(runs[1].saturation.threshold, 30);
  assert.deepEqual(runs[1].saturation.rows.slice(0, 6).map((row) => row.label), ["0-7", "8-14", "15-22", "23-29", "30-32", "33-35"]);
});

test("uses Survival mission events for active timing, reward cycles, extraction, and saturation", async () => {
  const lines = [
    "1.0 Game [Info]: EliteAlertMission at ClanNode23",
    "1.1 Game [Info]: Level=/Lotus/Levels/Proc/Grineer/GrineerGalleonSurvivalRaid/Test.lp",
    "2.0 ThemedSquadOverlay.lua: Mission name: Gabii (Ceres) - Arbitration",
    "10.0 Script [Info]: SurvivalMission.lua: Survival: Starting survival",
  ];
  for (let index = 0; index < 48; index += 1) {
    const time = 11 + index * 2;
    const npc = index < 7 ? "CorpusEliteShieldDroneAgent" : "ChargerAgent";
    const monitored = index < 24 ? 9 : 34;
    lines.push(`${time.toFixed(1)} AI [Info]: OnAgentCreated /Npc/${npc}${index + 1} Live ${monitored + 5} Spawned ${index + 1} Ticking ${monitored} Paused 0 IgnoredTicking 0 MonitoredTicking ${monitored}`);
  }
  lines.push("70.0 Sys [Info]: Created /Lotus/Interface/SurvivalReward.swf");
  lines.push("70.1 Script [Info]: SurvivalMission.lua: Survival: Gave reward tier 1 at 300.1");
  lines.push("80.0 Script [Info]: Arbitration.lua: Destroying CorpusEliteShieldDroneAvatar99 for not seeing a player for 20sec, 60sec after creation");
  lines.push("130.1 Script [Info]: SurvivalMission.lua: Survival: Gave reward tier 2 at 600.1");
  lines.push("140.0 Script [Info]: ExtractionTimer.lua: EOM: All players extracting");
  lines.push("145.0 Script [Info]: Arbitration.lua: Destroying CorpusEliteShieldDroneAvatar100 for not seeing a player for 20sec, 60sec after creation");

  const [run] = Parser.parseText(lines.join("\n"));
  assert.ok(run);
  assert.equal(run.missionType, "SURVIVAL");
  assert.equal(run.startTime, 10);
  assert.equal(run.endTime, 140);
  assert.equal(run.totalDuration, 130);
  assert.equal(run.rotations, 2);
  assert.equal(run.dronesDespawned, 1);
  assert.deepEqual(run.droneDespawnTimestamps, [80, 145]);
  assert.deepEqual(run.rewardTimestamps, [70.1, 130.1]);
  assert.ok(Math.abs(run.rotationDurations[0] - 60.1) < .0001);
  assert.equal(run.rotationDurations[1], 60);
  assert.equal(run.dronesPerRotation.length, 2);
  assert.equal(run.dpmPerRotation.length, 2);
  assert.equal(run.liveCounts.length, 48);
  assert.equal(run.saturation.threshold, 30);
  assert.equal(run.saturation.rows[4].label, "30-32");
  assert.ok(run.saturation.abovePercent > 0);
  assert.ok(run.saturationPerRotation.every(Number.isFinite));
  const payload = await Parser.buildContribution(run);
  assert.equal(payload.schema, "arbi-analyzer-run/v2");
  assert.deepEqual(payload.spawn_points, []);
  assert.equal(payload.observed_spawn_events, 0);
  assert.deepEqual(payload.run_metrics, {
    mission_seconds: 130,
    drone_kills: 7,
    reward_cycles: 2,
    defense_waves: 0,
    four_member_majority: false,
  });
});

test("a finalized squad invited after Survival scouting moves the active start", () => {
  const lines = [
    "0.1 Game [Info]: Host loadout loader finished.",
    "0.2 Game [Info]: Alpha loadout loader finished.",
    "0.3 Game [Info]: Beta loadout loader finished.",
    "0.4 Game [Info]: Prebuffer loadout loader finished.",
    "1.0 Game [Info]: EliteAlertMission at ClanNode23",
    "2.0 ThemedSquadOverlay.lua: Mission name: Gabii (Ceres) - Arbitration",
    "10.0 Script [Info]: SurvivalMission.lua: Survival: Starting survival",
    "15.0 Net [Info]: MatchingServiceWeb::ProcessSquadMessage received LEAVE message from Prebuffer",
    "16.0 Game [Info]: ClientImpl::PlayersChanged. Player=Prebuffer, change=UNREGISTERED",
    "30.0 Net [Info]: MatchingServiceWeb::ProcessSquadMessage received JOIN message from Gamma, loadout: 123 bytes",
    "30.1 Net [Info]: AddSquadMember: Gamma, mm=ABC123, squadCount=4",
    "35.0 Game [Info]: Gamma loadout loader finished.",
  ];
  for (let index = 0; index < 40; index += 1) {
    const npc = index < 5 ? "CorpusEliteShieldDroneAgent" : "ChargerAgent";
    lines.push(`${40 + index}.0 AI [Info]: OnAgentCreated /Npc/${npc}${index + 1} AI [Info]: MonitoredTicking ${index + 1}`);
  }
  lines.push("310.0 Script [Info]: SurvivalMission.lua: Survival: Gave reward tier 1 at 300");
  lines.push("320.0 Script [Info]: ExtractionTimer.lua: EOM: All players extracting");

  const [run] = Parser.parseText(lines.join("\n"));
  assert.equal(run.preciseStart, 10);
  assert.equal(run.openingRejoinTime, 35);
  assert.equal(run.startTime, 35);
  assert.deepEqual(run.squadmates, ["Alpha", "Beta", "Gamma"]);
  assert.equal(run.fullSquadCoverage, 1);
  assert.equal(run.fullSquadMajority, true);
});

test("uses Disruption round state for completed rotations, reward pauses, and per-rotation rates", () => {
  const lines = [
    "1.0 Game [Info]: EliteAlertMission at SolNode87",
    "1.1 Game [Info]: Level=/Lotus/Levels/Proc/Corpus/CorpusGasCity/CorpusGasCityDisruption/Test.lp",
    "2.0 ThemedSquadOverlay.lua: Mission name: Ganymede (Jupiter) - Arbitration",
    "10.0 Script [Info]: SentientArtifactMission.lua: Disruption: State change: ARTIFACT_ROUND",
  ];
  for (let index = 0; index < 24; index += 1) {
    const time = 11 + index * 3;
    const npc = index < 4 ? "CorpusEliteShieldDroneAgent" : "GasEliteSpacemanAgent";
    lines.push(`${time.toFixed(1)} AI [Info]: OnAgentCreated /Npc/${npc}${index + 1} AI [Info]: MonitoredTicking ${index + 1}`);
  }
  lines.push("100.0 Script [Info]: SentientArtifactMission.lua: Disruption: State change: ARTIFACT_ROUND_DONE");
  lines.push("100.1 Script [Info]: SentientArtifactMission.lua: Disruption: Endless mission reward given (host)");
  lines.push("120.0 Script [Info]: SentientArtifactMission.lua: Disruption: State change: ARTIFACT_ROUND");
  for (let index = 0; index < 24; index += 1) {
    const time = 121 + index * 3;
    const npc = index < 4 ? "CorpusEliteShieldDroneAgent" : "GasEliteSpacemanAgent";
    lines.push(`${time.toFixed(1)} AI [Info]: OnAgentCreated /Npc/${npc}${index + 25} AI [Info]: MonitoredTicking ${index + 1}`);
  }
  lines.push("220.0 Script [Info]: SentientArtifactMission.lua: Disruption: State change: ARTIFACT_ROUND_DONE");
  lines.push("220.1 Script [Info]: SentientArtifactMission.lua: Disruption: Endless mission reward given (host)");
  lines.push("230.0 Script [Info]: ExtractionTimer.lua: EOM: All players extracting");

  const [run] = Parser.parseText(lines.join("\n"));
  assert.ok(run);
  assert.equal(run.missionType, "DISRUPTION");
  assert.equal(run.startTime, 10);
  assert.equal(run.endTime, 230);
  assert.equal(run.rotations, 2);
  assert.deepEqual(run.rewardTimestamps, [100, 220]);
  assert.deepEqual(run.pauseIntervals, [[100, 120], [220, 230]]);
  assert.deepEqual(run.rotationDurations, [90, 100]);
  assert.deepEqual(run.dronesPerRotation, [4, 4]);
  assert.ok(Math.abs(run.dpmPerRotation[0] - 2.6666666667) < .000001);
  assert.ok(Math.abs(run.dpmPerRotation[1] - 2.4) < .000001);
  assert.equal(run.dpmWindows6m.length, 1);
  assert.equal(run.dpmWindows6m[0].count, 8);
  assert.equal(run.dpmWindows6m[0].seconds, 190);
  assert.ok(Math.abs(run.dpmWindows6m[0].dpm - (48 / 19)) < .000001);
  assert.equal(run.saturationPerRotation.length, 2);
});

test("bins Disruption drone pace into pause-adjusted six-minute windows", () => {
  const windows = Parser.helpers.calculateFixedDpmWindows({
    startTime: 0,
    endTime: 900,
    activeDuration: 780,
    pauseIntervals: [[300, 420]],
    droneTimestamps: [60, 120, 240, 330, 480, 540, 660, 780, 850],
  });
  assert.equal(windows.length, 3);
  assert.deepEqual(windows.map((window) => [window.from, window.to, window.seconds, window.count]), [
    [0, 360, 360, 3],
    [360, 720, 360, 4],
    [720, 780, 60, 1],
  ]);
  assert.ok(Math.abs(windows[0].dpm - 0.5) < .000001);
  assert.ok(Math.abs(windows[1].dpm - (2 / 3)) < .000001);
  assert.ok(Math.abs(windows[2].dpm - 1) < .000001);
});

test("an opening Disruption role rejoin can move the active start past the first round-state marker", () => {
  const lines = [
    "0.1 Game [Info]: Host loadout loader finished.",
    "0.2 Game [Info]: Alpha loadout loader finished.",
    "1.0 Game [Info]: EliteAlertMission at SolNode87",
    "2.0 ThemedSquadOverlay.lua: Mission name: Ganymede (Jupiter) - Arbitration",
    "5.0 Net [Info]: Player=Alpha, change=UNREGISTERED",
    "10.0 Script [Info]: SentientArtifactMission.lua: Disruption: State change: ARTIFACT_ROUND",
    "15.0 Game [Info]: Alpha loadout loader finished.",
  ];
  for (let index = 0; index < 40; index += 1) {
    const npc = index < 5 ? "CorpusEliteShieldDroneAgent" : "GasEliteSpacemanAgent";
    lines.push(`${20 + index}.0 AI [Info]: OnAgentCreated /Npc/${npc}${index + 1} AI [Info]: MonitoredTicking ${index + 1}`);
  }
  lines.push("70.0 Script [Info]: SentientArtifactMission.lua: Disruption: State change: ARTIFACT_ROUND_DONE");

  const [run] = Parser.parseText(lines.join("\n"));
  assert.equal(run.startTime, 15);
  assert.deepEqual(run.rotationDurations, [55]);
});

test("a finalized replacement can move Disruption timing past an early tileset-preview marker", () => {
  const lines = [
    "0.1 Game [Info]: Host loadout loader finished.",
    "0.2 Game [Info]: Alpha loadout loader finished.",
    "0.3 Game [Info]: Beta loadout loader finished.",
    "0.4 Game [Info]: Prebuffer loadout loader finished.",
    "1.0 Game [Info]: EliteAlertMission at SolNode87",
    "2.0 ThemedSquadOverlay.lua: Mission name: Ganymede (Jupiter) - Arbitration",
    "3.0 Net [Info]: MatchingServiceWeb::ProcessSquadMessage received LEAVE message from Prebuffer",
    "4.0 Game [Info]: ClientImpl::PlayersChanged. Player=Prebuffer, change=UNREGISTERED",
    "10.0 Script [Info]: SentientArtifactMission.lua: Disruption: State change: ARTIFACT_ROUND",
    "12.0 Net [Info]: MatchingServiceWeb::ProcessSquadMessage received JOIN message from Gamma, loadout: 123 bytes",
    "12.1 Net [Info]: AddSquadMember: Gamma, mm=ABC123, squadCount=4",
    "18.0 Game [Info]: Gamma loadout loader finished.",
    "18.5 Game [Info]: Gamma loadout loader finished.",
  ];
  for (let index = 0; index < 40; index += 1) {
    const npc = index < 5 ? "CorpusEliteShieldDroneAgent" : "GasEliteSpacemanAgent";
    lines.push(`${20 + index}.0 AI [Info]: OnAgentCreated /Npc/${npc}${index + 1} AI [Info]: MonitoredTicking ${index + 1}`);
  }
  lines.push("70.0 Script [Info]: SentientArtifactMission.lua: Disruption: State change: ARTIFACT_ROUND_DONE");

  const [run] = Parser.parseText(lines.join("\n"));
  assert.equal(run.preciseStart, 10);
  assert.equal(run.openingRejoinTime, 18);
  assert.equal(run.startTime, 18);
  assert.deepEqual(run.squadmates, ["Alpha", "Beta", "Gamma"]);
  assert.ok(!run.squadmates.includes("Prebuffer"));
  assert.ok(run.fullSquadCoverage > 0.8);
  assert.equal(run.fullSquadMajority, true);
});

test("three-player runs do not qualify for full-squad aggregate metrics", () => {
  const lines = [
    "0.1 Game [Info]: Host loadout loader finished.",
    "0.2 Game [Info]: Alpha loadout loader finished.",
    "0.3 Game [Info]: Beta loadout loader finished.",
    "1.0 Game [Info]: EliteAlertMission at SolNode26",
    "2.0 ThemedSquadOverlay.lua: Mission name: Lith (Earth) - Arbitration",
    "3.0 WaveDefend.lua: Defense wave: 1",
  ];
  for (let index = 0; index < 40; index += 1) {
    const npc = index < 5 ? "CorpusEliteShieldDroneAgent" : "ChargerAgent";
    lines.push(`${4 + index}.0 AI [Info]: OnAgentCreated /Npc/${npc}${index + 1} AI [Info]: MonitoredTicking ${index}`);
  }

  const [run] = Parser.parseText(lines.join("\n"));
  assert.equal(run.fullSquadCoverage, 0);
  assert.equal(run.fullSquadMajority, false);
});

test("roster refreshes and duplicate loadouts cannot move the opening timer", () => {
  const lines = [
    "0.1 Game [Info]: Host loadout loader finished.",
    "0.2 Game [Info]: Alpha loadout loader finished.",
    "1.0 Game [Info]: EliteAlertMission at SolNode87",
    "2.0 ThemedSquadOverlay.lua: Mission name: Ganymede (Jupiter) - Arbitration",
    "10.0 Script [Info]: SentientArtifactMission.lua: Disruption: State change: ARTIFACT_ROUND",
    "11.0 Net [Info]: AddSquadMember: Alpha, mm=ABC123, squadCount=2",
    "15.0 Game [Info]: Alpha loadout loader finished.",
  ];
  for (let index = 0; index < 40; index += 1) {
    const npc = index < 5 ? "CorpusEliteShieldDroneAgent" : "GasEliteSpacemanAgent";
    lines.push(`${20 + index}.0 AI [Info]: OnAgentCreated /Npc/${npc}${index + 1} AI [Info]: MonitoredTicking ${index + 1}`);
  }
  lines.push("70.0 Script [Info]: SentientArtifactMission.lua: Disruption: State change: ARTIFACT_ROUND_DONE");

  const [run] = Parser.parseText(lines.join("\n"));
  assert.equal(run.openingRejoinTime, 0);
  assert.equal(run.startTime, 10);
});

test("a reconnect after reward progression cannot reset Disruption timing", () => {
  const lines = [
    "0.1 Game [Info]: Host loadout loader finished.",
    "0.2 Game [Info]: Alpha loadout loader finished.",
    "1.0 Game [Info]: EliteAlertMission at SolNode87",
    "2.0 ThemedSquadOverlay.lua: Mission name: Ganymede (Jupiter) - Arbitration",
    "10.0 Script [Info]: SentientArtifactMission.lua: Disruption: State change: ARTIFACT_ROUND",
    "70.0 Script [Info]: SentientArtifactMission.lua: Disruption: State change: ARTIFACT_ROUND_DONE",
    "80.0 Game [Info]: ClientImpl::PlayersChanged. Player=Alpha, change=UNREGISTERED",
    "90.0 Net [Info]: AddSquadMember: Alpha, mm=ABC123, squadCount=2",
    "95.0 Game [Info]: Alpha loadout loader finished.",
  ];
  for (let index = 0; index < 40; index += 1) {
    const npc = index < 5 ? "CorpusEliteShieldDroneAgent" : "GasEliteSpacemanAgent";
    lines.push(`${100 + index}.0 AI [Info]: OnAgentCreated /Npc/${npc}${index + 1} AI [Info]: MonitoredTicking ${index + 1}`);
  }

  const [run] = Parser.parseText(lines.join("\n"));
  assert.equal(run.openingRejoinTime, 0);
  assert.equal(run.startTime, 10);
});

test("starts the run clock at the last early squad rejoin", () => {
  const lines = [
    "0.1 Game [Info]: Host loadout loader finished.",
    "0.2 Game [Info]: Alpha loadout loader finished.",
    "0.3 Game [Info]: Beta loadout loader finished.",
    "1.0 Game [Info]: EliteAlertMission at ClanNode6",
    "1.1 Game [Info]: Level=/Lotus/Levels/Proc/Corpus/CorpusIcePlanetDefense/CPkY.lp",
    "2.0 ThemedSquadOverlay.lua: Mission name: Arbitration: Larzac (Europa) - Defense",
    "7.0 Net [Info]: Player=Alpha, change=UNREGISTERED",
    "8.0 Net [Info]: Player=Beta, change=UNREGISTERED",
    "12.0 Game [Info]: Alpha loadout loader finished.",
    "17.0 WaveDefend.lua: Defense wave: 1",
    "18.0 Game [Info]: Beta loadout loader finished.",
  ];
  for (let index = 0; index < 40; index += 1) {
    const npc = index < 5 ? "CorpusEliteShieldDroneAgent" : "ChargerAgent";
    lines.push(`${(20 + index).toFixed(1)} AI [Info]: OnAgentCreated /Npc/${npc}${index + 1} AI [Info]: MonitoredTicking ${index % 20}`);
  }
  lines.push("70.0 Created /Lotus/Interface/DefenseReward.swf");

  const [run] = Parser.parseText(lines.join("\n"));
  assert.ok(run);
  assert.equal(run.openingRejoinTime, 18);
  assert.equal(run.startTime, 18);
  assert.equal(run.totalDuration, 52);
});

test("returning to a non-mission level closes the run and its finalized squad", () => {
  const lines = [
    "0.1 Game [Info]: Host loadout loader finished.",
    "0.2 Game [Info]: Alpha loadout loader finished.",
    "0.3 Game [Info]: Beta loadout loader finished.",
    "0.4 Game [Info]: Gamma loadout loader finished.",
    "1.0 Game [Info]: EliteAlertMission at SolNode26",
    "1.1 Game [Info]: Level=/Lotus/Levels/Proc/Grineer/GrineerForestDefense/DAA.lp",
    "2.0 ThemedSquadOverlay.lua: Mission name: Lith (Earth) - Arbitration",
    "3.0 WaveDefend.lua: Defense wave: 1",
  ];
  for (let index = 0; index < 40; index += 1) {
    const npc = index < 5 ? "CorpusEliteShieldDroneAgent" : "ChargerAgent";
    lines.push(`${(4 + index).toFixed(1)} AI [Info]: OnAgentCreated /Npc/${npc}${index + 1} AI [Info]: MonitoredTicking ${index % 20}`);
  }
  lines.push(
    "50.0 Game [Info]: Level=/Lotus/Levels/Proc/Hub/RelayStationHubMain/Return.lp",
    "51.0 Game [Info]: Delta loadout loader finished.",
    "51.1 Game [Info]: Epsilon loadout loader finished.",
    "51.2 Game [Info]: Zeta loadout loader finished.",
  );
  for (let index = 0; index < 40; index += 1) {
    lines.push(`${(52 + index).toFixed(1)} AI [Info]: OnAgentCreated /Npc/ChargerAgent${index + 1} AI [Info]: MonitoredTicking ${index % 20}`);
  }

  const [run] = Parser.parseText(lines.join("\n"));
  assert.ok(run);
  assert.equal(run.node, "Lith");
  assert.equal(run.host, "Host");
  assert.deepEqual(run.squadmates, ["Alpha", "Beta", "Gamma"]);
  assert.equal(run.rawEnemySpawns, 40);
});

test("finalized squad drops short prebuffers but retains a player who disconnects near the end", () => {
  const lines = [
    "0.1 Game [Info]: Host loadout loader finished.",
    "0.2 Game [Info]: Prebuffer loadout loader finished.",
    "0.3 Game [Info]: Alpha loadout loader finished.",
    "0.4 Game [Info]: Beta loadout loader finished.",
    "1.0 Game [Info]: EliteAlertMission at SolNode26",
    "1.1 Game [Info]: Level=/Lotus/Levels/Proc/Grineer/GrineerForestDefense/DAA.lp",
    "2.0 ThemedSquadOverlay.lua: Mission name: Lith (Earth) - Arbitration",
    "4.0 Net [Info]: Player=Prebuffer, change=UNREGISTERED",
    "5.0 Game [Info]: Gamma loadout loader finished.",
    "10.0 WaveDefend.lua: Defense wave: 1",
  ];
  for (let index = 0; index < 90; index += 1) {
    const npc = index < 5 ? "CorpusEliteShieldDroneAgent" : "ChargerAgent";
    lines.push(`${(11 + index).toFixed(1)} AI [Info]: OnAgentCreated /Npc/${npc}${index + 1} AI [Info]: MonitoredTicking ${index % 20}`);
  }
  lines.push("90.0 Net [Info]: Player=Beta, change=UNREGISTERED");

  const [run] = Parser.parseText(lines.join("\n"));
  assert.ok(run);
  assert.deepEqual(run.squadmates, ["Alpha", "Beta", "Gamma"]);
  assert.ok(!run.squadmates.includes("Prebuffer"));
});

test("ShowMissionVote starts an Arbitration when Mission name is absent", () => {
  const lines = [
    "1.0 Script [Info]: Background.lua: EliteAlertMission at SolNode302 (Lua - Tycho)",
    "2.0 Script [Info]: ThemedSquadOverlay.lua: ShowMissionVote Tycho (Lua) - Arbitration - Level (60-80) (SolNode302_EliteAlert) -1",
    "2.1 Game [Info]: Level=/Lotus/Levels/Proc/Orokin/OrokinMoonSurvival/Test.lp",
    "3.0 Script [Info]: SurvivalMission.lua: Survival: Starting survival",
  ];
  for (let index = 0; index < 40; index += 1) {
    const npc = index < 5 ? "CorpusEliteShieldDroneAgent" : "ChargerAgent";
    lines.push(`${(4 + index).toFixed(1)} AI [Info]: OnAgentCreated /Npc/${npc}${index + 1} AI [Info]: MonitoredTicking ${index % 20}`);
  }
  lines.push("50.0 Script [Info]: ExtractionTimer.lua: EOM: All players extracting");

  const [run] = Parser.parseText(lines.join("\n"));
  assert.ok(run);
  assert.equal(run.node, "Tycho");
  assert.equal(run.nodeKey, "SolNode302");
  assert.equal(run.missionType, "SURVIVAL");
  assert.equal(run.startTime, 3);
  assert.equal(run.endTime, 50);
});

test("does not move the run clock for a late reconnect", () => {
  const lines = [
    "0.1 Game [Info]: Host loadout loader finished.",
    "0.2 Game [Info]: Alpha loadout loader finished.",
    "1.0 Game [Info]: EliteAlertMission at ClanNode6",
    "2.0 ThemedSquadOverlay.lua: Mission name: Arbitration: Larzac (Europa) - Defense",
    "3.0 WaveDefend.lua: Defense wave: 1",
    "80.0 WaveDefend.lua: Defense wave: 2",
    "140.0 WaveDefend.lua: Defense wave: 3",
    "200.0 WaveDefend.lua: Defense wave: 4",
    "250.0 Net [Info]: Player=Alpha, change=UNREGISTERED",
    "260.0 Game [Info]: Alpha loadout loader finished.",
  ];
  for (let index = 0; index < 40; index += 1) {
    const npc = index < 5 ? "CorpusEliteShieldDroneAgent" : "ChargerAgent";
    lines.push(`${(330 + index).toFixed(1)} AI [Info]: OnAgentCreated /Npc/${npc}${index + 1} AI [Info]: MonitoredTicking ${index % 20}`);
  }
  lines.push("380.0 Created /Lotus/Interface/DefenseReward.swf");

  const [run] = Parser.parseText(lines.join("\n"));
  assert.ok(run);
  assert.equal(run.openingRejoinTime, 0);
  assert.equal(run.startTime, 3);
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

test("reports the share of active mission time covered by trustworthy enemy-count telemetry", () => {
  const run = {
    startTime: 0,
    endTime: 100,
    activeDuration: 100,
    liveCounts: [[0, 5], [10, 6], [50, 7], [80, 8], [100, 9]],
    pauseIntervals: [],
  };
  assert.equal(Parser.helpers.calculateTelemetryCoverage(run), 30);
});

test("models early and later rotation rewards, including Mirror Defense's two-Vitus bonus", () => {
  const early = Parser.computeVitus(0, 4, "DEFENSE");
  const normal = Parser.computeVitus(0, 5, "DEFENSE");
  const mirror = Parser.computeVitus(0, 5, "MIRROR_DEFENSE");
  const withDrones = Parser.computeVitus(100, 2, "DEFENSE");

  assert.ok(Math.abs(early.mean - 4.84) < 1e-9);
  assert.ok(Math.abs(early.standardDeviation - Math.sqrt(2.3436)) < 1e-9);
  assert.ok(Math.abs(normal.mean - 6.14) < 1e-9);
  assert.ok(Math.abs(mirror.mean - 5.76) < 1e-9);
  assert.ok(Math.abs(withDrones.mean - 37.82) < 1e-9);
});

test("classifies actual Vitus totals by scenario upper bounds", () => {
  const scenarios = [
    { total: 1025, label: "Worst Case" },
    { total: 1078, label: "Unlucky" },
    { total: 1109, label: "Below Avg" },
    { total: 1143, label: "Average" },
    { total: 1177, label: "Above Avg" },
    { total: 1208, label: "High Roll" },
    { total: 1261, label: "God Roll" },
  ];
  assert.equal(Parser.classifyVitusScenario(scenarios, 1025).label, "Worst Case");
  assert.equal(Parser.classifyVitusScenario(scenarios, 1026).label, "Unlucky");
  assert.equal(Parser.classifyVitusScenario(scenarios, 1050).label, "Unlucky");
  assert.equal(Parser.classifyVitusScenario(scenarios, 1078).label, "Unlucky");
  assert.equal(Parser.classifyVitusScenario(scenarios, 1079).label, "Below Avg");
  assert.equal(Parser.classifyVitusScenario(scenarios, 1262).label, "God Roll");
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

test("excludes the extraction-vote transition from every third Defense wave", () => {
  const phases = Parser.helpers.calculateWavePhases({
    waveStarts: { 1: 10, 2: 30, 3: 50, 4: 90 },
    waveEnds: [20, 40, 80, 100],
    waveCountdowns: [75],
    lastReward: 75,
  });
  assert.deepEqual(phases, [
    { label: 1, from: 10, to: 20, seconds: 10 },
    { label: 2, from: 30, to: 40, seconds: 10 },
    { label: 3, from: 50, to: 70, seconds: 20 },
    { label: 4, from: 90, to: 100, seconds: 10 },
  ]);
});

test("excludes reward-screen pauses from rotation clear times", () => {
  const phases = Parser.helpers.calculateRotationPhases({
    preciseStart: 10,
    missionStart: 10,
    openingRejoinTime: 0,
    rewardTimestamps: [100, 200],
    pauseIntervals: [[100, 120]],
  });
  assert.deepEqual(phases, [
    { label: 1, from: 10, to: 100, seconds: 90 },
    { label: 2, from: 100, to: 200, seconds: 80 },
  ]);
});

test("closes Mirror Defense reward pauses on LoopDefend markers without treating repeated sides as waves", () => {
  const lines = [
    "1.0 Game [Info]: EliteAlertMission at SolNode450",
    "1.1 Game [Info]: Level=/Lotus/Levels/Proc/LastWish/LastWishDefense",
    "2.0 ThemedSquadOverlay.lua: Mission name: Tyana Pass (Mars) - Arbitration",
    "10.0 Script [Info]: LoopDefend.lua: Loop Defense wave: 1",
  ];
  for (let index = 0; index < 48; index += 1) {
    const npc = index < 7 ? "CorpusEliteShieldDroneAgent" : "EliteRifleLancerAgent";
    lines.push(`${(11 + index).toFixed(1)} AI [Info]: OnAgentCreated /Npc/${npc}${index + 1} AI [Info]: MonitoredTicking ${index % 30}`);
  }
  lines.push("100.0 Sys [Info]: Created /Lotus/Interface/DefenseReward.swf");
  lines.push("110.0 Script [Info]: LoopDefend.lua: Loop Defense wave: 1");
  lines.push("200.0 Sys [Info]: Created /Lotus/Interface/DefenseReward.swf");
  lines.push("210.0 Script [Info]: LoopDefend.lua: Loop Defense wave: 2");
  lines.push("300.0 Sys [Info]: Created /Lotus/Interface/DefenseReward.swf");

  const [run] = Parser.parseText(lines.join("\n"));
  assert.ok(run);
  assert.equal(run.missionType, "MIRROR DEFENSE");
  assert.equal(run.rotations, 3);
  assert.deepEqual(run.pauseIntervals, [[100, 110], [200, 210]]);
  assert.deepEqual(run.rotationDurations, [98, 90, 90]);
  assert.deepEqual(run.waveStarts, {});
  assert.deepEqual(run.waveDurations, []);
});

test("excludes prebuffer and post-extraction samples from reported spawn gaps", () => {
  const gaps = Parser.helpers.longestGaps(
    [2, 8, 10, 14, 22, 29, 35],
    [],
    5,
    10,
    29,
  );
  assert.deepEqual(gaps, [[8, 14], [7, 22], [4, 10]]);
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
