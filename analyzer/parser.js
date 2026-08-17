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
  const ROTATION_CHANCE = 0.10;
  const WAVES_PER_ROTATION = 3;
  const OPENING_REJOIN_WINDOW_SECONDS = 10 * 60;
  const FORCED_VALID_AGENTS = new Set(["CorpusEliteShieldDroneAgent"]);
  const EXCLUDED_AGENT = /Replicant|RJCrew|petavatar|VoidClone|Turret|Dropship|CatbrowPetAgent|AllyAgent|AutoTurretAgentShipRemaster|Summon\s*Motorcycle/i;
  const NON_MISSION_LEVEL = ["/proc/playership/", "/levels/hub/", "/levels/clandojo/", "/levels/railjack/"];

  // Stable log tokens are the primary identity. Display metadata is deliberately
  // small and local; unknown nodes still parse and use the mission-name fallback.
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
  };

  const NODE_BY_NAME = Object.fromEntries(
    Object.entries(ARBI_NODES).map(([token, info]) => [info[0].toLocaleLowerCase(), token])
  );

  const P_TIMESTAMP = /^!?(\d+\.\d+)/;
  const P_MISSION = /ThemedSquadOverlay\.lua: Mission name: (.*)/;
  const P_AGENT_FULL = /OnAgentCreated.*?\/Npc\/(.+?)(\d+)\s+.*?MonitoredTicking\s+(\d+)/;
  const P_NPC = /\/Npc\/([A-Za-z0-9_]+)/;
  const P_WAVE_LINE = /^!?(\d+\.\d+).*WaveDefend\.lua: Starting wave (\d+)/;
  const P_WAVE_DEF = /^!?(\d+\.\d+).*WaveDefend\.lua: Defense wave: (\d+)/;
  const P_WAVE_CAP = /WaveDefend\.lua: Starting wave \d+.*?\((\d+) simultaneous/;
  const P_MONITORED = /AI \[Info\]: .*?MonitoredTicking (\d+)/;
  const P_LIVE = /AI \[Info\]:.*?Live (\d+)/;
  const P_LOADOUT = /Game \[Info\]: (\S+) loadout loader finished\./;
  const P_UNREGISTERED = /Player=([^,]+),\s*change=UNREGISTERED/;
  const P_INT_INIT = /TerritoryMission\.lua: .*?(?:control|captured)/i;
  const P_SPAWN_POINT = /^!?(\d+\.\d+).*WaveDefend\.lua: Spawned a \/Npc\/([A-Za-z0-9_]+?)\d* @ Vector\(([^)]+)\), spawn point: (\/[A-Za-z0-9_/]*?)\/([Nn]pcSpawnPoint\d+) @ Vector\(([^)]+)\)/;
  const P_AI_AGENT_INIT = /^!?(\d+\.\d+).*AI Agent Initialize\s+\/Npc\/([A-Za-z0-9_]+?)\d*\s+at NpcAiDirector\s+(\/[A-Za-z0-9_/]*?)\/([Nn]pcSpawnPoint\d+)/i;
  const P_ELITE_ALERT = /^!?(\d+\.\d+).*EliteAlertMission at ((?:Sol|Clan|Settlement)Node\d+)(?:\s+\(([^)]{1,120})\))?/i;
  const P_LEVEL = /^!?(\d+\.\d+).*Game \[Info\]: Level=(\/[^\s,]+)/;
  const P_RELEVANT_TOKEN = /OnAgentCreated|Mission name:|spawn point:|AI Agent Initialize|EliteAlertMission at|Game \[Info\]: Level=|_SleepBetweenWaves|DefenseReward\.swf|Starting wave|Defense wave:|TerritoryMission\.lua|loadout loader finished|change=UNREGISTERED|MonitoredTicking|Live /g;

  function cleanName(raw) {
    return String(raw || "").replace(/[\x00-\x1F\x7F-\x9F\uE000-\uF8FF\uFFFD■□]/g, "").trim().slice(0, 50);
  }

  function createRun() {
    return {
      missionName: "Unknown Node",
      isArbitration: false,
      nodeKey: "",
      levelPath: "",
      isDefense: false,
      isInterception: false,
      droneKills: 0,
      enemySpawns: 0,
      rawEnemySpawns: 0,
      rounds: 0,
      droneTimestamps: [],
      rewardTimestamps: [],
      enemyTimestamps: [],
      waveStarts: {},
      waveEnds: [],
      liveCounts: [],
      pauseIntervals: [],
      spawnPoints: {},
      host: "",
      squadmates: [],
      missionStart: 0,
      preciseStart: null,
      openingRejoinTime: 0,
      openingDepartures: [],
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
    const base = run.preciseStart || run.missionStart || run.droneTimestamps[0] || 0;
    return Math.max(base, run.openingRejoinTime || 0);
  }

  function isOpeningRejoinPhase(run) {
    if (run.isDefense) {
      const startedWaves = Object.keys(run.waveStarts).map(Number).filter(Number.isFinite);
      return !startedWaves.length || Math.max(...startedWaves) <= WAVES_PER_ROTATION;
    }
    if (run.isInterception) return run.rounds < WAVES_PER_ROTATION;
    return run.preciseStart === null;
  }

  function endTime(run) {
    return Math.max(run.lastActivity || 0, run.lastReward || 0);
  }

  function overlap(a, b, p0, p1) {
    return Math.max(0, Math.min(b, p1) - Math.max(a, p0));
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

    feedLine(line) {
      if (!line || line === "\r" || line.includes("Game [Warning]:") || line.includes("DamagePct")) return;
      const hasAgent = line.includes("OnAgentCreated");
      const hasMission = line.includes("Mission name:");
      const hasSpawnPoint = line.includes("spawn point:");
      const hasAgentInitialize = line.includes("AI Agent Initialize");
      const hasEliteAlert = line.includes("EliteAlertMission at");
      const hasLevel = line.includes("Game [Info]: Level=");
      const hasSleep = line.includes("WaveDefend.lua: _SleepBetweenWaves");
      const hasReward = line.includes("Created /Lotus/Interface/DefenseReward.swf");
      const hasWaveStart = line.includes("WaveDefend.lua: Starting wave");
      const hasWaveDef = line.includes("WaveDefend.lua: Defense wave:");
      const hasTerritory = line.includes("TerritoryMission.lua");
      const hasPlayerJoin = line.includes("loadout loader finished");
      const hasPlayerLeave = line.includes("change=UNREGISTERED");
      const hasLiveCount = line.includes("MonitoredTicking") || (line.includes("AI [Info]:") && line.includes("Live "));
      if (!(hasAgent || hasMission || hasSpawnPoint || hasAgentInitialize || hasEliteAlert || hasLevel || hasSleep || hasReward || hasWaveStart || hasWaveDef || hasTerritory || hasPlayerJoin || hasPlayerLeave || hasLiveCount)) return;

      if (hasMission) {
        const match = line.match(P_MISSION);
        const timestamp = (line.match(P_TIMESTAMP) || [])[1];
        if (match) this.startMission(match[1].trim(), Number(timestamp) || 0);
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
          if (!NON_MISSION_LEVEL.some((marker) => lower.includes(marker))) this.levels.push([Number(match[1]), path]);
        }
        return;
      }
      const lineTimestamp = (hasPlayerJoin || hasPlayerLeave)
        ? Number((line.match(P_TIMESTAMP) || [])[1]) || 0
        : 0;
      if (hasPlayerJoin) this.playerJoin(line, lineTimestamp);
      if (hasPlayerLeave) this.playerLeave(line, lineTimestamp);
      if (!this.cur.isArbitration) return;

      const cur = this.cur;
      let ts = 0;
      if (/^!?\d/.test(line)) {
        const match = line.match(P_TIMESTAMP);
        if (match) ts = Number(match[1]);
      }

      if (hasAgent) {
        if (ts && (cur.isDefense || cur.isInterception)) {
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

      let unpause = Boolean(cur.isDefense && waveMatch);
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

      if (ts && (cur.isDefense || cur.isInterception)) {
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
      this.cur = next;
      if (!isArbitration) return;
      const lower = next.missionName.toLocaleLowerCase();
      if (lower.includes("defense")) next.isDefense = true;
      else if (lower.includes("interception")) next.isInterception = true;
      if (lower.includes("munio") || lower.includes("tyana")) next.isDefense = true;
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

    playerJoin(line, timestamp = 0) {
      const match = line.match(P_LOADOUT);
      if (!match) return;
      const name = cleanName(match[1]);
      if (!name) return;
      const cur = this.cur;
      const departureIndex = cur.openingDepartures.indexOf(name);
      const isOpeningRejoin = cur.isArbitration
        && departureIndex >= 0
        && timestamp >= cur.missionStart
        && timestamp - cur.missionStart <= OPENING_REJOIN_WINDOW_SECONDS
        && isOpeningRejoinPhase(cur);
      if (departureIndex >= 0) {
        cur.openingDepartures.splice(departureIndex, 1);
      }
      if (isOpeningRejoin) {
        cur.openingRejoinTime = Math.max(cur.openingRejoinTime, timestamp);
      }
      if (!cur.host) cur.host = name;
      else if (name !== cur.host) {
        if (!cur.inMission.includes(name)) cur.inMission.push(name);
        if (!cur.squadmates.includes(name)) cur.squadmates.push(name);
      }
    }

    playerLeave(line, timestamp = 0) {
      const match = line.match(P_UNREGISTERED);
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
    const found = Object.keys(ARBI_NODES).find((key) => key.toLocaleLowerCase() === String(token || "").toLocaleLowerCase());
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
    run.startTime = startTime(run);
    run.endTime = endTime(run);
    run.totalDuration = run.endTime > run.startTime ? run.endTime - run.startTime : 0;
    const paused = pauseSeconds(run, run.startTime, run.endTime);
    run.activeDuration = Math.max(0, run.totalDuration - paused);
    const node = ARBI_NODES[canonicalNode(run.nodeKey)];
    const fallbackName = run.missionName.split(/[\-(]/)[0].trim() || "Unknown Node";
    run.node = node ? node[0] : fallbackName;
    run.planet = node ? node[1] : ((run.missionName.match(/\(([^)]+)\)/) || [])[1] || "Unknown");
    run.missionType = Object.keys(run.waveStarts).length || run.isDefense ? "DEFENSE" : (run.isInterception ? "INTERCEPTION" : "SURVIVAL");
    if (node && node[2] === "Mirror Defense") run.missionType = "MIRROR DEFENSE";
    if (node && node[2] === "Infested Salvage") run.missionType = "INFESTED SALVAGE";
    run.faction = node ? node[3] : "Unknown";
    run.tileset = node ? node[4] : tileFromPath(run.levelPath);
    const wavePhases = calculateWavePhases(run);
    const rotationPhases = calculateRotationPhases(run);
    run.waveDurations = wavePhases.map((phase) => [phase.label, phase.seconds]);
    run.rotationDurations = rotationPhases.map((phase) => phase.seconds);
    run.saturationPerWave = wavePhases.map((phase) => calculateRangeOccupancy(run, phase.from, phase.to));
    run.saturationPerRotation = rotationPhases.map((phase) => calculateRangeSaturation(run, phase.from, phase.to));
    run.rotations = run.rewardTimestamps.length || Math.floor(Object.keys(run.waveStarts).length / 3);
    run.dronesPerRotation = calculateDronesPerRotation(run);
    run.dpmPerRotation = calculateDpmPerRotation(run);
    run.avgDroneInterval = run.droneTimestamps.length > 1
      ? (run.droneTimestamps[run.droneTimestamps.length - 1] - run.droneTimestamps[0]) / (run.droneTimestamps.length - 1)
      : 0;
    run.saturation = calculateSaturation(run);
    run.cadence = calculateCadence(run);
    run.longestDroneGaps = longestGaps(run.droneTimestamps, run.pauseIntervals, 5);
    run.longestSpawnGaps = longestGaps(run.enemyTimestamps, run.pauseIntervals, 5);
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
    const result = [];
    let endIndex = 0;
    waves.forEach((wave, index) => {
      const from = run.waveStarts[wave];
      const nextStart = index + 1 < waves.length ? run.waveStarts[waves[index + 1]] : null;
      while (endIndex < ends.length && ends[endIndex] <= from) endIndex += 1;
      const candidate = ends[endIndex];
      let to = Number.isFinite(candidate) && (!Number.isFinite(nextStart) || candidate < nextStart)
        ? candidate
        : null;
      if (Number.isFinite(to)) endIndex += 1;
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
      return { label: index + 1, from, to: timestamp, seconds: Math.max(0, timestamp - from) };
    });
  }

  function calculateRotationDurations(run) {
    return calculateRotationPhases(run).map((phase) => phase.seconds);
  }

  function calculateDronesPerRotation(run) {
    if (!run.rewardTimestamps.length || !run.droneTimestamps.length) return [];
    let droneIndex = 0;
    return run.rewardTimestamps.map((reward) => {
      let count = 0;
      while (droneIndex < run.droneTimestamps.length && run.droneTimestamps[droneIndex] <= reward) {
        count += 1;
        droneIndex += 1;
      }
      return count;
    });
  }

  function calculateDpmPerRotation(run) {
    if (!run.dronesPerRotation.length) return [];
    let previous = startTime(run) || run.droneTimestamps[0];
    return run.dronesPerRotation.map((count, index) => {
      const reward = run.rewardTimestamps[index];
      const minutes = Math.max(reward - previous, 10) / 60;
      previous = reward;
      return count / minutes;
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
    const segments = liveSegments(run, rangeStart, rangeEnd);
    const total = segments.reduce((sum, segment) => sum + segment.duration, 0);
    if (!total) return null;
    const above = segments.reduce((sum, segment) => sum + (segment.count >= threshold ? segment.duration : 0), 0);
    return above / total * 100;
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

  function calculateSaturation(run, step = 3, maxValue = 30) {
    const size = Math.ceil(maxValue / step);
    const buckets = Array(size).fill(0);
    let total = 0;
    let above = 0;
    const live = run.liveCounts;
    if (live.length > 1 && run.endTime > run.startTime) {
      liveSegments(run).forEach((segment) => {
        const bucket = segment.count >= maxValue ? size - 1 : Math.floor(segment.count / step);
        buckets[bucket] += segment.duration;
        total += segment.duration;
        if (segment.count >= 15) above += segment.duration;
      });
    } else if (live.length) {
      live.forEach((entry) => {
        const bucket = entry[1] >= maxValue ? size - 1 : Math.floor(entry[1] / step);
        buckets[bucket] += 1;
        total += 1;
        if (entry[1] >= 15) above += 1;
      });
    }
    const rows = buckets.map((duration, index) => ({
      label: index === size - 1 ? `${index * step}+` : `${index * step}-${index * step + step - 1}`,
      percent: total ? duration / total * 100 : 0,
    }));
    return { rows, abovePercent: total ? above / total * 100 : 0 };
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
      gaps,
    };
  }

  function longestGaps(times, pauses, limit) {
    const gaps = [];
    for (let index = 1; index < times.length; index += 1) {
      const from = times[index - 1];
      const to = times[index];
      const paused = pauses.reduce((sum, pair) => sum + overlap(from, to, pair[0], pair[1]), 0);
      const duration = to - from - paused;
      if (duration > 0) gaps.push([duration, from]);
    }
    return gaps.sort((a, b) => b[0] - a[0]).slice(0, limit);
  }

  function computeVitus(droneKills, rotations) {
    const rot = Math.max(0, rotations || 0);
    const drones = Math.max(0, droneKills || 0);
    const rotationMean = rot + rot * ROTATION_CHANCE * WAVES_PER_ROTATION;
    const rotationVariance = rot * ROTATION_CHANCE * (1 - ROTATION_CHANCE) * WAVES_PER_ROTATION ** 2;
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

  function feedRelevantText(parser, text) {
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
      parser.feedLine(text.slice(start, end));
      P_RELEVANT_TOKEN.lastIndex = end + 1;
    }
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

  async function parseFileSlices(file, onProgress) {
    const parser = new Parser();
    const decoder = new TextDecoder();
    const chunkSize = 16 * 1024 * 1024;
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
    const spawnPoints = Object.values(run.spawnPoints || {})
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z))
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((point) => ({
        point_key: point.key,
        position: [round(point.x, 4), round(point.y, 4), round(point.z, 4)],
        count: point.count,
      }));
    const payload = {
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
    const runHash = await sha256(stableStringify(payload));
    return { ...payload, run_hash: runHash };
  }

  function round(value, places) {
    const factor = 10 ** places;
    return Math.round(value * factor) / factor;
  }

  return {
    ARBI_NODES,
    Parser,
    parseText,
    parseFile,
    deriveRun,
    computeVitus,
    fingerprintRun,
    buildContribution,
    stableStringify,
    helpers: {
      calculateCadence,
      calculateSaturation,
      calculateRangeSaturation,
      calculateRangeOccupancy,
      calculateWavePhases,
      longestGaps,
      tileFromPath,
    },
  };
});
