(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ArbitrationLogParser = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MIN_RUN_DRONES = 5;
  const MIN_RUN_ENEMIES = 40;
  const DROP_CHANCE = 0.15;
  const RETRIEVER_CHANCE = 0.18;
  const EARLY_ROTATION_BONUS_CHANCE = 0.07;
  const LATE_ROTATION_BONUS_CHANCE = 0.10;
  const EARLY_ROTATION_COUNT = 4;
  const WAVES_PER_ROTATION = 3;
  // Defense opens its extraction vote after a deterministic five-second
  // post-wave transition. EE.log keeps emitting the vote-screen marker even
  // after the one-time completion/transmission asset markers are cached.
  const DEFENSE_VOTE_TRANSITION_SECONDS = 5;
  const OPENING_REJOIN_WINDOW_SECONDS = 10 * 60;
  const JOIN_EVIDENCE_WINDOW_SECONDS = 60;
  const PARALLEL_PARSE_MIN_BYTES = 512 * 1024 * 1024;
  const PARALLEL_PARSE_MAX_WORKERS = 4;
  const PARALLEL_SCANNER_URL = "./scanner-worker.js?v=20260820-6";
  const HIGH_DENSITY_SATURATION_TYPES = new Set(["SURVIVAL", "DISRUPTION"]);
  const DEFAULT_SATURATION_EDGES = [3, 6, 9, 12, 15, 18, 21, 24, 27];
  const HIGH_DENSITY_SATURATION_EDGES = [8, 15, 23, 30, 33, 36, 39, 42, 45];
  const FORCED_VALID_AGENTS = new Set(["CorpusEliteShieldDroneAgent"]);
  const EXCLUDED_AGENT = /Replicant|RJCrew|petavatar|VoidClone|Turret|Dropship|CatbrowPetAgent|AllyAgent|AutoTurretAgentShipRemaster|Summon\s*Motorcycle/i;
  const NON_MISSION_LEVEL = [
    "/proc/playership/", "/proc/hub/", "/levels/hub/", "/levels/clandojo/", "/levels/railjack/"
  ];

  // Stable log tokens are the primary identity. This catalog covers every
  // Arbitration-capable star-chart node, independently from the curated tier
  // list and the smaller set of nodes with custom 3D-viewer data.
  const ARBI_NODES = {
    SolNode25: ["Callisto", "Jupiter", "Interception", "Corpus", "Corpus Gas City"],
    ClanNode4: ["Sinai", "Jupiter", "Defense", "Infested", "Corpus Gas City"],
    SolNode125: ["Io", "Jupiter", "Defense", "Corpus", "Corpus Gas City"],
    SolNode64: ["Umbriel", "Uranus", "Interception", "Grineer", "Grineer Sealab"],
    SolNode122: ["Stephano", "Uranus", "Defense", "Grineer", "Grineer Sealab"],
    SolNode23: ["Cytherean", "Venus", "Interception", "Corpus", "Corpus Ship"],
    SolNode172: ["Xini", "Eris", "Interception", "Infested", "Corpus Ship"],
    SettlementNode11: ["Gulliver", "Phobos", "Defense", "Corpus", "Corpus Ship"],
    ClanNode0: ["Romula", "Venus", "Defense", "Infested", "Corpus Ship"],
    SolNode17: ["Proteus", "Neptune", "Defense", "Corpus", "Corpus Ship"],
    SolNode106: ["Alator", "Mars", "Interception", "Grineer", "Grineer Settlement"],
    ClanNode8: ["Kadesh", "Mars", "Defense", "Infested", "Grineer Settlement"],
    SolNode46: ["Spear", "Mars", "Defense", "Grineer", "Grineer Settlement"],
    SolNode450: ["Tyana Pass", "Mars", "Mirror Defense", "Grineer / Corpus", "Tyana Pass"],
    SolNode719: ["Munio", "Deimos", "Mirror Defense", "The Murmur", "Albrecht's Laboratories"],
    SolNode412: ["Mithra", "Void", "Interception", "Corrupted", "Orokin Tower"],
    SolNode402: ["Taranis", "Void", "Defense", "Corrupted", "Orokin Tower"],
    SolNode408: ["Belenus", "Void", "Defense", "Corrupted", "Orokin Tower"],
    SolNode149: ["Casta", "Ceres", "Defense", "Grineer", "Grineer Shipyard"],
    ClanNode22: ["Seimeni", "Ceres", "Defense", "Infested", "Grineer Shipyard"],
    SolNode147: ["Cinxia", "Ceres", "Interception", "Grineer", "Grineer Shipyard"],
    SolNode195: ["Hydron", "Sedna", "Defense", "Grineer", "Grineer Galleon"],
    SolNode42: ["Helene", "Saturn", "Defense", "Grineer", "Grineer Galleon"],
    SolNode224: ["Odin", "Mercury", "Interception", "Grineer", "Grineer Galleon"],
    ClanNode24: ["Sechura", "Pluto", "Defense", "Infested", "Corpus Outpost"],
    SolNode22: ["Tessera", "Venus", "Defense", "Corpus", "Corpus Outpost"],
    SolNode72: ["Outer Terminus", "Pluto", "Defense", "Corpus", "Corpus Outpost"],
    SolNode43: ["Cerberus", "Pluto", "Interception", "Corpus", "Corpus Outpost"],
    SolNode211: ["Ose", "Europa", "Interception", "Corpus", "Corpus Ice Planet"],
    SolNode212: ["Paimon", "Europa", "Defense", "Corpus", "Corpus Ice Planet"],
    ClanNode6: ["Larzac", "Europa", "Defense", "Infested", "Corpus Ice Planet"],
    SolNode18: ["Rhea", "Saturn", "Interception", "Grineer", "Grineer Asteroid"],
    SolNode130: ["Lares", "Mercury", "Defense", "Infested", "Grineer Asteroid"],
    ClanNode15: ["Sangeru", "Sedna", "Defense", "Infested", "Grineer Asteroid"],
    ClanNode18: ["Akkad", "Eris", "Defense", "Infested", "Infested Ship"],
    SolNode164: ["Kala-Azar", "Eris", "Defense", "Infested", "Infested Ship"],
    ClanNode2: ["Coba", "Earth", "Defense", "Infested", "Grineer Forest"],
    SolNode26: ["Lith", "Earth", "Defense", "Grineer", "Grineer Forest"],
    SolNode185: ["Berehynia", "Sedna", "Interception", "Grineer", "Grineer Settlement"],
    SolNode167: ["Oestrus", "Eris", "Infested Salvage", "Infested", "Infested Ship"],
    SolNode85: ["Gaia", "Earth", "Interception", "Grineer", "Grineer Forest"],
    SolNode707: ["Hyf", "Deimos", "Defense", "Infested", "Deimos"],
    SolNode305: ["Stöfler", "Lua", "Defense", "Grineer", "Lua"],
    ClanNode1: ["Malva", "Venus", "Survival", "Infested", "Corpus Ship"],
    ClanNode3: ["Tikal", "Earth", "Excavation", "Infested", "Grineer Forest"],
    ClanNode5: ["Cameria", "Jupiter", "Survival", "Infested", "Corpus Gas City"],
    ClanNode7: ["Cholistan", "Europa", "Excavation", "Infested", "Corpus Ice Planet"],
    ClanNode9: ["Wahiba", "Mars", "Survival", "Infested", "Corpus Ship"],
    ClanNode10: ["Memphis", "Phobos", "Defection", "Infested", "Grineer Asteroid"],
    ClanNode11: ["Zeugma", "Phobos", "Survival", "Infested", "Grineer Asteroid"],
    ClanNode12: ["Caracol", "Saturn", "Defection", "Infested", "Grineer Asteroid"],
    ClanNode13: ["Piscinas", "Saturn", "Survival", "Infested", "Grineer Asteroid"],
    ClanNode14: ["Amarna", "Sedna", "Survival", "Infested", "Grineer Asteroid"],
    ClanNode16: ["Ur", "Uranus", "Disruption", "Infested", "Grineer Galleon"],
    ClanNode17: ["Assur", "Uranus", "Survival", "Infested", "Grineer Galleon"],
    ClanNode19: ["Zabala", "Eris", "Survival", "Infested", "Infested Ship"],
    ClanNode20: ["Yursa", "Neptune", "Defection", "Infested", "Infested Ship"],
    ClanNode21: ["Kelashin", "Neptune", "Survival", "Infested", "Infested Ship"],
    ClanNode23: ["Gabii", "Ceres", "Survival", "Infested", "Grineer Galleon"],
    ClanNode25: ["Hieracon", "Pluto", "Excavation", "Infested", "Corpus Outpost"],
    SettlementNode3: ["Stickney", "Phobos", "Survival", "Corpus", "Corpus Ship"],
    SolNode6: ["Despina", "Neptune", "Excavation", "Corpus", "Corpus Outpost"],
    SolNode16: ["Augustus", "Mars", "Excavation", "Grineer", "Grineer Settlement"],
    SolNode30: ["Olympus", "Mars", "Disruption", "Grineer", "Grineer Settlement"],
    SolNode39: ["Everest", "Earth", "Excavation", "Grineer", "Grineer Forest"],
    SolNode69: ["Ophelia", "Uranus", "Survival", "Grineer", "Grineer Sealab"],
    SolNode81: ["Palus", "Pluto", "Survival", "Corpus", "Corpus Ship"],
    SolNode87: ["Ganymede", "Jupiter", "Disruption", "Corpus", "Corpus Gas City"],
    SolNode94: ["Apollodorus", "Mercury", "Survival", "Infested", "Grineer Galleon"],
    SolNode96: ["Titan", "Saturn", "Survival", "Grineer", "Grineer Galleon"],
    SolNode100: ["Elara", "Jupiter", "Survival", "Corpus", "Corpus Gas City"],
    SolNode101: ["Kiliken", "Venus", "Excavation", "Corpus", "Corpus Outpost"],
    SolNode118: ["Laomedeia", "Neptune", "Disruption", "Corpus", "Corpus Outpost"],
    SolNode123: ["V Prime", "Venus", "Survival", "Corpus", "Corpus Ship"],
    SolNode146: ["Draco", "Ceres", "Survival", "Grineer", "Grineer Asteroid"],
    SolNode166: ["Nimus", "Eris", "Survival", "Infested", "Infested Ship"],
    SolNode177: ["Kappa", "Sedna", "Disruption", "Grineer", "Grineer Galleon"],
    SolNode187: ["Selkie", "Sedna", "Survival", "Grineer", "Grineer Asteroid"],
    SolNode216: ["Valefor", "Europa", "Excavation", "Corpus", "Corpus Ice Planet"],
    SolNode302: ["Tycho", "Lua", "Survival", "Corpus", "Orokin Moon"],
    SolNode308: ["Apollo", "Lua", "Disruption", "Corpus", "Orokin Moon"],
    SolNode309: ["Yuvarium", "Lua", "Survival", "Corrupted", "Orokin Moon"],
    SolNode405: ["Ani", "Void", "Survival", "Orokin", "Orokin Tower"],
    SolNode409: ["Mot", "Void", "Survival", "Orokin", "Orokin Tower"],
    SolNode711: ["Terrorem", "Deimos", "Survival", "Infested", "Orokin Derelict"],
    SolNode744: ["Taveuni", "Kuva Fortress", "Survival", "Grineer", "Grineer Asteroid Fortress"],
    SolNode745: ["Tamu", "Kuva Fortress", "Disruption", "Grineer", "Grineer Asteroid Fortress"],
  };

  // Mission classification is intentionally broader than the curated tier
  // list and the 3D-viewer catalog above. Every Arbitration-capable star-chart
  // node needs its real endless mission type even when it has no tier badge or
  // custom tile metadata. Keep this keyed by the stable SolNode token emitted
  // by EE.log; never infer an unrecognized endless mode as Survival.
  const MISSION_TYPE_BY_NODE = Object.freeze(
    Object.fromEntries(Object.entries(ARBI_NODES).map(([token, info]) => [token, info[2]]))
  );

  const NODE_BY_NAME = Object.fromEntries(
    Object.entries(ARBI_NODES).map(([token, info]) => [info[0].toLocaleLowerCase(), token])
  );

  const P_TIMESTAMP = /^!?(\d+\.\d+)/;
  const P_MISSION = /ThemedSquadOverlay\.lua: Mission name: (.*)/;
  const P_MISSION_VOTE = /ThemedSquadOverlay\.lua: ShowMissionVote (.+?\([^)]+\)) - Arbitration\b/;
  const P_AGENT_FULL = /OnAgentCreated.*?\/Npc\/(.+?)(\d+)\s+.*?MonitoredTicking\s+(\d+)/;
  const P_NPC = /\/Npc\/([A-Za-z0-9_]+)/;
  const P_WAVE_LINE = /^!?(\d+\.\d+).*WaveDefend\.lua: Starting wave (\d+)/;
  const P_WAVE_DEF = /^!?(\d+\.\d+).*WaveDefend\.lua: Defense wave: (\d+)/;
  const P_WAVE_CAP = /WaveDefend\.lua: Starting wave \d+.*?\((\d+) simultaneous/;
  const P_MONITORED = /AI \[Info\]: .*?MonitoredTicking (\d+)/;
  const P_LIVE = /AI \[Info\]:.*?Live (\d+)/;
  const P_LOADOUT = /Game \[Info\]: (.+?) loadout loader finished\./;
  const P_UNREGISTERED = /Player=([^,]+),\s*change=UNREGISTERED/;
  const P_NAMED_JOIN = /ProcessSquadMessage received JOIN message from (.+?),\s*loadout:/;
  const P_NAMED_LEAVE = /ProcessSquadMessage received LEAVE message from (.+?)\s*$/;
  const P_SQUAD_ADD = /AddSquadMember:\s*(.+?),\s*mm=.*?\bsquadCount=\d+/;
  const P_INT_INIT = /TerritoryMission\.lua: .*?(?:control|captured)/i;
  const P_SPAWN_POINT = /^!?(\d+\.\d+).*WaveDefend\.lua: Spawned a \/Npc\/([A-Za-z0-9_]+?)\d* @ Vector\(([^)]+)\), spawn point: (\/[A-Za-z0-9_/]*?)\/([Nn]pcSpawnPoint\d+) @ Vector\(([^)]+)\)/;
  const P_AI_AGENT_INIT = /^!?(\d+\.\d+).*AI Agent Initialize\s+\/Npc\/([A-Za-z0-9_]+?)\d*\s+at NpcAiDirector\s+(\/[A-Za-z0-9_/]*?)\/([Nn]pcSpawnPoint\d+)/i;
  const P_ELITE_ALERT = /^!?(\d+\.\d+).*EliteAlertMission at ((?:Sol|Clan|Settlement)Node\d+)(?:\s+\(([^)]{1,120})\))?/i;
  const P_LEVEL = /^!?(\d+\.\d+).*Game \[Info\]: Level=(\/[^\s,]+)/;
  const P_LEVEL_COMPONENT = /Required by object (\/Lotus\/Levels\/[A-Za-z0-9_/-]+)\/Scope/;
  const P_RELEVANT_TOKEN = /OnAgentCreated|Destroying CorpusEliteShieldDroneAvatar|Mission name:|ShowMissionVote|spawn point:|AI Agent Initialize|EliteAlertMission at|Game \[Info\]: Level=|Required by object \/Lotus\/Levels\/|_SleepBetweenWaves|DefenseReward\.swf|ProjectionsCountdown\.swf|Starting wave|Defense wave:|Loop Defense wave:|TerritoryMission\.lua|Survival: Starting survival|Survival: Gave reward tier|Disruption: State change: ARTIFACT_ROUND|Disruption: Endless mission reward given|EOM: All players extracting|loadout loader finished|change=UNREGISTERED|received JOIN message from|received LEAVE message from|AddSquadMember:|Client joining mission in-progress|MonitoredTicking|Live /g;

  function cleanName(raw) {
    return String(raw || "").replace(/[\x00-\x1F\x7F-\x9F\uE000-\uF8FF\uFFFD■□]/g, "").trim().slice(0, 50);
  }

  function createRun() {
    return {
      missionName: "Unknown Node",
      isArbitration: false,
      nodeKey: "",
      levelPath: "",
      levelComponents: [],
      isDefense: false,
      isInterception: false,
      isDisruption: false,
      isSurvival: false,
      droneKills: 0,
      enemySpawns: 0,
      rawEnemySpawns: 0,
      rounds: 0,
      droneTimestamps: [],
      droneDespawnTimestamps: [],
      rewardTimestamps: [],
      enemyTimestamps: [],
      waveStarts: {},
      waveEnds: [],
      waveCountdowns: [],
      liveCounts: [],
      pauseIntervals: [],
      spawnPoints: {},
      host: "",
      squadmates: [],
      missionStart: 0,
      preciseStart: null,
      extractionTime: 0,
      openingRejoinTime: 0,
      openingDepartures: [],
      openingOperationalLoads: [],
      recentJoinEvidence: new Map(),
      localInProgressAt: 0,
      playerPresence: new Map(),
      lastActivity: 0,
      lastReward: 0,
      simCap: 32,
      nonTickingAgents: [],
      enemyTypes: {},
      allSpawns: [],
      agentsFinalized: false,
      pauseOpen: null,
      inMission: [],
    };
  }

  function hasData(run) {
    return run.droneKills >= MIN_RUN_DRONES || run.rawEnemySpawns >= MIN_RUN_ENEMIES;
  }

  function startTime(run) {
    if (Number.isFinite(run.startTime)) return run.startTime;
    const base = run.preciseStart || run.missionStart || run.droneTimestamps[0] || 0;
    return Math.max(base, run.openingRejoinTime || 0);
  }

  function isOpeningRejoinPhase(run) {
    if (run.rewardTimestamps.length) return false;
    if (run.isDefense) {
      const startedWaves = Object.keys(run.waveStarts).map(Number).filter(Number.isFinite);
      return !startedWaves.length || Math.max(...startedWaves) <= WAVES_PER_ROTATION;
    }
    if (run.isInterception) return run.rounds < WAVES_PER_ROTATION;
    if (run.isDisruption) return run.rounds < WAVES_PER_ROTATION;
    if (run.isSurvival) return true;
    return run.preciseStart === null;
  }

  function endTime(run) {
    if (run.extractionTime > 0) return run.extractionTime;
    return Math.max(run.lastActivity || 0, run.lastReward || 0);
  }

  function openPlayerPresence(run, name, timestamp) {
    if (!name || !timestamp) return;
    let presence = run.playerPresence.get(name);
    if (!presence) {
      presence = { intervals: [], since: null };
      run.playerPresence.set(name, presence);
    }
    if (presence.since === null) presence.since = timestamp;
  }

  function closePlayerPresence(run, name, timestamp) {
    const presence = run.playerPresence.get(name);
    if (!presence || presence.since === null || !timestamp) return;
    if (timestamp >= presence.since) presence.intervals.push([presence.since, timestamp]);
    presence.since = null;
  }

  function finalizedSquadmates(run, from, to) {
    const names = [...new Set(run.squadmates.filter((name) => name && name !== run.host))];
    if (names.length <= 3) return names;
    const score = (name) => {
      const presence = run.playerPresence.get(name);
      if (!presence) return 0;
      const intervals = [...presence.intervals];
      if (presence.since !== null) intervals.push([presence.since, to]);
      return intervals.reduce((sum, pair) => sum + overlap(pair[0], pair[1], from, to), 0);
    };
    const selected = new Set(names.map((name, index) => ({ name, index, seconds: score(name) }))
      .sort((left, right) => right.seconds - left.seconds || left.index - right.index)
      .slice(0, 3)
      .map((entry) => entry.name));
    return names.filter((name) => selected.has(name));
  }

  function openingReadyTime(run, names) {
    const selected = new Set(names);
    return run.openingOperationalLoads.reduce((latest, entry) => (
      selected.has(entry.name) ? Math.max(latest, entry.timestamp) : latest
    ), 0);
  }

  function resolveFinalizedCore(run, to) {
    const base = run.preciseStart || run.missionStart || run.droneTimestamps[0] || 0;
    let names = finalizedSquadmates(run, base, to);
    let ready = openingReadyTime(run, names);
    let from = Math.max(base, ready);

    // A later active start can change which of several transient opening
    // players has the greatest real-run presence. Iterate to a stable core so
    // timing and the displayed squad are derived from the same identities.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const nextNames = finalizedSquadmates(run, from, to);
      const nextReady = openingReadyTime(run, nextNames);
      const nextFrom = Math.max(base, nextReady);
      if (nextFrom === from && nextNames.join("\0") === names.join("\0")) break;
      names = nextNames;
      ready = nextReady;
      from = nextFrom;
    }
    return { names, ready, start: from };
  }

  function overlap(a, b, p0, p1) {
    return Math.max(0, Math.min(b, p1) - Math.max(a, p0));
  }

  function fullSquadCoverage(run, from, to) {
    if (!(to > from)) return 0;
    const events = [];
    run.playerPresence.forEach((presence) => {
      const intervals = [...presence.intervals];
      if (presence.since !== null) intervals.push([presence.since, to]);
      intervals.forEach(([left, right]) => {
        const start = Math.max(from, left);
        const end = Math.min(to, right);
        if (end <= start) return;
        events.push([start, 1], [end, -1]);
      });
    });
    events.sort((left, right) => left[0] - right[0]);

    let connected = 0;
    let cursor = from;
    let covered = 0;
    for (let index = 0; index < events.length;) {
      const timestamp = events[index][0];
      if (connected >= 3) covered += timestamp - cursor;
      let delta = 0;
      while (index < events.length && events[index][0] === timestamp) {
        delta += events[index][1];
        index += 1;
      }
      connected += delta;
      cursor = timestamp;
    }
    if (connected >= 3) covered += to - cursor;
    return Math.max(0, Math.min(1, covered / (to - from)));
  }

  function pauseSeconds(run, a, b) {
    return run.pauseIntervals.reduce((sum, pair) => sum + overlap(a, b, pair[0], pair[1]), 0);
  }

  function waveOf(run, timestamp) {
    let found = 0;
    Object.keys(run.waveStarts).map(Number).sort((a, b) => a - b).forEach((wave) => {
      if (run.waveStarts[wave] <= timestamp) found = wave;
    });
    return found;
  }

  class Parser {
    constructor() {
      this.runs = [];
      this.cur = createRun();
      this.advertised = [];
      this.levels = [];
      this.stringPool = new Map();
    }

    intern(value) {
      const candidate = String(value || "");
      const existing = this.stringPool.get(candidate);
      if (existing !== undefined) return existing;
      // RegExp captures are often sliced strings. Retaining one can otherwise
      // pin the entire 16 MB decoded log chunk that contained it.
      const detached = candidate ? candidate.split("").join("") : "";
      this.stringPool.set(detached, detached);
      return detached;
    }

    feedLine(line, relevantToken) {
      if (!line || line === "\r" || line.includes("Game [Warning]:") || line.includes("DamagePct")) return;
      let hasAgent = false;
      let hasDroneDespawn = false;
      let hasMission = false;
      let hasMissionVote = false;
      let hasSpawnPoint = false;
      let hasAgentInitialize = false;
      let hasEliteAlert = false;
      let hasLevel = false;
      let hasLevelComponent = false;
      let hasSleep = false;
      let hasReward = false;
      let hasCountdown = false;
      let hasWaveStart = false;
      let hasWaveDef = false;
      let hasLoopWave = false;
      let hasTerritory = false;
      let hasSurvivalStart = false;
      let hasSurvivalReward = false;
      let hasDisruptionRoundStart = false;
      let hasDisruptionRoundDone = false;
      let hasDisruptionReward = false;
      let hasExtraction = false;
      let hasPlayerJoin = false;
      let hasPlayerLeave = false;
      let hasNamedJoin = false;
      let hasNamedLeave = false;
      let hasSquadAdd = false;
      let hasLocalInProgress = false;
      let hasLiveCount = false;

      if (relevantToken === undefined) {
        // Preserve direct Parser.feedLine() compatibility for tests and other
        // callers that do not use the streaming token scanner.
        hasAgent = line.includes("OnAgentCreated");
        hasDroneDespawn = line.includes("Arbitration.lua: Destroying CorpusEliteShieldDroneAvatar");
        hasMission = line.includes("Mission name:");
        hasMissionVote = line.includes("ShowMissionVote") && line.includes(" - Arbitration");
        hasSpawnPoint = line.includes("spawn point:");
        hasAgentInitialize = line.includes("AI Agent Initialize");
        hasEliteAlert = line.includes("EliteAlertMission at");
        hasLevel = line.includes("Game [Info]: Level=");
        hasLevelComponent = line.includes("Required by object /Lotus/Levels/");
        hasSleep = line.includes("WaveDefend.lua: _SleepBetweenWaves");
        hasReward = line.includes("Created /Lotus/Interface/DefenseReward.swf");
        hasCountdown = line.includes("Created /Lotus/Interface/ProjectionsCountdown.swf");
        hasWaveStart = line.includes("WaveDefend.lua: Starting wave");
        hasWaveDef = line.includes("WaveDefend.lua: Defense wave:");
        hasLoopWave = line.includes("LoopDefend.lua: Loop Defense wave:");
        hasTerritory = line.includes("TerritoryMission.lua");
        hasSurvivalStart = line.includes("SurvivalMission.lua: Survival: Starting survival");
        hasSurvivalReward = line.includes("SurvivalMission.lua: Survival: Gave reward tier");
        hasDisruptionRoundDone = line.includes("SentientArtifactMission.lua: Disruption: State change: ARTIFACT_ROUND_DONE");
        hasDisruptionRoundStart = line.includes("SentientArtifactMission.lua: Disruption: State change: ARTIFACT_ROUND") && !hasDisruptionRoundDone;
        hasDisruptionReward = line.includes("SentientArtifactMission.lua: Disruption: Endless mission reward given");
        hasExtraction = line.includes("ExtractionTimer.lua: EOM: All players extracting");
        hasPlayerJoin = line.includes("loadout loader finished");
        hasPlayerLeave = line.includes("change=UNREGISTERED");
        hasNamedJoin = line.includes("ProcessSquadMessage received JOIN message from");
        hasNamedLeave = line.includes("ProcessSquadMessage received LEAVE message from");
        hasSquadAdd = line.includes("AddSquadMember:");
        hasLocalInProgress = line.includes("LoadLevelMsg received. Client joining mission in-progress");
        hasLiveCount = line.includes("MonitoredTicking") || (line.includes("AI [Info]:") && line.includes("Live "));
      } else {
        switch (relevantToken) {
          case "OnAgentCreated": hasAgent = true; break;
          case "Destroying CorpusEliteShieldDroneAvatar":
            hasDroneDespawn = line.includes("Arbitration.lua: Destroying CorpusEliteShieldDroneAvatar");
            break;
          case "Mission name:": hasMission = true; break;
          case "ShowMissionVote": hasMissionVote = line.includes(" - Arbitration"); break;
          case "spawn point:": hasSpawnPoint = true; break;
          case "AI Agent Initialize": hasAgentInitialize = true; break;
          case "EliteAlertMission at": hasEliteAlert = true; break;
          case "Game [Info]: Level=": hasLevel = true; break;
          case "Required by object /Lotus/Levels/": hasLevelComponent = true; break;
          case "_SleepBetweenWaves": hasSleep = line.includes("WaveDefend.lua: _SleepBetweenWaves"); break;
          case "DefenseReward.swf": hasReward = line.includes("Created /Lotus/Interface/DefenseReward.swf"); break;
          case "ProjectionsCountdown.swf": hasCountdown = line.includes("Created /Lotus/Interface/ProjectionsCountdown.swf"); break;
          case "Starting wave": hasWaveStart = line.includes("WaveDefend.lua: Starting wave"); break;
          case "Defense wave:": hasWaveDef = line.includes("WaveDefend.lua: Defense wave:"); break;
          case "Loop Defense wave:": hasLoopWave = line.includes("LoopDefend.lua: Loop Defense wave:"); break;
          case "TerritoryMission.lua": hasTerritory = true; break;
          case "Survival: Starting survival": hasSurvivalStart = line.includes("SurvivalMission.lua: Survival: Starting survival"); break;
          case "Survival: Gave reward tier": hasSurvivalReward = line.includes("SurvivalMission.lua: Survival: Gave reward tier"); break;
          case "Disruption: State change: ARTIFACT_ROUND":
            hasDisruptionRoundDone = line.includes("SentientArtifactMission.lua: Disruption: State change: ARTIFACT_ROUND_DONE");
            hasDisruptionRoundStart = !hasDisruptionRoundDone;
            break;
          case "Disruption: Endless mission reward given":
            hasDisruptionReward = line.includes("SentientArtifactMission.lua: Disruption: Endless mission reward given");
            break;
          case "EOM: All players extracting": hasExtraction = line.includes("ExtractionTimer.lua: EOM: All players extracting"); break;
          case "loadout loader finished": hasPlayerJoin = true; break;
          case "change=UNREGISTERED": hasPlayerLeave = true; break;
          case "received JOIN message from": hasNamedJoin = true; break;
          case "received LEAVE message from": hasNamedLeave = true; break;
          case "AddSquadMember:": hasSquadAdd = true; break;
          case "Client joining mission in-progress": hasLocalInProgress = true; break;
          case "MonitoredTicking":
            hasLiveCount = true;
            hasAgent = line.includes("OnAgentCreated");
            break;
          case "Live ":
            hasLiveCount = line.includes("AI [Info]:");
            hasAgent = line.includes("OnAgentCreated");
            break;
          default: break;
        }
      }
      if (!(hasAgent || hasDroneDespawn || hasMission || hasMissionVote || hasSpawnPoint || hasAgentInitialize || hasEliteAlert || hasLevel || hasLevelComponent || hasSleep || hasReward || hasCountdown || hasWaveStart || hasWaveDef || hasLoopWave || hasTerritory || hasSurvivalStart || hasSurvivalReward || hasDisruptionRoundStart || hasDisruptionRoundDone || hasDisruptionReward || hasExtraction || hasPlayerJoin || hasPlayerLeave || hasNamedJoin || hasNamedLeave || hasSquadAdd || hasLocalInProgress || hasLiveCount)) return;

      if (hasMission || hasMissionVote) {
        const match = line.match(hasMission ? P_MISSION : P_MISSION_VOTE);
        const timestamp = (line.match(P_TIMESTAMP) || [])[1];
        if (match) {
          const label = hasMission ? match[1].trim() : `${match[1].trim()} - Arbitration`;
          this.startMission(label, Number(timestamp) || 0);
        }
        return;
      }
      if (hasEliteAlert) {
        const match = line.match(P_ELITE_ALERT);
        if (match) this.advertised.push([Number(match[1]), canonicalNode(match[2])]);
        return;
      }
      if (hasLevel) {
        const match = line.match(P_LEVEL);
        if (match) {
          const path = this.intern(match[2]);
          const lower = path.toLocaleLowerCase();
          if (NON_MISSION_LEVEL.some((marker) => lower.includes(marker))) {
            // Some mission exits never emit a new ThemedSquadOverlay mission
            // name. Close the active run when the client returns to a hub,
            // dojo, Railjack, or player ship so a later squad cannot leak into
            // the completed report.
            if (this.cur.isArbitration) this.endMissionContext();
          } else {
            this.levels.push([Number(match[1]), path]);
          }
        }
        return;
      }
      if (hasLevelComponent) {
        const match = line.match(P_LEVEL_COMPONENT);
        if (match) {
          const path = this.intern(`${match[1]}.level`);
          if (!this.cur.levelComponents.includes(path)) this.cur.levelComponents.push(path);
        }
        return;
      }
      const lineTimestamp = (hasPlayerJoin || hasPlayerLeave || hasNamedJoin || hasNamedLeave || hasSquadAdd || hasLocalInProgress)
        ? Number((line.match(P_TIMESTAMP) || [])[1]) || 0
        : 0;
      if (hasNamedJoin) this.playerJoinEvidence(line, lineTimestamp, P_NAMED_JOIN);
      if (hasSquadAdd) this.playerJoinEvidence(line, lineTimestamp, P_SQUAD_ADD);
      if (hasLocalInProgress && this.cur.isArbitration) this.cur.localInProgressAt = lineTimestamp;
      if (hasNamedLeave) this.playerLeave(line, lineTimestamp, P_NAMED_LEAVE);
      if (hasPlayerJoin) this.playerJoin(line, lineTimestamp);
      if (hasPlayerLeave) this.playerLeave(line, lineTimestamp);
      if (!this.cur.isArbitration) return;

      const cur = this.cur;
      let ts = 0;
      if (/^!?\d/.test(line)) {
        const match = line.match(P_TIMESTAMP);
        if (match) ts = Number(match[1]);
      }

      if (hasDroneDespawn) {
        if (ts) {
          cur.droneDespawnTimestamps.push(ts);
          cur.lastActivity = Math.max(cur.lastActivity, ts);
        }
        return;
      }

      if (hasAgent) {
        if (ts) {
          const mon = line.match(P_MONITORED);
          if (mon) cur.liveCounts.push([ts, Number(mon[1]), cur.simCap]);
        }
        const isDrone = line.includes("CorpusEliteShieldDroneAgent");
        if (!isDrone && EXCLUDED_AGENT.test(line)) return;
        if (isDrone) {
          cur.droneKills += 1;
          if (ts) {
            cur.droneTimestamps.push(ts);
            cur.lastActivity = Math.max(cur.lastActivity, ts);
          }
        }
        cur.rawEnemySpawns += 1;
        const full = line.match(P_AGENT_FULL);
        if (full) {
          cur.allSpawns.push({ name: this.intern(full[1].trim()), tick: Number(full[3]) || null, timestamp: ts });
        } else {
          const npc = line.match(P_NPC);
          cur.allSpawns.push({ name: npc ? this.intern(npc[1].trim()) : null, tick: null, timestamp: ts });
        }
        return;
      }

      if (hasSurvivalStart) {
        cur.isSurvival = true;
        if (ts) {
          cur.preciseStart = ts;
          cur.lastActivity = Math.max(cur.lastActivity, ts);
        }
        return;
      }

      // SurvivalReward.swf is created repeatedly during normal play and is not
      // a rotation boundary. The mission-script line below is emitted once for
      // each completed five-minute reward cycle.
      if (hasSurvivalReward) {
        cur.isSurvival = true;
        if (ts && ts - cur.lastReward > 30) {
          cur.rounds += 1;
          cur.lastReward = ts;
          cur.rewardTimestamps.push(ts);
          cur.lastActivity = Math.max(cur.lastActivity, ts);
        }
        return;
      }

      // ARTIFACT_ROUND_DONE is replicated mission state and is therefore the
      // primary completed-round boundary for both hosts and clients. The
      // subsequent host reward line is retained as a fallback and deduplicated.
      if (hasDisruptionRoundDone || hasDisruptionReward) {
        cur.isDisruption = true;
        if (ts && ts - cur.lastReward > 30) {
          cur.rounds += 1;
          cur.lastReward = ts;
          cur.rewardTimestamps.push(ts);
          cur.lastActivity = Math.max(cur.lastActivity, ts);
          if (cur.pauseOpen === null) cur.pauseOpen = ts;
        }
        return;
      }

      if (hasDisruptionRoundStart) {
        cur.isDisruption = true;
        if (ts) {
          // Some prebuffered logs join after the first round-state transition.
          // Only claim an exact active start when this marker precedes the first
          // completed reward; otherwise preserve the normal active-run fallback.
          if (cur.preciseStart === null && !cur.rewardTimestamps.length) cur.preciseStart = ts;
          if (cur.pauseOpen !== null) {
            cur.pauseIntervals.push([cur.pauseOpen, ts]);
            cur.pauseOpen = null;
          }
          cur.lastActivity = Math.max(cur.lastActivity, ts);
        }
        return;
      }

      if (hasExtraction) {
        if (ts) {
          cur.extractionTime = ts;
          cur.lastActivity = Math.max(cur.lastActivity, ts);
        }
        return;
      }

      if (hasSpawnPoint) {
        this.spawnPoint(line);
        return;
      }
      if (hasAgentInitialize) {
        this.spawnPointFallback(line);
        return;
      }

      const isDefWaveOne = hasWaveDef && line.includes("Defense wave: 1");

      if ((hasSleep || hasReward) && cur.pauseOpen === null && ts) cur.pauseOpen = ts;
      let waveMatch = null;
      if (hasWaveStart) waveMatch = line.match(P_WAVE_LINE);
      else if (hasWaveDef) waveMatch = line.match(P_WAVE_DEF);

      // Mirror Defense uses LoopDefend resume markers after each reward. Keep
      // them out of waveStarts: a bugged side can repeat its round number, and
      // Mirror Defense reporting is correctly bounded by reward rotations.
      let unpause = Boolean(cur.isDefense && (waveMatch || hasLoopWave));
      if (hasTerritory) {
        cur.isInterception = true;
        unpause = true;
      }
      if (unpause && cur.pauseOpen !== null && ts) {
        cur.pauseIntervals.push([cur.pauseOpen, ts]);
        cur.pauseOpen = null;
      }

      if (cur.preciseStart === null && ts) {
        if (isDefWaveOne) cur.preciseStart = ts;
        else if (hasTerritory && P_INT_INIT.test(line)) {
          cur.preciseStart = ts;
          cur.isInterception = true;
        }
      }

      if (hasReward && ts && ts - cur.lastReward > 30) {
        cur.rounds += 1;
        cur.lastReward = ts;
        cur.rewardTimestamps.push(ts);
        cur.lastActivity = Math.max(cur.lastActivity, ts);
        if (cur.pauseOpen === null) cur.pauseOpen = ts;
      }

      if (hasWaveStart && line.includes("simultaneous")) {
        const cap = line.match(P_WAVE_CAP);
        if (cap) cur.simCap = Number(cap[1]);
      }

      if (ts) {
        let monitored = null;
        if (line.includes("MonitoredTicking")) monitored = line.match(P_MONITORED);
        else if (line.includes("AI [Info]:") && line.includes("Live ")) monitored = line.match(P_LIVE);
        if (monitored) cur.liveCounts.push([ts, Number(monitored[1]), cur.simCap]);
      }

      if (isDefWaveOne) cur.isDefense = true;
      if (waveMatch && ts) {
        cur.isDefense = true;
        cur.waveStarts[Number(waveMatch[2])] = ts;
        cur.lastActivity = Math.max(cur.lastActivity, ts);
      }
      if (hasSleep && line.includes("_SleepBetweenWaves(3)") && ts) cur.waveEnds.push(ts);
      if (hasCountdown && ts) cur.waveCountdowns.push(ts);
    }

    startMission(raw, ts) {
      raw = raw.replace(/Dark Sector/gi, "").trim();
      const isArbitration = raw.toLocaleLowerCase().includes("arbitration");
      this.pushCurrent();
      const next = createRun();
      next.isArbitration = isArbitration;
      next.missionName = this.intern(isArbitration
        ? raw.replace(/Arbitration:/gi, "").replace(/Arbitration/gi, "").replace(/^[\s\-–—]+|[\s\-–—]+$/g, "").trim() || raw
        : raw);
      if (ts) {
        next.missionStart = ts;
        next.lastActivity = ts;
      }
      next.host = this.cur.host;
      next.squadmates = [...this.cur.inMission];
      next.inMission = [...this.cur.inMission];
      this.cur.recentJoinEvidence.forEach((timestamp, name) => {
        if (ts >= timestamp && ts - timestamp <= JOIN_EVIDENCE_WINDOW_SECONDS) {
          next.recentJoinEvidence.set(name, timestamp);
        }
      });
      if (this.cur.localInProgressAt > 0 && ts >= this.cur.localInProgressAt && ts - this.cur.localInProgressAt <= JOIN_EVIDENCE_WINDOW_SECONDS) {
        next.localInProgressAt = this.cur.localInProgressAt;
      }
      next.inMission.forEach((name) => openPlayerPresence(next, name, ts));
      this.cur = next;
      if (!isArbitration) return;
      const lower = next.missionName.toLocaleLowerCase();
      if (lower.includes("defense")) next.isDefense = true;
      else if (lower.includes("interception")) next.isInterception = true;
      if (lower.includes("munio") || lower.includes("tyana")) next.isDefense = true;
    }

    endMissionContext() {
      const host = this.cur.host;
      this.pushCurrent();
      const next = createRun();
      next.host = host;
      this.cur = next;
    }

    spawnPoint(line) {
      const match = line.match(P_SPAWN_POINT);
      if (!match) return;
      const cur = this.cur;
      const timestamp = Number(match[1]);
      const npcType = this.intern(match[2]);
      const layer = this.intern(match[4]);
      const ident = this.intern(match[5]);
      const coords = match[6].split(",").slice(0, 3).map(Number);
      if (coords.length !== 3 || coords.some((value) => !Number.isFinite(value))) return;
      const key = `${layer}/${ident}`;
      if (!cur.spawnPoints[key]) {
        cur.spawnPoints[key] = {
          key,
          layer,
          ident,
          count: 0,
          x: coords[0],
          y: coords[1],
          z: coords[2],
          first: timestamp,
          last: timestamp,
          types: {},
          waveCounts: {},
        };
      }
      const point = cur.spawnPoints[key];
      point.count += 1;
      point.last = timestamp;
      point.types[npcType] = (point.types[npcType] || 0) + 1;
      const wave = waveOf(cur, timestamp);
      point.waveCounts[wave] = (point.waveCounts[wave] || 0) + 1;
      cur.isDefense = true;
    }

    spawnPointFallback(line) {
      const match = line.match(P_AI_AGENT_INIT);
      if (!match) return;
      const cur = this.cur;
      const timestamp = Number(match[1]);
      const layer = this.intern(match[3]);
      const ident = this.intern(match[4]);
      const npcType = this.intern(match[2]);
      const key = `${layer}/${ident}`;
      if (!cur.spawnPoints[key]) {
        cur.spawnPoints[key] = {
          key,
          layer,
          ident,
          count: 0,
          x: null,
          y: null,
          z: null,
          first: timestamp,
          last: timestamp,
          types: {},
          waveCounts: {},
        };
      }
      const point = cur.spawnPoints[key];
      point.count += 1;
      point.last = timestamp;
      point.types[npcType] = (point.types[npcType] || 0) + 1;
      const wave = waveOf(cur, timestamp);
      point.waveCounts[wave] = (point.waveCounts[wave] || 0) + 1;
    }

    playerJoinEvidence(line, timestamp = 0, pattern = P_NAMED_JOIN) {
      const match = line.match(pattern);
      if (!match || !this.cur.isArbitration) return;
      const name = cleanName(match[1]);
      if (!name || name === this.cur.host) return;
      this.cur.recentJoinEvidence.set(name, timestamp);
    }

    playerJoin(line, timestamp = 0) {
      const match = line.match(P_LOADOUT);
      if (!match) return;
      const name = cleanName(match[1]);
      if (!name) return;
      const cur = this.cur;
      const departureIndex = cur.openingDepartures.indexOf(name);
      const presence = cur.playerPresence.get(name);
      const beginsPresence = name !== cur.host && (!presence || presence.since === null);
      const evidenceAt = cur.recentJoinEvidence.get(name) || 0;
      const hasRecentNamedEvidence = evidenceAt > 0
        && timestamp >= evidenceAt
        && timestamp - evidenceAt <= JOIN_EVIDENCE_WINDOW_SECONDS;
      const hasRecentLocalEvidence = cur.localInProgressAt > 0
        && timestamp >= cur.localInProgressAt
        && timestamp - cur.localInProgressAt <= JOIN_EVIDENCE_WINDOW_SECONDS;
      const wasKnownRoster = cur.inMission.includes(name) || cur.squadmates.includes(name);
      const isOpeningOperationalLoad = cur.isArbitration
        && beginsPresence
        && timestamp >= cur.missionStart
        && timestamp - cur.missionStart <= OPENING_REJOIN_WINDOW_SECONDS
        && isOpeningRejoinPhase(cur)
        && (departureIndex >= 0 || hasRecentNamedEvidence || hasRecentLocalEvidence || wasKnownRoster);
      if (departureIndex >= 0) {
        cur.openingDepartures.splice(departureIndex, 1);
      }
      if (isOpeningOperationalLoad) {
        cur.openingOperationalLoads.push({ name, timestamp });
      }
      cur.recentJoinEvidence.delete(name);
      if (!cur.host) cur.host = name;
      else if (name !== cur.host) {
        if (!cur.inMission.includes(name)) cur.inMission.push(name);
        if (!cur.squadmates.includes(name)) cur.squadmates.push(name);
        openPlayerPresence(cur, name, timestamp);
      }
    }

    playerLeave(line, timestamp = 0, pattern = P_UNREGISTERED) {
      const match = line.match(pattern);
      if (!match) return;
      const name = cleanName(match[1]);
      const cur = this.cur;
      if (name === cur.host) return;
      const wasInOpeningSquad = cur.inMission.includes(name) || cur.squadmates.includes(name);
      const isOpeningDeparture = cur.isArbitration
        && wasInOpeningSquad
        && timestamp >= cur.missionStart
        && timestamp - cur.missionStart <= OPENING_REJOIN_WINDOW_SECONDS
        && isOpeningRejoinPhase(cur);
      if (isOpeningDeparture && !cur.openingDepartures.includes(name)) cur.openingDepartures.push(name);
      closePlayerPresence(cur, name, timestamp);
      cur.inMission = cur.inMission.filter((item) => item !== name);
    }

    pushCurrent() {
      if (hasData(this.cur)) {
        finalizeRun(this.cur);
        this.runs.push(this.cur);
      }
    }

    finish() {
      this.pushCurrent();
      this.runs.forEach((run) => {
        finalizeRun(run);
        bindContext(run, this.advertised, this.levels);
        deriveRun(run);
      });
      return this.runs.filter(hasData);
    }
  }

  function canonicalNode(token) {
    const found = Object.keys(MISSION_TYPE_BY_NODE).find((key) => key.toLocaleLowerCase() === String(token || "").toLocaleLowerCase());
    return found || token || "";
  }

  function finalizeRun(run) {
    if (run.agentsFinalized) return;
    run.agentsFinalized = true;
    if (run.pauseOpen !== null && run.lastActivity > run.pauseOpen) {
      run.pauseIntervals.push([run.pauseOpen, run.lastActivity]);
      run.pauseOpen = null;
    }
    if (!run.allSpawns.length) {
      run.enemySpawns = run.rawEnemySpawns;
      return;
    }
    const named = run.allSpawns.filter((spawn) => spawn.name !== null);
    const confirmed = new Set();
    const suspected = new Set();
    for (let index = 1; index < named.length; index += 1) {
      const previous = named[index - 1];
      const current = named[index];
      if (previous.tick === null || current.tick === null) continue;
      (current.tick > previous.tick ? confirmed : suspected).add(previous.name);
    }
    const nonTicking = new Set(
      [...suspected].filter((name) => !confirmed.has(name) && !FORCED_VALID_AGENTS.has(name))
    );
    const times = [];
    const types = {};
    let valid = 0;
    run.allSpawns.forEach((spawn) => {
      if (spawn.name !== null && nonTicking.has(spawn.name)) return;
      valid += 1;
      if (spawn.timestamp) times.push(spawn.timestamp);
      const key = spawn.name || "Unknown";
      types[key] = (types[key] || 0) + 1;
    });
    run.enemySpawns = valid;
    run.enemyTimestamps = times;
    run.enemyTypes = Object.fromEntries(Object.entries(types).sort((a, b) => b[1] - a[1]));
    run.nonTickingAgents = [...nonTicking].sort();
    if (times.length) run.lastActivity = Math.max(run.lastActivity, times[times.length - 1]);
    run.allSpawns = [];
  }

  function bindContext(run, advertised, levels) {
    const start = run.missionStart || startTime(run);
    if (!run.nodeKey && advertised.length) {
      const before = advertised.filter(([timestamp]) => timestamp <= start).map((entry) => entry[1]);
      run.nodeKey = before.length ? before[before.length - 1] : advertised[0][1];
    }
    if (!run.levelPath && levels.length) {
      const end = endTime(run) || start;
      const before = levels.filter(([timestamp]) => timestamp <= start + 5).map((entry) => entry[1]);
      const inside = levels.filter(([timestamp]) => timestamp >= start && timestamp <= end).map((entry) => entry[1]);
      run.levelPath = before.length ? before[before.length - 1] : (inside[0] || "");
    }
    if (!run.nodeKey) {
      const candidate = run.missionName.split(/[\-(]/)[0].trim().toLocaleLowerCase();
      run.nodeKey = NODE_BY_NAME[candidate] || "";
    }
  }

  function deriveRun(run) {
    run.endTime = endTime(run);
    const finalizedCore = resolveFinalizedCore(run, run.endTime);
    run.openingRejoinTime = finalizedCore.ready;
    run.startTime = finalizedCore.start;
    run.totalDuration = run.endTime > run.startTime ? run.endTime - run.startTime : 0;
    run.fullSquadCoverage = fullSquadCoverage(run, run.startTime, run.endTime);
    run.fullSquadMajority = run.fullSquadCoverage > 0.5;
    run.squadmates = finalizedCore.names;
    delete run.playerPresence;
    delete run.openingOperationalLoads;
    delete run.recentJoinEvidence;
    const paused = pauseSeconds(run, run.startTime, run.endTime);
    run.activeDuration = Math.max(0, run.totalDuration - paused);
    const nodeKey = canonicalNode(run.nodeKey);
    const node = ARBI_NODES[nodeKey];
    const fallbackName = run.missionName.split(/[\-(]/)[0].trim() || "Unknown Node";
    run.node = node ? node[0] : fallbackName;
    run.planet = node ? node[1] : ((run.missionName.match(/\(([^)]+)\)/) || [])[1] || "Unknown");
    const catalogMissionType = MISSION_TYPE_BY_NODE[nodeKey];
    run.missionType = catalogMissionType
      ? catalogMissionType.toLocaleUpperCase()
      : (Object.keys(run.waveStarts).length || run.isDefense
        ? "DEFENSE"
        : (run.isInterception
          ? "INTERCEPTION"
          : (run.isSurvival ? "SURVIVAL" : "UNKNOWN")));
    run.faction = node ? node[3] : "Unknown";
    run.tileset = node ? node[4] : tileFromPath(run.levelPath);
    const saturationScale = HIGH_DENSITY_SATURATION_TYPES.has(run.missionType)
      ? { edges: HIGH_DENSITY_SATURATION_EDGES, threshold: 30 }
      : { edges: DEFAULT_SATURATION_EDGES, threshold: 15 };
    const wavePhases = calculateWavePhases(run);
    const rotationPhases = calculateRotationPhases(run);
    run.waveDurations = wavePhases.map((phase) => [phase.label, phase.seconds]);
    run.rotationDurations = rotationPhases.map((phase) => phase.seconds);
    run.saturationPerWave = wavePhases.map((phase) => calculateRangeOccupancy(run, phase.from, phase.to));
    run.saturationPerRotation = rotationPhases.map((phase) => calculateRangeSaturation(run, phase.from, phase.to, saturationScale.threshold));
    run.rotations = run.rewardTimestamps.length || Math.floor(Object.keys(run.waveStarts).length / 3);
    run.dronesDespawned = run.droneDespawnTimestamps.filter((timestamp) => timestamp >= run.startTime && timestamp <= run.endTime).length;
    run.dronesPerRotation = calculateDronesPerRotation(run);
    run.dpmPerRotation = calculateDpmPerRotation(run);
    run.dpmWindows6m = run.missionType === "DISRUPTION" ? calculateFixedDpmWindows(run, 6 * 60) : [];
    run.avgDroneInterval = run.droneTimestamps.length > 1
      ? (run.droneTimestamps[run.droneTimestamps.length - 1] - run.droneTimestamps[0]) / (run.droneTimestamps.length - 1)
      : 0;
    run.saturation = calculateSaturation(run, saturationScale.edges, saturationScale.threshold);
    run.telemetryCoverage = calculateTelemetryCoverage(run);
    run.cadence = calculateCadence(run);
    run.longestDroneGaps = longestGaps(run.droneTimestamps, run.pauseIntervals, 5, run.startTime, run.endTime);
    run.longestSpawnGaps = longestGaps(run.enemyTimestamps, run.pauseIntervals, 5, run.startTime, run.endTime);
    run.shortId = "pending";
    return run;
  }

  function tileFromPath(path) {
    if (!path) return "Unknown tile";
    const parts = path.split("/").filter(Boolean);
    const stem = (parts.pop() || "").replace(/\.[^.]+$/, "");
    const parent = parts.pop() || "";
    return parent ? `${parent}/${stem}` : stem;
  }

  function calculateWavePhases(run) {
    const waves = Object.keys(run.waveStarts).map(Number).sort((a, b) => a - b);
    const ends = [...run.waveEnds].sort((a, b) => a - b);
    const countdowns = [...(run.waveCountdowns || [])].sort((a, b) => a - b);
    const result = [];
    let endIndex = 0;
    let countdownIndex = 0;
    waves.forEach((wave, index) => {
      const from = run.waveStarts[wave];
      const nextStart = index + 1 < waves.length ? run.waveStarts[waves[index + 1]] : null;
      while (endIndex < ends.length && ends[endIndex] <= from) endIndex += 1;
      while (countdownIndex < countdowns.length && countdowns[countdownIndex] <= from) countdownIndex += 1;
      let to = null;

      // Every third Defense wave opens the extraction vote. The later sleep
      // marker occurs after players answer it, so anchor the fight end to the
      // logged vote event minus the game's scripted post-wave transition.
      if (wave % WAVES_PER_ROTATION === 0) {
        const countdown = countdowns[countdownIndex];
        if (Number.isFinite(countdown) && (!Number.isFinite(nextStart) || countdown < nextStart)) {
          to = Math.max(from, countdown - DEFENSE_VOTE_TRANSITION_SECONDS);
          countdownIndex += 1;
        }
      }

      if (!Number.isFinite(to)) {
        const candidate = ends[endIndex];
        to = Number.isFinite(candidate) && (!Number.isFinite(nextStart) || candidate < nextStart)
          ? candidate
          : null;
        if (Number.isFinite(to)) endIndex += 1;
      }
      if (!Number.isFinite(to) && Number.isFinite(nextStart)) to = nextStart;
      if (!Number.isFinite(to) && run.lastReward > from) to = run.lastReward;
      if (Number.isFinite(to)) result.push({ label: wave, from, to, seconds: Math.max(0, to - from) });
    });
    return result;
  }

  function calculateWaveDurations(run) {
    return calculateWavePhases(run).map((phase) => [phase.label, phase.seconds]);
  }

  function calculateRotationPhases(run) {
    if (!run.rewardTimestamps.length) return [];
    let previous = startTime(run) || run.rewardTimestamps[0];
    return run.rewardTimestamps.map((timestamp, index) => {
      const from = previous;
      previous = timestamp;
      const downtime = pauseSeconds(run, from, timestamp);
      return { label: index + 1, from, to: timestamp, seconds: Math.max(0, timestamp - from - downtime) };
    });
  }

  function calculateRotationDurations(run) {
    return calculateRotationPhases(run).map((phase) => phase.seconds);
  }

  function calculateDronesPerRotation(run) {
    if (!run.rewardTimestamps.length || !run.droneTimestamps.length) return [];
    const phases = calculateRotationPhases(run);
    let droneIndex = 0;
    return phases.map((phase) => {
      let count = 0;
      while (droneIndex < run.droneTimestamps.length && run.droneTimestamps[droneIndex] < phase.from) droneIndex += 1;
      while (droneIndex < run.droneTimestamps.length && run.droneTimestamps[droneIndex] <= phase.to) {
        count += 1;
        droneIndex += 1;
      }
      return count;
    });
  }

  function calculateDpmPerRotation(run) {
    if (!run.dronesPerRotation.length) return [];
    const phases = calculateRotationPhases(run);
    return run.dronesPerRotation.map((count, index) => {
      const minutes = Math.max(phases[index]?.seconds || 0, 10) / 60;
      return count / minutes;
    });
  }

  function calculateFixedDpmWindows(run, windowSeconds = 6 * 60) {
    const start = Number(run.startTime || 0);
    const end = Number(run.endTime || 0);
    const activeDuration = Number(run.activeDuration || 0);
    const size = Math.max(1, Number(windowSeconds || 0));
    if (end <= start || activeDuration <= 0) return [];

    const counts = Array.from({ length: Math.ceil(activeDuration / size) }, () => 0);
    (run.droneTimestamps || []).forEach((timestamp) => {
      if (timestamp < start || timestamp > end) return;
      if ((run.pauseIntervals || []).some((pair) => timestamp > pair[0] && timestamp < pair[1])) return;
      const activeElapsed = Math.max(0, timestamp - start - pauseSeconds(run, start, timestamp));
      const index = Math.min(counts.length - 1, Math.floor(activeElapsed / size));
      counts[index] += 1;
    });

    return counts.map((count, index) => {
      const from = index * size;
      const to = Math.min(activeDuration, from + size);
      const seconds = Math.max(0, to - from);
      return { from, to, seconds, count, dpm: seconds ? count / seconds * 60 : 0 };
    });
  }

  function liveSegments(run, rangeStart = run.startTime, rangeEnd = run.endTime) {
    const segments = [];
    const live = run.liveCounts;
    if (live.length <= 1 || run.endTime <= run.startTime) return segments;
    for (let index = 0; index < live.length - 1; index += 1) {
      const current = live[index];
      const next = live[index + 1];
      const sampledFrom = Math.max(current[0], run.startTime);
      const sampledTo = Math.min(next[0], run.endTime);
      const sampledDuration = sampledTo - sampledFrom;
      if (sampledDuration <= 0 || sampledDuration > 29) continue;
      if (run.pauseIntervals.some((pair) => overlap(sampledFrom, sampledTo, pair[0], pair[1]) > 0)) continue;
      const from = Math.max(sampledFrom, rangeStart);
      const to = Math.min(sampledTo, rangeEnd);
      const duration = to - from;
      if (duration > 0) segments.push({ count: current[1], cap: current[2], duration });
    }
    return segments;
  }

  function calculateRangeSaturation(run, rangeStart, rangeEnd, threshold = 15) {
    const totals = calculateSaturationTotals(run, threshold, rangeStart, rangeEnd);
    return totals.telemetrySeconds ? totals.highEnemySeconds / totals.telemetrySeconds * 100 : null;
  }

  function calculateSaturationTotals(run, threshold = 15, rangeStart = run.startTime, rangeEnd = run.endTime) {
    const segments = liveSegments(run, rangeStart, rangeEnd);
    return {
      telemetrySeconds: segments.reduce((sum, segment) => sum + segment.duration, 0),
      highEnemySeconds: segments.reduce((sum, segment) => sum + (segment.count >= threshold ? segment.duration : 0), 0),
    };
  }

  function calculateRangeOccupancy(run, rangeStart, rangeEnd) {
    const segments = liveSegments(run, rangeStart, rangeEnd);
    const total = segments.reduce((sum, segment) => sum + segment.duration, 0);
    if (!total) return null;
    const fallbackCap = Number(run.simCap) > 0 ? Number(run.simCap) : 32;
    const occupied = segments.reduce((sum, segment) => {
      const cap = Number(segment.cap) > 0 ? Number(segment.cap) : fallbackCap;
      const ratio = Math.max(0, Math.min(1, Number(segment.count) / cap));
      return sum + ratio * segment.duration;
    }, 0);
    return occupied / total * 100;
  }

  function calculateTelemetryCoverage(run) {
    const activeDuration = Number(run.activeDuration);
    if (!Number.isFinite(activeDuration) || activeDuration <= 0) return 0;
    const coveredDuration = calculateSaturationTotals(run).telemetrySeconds;
    return Math.max(0, Math.min(100, coveredDuration / activeDuration * 100));
  }

  function calculateSaturation(run, edges = DEFAULT_SATURATION_EDGES, threshold = 15) {
    const size = edges.length + 1;
    const buckets = Array(size).fill(0);
    const bucketIndex = (count) => {
      const index = edges.findIndex((edge) => count < edge);
      return index < 0 ? size - 1 : index;
    };
    let total = 0;
    let above = 0;
    const live = run.liveCounts;
    if (live.length > 1 && run.endTime > run.startTime) {
      liveSegments(run).forEach((segment) => {
        const bucket = bucketIndex(segment.count);
        buckets[bucket] += segment.duration;
        total += segment.duration;
        if (segment.count >= threshold) above += segment.duration;
      });
    } else if (live.length) {
      live.forEach((entry) => {
        const bucket = bucketIndex(entry[1]);
        buckets[bucket] += 1;
        total += 1;
        if (entry[1] >= threshold) above += 1;
      });
    }
    let lower = 0;
    const labels = edges.map((edge) => {
      const label = `${lower}-${edge - 1}`;
      lower = edge;
      return label;
    });
    labels.push(`${lower}+`);
    const rows = buckets.map((duration, index) => ({ label: labels[index], percent: total ? duration / total * 100 : 0 }));
    return { rows, abovePercent: total ? above / total * 100 : 0, threshold };
  }

  function calculateCadence(run, edges = [1, 2, 3, 5, 8, 12]) {
    const gaps = [];
    for (let index = 1; index < run.droneTimestamps.length; index += 1) {
      const from = run.droneTimestamps[index - 1];
      const to = run.droneTimestamps[index];
      const gap = to - from - pauseSeconds(run, from, to);
      if (gap > 0) gaps.push(gap);
    }
    const buckets = Array(edges.length + 1).fill(0);
    let total = 0;
    let drought = 0;
    gaps.forEach((gap) => {
      let index = edges.findIndex((edge) => gap < edge);
      if (index < 0) index = edges.length;
      buckets[index] += gap;
      total += gap;
      if (gap >= 12) drought += gap;
    });
    let previous = 0;
    const labels = edges.map((edge) => {
      const label = `${previous}-${edge}s`;
      previous = edge;
      return label;
    });
    labels.push(`${previous}s+`);
    return {
      rows: buckets.map((value, index) => ({ label: labels[index], percent: total ? value / total * 100 : 0 })),
      droughtPercent: total ? drought / total * 100 : 0,
      droughtSeconds: drought,
      totalSeconds: total,
      gaps,
    };
  }

  function longestGaps(times, pauses, limit, rangeStart = -Infinity, rangeEnd = Infinity) {
    const gaps = [];
    const inRange = times.filter((timestamp) => timestamp >= rangeStart && timestamp <= rangeEnd);
    for (let index = 1; index < inRange.length; index += 1) {
      const from = inRange[index - 1];
      const to = inRange[index];
      const paused = pauses.reduce((sum, pair) => sum + overlap(from, to, pair[0], pair[1]), 0);
      const duration = to - from - paused;
      if (duration > 0) gaps.push([duration, from]);
    }
    return gaps.sort((a, b) => b[0] - a[0]).slice(0, limit);
  }

  function computeVitus(droneKills, rotations, missionType = "") {
    const rot = Math.max(0, rotations || 0);
    const drones = Math.max(0, droneKills || 0);
    const mode = String(missionType).trim().toUpperCase().replace(/[_-]+/g, " ");
    const bonusVitus = mode === "MIRROR DEFENSE" ? 2 : 3;
    const earlyRotations = Math.min(rot, EARLY_ROTATION_COUNT);
    const lateRotations = Math.max(0, rot - EARLY_ROTATION_COUNT);
    const rotationMean = rot + bonusVitus * (
      earlyRotations * EARLY_ROTATION_BONUS_CHANCE
      + lateRotations * LATE_ROTATION_BONUS_CHANCE
    );
    const rotationVariance = bonusVitus ** 2 * (
      earlyRotations * EARLY_ROTATION_BONUS_CHANCE * (1 - EARLY_ROTATION_BONUS_CHANCE)
      + lateRotations * LATE_ROTATION_BONUS_CHANCE * (1 - LATE_ROTATION_BONUS_CHANCE)
    );
    const meanDrops = drones * DROP_CHANCE;
    const varianceDrops = drones * DROP_CHANCE * (1 - DROP_CHANCE);
    const meanValue = 4 * RETRIEVER_CHANCE + 2 * (1 - RETRIEVER_CHANCE);
    const expectedValueSquared = 16 * RETRIEVER_CHANCE + 4 * (1 - RETRIEVER_CHANCE);
    const varianceValue = expectedValueSquared - meanValue ** 2;
    const droneMean = meanDrops * meanValue;
    const droneVariance = meanDrops * varianceValue + meanValue ** 2 * varianceDrops;
    const mean = rotationMean + droneMean;
    const standardDeviation = Math.sqrt(Math.max(0, rotationVariance + droneVariance));
    const scenarios = [
      [-2.326, "99%", "Worst Case"],
      [-1.282, "90%", "Unlucky"],
      [-0.674, "75%", "Below Avg"],
      [0, "50%", "Average"],
      [0.674, "25%", "Above Avg"],
      [1.282, "10%", "High Roll"],
      [2.326, "1%", "God Roll"],
    ].map(([z, chance, label]) => ({ chance, label, total: Math.max(0, Math.round(mean + z * standardDeviation)) }));
    return { mean, standardDeviation, scenarios };
  }

  function classifyVitusScenario(scenarios, actual) {
    const value = Number(actual);
    if (!Array.isArray(scenarios) || !scenarios.length || !Number.isFinite(value)) return null;
    return scenarios.find((scenario) => value <= scenario.total) || scenarios[scenarios.length - 1];
  }

  function forEachRelevantLine(text, callback) {
    // Let the native regexp engine scan the chunk and only create JS strings
    // for matching lines. Splitting a multi-gigabyte log into every irrelevant
    // line costs far more than parsing the small set of lines we actually use.
    P_RELEVANT_TOKEN.lastIndex = 0;
    let match = null;
    while ((match = P_RELEVANT_TOKEN.exec(text)) !== null) {
      const start = text.lastIndexOf("\n", Math.max(0, match.index - 1)) + 1;
      let end = text.indexOf("\n", match.index);
      if (end < 0) end = text.length;
      if (end > start && text.charCodeAt(end - 1) === 13) end -= 1;
      callback(text.slice(start, end), match[0]);
      P_RELEVANT_TOKEN.lastIndex = end + 1;
    }
  }

  function feedRelevantText(parser, text) {
    forEachRelevantLine(text, (line, token) => parser.feedLine(line, token));
  }

  function detachedTail(text, boundary) {
    const tail = text.slice(boundary + 1);
    // V8 may otherwise keep the entire multi-megabyte parent chunk alive for
    // this usually tiny sliced string until parsing finishes.
    return tail ? tail.split("").join("") : "";
  }

  function parseText(text) {
    const parser = new Parser();
    feedRelevantText(parser, String(text || ""));
    return parser.finish();
  }

  async function parseFile(file, onProgress) {
    if (!file || typeof file.stream !== "function") throw new Error("Choose an EE.log or text log file.");
    const lowerName = String(file.name || "").toLocaleLowerCase();
    if (lowerName.endsWith(".zip")) throw new Error("ZIP files are not enabled in this local prototype yet. Choose EE.log, .txt, or .gz.");
    if (shouldParseInParallel(file, lowerName)) {
      try {
        return await parseFileParallel(file, onProgress);
      } catch (_) {
        // Worker restrictions, memory pressure, or browser-specific File
        // cloning failures fall back to the proven sequential parser.
      }
    }
    if (!lowerName.endsWith(".gz") && typeof file.slice === "function" && typeof TextDecoder !== "undefined") {
      return parseFileSlices(file, onProgress);
    }
    let stream = file.stream();
    let compressedRead = 0;
    if (lowerName.endsWith(".gz")) {
      if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot open gzip logs. Choose the uncompressed EE.log instead.");
      if (typeof TransformStream !== "undefined") {
        stream = stream.pipeThrough(new TransformStream({
          transform(chunk, controller) {
            compressedRead += Number(chunk?.byteLength || 0);
            controller.enqueue(chunk);
          },
        }));
      }
      stream = stream.pipeThrough(new DecompressionStream("gzip"));
    }
    if (typeof TextDecoderStream === "undefined") {
      const text = await file.text();
      if (onProgress) onProgress(1);
      return parseText(text);
    }
    const parser = new Parser();
    const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    let decoded = 0;
    let lastUpdate = 0;
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      const chunk = result.value || "";
      decoded += chunk.length;
      buffer += chunk;
      const boundary = buffer.lastIndexOf("\n");
      if (boundary >= 0) {
        feedRelevantText(parser, buffer.slice(0, boundary + 1));
        buffer = detachedTail(buffer, boundary);
      }
      const now = Date.now();
      if (now - lastUpdate >= 100) {
        if (onProgress) {
          const consumed = compressedRead || decoded;
          onProgress(Math.min(0.98, consumed / Math.max(1, file.size)));
        }
        lastUpdate = now;
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    if (buffer) feedRelevantText(parser, `${buffer}\n`);
    if (onProgress) onProgress(1);
    return parser.finish();
  }

  function shouldParseInParallel(file, lowerName) {
    return !lowerName.endsWith(".gz")
      && Number(file.size || 0) >= PARALLEL_PARSE_MIN_BYTES
      && typeof file.slice === "function"
      && typeof Worker === "function"
      && typeof TextDecoder !== "undefined";
  }

  function parallelWorkerCount() {
    const cores = Number(globalThis.navigator?.hardwareConcurrency || 4);
    return Math.max(2, Math.min(PARALLEL_PARSE_MAX_WORKERS, Number.isFinite(cores) ? cores - 1 : 3));
  }

  async function nextLineBoundary(file, position) {
    if (position <= 0) return 0;
    if (position >= file.size) return file.size;
    const probeSize = 64 * 1024;
    let offset = position;
    while (offset < file.size) {
      const end = Math.min(file.size, offset + probeSize);
      const bytes = new Uint8Array(await file.slice(offset, end).arrayBuffer());
      const newline = bytes.indexOf(10);
      if (newline >= 0) return offset + newline + 1;
      offset = end;
    }
    return file.size;
  }

  async function parseFileParallel(file, onProgress) {
    const workerCount = parallelWorkerCount();
    const boundaries = [0];
    for (let index = 1; index < workerCount; index += 1) {
      boundaries.push(await nextLineBoundary(file, Math.floor(file.size * index / workerCount)));
    }
    boundaries.push(file.size);

    const completedBytes = Array(workerCount).fill(0);
    const workers = [];
    const baseUrl = globalThis.document?.baseURI || globalThis.location?.href || "https://arbi.guide/analyzer/";
    const workerUrl = new URL(PARALLEL_SCANNER_URL, baseUrl);
    try {
      const parts = await Promise.all(Array.from({ length: workerCount }, (_, index) => new Promise((resolve, reject) => {
        const worker = new Worker(workerUrl, { name: `arbi-log-scanner-${index + 1}` });
        workers.push(worker);
        worker.onmessage = (event) => {
          const message = event.data || {};
          if (message.type === "progress") {
            completedBytes[index] = Math.max(completedBytes[index], Number(message.bytes || 0));
            const processed = completedBytes.reduce((total, value) => total + value, 0);
            if (onProgress) onProgress(Math.min(.94, processed / Math.max(1, file.size) * .94));
            return;
          }
          if (message.type === "error") {
            reject(new Error(message.message || "Parallel log scanner failed."));
            return;
          }
          if (message.type === "result") {
            completedBytes[index] = boundaries[index + 1] - boundaries[index];
            worker.terminate();
            resolve(Array.isArray(message.lines) ? message.lines : []);
          }
        };
        worker.onerror = (event) => reject(event.error || new Error(event.message || "Parallel log scanner failed."));
        worker.postMessage({
          file,
          index,
          start: boundaries[index],
          end: boundaries[index + 1],
          chunkSize: 64 * 1024 * 1024,
        });
      })));

      const parser = new Parser();
      for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
        const lines = parts[partIndex];
        for (let index = 0; index < lines.length; index += 2) {
          parser.feedLine(lines[index + 1], lines[index]);
        }
        parts[partIndex] = null;
        if (onProgress) onProgress(.94 + .04 * (partIndex + 1) / parts.length);
      }
      const runs = parser.finish();
      if (onProgress) onProgress(1);
      return runs;
    } finally {
      workers.forEach((worker) => worker.terminate());
    }
  }

  async function parseFileSlices(file, onProgress) {
    const parser = new Parser();
    const decoder = new TextDecoder();
    const chunkSize = 64 * 1024 * 1024;
    let offset = 0;
    let buffer = "";
    let lastUpdate = 0;
    while (offset < file.size) {
      const end = Math.min(file.size, offset + chunkSize);
      const bytes = await file.slice(offset, end).arrayBuffer();
      buffer += decoder.decode(bytes, { stream: end < file.size });
      const boundary = buffer.lastIndexOf("\n");
      if (boundary >= 0) {
        feedRelevantText(parser, buffer.slice(0, boundary + 1));
        buffer = detachedTail(buffer, boundary);
      }
      offset = end;
      const now = Date.now();
      if (now - lastUpdate >= 100) {
        if (onProgress) onProgress(Math.min(0.98, offset / Math.max(1, file.size)));
        lastUpdate = now;
      }
    }
    buffer += decoder.decode();
    if (buffer) feedRelevantText(parser, `${buffer}\n`);
    if (onProgress) onProgress(1);
    return parser.finish();
  }

  function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    if (value && typeof value === "object") {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
  }

  async function sha256(text) {
    const bytes = new TextEncoder().encode(text);
    if (globalThis.crypto && globalThis.crypto.subtle) {
      const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
      return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    }
    // Deterministic test fallback; browsers served from localhost/HTTPS use SubtleCrypto.
    let hash = 2166136261;
    bytes.forEach((byte) => { hash = Math.imul(hash ^ byte, 16777619); });
    return `test-${(hash >>> 0).toString(16).padStart(8, "0")}`;
  }

  async function fingerprintRun(run) {
    const relative = (run.droneTimestamps || []).slice(0, 128).map((timestamp) => Math.round((timestamp - run.startTime) * 10) / 10);
    const shape = run.rewardTimestamps.length >= 3
      ? run.rewardTimestamps.slice(1).map((timestamp, index) => Math.round((timestamp - run.rewardTimestamps[index]) * 10) / 10)
      : Object.keys(run.waveStarts).map(Number).sort((a, b) => a - b).slice(1).map((wave, index, waves) => {
        const previousWave = Object.keys(run.waveStarts).map(Number).sort((a, b) => a - b)[index];
        return Math.round((run.waveStarts[wave] - run.waveStarts[previousWave]) * 10) / 10;
      });
    return sha256(stableStringify({
      node: run.nodeKey,
      level: run.levelPath,
      mission: run.missionType,
      duration: Math.round(run.totalDuration),
      drones: run.droneKills,
      enemies: run.enemySpawns,
      relativeDrones: relative,
      phaseShape: shape,
    }));
  }

  async function buildContribution(run) {
    const spawnEligible = ["DEFENSE", "INTERCEPTION"].includes(run.missionType);
    const spawnPoints = (spawnEligible ? Object.values(run.spawnPoints || {}) : [])
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z))
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((point) => ({
        point_key: point.key,
        position: [round(point.x, 4), round(point.y, 4), round(point.z, 4)],
        count: point.count,
      }));
    // Preserve the original identity hash so historical coordinate rows
    // continue to deduplicate under the expanded envelope.
    const identity = {
      schema: "arbi-solnode-spawns/v1",
      sol_node: run.nodeKey || null,
      level_path: run.levelPath || null,
      mission_type: run.missionType,
      // EE.log timestamps are relative to the current Warframe process. This
      // distinguishes two otherwise-identical missions in one growing log,
      // while revealing no wall-clock timestamp or player identity.
      run_offset_seconds: round(run.startTime || 0, 3),
      observed_spawn_events: spawnPoints.reduce((sum, point) => sum + point.count, 0),
      spawn_points: spawnPoints,
    };
    const highEnemyThreshold = HIGH_DENSITY_SATURATION_TYPES.has(run.missionType) ? 30 : 15;
    const saturationTotals = calculateSaturationTotals(run, highEnemyThreshold);
    const cadence = run.cadence || calculateCadence(run);
    const runMetrics = {
      mission_seconds: round(run.totalDuration || 0, 3),
      drone_kills: Math.max(0, Math.trunc(run.droneKills || 0)),
      enemy_spawns: Math.max(0, Math.trunc(run.enemySpawns || 0)),
      high_enemy_seconds: round(saturationTotals.highEnemySeconds, 3),
      enemy_telemetry_seconds: round(saturationTotals.telemetrySeconds, 3),
      drone_dry_seconds: round(cadence.droughtSeconds || 0, 3),
      drone_cadence_seconds: round(cadence.totalSeconds || 0, 3),
      reward_cycles: Math.max(0, Math.trunc(run.rotations || 0)),
      defense_waves: run.missionType === "DEFENSE"
        ? Object.keys(run.waveStarts || {}).length
        : 0,
      four_member_majority: run.fullSquadMajority === true,
    };
    const runHash = await sha256(stableStringify(identity));
    return {
      ...identity,
      schema: "arbi-analyzer-run/v2",
      run_metrics: runMetrics,
      run_hash: runHash,
    };
  }

  function round(value, places) {
    const factor = 10 ** places;
    return Math.round(value * factor) / factor;
  }

  return {
    ARBI_NODES,
    MISSION_TYPE_BY_NODE,
    Parser,
    parseText,
    parseFile,
    forEachRelevantLine,
    deriveRun,
    computeVitus,
    classifyVitusScenario,
    fingerprintRun,
    buildContribution,
    stableStringify,
    helpers: {
      calculateCadence,
      calculateSaturation,
      calculateRangeSaturation,
      calculateSaturationTotals,
      calculateRangeOccupancy,
      calculateTelemetryCoverage,
      calculateWavePhases,
      calculateRotationPhases,
      calculateFixedDpmWindows,
      longestGaps,
      tileFromPath,
    },
  };
});
