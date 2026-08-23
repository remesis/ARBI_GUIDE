(function () {
  "use strict";

  const Parser = globalThis.ArbitrationLogParser;
  if (!Parser) throw new Error("Analyzer parser failed to load.");
  const SpawnAlignment = globalThis.ArbitrationSpawnAlignment;
  if (!SpawnAlignment) throw new Error("Analyzer spawn alignment failed to load.");
  const SpawnSubmission = globalThis.ArbitrationSpawnSubmission;
  if (!SpawnSubmission) throw new Error("Analyzer spawn submission helper failed to load.");

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const PLAYER_PRIVACY_KEY = "arbi-analyzer-player-privacy-v1";
  const PLAYER_PRIVACY_TTL_MS = 365 * 24 * 60 * 60 * 1000;
  const CORRELATION_LAYOUT_ACTIVE = true;
  const CORRELATION_VISIBILITY_KEY = "arbi-analyzer-correlation-series-v2";
  const LEGACY_CORRELATION_VISIBILITY_KEY = "arbi-analyzer-correlation-series-v1";
  const CORRELATION_DEFAULT_VISIBILITY = Object.freeze({
    drones: true,
    spawns: true,
    time: true,
    saturation: true,
    dry: false,
    occupancy: false,
    enemiesPerDrone: false,
    peak: false,
  });
  const INITIAL_RUN_MIN_SECONDS = 5 * 60;
  const state = {
    runs: [], activeIndex: 0, query: "", sourceName: "", toastTimer: 0,
    fontStep: 0, spacingStep: 0, widthStep: 0,
    hidePlayerNames: loadPlayerNamePrivacy(),
    correlationVisibilityByMode: loadCorrelationVisibility(),
    correlationVisibility: { ...CORRELATION_DEFAULT_VISIBILITY },
    activeCorrelationMode: "UNKNOWN",
  };
  let topbarResizeObserver = null;
  let reportResizeObserver = null;
  let correlationLayoutResizeObserver = null;
  let reportFitFrame = 0;
  let correlationLayoutFrame = 0;

  const minimapBundle = globalThis.ArbitrationMinimapCatalog || { catalog: {}, nodes: {} };
  const MINIMAPS = Object.fromEntries(Object.entries(minimapBundle.nodes || {}).map(
    ([node, groups]) => [node, (Array.isArray(groups) ? groups : [groups])
      .map((group) => minimapBundle.catalog[group])
      .filter(Boolean)],
  ));

  function h(value) {
    return String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
  }

  function loadPlayerNamePrivacy() {
    try {
      const saved = JSON.parse(localStorage.getItem(PLAYER_PRIVACY_KEY) || "null");
      if (!saved || !Number.isFinite(saved.expiresAt) || saved.expiresAt <= Date.now()) {
        localStorage.removeItem(PLAYER_PRIVACY_KEY);
        return false;
      }
      return saved.hidden === true;
    } catch (_) {
      return false;
    }
  }

  function savePlayerNamePrivacy() {
    try {
      localStorage.setItem(PLAYER_PRIVACY_KEY, JSON.stringify({
        hidden: state.hidePlayerNames,
        expiresAt: Date.now() + PLAYER_PRIVACY_TTL_MS,
      }));
    } catch (_) {
      // Privacy still works for this page load when browser storage is unavailable.
    }
  }

  function squadNames(run) {
    const names = [run.host || "Unknown", ...(run.squadmates || [])];
    return state.hidePlayerNames ? names.map((_, index) => `Player ${index + 1}`) : names;
  }

  function syncSquadPrivacy(root, run) {
    const toggle = root?.querySelector("#squadPrivacyToggle");
    if (!toggle) return;
    const action = state.hidePlayerNames ? "Show" : "Hide";
    toggle.classList.toggle("is-hidden", state.hidePlayerNames);
    toggle.setAttribute("aria-pressed", String(state.hidePlayerNames));
    toggle.setAttribute("aria-label", `${action} squad names`);
    toggle.dataset.tooltip = `${action} squad names`;
    const names = squadNames(run);
    root.querySelectorAll(".squad-player").forEach((player, index) => {
      player.textContent = names[index] || "Unknown";
    });
  }

  function syncTopbarHeight() {
    const topbar = $(".topbar");
    if (!topbar) return;
    const height = Math.ceil(topbar.getBoundingClientRect().height);
    if (height) document.documentElement.style.setProperty("--topbar", `${height}px`);
  }

  function setupTopbarHeightObserver() {
    syncTopbarHeight();
    const topbar = $(".topbar");
    if (!topbar || typeof ResizeObserver === "undefined") return;
    topbarResizeObserver = new ResizeObserver(syncTopbarHeight);
    topbarResizeObserver.observe(topbar);
  }

  function syncReportHeaderAccent(root = document) {
    const header = root.matches?.(".report-header") ? root : root.querySelector?.(".report-header");
    const title = header?.querySelector(".report-title");
    if (!header || !title) return;
    const headerRect = header.getBoundingClientRect();
    const titleRect = title.getBoundingClientRect();
    const scale = header.offsetWidth ? headerRect.width / header.offsetWidth : 1;
    const width = Math.max(0, (titleRect.right - headerRect.left) / Math.max(scale, .001));
    header.style.setProperty("--header-accent-width", `${Math.ceil(width)}px`);
  }

  function fitReportToViewport() {
    const viewport = $("#reportViewport");
    const report = $("#reportRoot");
    if (!viewport || !report) return;
    syncReportHeaderAccent(report);
    syncDashboardClearMapLayout(report);
    const correlationGrid = report.querySelector(".correlation-test-layout.correlation-test-defense");
    if (correlationGrid) syncCorrelationDefenseTileHeight(correlationGrid);
    const availableWidth = viewport.clientWidth;
    const canvasWidth = report.offsetWidth || 1600;
    if (!availableWidth || !canvasWidth) return;
    const selectedZoom = 1 + state.widthStep * .1;
    const fittedScale = Math.min(1, availableWidth / canvasWidth);
    const scale = Math.min(fittedScale * selectedZoom, availableWidth / canvasWidth);
    const scaledWidth = canvasWidth * scale;
    report.style.transform = `scale(${scale})`;
    report.style.marginLeft = `${Math.max(0, (availableWidth - scaledWidth) / 2)}px`;
    viewport.style.height = report.childElementCount ? `${Math.ceil(report.scrollHeight * scale)}px` : "0px";
  }

  function scheduleReportFit() {
    cancelAnimationFrame(reportFitFrame);
    reportFitFrame = requestAnimationFrame(fitReportToViewport);
  }

  function setupReportFitObserver() {
    const main = $(".analyzer-main");
    const report = $("#reportRoot");
    if (typeof ResizeObserver === "undefined") {
      addEventListener("resize", scheduleReportFit, { passive: true });
      scheduleReportFit();
      return;
    }
    reportResizeObserver = new ResizeObserver(scheduleReportFit);
    if (main) reportResizeObserver.observe(main);
    if (report) reportResizeObserver.observe(report);
    scheduleReportFit();
  }

  const sum = (items) => items.reduce((total, value) => total + Number(value || 0), 0);
  const avg = (items) => items.length ? sum(items) / items.length : 0;
  const runDroneRate = (run) => run?.activeDuration ? Number(run.droneKills || 0) / run.activeDuration * 60 : 0;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const fmt = (value, digits = 0) => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });

  function duration(seconds) {
    const total = Math.max(0, Math.round(Number(seconds || 0)));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if (hours) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
    return `${minutes}m ${String(secs).padStart(2, "0")}s`;
  }

  function shortDuration(seconds) {
    const total = Math.max(0, Math.round(Number(seconds || 0)));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    const parts = [];
    if (hours) parts.push(`${hours}h`);
    if (minutes || hours) parts.push(`${minutes}m`);
    parts.push(`${secs}s`);
    return parts.join(" ");
  }

  function normalizeCorrelationVisibility(saved) {
    return Object.fromEntries(Object.entries(CORRELATION_DEFAULT_VISIBILITY)
      .map(([id, fallback]) => [id, typeof saved?.[id] === "boolean" ? saved[id] : fallback]));
  }

  function correlationModeKey(missionType) {
    return String(missionType || "UNKNOWN").trim().toUpperCase().replace(/[_-]+/g, " ") || "UNKNOWN";
  }

  function loadCorrelationVisibility() {
    try {
      const saved = JSON.parse(localStorage.getItem(CORRELATION_VISIBILITY_KEY) || "null");
      if (saved && typeof saved === "object") {
        return Object.fromEntries(Object.entries(saved)
          .filter(([, visibility]) => visibility && typeof visibility === "object")
          .map(([mode, visibility]) => [correlationModeKey(mode), normalizeCorrelationVisibility(visibility)]));
      }
      const legacy = JSON.parse(localStorage.getItem(LEGACY_CORRELATION_VISIBILITY_KEY) || "null");
      return legacy && typeof legacy === "object"
        ? { DEFAULT: normalizeCorrelationVisibility(legacy) }
        : {};
    } catch (_) {
      return {};
    }
  }

  function activateCorrelationVisibility(missionType) {
    const mode = correlationModeKey(missionType);
    state.activeCorrelationMode = mode;
    state.correlationVisibility = normalizeCorrelationVisibility(
      state.correlationVisibilityByMode[mode]
      || state.correlationVisibilityByMode.DEFAULT
      || CORRELATION_DEFAULT_VISIBILITY
    );
  }

  function saveCorrelationVisibility() {
    try {
      state.correlationVisibilityByMode[state.activeCorrelationMode] = normalizeCorrelationVisibility(state.correlationVisibility);
      localStorage.setItem(CORRELATION_VISIBILITY_KEY, JSON.stringify(state.correlationVisibilityByMode));
    } catch (_) {
      // The toggles still work for this page load when browser storage is unavailable.
    }
  }

  function phaseDuration(seconds) {
    const value = Math.max(0, Number(seconds || 0));
    return value < 60 ? `${fmt(value, 1)}s` : shortDuration(value);
  }

  function elapsedAt(run, timestamp) {
    const start = Number(run?.startTime || 0);
    return shortDuration(Math.max(0, Number(timestamp || 0) - start));
  }

  // Use consistent binary success/danger endpoints with the full HSL
  // performance ramp used by the report heat maps.
  const PERFORMANCE_SUCCESS = "#00e676";
  const PERFORMANCE_DANGER = "#ff5252";
  const DEFENSE_WAVE_TARGET_SECONDS = 25;
  const INTERCEPTION_ROTATION_TARGET = 6 * 60 + 30;
  const SPAWN_ELEVATION_COLORS = ["#0b4399", "#1768c5", "#2d91eb", "#67b7f5", "#b9ddff"];

  function performanceHue(intensity) {
    return clamp(Number(intensity || 0), 0, 1) * 120;
  }

  function heatColor(intensity) {
    const hue = performanceHue(intensity);
    return { color: `hsl(${hue},100%,50%)`, ink: "#121212" };
  }

  function droneDespawnColor(count) {
    const value = Math.max(0, Number(count) || 0);
    const performance = 1 - clamp((value - 1) / 4, 0, 1);
    return heatColor(performance).color;
  }

  function interceptionRotationScore(seconds, maxDeviation) {
    const value = Number(seconds);
    if (!Number.isFinite(value)) return 0;
    const distance = Math.abs(value - INTERCEPTION_ROTATION_TARGET);
    const scale = Number(maxDeviation);
    if (!Number.isFinite(scale) || scale <= 0) return distance === 0 ? 1 : 0;
    return clamp(1 - distance / scale, 0, 1);
  }

  function defenseWaveScore(seconds) {
    // The cell label uses shortDuration(), which rounds to a whole second.
    // Grade that same displayed value so a visible 25s cell agrees with the
    // <=25s legend instead of turning red because of hidden milliseconds.
    return Number(Math.round(Number(seconds || 0)) <= DEFENSE_WAVE_TARGET_SECONDS);
  }

  function activityHeatColor(intensity) {
    const t = clamp(Number(intensity || 0), 0, 1);
    const low = [31, 35, 39];
    const high = [0, 230, 118];
    const rgb = low.map((channel, index) => Math.round(channel + (high[index] - channel) * t));
    return `rgb(${rgb.join(",")})`;
  }

  function rotationHeatColor(intensity) {
    const t = clamp(Number(intensity || 0), 0, 1);
    const saturation = 12 + 63 * t;
    const lightness = 44 + 8 * t;
    return { color: `hsl(150,${saturation.toFixed(1)}%,${lightness.toFixed(1)}%)`, ink: "#121212" };
  }

  function spawnBubbleHeatColor(intensity) {
    const t = clamp(Number(intensity || 0), 0, 1);
    const hue = performanceHue(t);
    return {
      fill: `hsla(${hue},100%,50%,${(.22 + t * .5).toFixed(2)})`,
      compactFill: `hsla(${hue},100%,50%,${(.46 + t * .34).toFixed(2)})`,
    };
  }

  function tileElevationBands(config) {
    const heights = Object.values(config?.spawnPoints || {}).flat()
      .map((position) => Number(position?.[1]))
      .filter(Number.isFinite)
      .sort((left, right) => left - right);
    if (!heights.length) return [0, 0, 0, 0];
    return [.2, .4, .6, .8].map((fraction) =>
      heights[Math.min(heights.length - 1, Math.ceil(heights.length * fraction) - 1)]
    );
  }

  function spawnElevationLevel(height, bands) {
    if (!Number.isFinite(height)) return 2;
    const level = bands.findIndex((maximum) => height <= maximum);
    return level < 0 ? 4 : level;
  }

  function renderElevationLegend() {
    const levels = SPAWN_ELEVATION_COLORS
      .map((color, index) => `<i style="--elevation-color:${color}" title="Elevation level ${index + 1} of 5"></i>`)
      .join("");
    return `<div class="elevation-legend"><strong>Elevation:</strong><span>Low</span><span class="elevation-scale" aria-label="Five elevation levels from low to high">${levels}</span><span>High</span></div>`;
  }

  function makeDemoRuns() {
    const lares = demoBase({
      nodeKey: "SolNode130", node: "Lares", planet: "Mercury", missionType: "DEFENSE",
      faction: "Infested", tileset: "Grineer Asteroid", totalDuration: 727, activeDuration: 703,
      droneKills: 311, enemySpawns: 2148, rotations: 4, sourceDate: new Date("2026-08-16T01:28:00Z"),
      levelPath: "/Lotus/Levels/GrineerAsteroidRelight/GrnDefenseOne.level",
    });
    lares.waveDurations = Array.from({ length: 12 }, (_, i) => [i + 1, [31, 23, 27, 25, 38, 22, 29, 24, 26, 35, 24, 28][i]]);
    lares.saturationPerWave = [12.8, 18.6, 23.4, 28.9, 31.1, 35.7, 38.2, 41.8, 39.5, 44.3, 47.6, 49.1];
    lares.rotationDurations = [180, 176, 171, 176];
    lares.dronesPerRotation = [73, 82, 79, 77];
    lares.dpmPerRotation = [24.3, 28.0, 27.7, 26.3];
    lares.avgDroneInterval = 2.24;
    lares.spawnPoints = demoAsteroidSpawns();
    lares.enemyTypes = { Charger: 743, Runner: 488, "CorpusEliteShieldDroneAgent": 311, AncientHealer: 243, Leaper: 215, Other: 459 };
    lares.saturation = demoSaturation([28, 36, 19, 10, 5, 2, 0, 0, 0, 0]);
    lares.telemetryCoverage = 96.8;
    lares.cadence = demoCadence([9, 17, 21, 24, 16, 9, 4]);
    lares.longestSpawnGaps = [[8.9, 441], [8.4, 99], [7.7, 567], [7.2, 302], [6.8, 199]];
    lares.longestDroneGaps = [[12.7, 441], [10.9, 99], [9.2, 567], [8.5, 302], [8.1, 199]];

    const odin = demoBase({
      nodeKey: "SolNode224", node: "Odin", planet: "Mercury", missionType: "INTERCEPTION",
      faction: "Grineer", tileset: "Grineer Galleon", totalDuration: 4033, activeDuration: 3948,
      droneKills: 1727, enemySpawns: 11611, rotations: 10, sourceDate: new Date("2026-08-14T18:00:00Z"),
      levelPath: "/Lotus/Levels/GrineerGalleon/GrnInterception.level",
    });
    odin.rotationDurations = [454, 395, 402, 404, 406, 406, 389, 390, 392, 391];
    odin.saturationPerRotation = [9.7, 13.2, 17.8, 14.4, 20.6, 18.9, 23.1, 21.7, 16.5, 19.3];
    odin.dronesPerRotation = [185, 185, 177, 161, 188, 172, 174, 171, 155, 156];
    odin.dpmPerRotation = [24.4, 28.1, 26.3, 23.9, 27.6, 25.4, 26.6, 26.2, 23.7, 23.9];
    odin.avgDroneInterval = 2.36;
    odin.enemyTypes = { EliteRifleLancer: 4786, "CorpusEliteShieldDroneAgent": 1727, ShotgunLancer: 1428, EvisceratorLancer: 544, MinigunBombard: 482, Other: 2644 };
    odin.saturation = demoSaturation([19.1, 31.4, 16, 15.3, 10.8, 4.4, 1.2, .9, .4, .5]);
    odin.telemetryCoverage = 98.1;
    odin.cadence = demoCadence([5.2, 11.9, 9.3, 16.3, 16.8, 13.1, 27.4]);
    odin.longestDroneGaps = [[27.1, 1629], [26.9, 2035], [26.5, 2442], [22.1, 1230], [20.5, 3100]];
    return [lares, odin];
  }

  function demoBase(values) {
    const run = Object.assign({
      missionName: values.node, host: "Local player", squadmates: ["Squadmate 2", "Squadmate 3", "Squadmate 4"],
      rounds: 0, waveStarts: {}, rewardTimestamps: [], droneTimestamps: [], droneDespawnTimestamps: [], dronesDespawned: 0, enemyTimestamps: [],
      spawnPoints: {}, liveCounts: [], pauseIntervals: [], shortId: "demo", actualVitus: "",
    }, values);
    run.droneTimestamps = sequence(run.droneKills, run.totalDuration, 0.41);
    run.enemyTimestamps = sequence(Math.min(run.enemySpawns, 1500), run.totalDuration, 0.18);
    run.startTime = 0;
    run.endTime = run.totalDuration;
    return run;
  }

  function sequence(count, span, phase) {
    return Array.from({ length: count }, (_, index) => {
      const base = (index + 1) * span / (count + 1);
      return base + Math.sin(index * phase) * Math.min(1.7, span / count * .4);
    });
  }

  function demoSaturation(values) {
    const labels = ["0-2", "3-5", "6-8", "9-11", "12-14", "15-17", "18-20", "21-23", "24-26", "27+"];
    return { rows: labels.map((label, index) => ({ label, percent: values[index] || 0 })), abovePercent: sum(values.slice(5)), threshold: 15 };
  }

  function demoCadence(values) {
    const labels = ["0-1s", "1-2s", "2-3s", "3-5s", "5-8s", "8-12s", "12s+"];
    return { rows: labels.map((label, index) => ({ label, percent: values[index] || 0 })), droughtPercent: values[6] || 0, gaps: [] };
  }

  function demoAsteroidSpawns() {
    const config = MINIMAPS.SolNode130?.[0];
    const numbers = [293, 294, 295, 301, 302, 303, 309, 310, 311, 317, 318, 319, 325, 326, 327, 333, 334, 335];
    const counts = [139, 105, 84, 126, 116, 93, 122, 88, 75, 133, 96, 81, 111, 91, 73, 128, 99, 86];
    const points = {};
    numbers.forEach((number, index) => {
        const position = config?.spawnPoints?.[number]?.[0];
        if (!position) return;
        const key = `/LayerGrnDefenseOne/NpcSpawnPoint${number}`;
        const count = counts[index];
        const waveCounts = {};
        for (let wave = 1; wave <= 12; wave += 1) waveCounts[wave] = Math.max(0, Math.round(count / 12 + Math.sin((wave + index % 3) * 1.4) * 4));
        points[key] = {
          key, ident: `NpcSpawnPoint${number}`, layer: "/LayerGrnDefenseOne", count,
          x: position[0], y: position[1], z: position[2],
          types: { Charger: Math.round(count * .48), Runner: Math.round(count * .32), AncientHealer: Math.round(count * .2) },
          waveCounts,
        };
    });
    return points;
  }

  function phaseInfo(run) {
    const defense = run.waveDurations && run.waveDurations.length;
    const saturation = defense ? (run.saturationPerWave || []) : (run.saturationPerRotation || []);
    const items = defense ? run.waveDurations.map(([label, seconds], index) => ({ label: String(label), seconds, saturation: saturation[index] }))
      : (run.rotationDurations || []).map((seconds, index) => ({ label: String(index + 1), seconds, saturation: saturation[index] }));
    return { defense: Boolean(defense), items, noun: defense ? "wave" : "rotation" };
  }

  function kpi(label, value, note) {
    return `<section class="card kpi"><div class="kpi-label">${h(label)}</div><div class="kpi-value">${h(value)}</div><div class="kpi-note">${h(note)}</div></section>`;
  }

  function renderReport(run) {
    if (!run) {
      $("#reportRoot").innerHTML = "";
      $("#emptyState").hidden = false;
      const hoverTooltip = document.querySelector("#analyzerHoverTooltip");
      if (hoverTooltip) hoverTooltip.hidden = true;
      return;
    }
    if (CORRELATION_LAYOUT_ACTIVE) activateCorrelationVisibility(run.missionType);
    $("#emptyState").hidden = true;
    const phase = phaseInfo(run);
    const droneRate = runDroneRate(run);
    const enemyRate = run.activeDuration ? run.enemySpawns / run.activeDuration * 60 : 0;
    const perPhase = (phase.items.length ? run.droneKills / phase.items.length : 0);
    const phaseDroneKpi = ["SURVIVAL", "DISRUPTION"].includes(run.missionType)
      ? kpi("Drones despawned", fmt(run.dronesDespawned || 0), "Despawn after 20s")
      : kpi(`Drones / ${phase.noun}`, fmt(perPhase, 1), `Per ${phase.noun}`);
    const hasSpawnPoints = Object.values(run.spawnPoints || {}).some((point) => point.count > 0);
    const date = run.sourceDate instanceof Date && !Number.isNaN(run.sourceDate.valueOf())
      ? run.sourceDate.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Local log";
    const tier = globalThis.ArbitrationTierData?.findTier(run.node);
    const tierBadge = tier
      ? `<span class="tier-badge" style="--tier-rgb:${tier.color.join(",")}"${tier.subname ? ` data-tooltip="${h(tier.subname)}"` : ""}>${h(tier.name)}</span>`
      : "";

    $("#reportRoot").innerHTML = `
      <header class="report-header">
        <img class="report-logo" src="../logo.webp" alt="Arbitration Goons logo" width="78" height="78">
        <div>
          <div class="report-title-row"><h2 class="report-title">${h(run.node)}</h2>${tierBadge}</div>
          <div class="report-badges">
            <span class="badge mission">${h(run.missionType)}</span><span class="badge">${h(run.planet)}</span>
            <span class="badge">${h(run.faction)}</span><span class="badge">${h(run.tileset)}</span>
            ${run.levelPath ? `<span class="badge" data-tooltip="${h(run.levelPath)}">${h(run.levelPath.split("/").pop().replace(/\.level$/i, ""))}</span>` : ""}
            <div class="report-actions">
              <button id="copyImageBtn" class="copy-image-button" type="button"><svg width="17" height="17"><use href="#icon-copy"></use></svg> COPY RUN IMAGE</button>
            </div>
          </div>
          <div class="squad-line">
            <button id="squadPrivacyToggle" class="squad-privacy-toggle${state.hidePlayerNames ? " is-hidden" : ""}" type="button" aria-pressed="${state.hidePlayerNames}" aria-label="${state.hidePlayerNames ? "Show" : "Hide"} squad names" data-tooltip="${state.hidePlayerNames ? "Show" : "Hide"} squad names">
              <svg aria-hidden="true"><use href="#icon-eye"></use></svg>
            </button>
            ${squadNames(run).map((name) => `<span class="squad-member"><span class="squad-player">${h(name)}</span><i class="squad-separator" aria-hidden="true"></i></span>`).join("")}
            <span class="squad-phase">${phase.items.length} ${phase.noun}${phase.items.length === 1 ? "" : "s"}</span>
          </div>
        </div>
        <div class="run-identity">
          <div class="export-run-identity">
            <div class="goons-label">ARBITRATION GOONS</div>
            <div class="run-code">RUN ${h(String(run.shortId || "LOCAL").slice(0, 12).toUpperCase())}<br>${h(date)}</div>
          </div>
        </div>
      </header>
      <div class="report-grid ${hasSpawnPoints ? "" : "no-spawns"}">
        <div class="column left-column">
          <div class="kpi-grid">
            ${CORRELATION_LAYOUT_ACTIVE ? `
              ${kpi("Total enemies", fmt(run.enemySpawns), "Non-ticking filtered")}
              ${kpi("Drones killed", fmt(run.droneKills), "Shield drones")}
              ${kpi("Enemies / min", fmt(enemyRate), "Spawn pace")}
              ${kpi("Total duration", duration(run.totalDuration), `${phase.items.length} ${phase.noun}${phase.items.length === 1 ? "" : "s"}`)}
              ${kpi("Enemies / drone", fmt(run.droneKills ? run.enemySpawns / run.droneKills : 0, 2), "Spawned per drone")}
              ${kpi("Drone interval", `${fmt(run.avgDroneInterval, 2)}s`, "Between spawns")}
            ` : `
              ${kpi("Drones killed", fmt(run.droneKills), "Shield drones")}
              ${kpi("Enemies spawned", fmt(run.enemySpawns), "Non-ticking filtered")}
              ${kpi("Enemies / drone", fmt(run.droneKills ? run.enemySpawns / run.droneKills : 0, 2), "Spawned per drone")}
              ${kpi("Total duration", duration(run.totalDuration), `${phase.items.length} ${phase.noun}${phase.items.length === 1 ? "" : "s"}`)}
              ${kpi("Drones / min", fmt(droneRate, 1), "Drone pace")}
              ${kpi("Avg drone interval", `${fmt(run.avgDroneInterval, 2)}s`, "Between spawns")}
              ${kpi(`Avg ${phase.noun}`, phase.items.length ? phaseDuration(avg(phase.items.map((item) => item.seconds))) : "—", "Active phase time")}
              ${kpi("Enemies / min", fmt(enemyRate), "Spawn pace")}
              ${phaseDroneKpi}
            `}
          </div>
          ${renderVitus(run)}
          ${renderSaturation(run)}
          ${renderComposition(run)}
        </div>
        <div class="column center-column">
          ${renderClearMap(run, phase)}
          <div class="split-row">${renderDpm(run)}${renderPerRotation(run)}</div>
          ${renderBottlenecks(run, phase)}
          ${renderCadence(run)}
        </div>
        ${hasSpawnPoints ? `<div class="column right-column">${renderSpawnColumn(run)}</div>` : ""}
      </div>
      <footer class="report-footer"><span>https://arbi.guide/analyzer</span><span>discord.gg/Arbitrations</span></footer>`;

    if (CORRELATION_LAYOUT_ACTIVE) {
      prepareCorrelationLayout($("#reportRoot"), run);
      setupCorrelationInteractions($("#reportRoot"));
    } else {
      prepareDashboardLayout($("#reportRoot"), run);
      setupDpmTooltips($("#reportRoot"));
    }
    setupAnalyzerTooltips($("#reportRoot"));
    syncReportHeaderAccent($("#reportRoot"));
    scheduleReportFit();
    $("#copyImageBtn").addEventListener("click", () => copyReportImage());
    $("#squadPrivacyToggle").addEventListener("click", () => {
      state.hidePlayerNames = !state.hidePlayerNames;
      savePlayerNamePrivacy();
      syncSquadPrivacy($("#reportRoot"), run);
    });
    const vitusInput = $("#actualVitusInput");
    if (vitusInput) vitusInput.addEventListener("input", () => {
      const digits = cleanVitusDigits(vitusInput.value);
      if (vitusInput.value !== digits) vitusInput.value = digits;
      run.actualVitus = digits;
      updateVitusActual(run);
    });
  }

  function renderClearMap(run, phase) {
    if (!phase.items.length) return `<section class="card"><h3 class="card-title">${h(phase.noun)} clear map</h3><p class="card-subtitle">No phase timing lines were present in this log.</p></section>`;
    const values = phase.items.map((item) => item.seconds);
    const low = Math.min(...values), high = Math.max(...values);
    const threshold = phase.defense ? DEFENSE_WAVE_TARGET_SECONDS : avg(values);
    const interception = !phase.defense && run.missionType === "INTERCEPTION";
    const interceptionMaxDeviation = interception
      ? Math.max(0, ...values.map((value) => Math.abs(value - INTERCEPTION_ROTATION_TARGET)))
      : 0;
    const interceptionFarthest = interception
      ? values.reduce((farthest, value) => (
        Math.abs(value - INTERCEPTION_ROTATION_TARGET) > Math.abs(farthest - INTERCEPTION_ROTATION_TARGET) ? value : farthest
      ), values[0])
      : 0;
    const cells = phase.items.map((item) => {
      const good = phase.defense
        ? defenseWaveScore(item.seconds)
        : (interception
          ? interceptionRotationScore(item.seconds, interceptionMaxDeviation)
          : (high === low ? .6 : 1 - (item.seconds - low) / (high - low)));
      const color = phase.defense
        ? { color: good ? PERFORMANCE_SUCCESS : PERFORMANCE_DANGER, ink: "#121212" }
        : heatColor(good);
      const saturation = Number.isFinite(item.saturation) ? `${fmt(item.saturation, 1)}%` : "—";
      const visibleDuration = CORRELATION_LAYOUT_ACTIVE && phase.defense
        ? String(Math.round(item.seconds))
        : shortDuration(item.seconds);
      const content = CORRELATION_LAYOUT_ACTIVE
        ? `<span class="clear-cell-content"><strong>${visibleDuration}</strong></span>`
        : `<span class="clear-cell-content"><small>${shortDuration(item.seconds)}</small><small class="phase-saturation">${h(saturation)}</small></span>`;
      const tooltip = CORRELATION_LAYOUT_ACTIVE
        ? `${phase.defense ? "Wave" : "Rotation"} ${item.label} · ${shortDuration(item.seconds)} · Saturation ${saturation}`
        : `Round ${item.label} - Saturation ${saturation}`;
      return `<div class="heat-cell" data-tooltip="${h(tooltip)}" aria-label="${h(tooltip)}" style="--heat:${color.color};--ink:${color.ink}">${content}</div>`;
    }).join("");
    const subtitle = phase.defense
      ? "Fight time per wave, downtime excluded. Greener = faster."
      : (interception
        ? "Time per rotation. Green at 6m 30s; red at this run's furthest deviation."
        : "Time per rotation. Greener = faster for this local comparison.");
    const goodLegend = phase.defense
      ? `≤${threshold}s`
      : (interception ? "target 6m 30s" : `fastest ${shortDuration(low)}`);
    const badLegend = phase.defense
      ? `>${threshold}s`
      : (interception ? `furthest ${shortDuration(interceptionFarthest)}` : `slowest ${shortDuration(high)}`);
    const saturationLegend = CORRELATION_LAYOUT_ACTIVE ? "" : `<span class="round-saturation-legend">##.#% is Saturation per round</span>`;
    return `<section class="card"><h3 class="card-title">${h(phase.noun)} clear map</h3><p class="card-subtitle">${subtitle}</p><div class="heat-map clear-heat-map" style="--heat-cols:${Math.min(CORRELATION_LAYOUT_ACTIVE && phase.defense ? 25 : 12, phase.items.length)};--mobile-heat-cols:${Math.min(8, phase.items.length)}">${cells}</div><div class="heat-legend"><span class="legend-chip"><i style="--swatch:${PERFORMANCE_SUCCESS}"></i><span>${goodLegend}</span></span><span class="legend-chip"><i style="--swatch:${PERFORMANCE_DANGER}"></i><span>${badLegend}</span></span>${saturationLegend}</div></section>`;
  }

  function dpmElapsed(seconds) {
    const total = Math.max(0, Math.round(Number(seconds || 0)));
    if (total === 0) return "0m";
    if (total % 3600 === 0) return `${total / 3600}h`;
    if (total % 60 === 0) return `${total / 60}m`;
    return shortDuration(total);
  }

  function dpmChartSeries(run) {
    if (run.missionType === "DISRUPTION") {
      const windows = run.dpmWindows6m || Parser.helpers.calculateFixedDpmWindows(run, 6 * 60);
      return {
        values: windows.map((window) => window.dpm),
        labels: windows.map((window) => `${dpmElapsed(window.from)}–${dpmElapsed(window.to)}`),
        tooltips: windows.map((window) => `${dpmElapsed(window.from)}–${dpmElapsed(window.to)}`),
        axis: windows.map((window) => dpmElapsed(window.to)),
        mean: runDroneRate(run),
        subtitle: "Six-minute active-time windows, against the run average.",
        empty: "Not enough active mission time to chart.",
      };
    }
    const values = run.dpmPerRotation || [];
    return {
      values,
      labels: values.map((_, index) => `R${index + 1}`),
      tooltips: values.map((_, index) => `Rotation ${index + 1}`),
      axis: values.map((_, index) => `R${index + 1}`),
      mean: runDroneRate(run),
      subtitle: "Per rotation, against the run average.",
      empty: "Not enough rotation boundaries to chart.",
    };
  }

  function renderDpm(run) {
    const series = dpmChartSeries(run);
    const values = series.values;
    if (!values.length) return `<section class="card"><h3 class="card-title">Drones per minute</h3><p class="card-subtitle">${h(series.empty)}</p></section>`;
    const width = 520, height = 190, pad = { l: 25, r: 25, t: 15, b: 25 };
    const min = Math.min(...values) * .9, max = Math.max(...values) * 1.08;
    const x = (index) => values.length === 1
      ? pad.l + (width - pad.l - pad.r) / 2
      : pad.l + index / (values.length - 1) * (width - pad.l - pad.r);
    const y = (value) => pad.t + (max - value) / Math.max(.001, max - min) * (height - pad.t - pad.b);
    const points = values.map((value, index) => `${x(index)},${y(value)}`).join(" ");
    const mean = series.mean;
    const best = Math.max(...values), worst = Math.min(...values);
    const dots = values.map((value,index) => {
      const pointX = x(index), pointY = y(value);
      const label = `${series.tooltips[index]}: ${fmt(value, 1)} DPM`;
      return `<g class="chart-point"><circle class="chart-dot" cx="${pointX}" cy="${pointY}" r="3"/><circle class="chart-hit" cx="${pointX}" cy="${pointY}" r="10" tabindex="0" role="img" aria-label="${h(label)}" data-label="${h(label)}" data-x="${pointX}" data-y="${pointY}" data-chart-width="${width}" data-chart-height="${height}"></circle></g>`;
    }).join("");
    const averageTop = y(mean) / height * 100;
    const axisLabels = values.length === 1
      ? `<text class="chart-label" x="${x(0)}" y="${height-5}" text-anchor="middle">${h(series.axis[0])}</text>`
      : `<text class="chart-label" x="${pad.l}" y="${height-5}" text-anchor="start">${h(series.axis[0])}</text><text class="chart-label" x="${width-pad.r}" y="${height-5}" text-anchor="end">${h(series.axis.at(-1))}</text>`;
    return `<section class="card"><h3 class="card-title">Drones per minute</h3><p class="card-subtitle">${h(series.subtitle)}</p><div class="line-chart-wrap"><svg class="line-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" aria-label="Drones per minute line chart"><line class="chart-grid" x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${height-pad.b}"/><line class="chart-grid" x1="${pad.l}" y1="${height-pad.b}" x2="${width-pad.r}" y2="${height-pad.b}"/><line class="chart-average" x1="${pad.l}" y1="${y(mean)}" x2="${width-pad.r}" y2="${y(mean)}"/><polyline class="chart-line" points="${points}"/>${dots}${axisLabels}</svg><span class="chart-average-badge" style="--average-top:${averageTop.toFixed(2)}%">AVG ${fmt(mean,1)}</span><div class="chart-tooltip" role="status" hidden data-html2canvas-ignore="true"></div></div><div class="heat-legend"><span class="chart-accent">best ${h(series.labels[values.indexOf(best)])} · ${fmt(best,1)}</span><span>worst ${h(series.labels[values.indexOf(worst)])} · ${fmt(worst,1)}</span></div></section>`;
  }

  function setupDpmTooltips(root) {
    $$(".chart-hit", root).forEach((hit) => {
      const wrap = hit.closest(".line-chart-wrap");
      const tooltip = $(".chart-tooltip", wrap);
      if (!tooltip) return;
      const show = () => {
        const chartWidth = Number(hit.dataset.chartWidth) || 1;
        const chartHeight = Number(hit.dataset.chartHeight) || 1;
        const left = Number(hit.dataset.x) / chartWidth * 100;
        tooltip.textContent = hit.dataset.label || "";
        tooltip.style.left = `${left}%`;
        tooltip.style.top = `${Number(hit.dataset.y) / chartHeight * 100}%`;
        tooltip.dataset.align = left < 14 ? "start" : left > 86 ? "end" : "center";
        tooltip.hidden = false;
        hit.classList.add("active");
      };
      const hide = () => {
        tooltip.hidden = true;
        hit.classList.remove("active");
      };
      hit.addEventListener("pointerenter", show);
      hit.addEventListener("pointerleave", hide);
      hit.addEventListener("focus", show);
      hit.addEventListener("blur", hide);
    });
  }

  function setupAnalyzerTooltips(root) {
    let tooltip = document.querySelector("#analyzerHoverTooltip");
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.id = "analyzerHoverTooltip";
      tooltip.className = "chart-tooltip analyzer-hover-tooltip";
      tooltip.setAttribute("role", "status");
      tooltip.dataset.html2canvasIgnore = "true";
      tooltip.hidden = true;
      document.body.append(tooltip);
    }
    tooltip.hidden = true;

    $$('[data-tooltip]', root).forEach((target) => {
      const show = () => {
        const label = target.dataset.tooltip || "";
        if (!label) return;
        tooltip.textContent = label;
        tooltip.hidden = false;
        tooltip.style.visibility = "hidden";

        const targetRect = target.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        const margin = 8;
        const centered = targetRect.left + targetRect.width / 2;
        const halfWidth = tooltipRect.width / 2;
        const left = Math.min(window.innerWidth - halfWidth - margin, Math.max(halfWidth + margin, centered));
        const fitsAbove = targetRect.top - tooltipRect.height - 10 >= margin;

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${fitsAbove ? targetRect.top : targetRect.bottom}px`;
        tooltip.dataset.placement = fitsAbove ? "above" : "below";
        tooltip.style.visibility = "";
      };
      const hide = () => { tooltip.hidden = true; };
      target.addEventListener("pointerenter", show);
      target.addEventListener("pointerleave", hide);
      target.addEventListener("focus", show);
      target.addEventListener("blur", hide);
    });
  }

  function renderPerRotation(run) {
    const values = run.dronesPerRotation || [];
    if (!values.length) return `<section class="card"><h3 class="card-title">Drones per rotation</h3><p class="card-subtitle">No complete rotations found.</p></section>`;
    const low = Math.min(...values), high = Math.max(...values);
    return `<section class="card"><h3 class="card-title">Drones per rotation</h3><p class="card-subtitle">Greener is a stronger rotation.</p><div class="heat-map" style="--heat-cols:${Math.min(4, values.length)};--mobile-heat-cols:${Math.min(4,values.length)}">${values.map((value, index) => { const heat=rotationHeatColor((value-low)/Math.max(1,high-low)); const tooltip=`Rotation ${index+1}: ${fmt(value)} drones`; return `<div class="heat-cell" data-tooltip="${h(tooltip)}" aria-label="${h(tooltip)}" style="--heat:${heat.color};--ink:${heat.ink}">${fmt(value)}</div>`; }).join("")}</div><div class="heat-legend"><span>low ${fmt(low)}</span><span>avg ${fmt(avg(values),1)}</span><span>high ${fmt(high)}</span></div></section>`;
  }

  function renderVitus(run) {
    const result = computeRunVitus(run);
    const actualDigits = cleanVitusDigits(run.actualVitus);
    run.actualVitus = actualDigits;
    const actual = Number(actualDigits);
    const classified = Number.isFinite(actual) && actual > 0 ? Parser.classifyVitusScenario(result.scenarios, actual) : result.scenarios[3];
    const luckColor = vitusLuckColor(result.scenarios, classified);
    return `<section class="card vitus-card"><h3 class="card-title">Expected Vitus</h3><p class="card-subtitle">${h(vitusAssumptionCopy(run))}</p><div class="highlight-panel vitus-entry-panel"><div class="vitus-entry-group"><span class="vitus-actual"><span class="vitus-entry-label">Actual Vitus</span><span id="vitusDelta" class="mini vitus-delta">${h(formatVitusDelta(result, actual))}</span></span><input id="actualVitusInput" class="vitus-input" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" placeholder="####" value="${h(actualDigits)}"><span id="vitusRate" class="vitus-rate">${h(formatVitusRate(run))}</span></div><div id="vitusLuck" class="vitus-luck" style="--luck-color:${luckColor}"><strong>${h(classified.label)}</strong><div class="mini vitus-tail">${h(formatVitusTailRarity(result, actual))}</div></div></div><table class="vitus-table"><thead><tr><th>CHANCE</th><th>TOTAL</th><th>LUCK LEVEL</th></tr></thead><tbody>${result.scenarios.map((scenario) => `<tr class="${scenario === classified ? "active" : ""}"><td>${h(formatVitusScenarioChance(scenario.chance))}</td><td><strong>${fmt(scenario.total)}</strong></td><td>${h(scenario.label)}</td></tr>`).join("")}</tbody></table></section>`;
  }

  function computeRunVitus(run) {
    return Parser.computeVitus(run.droneKills, run.rotations, run.missionType, run.blessedDroneKills);
  }

  function vitusAssumptionCopy(run) {
    if (Number.isFinite(run.resourceBlessingExpiryElapsed)) {
      return `Both Boosters, Resourceful Retriever, and Drop Blessing until ${duration(run.resourceBlessingExpiryElapsed)}.`;
    }
    if (Number.isFinite(run.blessedDroneKills) && run.blessedDroneKills === 0) {
      return "Both Boosters and Resourceful Retriever; the logged Drop Blessing had expired.";
    }
    return "Both Boosters, Drop Blessing and Resourceful Retriever.";
  }

  function formatVitusScenarioChance(chance) {
    const exceedance = Math.round(Number.parseFloat(chance));
    if (!Number.isFinite(exceedance)) return "";
    return `${exceedance}%`;
  }

  function cleanVitusDigits(value) {
    return String(value ?? "").replace(/\D/g, "").slice(0, 4);
  }

  function vitusLuckColor(scenarios, classified) {
    const index = Math.max(0, scenarios.indexOf(classified));
    return heatColor(index / Math.max(1, scenarios.length - 1)).color;
  }

  function standardNormalCdf(z) {
    const x = Math.abs(Number(z));
    const t = 1 / (1 + .2316419 * x);
    const density = Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
    const tail = density * t * (.319381530 + t * (-.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return clamp(z >= 0 ? 1 - tail : tail, 0, 1);
  }

  function formatChancePercent(percentile) {
    const normalized = clamp(percentile, 0, 100);
    if (normalized < .01) return "<0.01%";
    if (normalized < .1) return `${normalized.toFixed(2)}%`;
    const rounded = Math.round(normalized * 10) / 10;
    const value = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
    return `${value}%`;
  }

  function vitusTailChance(result, actual) {
    const mean = Number(result?.mean);
    const deviation = Number(result?.standardDeviation);
    if (!Number.isFinite(actual) || actual <= 0) return "";
    if (!Number.isFinite(mean) || !Number.isFinite(deviation) || deviation <= 0) return "0.00%";
    const lowerTail = actual <= mean;
    const cumulative = standardNormalCdf((actual - mean) / deviation);
    const tailChance = (lowerTail ? cumulative : 1 - cumulative) * 100;
    return formatChancePercent(tailChance);
  }

  function formatVitusTailRarity(result, actual) {
    const chance = vitusTailChance(result, actual);
    if (!chance) return "";
    return `${actual <= result.mean ? "Bottom" : "Top"} ${chance} Luck`;
  }

  function formatVitusDelta(result, actual) {
    return actual > 0
      ? `${actual >= result.mean ? "+" : ""}${fmt(actual-result.mean)} vs expected`
      : `expected ${fmt(result.mean)}`;
  }

  function formatVitusRate(run) {
    const rawActual = String(run.actualVitus ?? "").trim();
    const actual = Number(rawActual);
    const seconds = Number(run.totalDuration);
    if (!rawActual || !Number.isFinite(actual) || actual < 0 || !Number.isFinite(seconds) || seconds <= 0) return "⎵ VE/min";
    return `${fmt(actual * 60 / seconds, 1)} VE/min`;
  }

  function updateVitusActual(run) {
    const result = computeRunVitus(run);
    const actual = Number(run.actualVitus);
    const classified = Number.isFinite(actual) && actual > 0 ? Parser.classifyVitusScenario(result.scenarios, actual) : result.scenarios[3];
    $("#vitusRate").textContent = formatVitusRate(run);
    $("#vitusDelta").textContent = formatVitusDelta(result, actual);
    const luck = $("#vitusLuck");
    luck.style.setProperty("--luck-color", vitusLuckColor(result.scenarios, classified));
    luck.innerHTML = `<strong>${h(classified.label)}</strong><div class="mini vitus-tail">${h(formatVitusTailRarity(result, actual))}</div>`;
    $$(".vitus-table tbody tr").forEach((row,index) => row.classList.toggle("active", result.scenarios[index] === classified));
  }

  function focusActualVitusEntry(settle = false) {
    const applyFocus = () => {
      const input = $("#actualVitusInput");
      if (!input?.isConnected) return;
      input.focus({ preventScroll: true });
      const end = input.value.length;
      input.setSelectionRange(end, end);
    };
    requestAnimationFrame(() => {
      applyFocus();
      if (settle) setTimeout(() => requestAnimationFrame(applyFocus), 0);
    });
  }

  function renderSaturation(run) {
    const saturation = run.saturation || { rows: [], abovePercent: 0 };
    const threshold = Number.isFinite(saturation.threshold) ? saturation.threshold : 15;
    const telemetryCoverage = Number.isFinite(run.telemetryCoverage) ? run.telemetryCoverage : 0;
    const telemetryLabel = Math.round(telemetryCoverage * 10) / 10 === 100 ? "100" : fmt(telemetryCoverage, 1);
    const max = Math.max(1, ...saturation.rows.map((row) => row.percent));
    return `<section class="card saturation-card"><h3 class="card-title">Enemy saturation</h3><p class="card-subtitle">Share of run time at each enemy count.</p><div class="metric-bars">${saturation.rows.map((row,index) => { const heat=heatColor(1-index/Math.max(1,saturation.rows.length-1)); return `<div class="metric-row"><span>${h(row.label)}</span><div class="bar-track"><div class="bar-fill" style="--width:${row.percent/max*100}%;--color:${heat.color}"></div></div><strong>${fmt(row.percent,1)}%</strong></div>`; }).join("")}</div><div class="highlight-panel saturation-summary" style="margin-top:13px"><div class="saturation-summary-item"><span class="mini">Time at ${threshold}+ enemies</span><div class="big" style="color:${saturationSummaryColor(saturation.abovePercent)}">${fmt(saturation.abovePercent,1)}%</div></div><div class="saturation-summary-item telemetry-coverage"><span class="mini">Telemetry coverage</span><div class="big">${telemetryLabel}%</div></div></div></section>`;
  }

  function saturationSummaryColor(percent) {
    const hue = 120 - clamp(Number(percent || 0), 0, 18) / 18 * 120;
    return `hsl(${hue},100%,50%)`;
  }

  function renderCadence(run) {
    const cadence = run.cadence || { rows: [], droughtPercent: 0 };
    const max = Math.max(1, ...cadence.rows.map((row) => row.percent));
    const activeDrones = (run.droneTimestamps || []).filter((timestamp) => timestamp >= run.startTime && timestamp <= run.endTime);
    const peak = peakInWindow(activeDrones, 10);
    const peakValue = CORRELATION_LAYOUT_ACTIVE
      ? `<div class="peak-value-row"><div class="big">${fmt(peak.count)}</div><span class="mini">at ${elapsedAt(run, peak.time)}</span></div>`
      : `<div class="big">${fmt(peak.count)}</div><span class="mini">at ${elapsedAt(run, peak.time)}</span>`;
    return `<section class="card"><h3 class="card-title">Drone cadence</h3><p class="card-subtitle">Share of wait time spent waiting this long for the next drone.</p><div class="metric-bars">${cadence.rows.map((row,index) => { const heat=heatColor(1-index/Math.max(1,cadence.rows.length-1)); return `<div class="metric-row"><span>${h(row.label)}</span><div class="bar-track"><div class="bar-fill" style="--width:${row.percent/max*100}%;--color:${heat.color}"></div></div><strong>${fmt(row.percent,1)}%</strong></div>`; }).join("")}</div><div class="split-row cadence-highlights" style="margin-top:13px"><div class="highlight-panel"><span class="mini">Dry ≥12s</span><div class="big">${fmt(cadence.droughtPercent,1)}%</div></div><div class="highlight-panel"><span class="mini">Peak / 10s</span>${peakValue}</div></div></section>`;
  }

  function peakInWindow(times, windowSeconds) {
    let left = 0, best = { count: 0, time: 0 };
    times.forEach((time, right) => {
      while (times[left] < time - windowSeconds) left += 1;
      const count = right - left + 1;
      if (count > best.count) best = { count, time };
    });
    return best;
  }

  function renderComposition(run) {
    const entries = Object.entries(run.enemyTypes || {})
      .filter(([name]) => !isExcludedCompositionAgent(name))
      .sort((a,b) => b[1]-a[1]);
    const droneDespawns = Math.max(0, Number(run.dronesDespawned) || 0);
    const heading = CORRELATION_LAYOUT_ACTIVE
      ? `<div class="composition-heading"><h3 class="card-title">Enemy composition</h3><span class="composition-despawns"><span>20s Drone despawns:</span><strong style="--despawn-color:${droneDespawnColor(droneDespawns)}">${fmt(droneDespawns)}</strong></span></div>`
      : `<h3 class="card-title">Enemy composition</h3>`;
    if (!entries.length) return `<section class="card">${heading}<p class="card-subtitle">Unit names were unavailable in this log.</p></section>`;
    const total = sum(entries.map((entry) => entry[1]));
    const gradient = CORRELATION_LAYOUT_ACTIVE ? "" : `<div class="composition-bar">${entries.map(([name,count],index) => { const heat=heatColor(1-index/Math.max(1,entries.length-1)); const tooltip=`${prettyNpc(name)}: ${fmt(count)}`; return `<div class="composition-segment" style="width:${count/total*100}%;--segment:${heat.color}" data-tooltip="${h(tooltip)}">${count/total>.1 ? `${fmt(count/total*100)}%` : ""}</div>`; }).join("")}</div>`;
    return `<section class="card">${heading}<p class="card-subtitle">Share of locally parsed spawns by unit.</p>${gradient}<div class="composition-list">${entries.map(([name,count],index) => { const heat=heatColor(1-index/Math.max(1,entries.length-1)); return `<div class="composition-item" style="--segment:${heat.color}"><i></i><span data-tooltip="${h(name)}">${h(prettyNpc(name))}</span><strong>${fmt(count)}</strong></div>`; }).join("")}</div></section>`;
  }

  function prettyNpc(value) {
    return String(value).replace(/Agent$/," ").replace(/([a-z])([A-Z])/g,"$1 $2").trim();
  }

  function isExcludedCompositionAgent(value) {
    return String(value).replace(/[^a-z0-9]/gi, "").replace(/agent$/i, "").toLowerCase() === "summonmotorcycle";
  }

  function renderBottlenecks(run, phase) {
    const slow = [...phase.items].sort((a,b) => b.seconds-a.seconds).slice(0,5);
    const gaps = (run.longestSpawnGaps && run.longestSpawnGaps.length ? run.longestSpawnGaps : run.longestDroneGaps || []).slice(0,5);
    const weak = (run.dpmPerRotation || []).map((value,index) => ({ label:`Rot ${index+1}`, value })).sort((a,b)=>a.value-b.value).slice(0,5);
    const items = (list, formatter) => list.length ? list.map(formatter).join("") : `<div class="bottleneck-item"><span>Unavailable</span><span>—</span></div>`;
    return `<section class="card"><h3 class="card-title">Bottlenecks</h3><p class="card-subtitle">Where this run lost time. Gaps exclude parsed pause intervals.</p><div class="bottleneck-grid"><div class="bottleneck-column"><h4>Slowest ${h(phase.noun)}s</h4>${items(slow,(item)=>`<div class="bottleneck-item"><strong>${h(phase.defense?`Wave ${item.label}`:item.label)}</strong><span>${phaseDuration(item.seconds)}</span></div>`)}</div><div class="bottleneck-column"><h4>Longest spawn gaps</h4>${items(gaps,(item)=>`<div class="bottleneck-item"><strong>${fmt(item[0],1)}s</strong><span>at ${elapsedAt(run, item[1])}</span></div>`)}</div><div class="bottleneck-column"><h4>Weakest rotations</h4>${items(weak,(item)=>`<div class="bottleneck-item"><strong>${item.label}</strong><span>${fmt(item.value,1)} dpm</span></div>`)}</div></div></section>`;
  }

  function renderSpawnColumn(run) {
    const points = analyzerSpawnPoints(run);
    const total = sum(points.map((point)=>point.count));
    const median = [...points].map((point)=>point.count).sort((a,b)=>a-b)[Math.floor(points.length/2)] || 0;
    const topShare = total ? sum(points.slice(0,10).map((point)=>point.count))/total*100 : 0;
    const cold = points.filter((point)=>point.count<=2).length;
    return `<div class="kpi-grid">${kpi("Points fired",fmt(points.length),"Spawn points observed")}${kpi("Logged spawns",fmt(total),"Traced to a point")}${kpi("Busiest point",points[0]?`#${pointNumber(points[0])}`:"—",points[0]?`${fmt(points[0].count)} · ${fmt(points[0].count/total*100,1)}%`:"No point")}${kpi("Avg / point",fmt(total/Math.max(1,points.length),1),`median ${fmt(median)}`)}${kpi("Top 10 share",`${fmt(topShare)}%`,"of traced spawns")}${kpi("Cold points",fmt(cold),"fired ≤2 times")}</div>${renderMinimap(run,points)}${renderRankList(points,total)}${renderActivity(points)}`;
  }

  function analyzerSpawnPoints(run) {
    const floorConfig = (MINIMAPS[run.nodeKey] || [])
      .find((config) => config.floorFilter);
    const floorFilter = floorConfig?.floorFilter;
    let points = Object.values(run.spawnPoints || {})
      .filter((point) => point.count > 0);
    if (Number.isFinite(floorFilter?.minWave)) {
      points = points.map((point) => {
        const waveCounts = Object.fromEntries(Object.entries(point.waveCounts || {})
          .filter(([wave]) => Number(wave) >= floorFilter.minWave));
        return { ...point, waveCounts, count: sum(Object.values(waveCounts)) };
      }).filter((point) => point.count > 0);
      const aligned = SpawnAlignment.matchingSubset(points, floorConfig);
      points = aligned.matches.map(({ point }) => point);
    } else {
      points = points
      .filter((point) => {
        if (!floorFilter) return true;
        const y = Number(point.y);
        if (!Number.isFinite(y)) return false;
        if (Number.isFinite(floorFilter.minY) && y < floorFilter.minY) return false;
        if (Number.isFinite(floorFilter.maxY) && y > floorFilter.maxY) return false;
        return true;
      });
    }
    return points.sort((a,b) => b.count-a.count);
  }

  function renderMinimap(run, points) {
    const configs = MINIMAPS[run.nodeKey] || [];
    const coordinatePoints = points.filter((point)=>[point.x,point.y,point.z].every(Number.isFinite));
    const candidates = configs.map((config, index) => {
      // Procedural tiles renumber spawn IDs for each generated mission. Pass every
      // coordinate through so the position matcher can recover the layout.
      const result = SpawnAlignment.verifyDisplayPositions(coordinatePoints, config);
      const complete = coordinatePoints.length > 0 && result.matches.length === coordinatePoints.length;
      // A guarded procedural fallback returns every submitted point for
      // display, but `matchedCount` records how many points genuinely matched
      // this layout. Use that underlying evidence to break ties between
      // similar Defense variants instead of letting catalog order choose.
      const matchedCount = result.matchedCount ?? result.matches.length;
      const observedLevels = new Set([run.levelPath, ...(run.levelComponents || [])].filter(Boolean));
      const levelMatches = (config.levelPaths || []).filter((path) => observedLevels.has(path)).length;
      return { config, index, verified: result.matches, complete, score: (complete ? matchedCount : 0) + levelMatches * 100000 };
    }).sort((left, right) => right.score - left.score || left.index - right.index);
    const selected = candidates[0];
    const config = selected?.config;
    if (!config) return `<section class="card"><h3 class="card-title">Tile layout</h3><p class="card-subtitle">No tile layout is mapped to ${h(run.node)} yet.</p><div class="minimap-wrap"></div><div class="minimap-status"><i></i><span>Spawn dots are withheld until the matching layout is available.</span></div></section>`;
    const dimensions = config.width && config.height ? `viewBox="0 0 ${config.width} ${config.height}"` : "viewBox=\"0 0 100 100\"";
    let bubbles = "";
    const verified = selected?.verified || [];
    const exactTileMatch = Boolean(selected?.complete);
    const elevationBands = tileElevationBands(config);
    if (config.calibrated && exactTileMatch) {
      const max = Math.max(1,...verified.map(({point})=>point.count));
      const min = Math.min(max,...verified.map(({point})=>point.count));
      bubbles = verified.map(({point,position}) => {
        const [a,b,c,d,e,f] = config.matrix;
        const x = a*position[0]+b*position[2]+c, y=d*position[0]+e*position[2]+f;
        const radius = 8 + Math.sqrt(point.count/max)*13;
        const heat = spawnBubbleHeatColor(max === min ? .65 : (point.count - min) / (max - min));
        const elevationLevel = spawnElevationLevel(Number(position[1]), elevationBands);
        const elevationColor = SPAWN_ELEVATION_COLORS[elevationLevel];
        const spawnId = pointNumber(point);
        const tooltip = `${point.ident || point.key} · ${fmt(point.count)} spawns · elevation ${elevationLevel + 1}/5`;
        return `<circle class="spawn-bubble" data-spawn-id="${h(spawnId)}" data-tooltip="${h(tooltip)}" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${radius.toFixed(2)}" style="--bubble-fill:${heat.fill};--bubble-fill-compact:${heat.compactFill};--elevation-ring:${elevationColor}"></circle><text class="spawn-label" data-spawn-id="${h(spawnId)}" x="${x.toFixed(2)}" y="${y.toFixed(2)}">${h(spawnId)}</text>`;
      }).join("");
    }
    const subtitle = exactTileMatch
      ? `${config.floorFilter?.label === "bottom" ? "Bottom floor only. " : ""}Bubble size and heat = enemies produced.`
      : `Spawn overlay unavailable for this tile variation.`;
    const elevationLegend = exactTileMatch ? renderElevationLegend() : "";
    return `<section class="card"><h3 class="card-title">Tile layout</h3><p class="card-subtitle">${subtitle}</p><div class="minimap-wrap" role="button" tabindex="0" aria-label="Expand tile layout for ${h(config.label)}"><img src="${h(config.src)}" alt="Tile layout for ${h(config.label)}"><svg class="minimap-overlay" ${dimensions} preserveAspectRatio="xMidYMid meet">${bubbles}</svg></div>${elevationLegend}</section>`;
  }

  function pointNumber(point) {
    return (String(point.ident || point.key).match(/(\d+)(?!.*\d)/) || [,"?"])[1];
  }

  function renderRankList(points,total) {
    const top = points.slice(0,12);
    return `<section class="card"><h3 class="card-title">Most Active</h3><p class="card-subtitle">Enemies produced per point.</p><div class="rank-list">${top.map((point,index)=>{ const heat=heatColor(1-index/Math.max(1,top.length-1)); const spawnId=pointNumber(point); return `<div class="rank-row" data-spawn-id="${h(spawnId)}"><span>#${h(spawnId)}</span><div class="bar-track"><div class="bar-fill" style="--width:${point.count/top[0].count*100}%;--color:${heat.color}"></div></div><strong>${fmt(point.count)}</strong><em>${fmt(point.count/total*100,1)}%</em></div>`; }).join("")}</div>${points.length>top.length?`<p class="card-subtitle">+${points.length-top.length} more sharing ${fmt(sum(points.slice(top.length).map((point)=>point.count))/total*100)}%</p>`:""}</section>`;
  }

  function renderActivity(points) {
    const top = points.slice(0,14);
    const waves = Math.max(1,...top.flatMap((point)=>Object.keys(point.waveCounts||{}).map(Number).filter(Number.isFinite)));
    const max = Math.max(1,...top.flatMap((point)=>Object.values(point.waveCounts||{}).map(Number)));
    let content = "";
    top.forEach((point)=>{
      content += `<span class="activity-row-label">#${h(pointNumber(point))}</span>`;
      for(let wave=1;wave<=waves;wave+=1){ const value=Number((point.waveCounts||{})[wave]||0); const tooltip=`#${pointNumber(point)} · wave ${wave} · ${fmt(value)}`; content += `<i class="activity-cell" style="--heat:${activityHeatColor(value/max)}" data-tooltip="${h(tooltip)}"></i>`; }
    });
    const tickStep = Math.max(1, Math.floor((waves - 1) / 11));
    content += `<span class="activity-row-label" aria-hidden="true"></span>`;
    for (let wave=1; wave<=waves; wave+=1) {
      const label = (wave - 1) % tickStep === 0 ? `W${wave}` : "";
      content += `<span class="activity-axis-label">${label}</span>`;
    }
    const compact = waves < 36;
    const columns = compact ? `40px repeat(${waves},12px)` : `40px repeat(${waves},minmax(0,1fr))`;
    const rows = `repeat(${top.length},12px) 18px`;
    return `<section class="card activity-card"><h3 class="card-title">Activity over time</h3><p class="card-subtitle">Rows are spawn points, columns are waves. Greener = more enemies from that point.</p><div class="activity-scroll"><div class="activity-grid${compact ? " is-compact" : ""}" style="grid-template-columns:${columns};grid-template-rows:${rows}">${content}</div></div></section>`;
  }

  function initialRunIndex(runs) {
    for (let index = runs.length - 1; index >= 0; index -= 1) {
      if (Number(runs[index]?.totalDuration) > INITIAL_RUN_MIN_SECONDS) return index;
    }
    return Math.max(0, runs.length - 1);
  }

  async function prepareRuns(runs, sourceName, sourceDate) {
    for (const run of runs) {
      run.sourceName = sourceName;
      run.sourceDate = run.sourceDate || sourceDate;
      run.actualVitus = "";
      try { run.shortId = (await Parser.fingerprintRun(run)).slice(0,12); } catch (_) { run.shortId = "local"; }
    }
    state.runs = runs;
    state.activeIndex = initialRunIndex(runs);
    state.sourceName = sourceName;
    renderRunList();
    renderReport(state.runs[state.activeIndex]);
    focusActualVitusEntry();
  }

  function clearRuns() {
    state.runs = [];
    state.activeIndex = 0;
    state.query = "";
    state.sourceName = "";
    $("#runSearch").value = "";
    $("#mobileRunSearch").value = "";
    $("#logFileInput").value = "";
    $("#parseStatus").className = "parse-status";
    $("#parseStatus").textContent = "";
    $("#mobileSearchBar").hidden = true;
    document.body.classList.remove("mobile-search-active", "sidebar-open");
    closeMinimapLightbox();
    renderRunList();
    renderReport(null);
    showToast("Analyzer cleared.");
  }

  function renderRunList() {
    const query = state.query.trim().toLocaleLowerCase();
    const visible = state.runs.map((run,index)=>({run,index})).filter(({run})=>!query || `${run.node} ${run.planet} ${run.missionType} ${run.tileset}`.toLocaleLowerCase().includes(query));
    $("#runCount").textContent = visible.length;
    const queryCount = query ? `${visible.length}/${state.runs.length}` : "";
    $("#searchCount").textContent = queryCount;
    $("#mobileSearchCount").textContent = queryCount;
    $("#clearRunsBtn").disabled = !state.runs.length;
    $("#runList").innerHTML = visible.length ? visible.map(({run,index})=>`<button class="run-button ${index===state.activeIndex?"active":""}" type="button" data-index="${index}"><span class="run-accent"></span><span class="run-copy"><strong>${h(run.node)}</strong><span>${h(run.missionType)} · ${h(run.planet)}</span></span><span class="run-meta"><strong class="${Number(run.totalDuration) < INITIAL_RUN_MIN_SECONDS ? "short-run-duration" : ""}">${duration(run.totalDuration)}</strong>${fmt(run.droneKills)} drones</span></button>`).join("") : `<div class="no-runs">${state.runs.length ? "No matching runs." : "No analyzed runs."}</div>`;
    $$(".run-button",$("#runList")).forEach((button)=>button.addEventListener("click",()=>{
      state.activeIndex=Number(button.dataset.index); renderRunList(); renderReport(state.runs[state.activeIndex]); focusActualVitusEntry(); document.body.classList.remove("sidebar-open");
    }));
  }

  async function importFile(file, settleFocus = false) {
    if (!file) return;
    const status=$("#parseStatus");
    status.className="parse-status"; status.textContent=`Reading ${file.name} locally…`;
    try {
      const runs=await Parser.parseFile(file,(progress)=>{status.textContent=`Parsing locally… ${Math.round(progress*100)}%`;});
      if(!runs.length) throw new Error("No complete Arbitration runs were found. The local parser requires at least 5 drones or 40 enemy spawns per run.");
      await prepareRuns(runs,file.name,new Date(file.lastModified));
      status.className="parse-status success"; status.textContent=`${runs.length} run${runs.length===1?"":"s"} parsed.`;
      showToast(`Loaded ${runs.length} local run${runs.length===1?"":"s"}.`);
      void reportSpawnMetrics(runs);
      if (settleFocus) focusActualVitusEntry(true);
    } catch(error) {
      status.className="parse-status error"; status.textContent=error.message||String(error); showToast(status.textContent,true);
    } finally { $("#logFileInput").value=""; }
  }

  async function reportSpawnMetrics(runs) {
    try {
      await SpawnSubmission.submitRuns(runs, Parser.buildContribution);
    } catch {
      // Spawn contributions are best-effort and intentionally silent in the UI.
    }
  }

  function correlationPhaseBuckets(times, phases, run) {
    const buckets = phases.map(() => []);
    let phaseIndex = 0;
    (times || []).forEach((timestamp) => {
      if ((run?.pauseIntervals || []).some((pause) => timestamp >= pause[0] && timestamp <= pause[1])) return;
      while (phaseIndex < phases.length && timestamp > phases[phaseIndex].to) phaseIndex += 1;
      if (phaseIndex >= phases.length) return;
      const phase = phases[phaseIndex];
      if (timestamp >= phase.from && timestamp <= phase.to) buckets[phaseIndex].push(timestamp);
    });
    return buckets;
  }

  function correlationTimestampAtActiveElapsed(run, activeElapsed) {
    const start = Number(run.startTime || 0);
    const end = Number(run.endTime || start);
    let timestamp = start + Math.max(0, Number(activeElapsed || 0));
    const pauses = (run.pauseIntervals || [])
      .filter((pause) => Array.isArray(pause) && Number.isFinite(pause[0]) && Number.isFinite(pause[1]))
      .slice()
      .sort((left, right) => left[0] - right[0]);
    pauses.forEach((pause) => {
      const pauseFrom = Math.max(start, pause[0]);
      const pauseTo = Math.min(end, pause[1]);
      if (pauseTo > pauseFrom && pauseFrom < timestamp) timestamp += pauseTo - pauseFrom;
    });
    return Math.min(end, timestamp);
  }

  function correlationFixedActivePhases(run, windowSeconds = 6 * 60) {
    return Parser.helpers.calculateFixedDpmWindows(run, windowSeconds).map((window, index) => ({
      label: index + 1,
      axisLabel: String(Math.round(window.to / 60)),
      from: correlationTimestampAtActiveElapsed(run, window.from),
      to: correlationTimestampAtActiveElapsed(run, window.to),
      seconds: window.seconds,
    }));
  }

  function correlationPauseSeconds(run, from, to) {
    return (run.pauseIntervals || []).reduce((total, pause) => {
      const overlap = Math.max(0, Math.min(to, pause[1]) - Math.max(from, pause[0]));
      return total + overlap;
    }, 0);
  }

  function correlationDryPercent(run, droneTimes) {
    let total = 0;
    let dry = 0;
    for (let index = 1; index < droneTimes.length; index += 1) {
      const from = droneTimes[index - 1];
      const to = droneTimes[index];
      const gap = to - from - correlationPauseSeconds(run, from, to);
      if (gap <= 0) continue;
      total += gap;
      if (gap >= 12) dry += gap;
    }
    return total ? dry / total * 100 : 0;
  }

  function correlationPeak(droneTimes, windowSeconds = 10) {
    let left = 0;
    let peak = 0;
    for (let right = 0; right < droneTimes.length; right += 1) {
      while (droneTimes[right] - droneTimes[left] > windowSeconds) left += 1;
      peak = Math.max(peak, right - left + 1);
    }
    return peak;
  }

  function standardizeCorrelationValues(values) {
    const finite = values.filter(Number.isFinite);
    const mean = avg(finite);
    const deviation = finite.length
      ? Math.sqrt(avg(finite.map((value) => (value - mean) ** 2)))
      : 0;
    return values.map((value) => Number.isFinite(value)
      ? (deviation > .000001 ? (value - mean) / deviation : 0)
      : null);
  }

  function buildCorrelationMetrics(run) {
    const fixedIntervals = run.missionType === "DISRUPTION";
    const phaseNoun = fixedIntervals ? "6-minute interval" : "Rotation";
    const axisPrefix = fixedIntervals ? "I" : "R";
    const phases = fixedIntervals
      ? correlationFixedActivePhases(run)
      : Parser.helpers.calculateRotationPhases(run);
    const blessingExpiry = Number.isFinite(run.resourceBlessingExpiryElapsed)
      && Number.isFinite(run.resourceBlessingExpiresAt)
      ? { timestamp: run.resourceBlessingExpiresAt, elapsed: run.resourceBlessingExpiryElapsed }
      : null;
    if (!phases.length) return { phases: [], metrics: [], phaseNoun, axisPrefix, fixedIntervals, blessingExpiry };
    const dronesByPhase = correlationPhaseBuckets(run.droneTimestamps, phases, run);
    const enemiesByPhase = correlationPhaseBuckets(run.enemyTimestamps, phases, run);
    const threshold = ["SURVIVAL", "DISRUPTION"].includes(run.missionType) ? 30 : 15;
    const droneValues = dronesByPhase.map((times) => times.length);
    const enemyValues = enemiesByPhase.map((times) => times.length);
    const definitions = [
      { id: "drones", name: "Drones", color: "#32d583", dash: "9 5", values: droneValues, digits: 0, avgDigits: 1 },
      { id: "spawns", name: "Spawns", color: "#ff5a5f", dash: "4 4", values: enemyValues, digits: 0, avgDigits: 1 },
      { id: "time", name: "Time", color: "#55a7ff", dash: "11 4 2 4", values: phases.map((phase) => phase.seconds), format: phaseDuration, averageFormat: shortDuration },
      { id: "saturation", name: "Saturation", color: "#a879ff", dash: "", values: phases.map((phase) => Parser.helpers.calculateRangeSaturation(run, phase.from, phase.to, threshold)), suffix: "%", digits: 1, avgDigits: 1 },
      { id: "dry", name: "Dry ≥12s", color: "#ff9f1c", dash: "12 4", values: dronesByPhase.map((times) => correlationDryPercent(run, times)), suffix: "%", digits: 1, avgDigits: 1 },
      { id: "occupancy", name: "Enemy occupancy", color: "#2dd4bf", dash: "2 2", values: phases.map((phase) => Parser.helpers.calculateRangeOccupancy(run, phase.from, phase.to)), suffix: "%", digits: 1, avgDigits: 1 },
      { id: "enemiesPerDrone", name: "Enemies / drone", color: "#f472b6", dash: "8 3 2 3", values: enemyValues.map((count, index) => droneValues[index] ? count / droneValues[index] : null), digits: 2, avgDigits: 2 },
      { id: "peak", name: "Peak / 10s", color: "#facc15", dash: "1 5", values: dronesByPhase.map((times) => correlationPeak(times)), digits: 0, avgDigits: 1 },
    ];
    const metrics = definitions.map((metric) => {
      const finite = metric.values.filter(Number.isFinite);
      return {
        ...metric,
        average: finite.length ? avg(finite) : null,
        normalized: standardizeCorrelationValues(metric.values),
      };
    });
    return { phases, metrics, phaseNoun, axisPrefix, fixedIntervals, blessingExpiry };
  }

  function correlationMetricValue(metric, value, average = false) {
    if (!Number.isFinite(value)) return "—";
    if (average && metric.averageFormat) return metric.averageFormat(value);
    if (!average && metric.format) return metric.format(value);
    const digits = average ? (metric.avgDigits ?? metric.digits ?? 1) : (metric.digits ?? 1);
    return `${fmt(value, digits)}${metric.suffix || ""}`;
  }

  function correlationLinePath(metric, x, y) {
    let path = "";
    let drawing = false;
    metric.normalized.forEach((value, index) => {
      if (!Number.isFinite(value)) {
        drawing = false;
        return;
      }
      path += `${drawing ? "L" : "M"}${x(index).toFixed(2)},${y(clamp(value, -2, 3)).toFixed(2)} `;
      drawing = true;
    });
    return path.trim();
  }

  function correlationTimestampPosition(timestamp, phases) {
    if (!Number.isFinite(timestamp) || !phases.length) return null;
    if (phases.length === 1) return 0;
    const anchors = phases.map((phase) => (phase.from + phase.to) / 2);
    if (timestamp <= anchors[0]) return 0;
    for (let index = 1; index < anchors.length; index += 1) {
      if (timestamp > anchors[index]) continue;
      const span = Math.max(.001, anchors[index] - anchors[index - 1]);
      return index - 1 + (timestamp - anchors[index - 1]) / span;
    }
    return phases.length - 1;
  }

  function renderCorrelationCard(data) {
    const phaseNoun = data.phaseNoun || "Rotation";
    const axisPrefix = data.axisPrefix || "R";
    const title = data.fixedIntervals ? "6-minute interval correlation" : "Rotation correlation";
    const subtitle = data.fixedIntervals
      ? "Each line shows deviation across fixed six-minute active-time intervals. Select legend items to show or hide metrics."
      : "Each line shows deviation from its own run average. Select legend items to show or hide metrics.";
    if (!data.phases.length) return `<section class="card correlation-card"><h3 class="card-title">${title}</h3><p class="card-subtitle">No complete ${phaseNoun.toLocaleLowerCase()} data found.</p></section>`;
    const width = 1040;
    const height = 330;
    const pad = { left: 42, right: 20, top: 15, bottom: 32 };
    const plotWidth = width - pad.left - pad.right;
    const plotHeight = height - pad.top - pad.bottom;
    const x = (index) => data.phases.length === 1
      ? pad.left + plotWidth / 2
      : pad.left + index / (data.phases.length - 1) * plotWidth;
    const y = (value) => pad.top + (3 - value) / 5 * plotHeight;
    const yTicks = [-2, -1, 0, 1, 2, 3];
    const grid = yTicks.map((tick) => `<line x1="${pad.left}" y1="${y(tick)}" x2="${width - pad.right}" y2="${y(tick)}"></line><text x="${pad.left - 8}" y="${y(tick) + 4}" text-anchor="end">${tick > 0 ? "+" : ""}${tick}σ</text>`).join("");
    const tickStep = Math.max(1, Math.ceil(data.phases.length / 10));
    const xLabels = data.phases.map((phase, index) => ((index % tickStep === 0 || index === data.phases.length - 1)
      ? `<text x="${x(index)}" y="${height - 7}" text-anchor="middle">${data.fixedIntervals ? h(phase.axisLabel) : `${axisPrefix}${index + 1}`}</text>`
      : "")).join("");
    const series = data.metrics.map((metric) => {
      const visible = state.correlationVisibility[metric.id] !== false;
      const circles = metric.normalized.map((value, index) => Number.isFinite(value)
        ? `<circle data-correlation-index="${index}" cx="${x(index).toFixed(2)}" cy="${y(clamp(value, -2, 3)).toFixed(2)}" r="2.5"></circle>`
        : "").join("");
      return `<g class="correlation-series" data-correlation-series="${metric.id}"${visible ? "" : " hidden"} style="--series:${metric.color}"><path d="${correlationLinePath(metric, x, y)}"${metric.dash ? ` stroke-dasharray="${metric.dash}"` : ""}></path>${circles}</g>`;
    }).join("");
    const blessingPosition = data.blessingExpiry
      ? correlationTimestampPosition(data.blessingExpiry.timestamp, data.phases)
      : null;
    const blessingX = Number.isFinite(blessingPosition)
      ? pad.left + blessingPosition / Math.max(1, data.phases.length - 1) * plotWidth
      : null;
    const blessingLine = Number.isFinite(blessingX)
      ? `<line class="correlation-blessing-expiry" x1="${blessingX.toFixed(2)}" y1="${pad.top}" x2="${blessingX.toFixed(2)}" y2="${height - pad.bottom}"></line>`
      : "";
    const blessingLabel = data.blessingExpiry
      ? `<span class="correlation-blessing-expiry-label">Blessing ran out at: ${h(duration(data.blessingExpiry.elapsed))}</span>`
      : "";
    const hitWidth = plotWidth / Math.max(1, data.phases.length);
    const hits = data.phases.map((_, index) => `<rect class="correlation-hit" data-correlation-index="${index}" data-correlation-x="${x(index).toFixed(2)}" x="${(x(index) - hitWidth / 2).toFixed(2)}" y="${pad.top}" width="${Math.max(4, hitWidth).toFixed(2)}" height="${plotHeight}"></rect>`).join("");
    const legend = data.metrics.map((metric) => {
      const visible = state.correlationVisibility[metric.id] !== false;
      return `<button class="correlation-legend-item" type="button" data-correlation-toggle="${metric.id}" aria-pressed="${visible}" style="--series:${metric.color}"><i></i><span>${h(metric.name)}</span><em>AVG ${h(correlationMetricValue(metric, metric.average, true))}</em></button>`;
    }).join("");
    return `<section class="card correlation-card"><h3 class="card-title">${title}</h3>${blessingLabel}<p class="card-subtitle">${subtitle}</p><div class="correlation-tooltip-stage"><div class="correlation-tooltip" role="status" hidden data-html2canvas-ignore="true"></div></div><div class="correlation-chart-wrap"><svg class="correlation-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" aria-label="Per-${h(phaseNoun.toLocaleLowerCase())} metric correlation chart"><g class="correlation-grid">${grid}</g><line class="correlation-average" x1="${pad.left}" y1="${y(0)}" x2="${width - pad.right}" y2="${y(0)}"></line>${series}${blessingLine}<line class="correlation-hover-guide" x1="0" y1="${pad.top}" x2="0" y2="${height - pad.bottom}" hidden></line><g class="correlation-axis">${xLabels}</g><g class="correlation-hits">${hits}</g></svg></div><div class="correlation-legend">${legend}</div></section>`;
  }

  function setCorrelationSeriesVisibility(card, id, visible) {
    state.correlationVisibility[id] = visible;
    saveCorrelationVisibility();
    const series = card.querySelector(`[data-correlation-series="${id}"]`);
    const toggle = card.querySelector(`[data-correlation-toggle="${id}"]`);
    if (series) series.toggleAttribute("hidden", !visible);
    if (toggle) toggle.setAttribute("aria-pressed", String(visible));
  }

  function setupCorrelationInteractions(root) {
    const card = root.querySelector(".correlation-card");
    const data = card?._correlationData;
    if (!card || !data?.phases?.length) return;
    card.querySelectorAll("[data-correlation-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.correlationToggle;
        setCorrelationSeriesVisibility(card, id, button.getAttribute("aria-pressed") !== "true");
      });
    });
    const tooltip = card.querySelector(".correlation-tooltip");
    const guide = card.querySelector(".correlation-hover-guide");
    const clearActive = () => card.querySelectorAll(".correlation-series circle.is-active").forEach((circle) => circle.classList.remove("is-active"));
    const hideTooltip = () => {
      tooltip.hidden = true;
      guide.hidden = true;
      clearActive();
    };
    card.querySelectorAll(".correlation-hit").forEach((hit) => {
      const showTooltip = () => {
        const index = Number(hit.dataset.correlationIndex);
        const phaseHeading = data.fixedIntervals
          ? `${data.phases[index].axisLabel} minutes`
          : `${data.phaseNoun || "Rotation"} ${index + 1}`;
        clearActive();
        card.querySelectorAll(`.correlation-series:not([hidden]) circle[data-correlation-index="${index}"]`).forEach((circle) => circle.classList.add("is-active"));
        tooltip.innerHTML = `<strong>${h(phaseHeading)}</strong>${data.metrics.map((metric) => `<span><i style="--series:${metric.color}"></i><em>${h(metric.name)}</em><b>${h(correlationMetricValue(metric, metric.values[index]))}</b></span>`).join("")}`;
        tooltip.hidden = false;
        guide.setAttribute("x1", hit.dataset.correlationX);
        guide.setAttribute("x2", hit.dataset.correlationX);
        guide.hidden = false;
      };
      hit.addEventListener("pointerenter", showTooltip);
      hit.addEventListener("pointermove", showTooltip);
      hit.addEventListener("pointerleave", hideTooltip);
    });
  }

  function elementFromMarkup(markup) {
    const template = document.createElement("template");
    template.innerHTML = markup.trim();
    return template.content.firstElementChild;
  }

  function syncCorrelationDefenseTileHeight(grid) {
    const clearMap = grid.querySelector(":scope > .correlation-test-clear-map");
    const minimap = grid.querySelector(".correlation-test-minimap");
    if (!clearMap || !minimap) return;
    const canStretchMinimap = grid.classList.contains("correlation-test-defense-102");
    minimap.style.height = "";
    clearMap.style.height = "";
    const clearMapRect = clearMap.getBoundingClientRect();
    const minimapRect = minimap.getBoundingClientRect();
    const scale = minimap.offsetWidth > 0 ? minimapRect.width / minimap.offsetWidth : 1;
    const safeScale = Math.max(scale, 0.001);
    if (canStretchMinimap && clearMapRect.bottom > minimapRect.bottom) {
      const targetHeight = Math.ceil((clearMapRect.bottom - minimapRect.top) / safeScale);
      if (targetHeight > minimap.offsetHeight) minimap.style.height = `${targetHeight}px`;
    } else if (minimapRect.bottom > clearMapRect.bottom) {
      const targetHeight = Math.ceil((minimapRect.bottom - clearMapRect.top) / safeScale);
      if (targetHeight > clearMap.offsetHeight) clearMap.style.height = `${targetHeight}px`;
    }
  }

  function scheduleCorrelationDefenseLayout(grid) {
    cancelAnimationFrame(correlationLayoutFrame);
    correlationLayoutFrame = requestAnimationFrame(() => {
      if (!grid.isConnected) return;
      syncCorrelationDefenseTileHeight(grid);
      scheduleReportFit();
    });
  }

  function observeCorrelationDefenseLayout(grid) {
    correlationLayoutResizeObserver?.disconnect();
    correlationLayoutResizeObserver = null;
    const clearMap = grid.querySelector(":scope > .correlation-test-clear-map");
    const minimap = grid.querySelector(".correlation-test-minimap");
    if (!clearMap || !minimap) return;
    if (typeof ResizeObserver !== "undefined") {
      correlationLayoutResizeObserver = new ResizeObserver(() => scheduleCorrelationDefenseLayout(grid));
      correlationLayoutResizeObserver.observe(clearMap);
      correlationLayoutResizeObserver.observe(minimap);
    }
    minimap.querySelectorAll("img").forEach((image) => {
      if (!image.complete) image.addEventListener("load", () => scheduleCorrelationDefenseLayout(grid), { once: true });
    });
    scheduleCorrelationDefenseLayout(grid);
  }

  function prepareCorrelationLayout(report, run) {
    const grid = report.querySelector(".report-grid");
    const left = grid?.querySelector(":scope > .left-column");
    const center = grid?.querySelector(":scope > .center-column");
    const right = grid?.querySelector(":scope > .right-column");
    if (!grid || !left || !center || grid.classList.contains("correlation-test-layout")) return;
    correlationLayoutResizeObserver?.disconnect();
    correlationLayoutResizeObserver = null;
    const [coreKpis, vitus, saturation, composition] = [...left.children];
    const [clearMap, , , cadence] = [...center.children];
    const defenseWaveCount = run.missionType === "DEFENSE"
      ? clearMap.querySelectorAll(".heat-cell").length
      : 0;
    const rightChildren = right ? [...right.children] : [];
    const minimap = rightChildren[1] || (run.missionType === "DEFENSE"
      ? elementFromMarkup(renderMinimap(run, analyzerSpawnPoints(run)))
      : null);
    const correlationData = buildCorrelationMetrics(run);
    const correlation = elementFromMarkup(renderCorrelationCard(correlationData));
    correlation._correlationData = correlationData;

    cadence.classList.add("correlation-test-cadence");
    composition.classList.add("correlation-test-composition");
    saturation.classList.add("correlation-test-saturation");
    clearMap.classList.add("correlation-test-clear-map");
    if (defenseWaveCount > 125) clearMap.classList.add("correlation-test-clear-map-dense");
    if (minimap) minimap.classList.add("correlation-test-minimap");

    left.replaceChildren(coreKpis, vitus, cadence);
    const middle = document.createElement("div");
    middle.className = "correlation-test-detail-column";
    middle.append(saturation);
    const detail = document.createElement("div");
    detail.className = "correlation-test-details";
    const detailRight = document.createElement("div");
    detailRight.className = "correlation-test-detail-column correlation-test-detail-right";
    detailRight.append(composition);
    if (run.missionType === "DEFENSE") {
      if (minimap) detailRight.append(minimap);
    } else {
      detailRight.append(clearMap);
    }
    detail.append(middle, detailRight);
    const workspace = document.createElement("div");
    workspace.className = "correlation-test-workspace";
    workspace.append(correlation, detail);

    const finalChildren = [left, workspace];
    if (run.missionType === "DEFENSE") finalChildren.push(clearMap);
    grid.replaceChildren(...finalChildren);
    grid.className = `report-grid correlation-test-layout ${run.missionType === "DEFENSE" ? "correlation-test-defense" : "correlation-test-non-defense"}`;
    if (run.missionType === "DEFENSE") {
      if (defenseWaveCount === 102) grid.classList.add("correlation-test-defense-102");
      observeCorrelationDefenseLayout(grid);
    }
  }

  function prepareDashboardLayout(report, run) {
    const grid = report.querySelector(".report-grid");
    const left = grid?.querySelector(":scope > .left-column");
    const center = grid?.querySelector(":scope > .center-column");
    const right = grid?.querySelector(":scope > .right-column");
    if (!grid || !left || !center || grid.classList.contains("dashboard-layout")) return;

    const [coreKpis, vitus, saturation, composition] = [...left.children];
    const [clearMap, performanceCharts, bottlenecks, cadence] = [...center.children];
    const [dpm, perRotation] = [...performanceCharts.children];

    if (run?.missionType === "DEFENSE") grid.classList.add("dashboard-defense");

    composition.classList.add("dashboard-composition-card");
    clearMap.classList.add("dashboard-clear-map-card");
    cadence.classList.add("dashboard-cadence-card");
    left.replaceChildren(coreKpis, vitus, bottlenecks, composition);
    perRotation.classList.add("dashboard-per-rotation");
    dpm.classList.add("dashboard-dpm");
    center.replaceChildren(perRotation, saturation, dpm);

    if (!right) {
      left.replaceChildren(coreKpis, vitus, composition);
      const interceptionColumn = document.createElement("div");
      interceptionColumn.className = "column right-column dashboard-interception-column";
      interceptionColumn.append(clearMap, bottlenecks, cadence);
      grid.replaceChildren(left, center, interceptionColumn);
      grid.classList.add("dashboard-layout", "dashboard-no-spawns");
      return;
    }

    const [spawnKpis, minimap, busiest, activity] = [...right.children];
    minimap.classList.add("dashboard-minimap-card");
    busiest.classList.add("dashboard-busiest-card");

    const spawnDetail = document.createElement("div");
    spawnDetail.className = "dashboard-spawn-detail";
    spawnDetail.append(minimap, busiest);
    right.replaceChildren(spawnKpis, spawnDetail, cadence);

    const workspaceTop = document.createElement("div");
    workspaceTop.className = "dashboard-workspace-top";
    workspaceTop.append(center, right);

    const workspace = document.createElement("div");
    workspace.className = "dashboard-workspace";
    workspace.append(workspaceTop, clearMap);

    grid.replaceChildren(left, workspace, activity);
    grid.classList.add("dashboard-layout");
  }

  function syncDashboardClearMapLayout(report) {
    const grid = report?.querySelector(".report-grid.dashboard-layout:not(.dashboard-no-spawns)");
    const composition = grid?.querySelector(".dashboard-composition-card");
    const compositionContent = composition?.querySelector(".composition-list");
    const workspace = grid?.querySelector(".dashboard-workspace");
    const workspaceTop = workspace?.querySelector(":scope > .dashboard-workspace-top");
    const clearMap = grid?.querySelector(".dashboard-clear-map-card");
    const activity = grid?.querySelector(":scope > .activity-card");
    if (!grid || !compositionContent || !workspace || !workspaceTop || !clearMap || !activity) return;

    const reportWidth = report.getBoundingClientRect().width;
    const scale = report.offsetWidth ? reportWidth / report.offsetWidth : 1;
    const gap = parseFloat(getComputedStyle(workspace).rowGap) || 0;
    const compositionContentBottom = compositionContent.getBoundingClientRect().bottom;
    const clearMapTop = clearMap.parentElement === workspace
      ? clearMap.getBoundingClientRect().top
      : workspaceTop.getBoundingClientRect().bottom + gap * scale;
    const shouldSpanReport = compositionContentBottom < clearMapTop - Math.max(.5, scale);
    const spansReport = clearMap.parentElement === grid;

    if (shouldSpanReport === spansReport) return;
    clearMap.classList.toggle("dashboard-clear-map-full", shouldSpanReport);
    if (shouldSpanReport) grid.insertBefore(clearMap, activity);
    else workspace.append(clearMap);
  }

  async function copyReportImage() {
    const button = $("#copyImageBtn");
    const sourceReport = $("#reportRoot");
    let stage = null;
    button.disabled = true;
    button.textContent = "COPYING IMAGE…";
    try {
      if (typeof globalThis.html2canvas !== "function") throw new Error("The image renderer did not load.");
      if (!globalThis.ClipboardItem || !navigator.clipboard?.write) throw new Error("Image clipboard access is unavailable in this browser.");

      stage = document.createElement("div");
      stage.className = "export-stage";
      stage.setAttribute("aria-hidden", "true");
      const report = sourceReport.cloneNode(true);
      report.removeAttribute("id");
      report.style.removeProperty("transform");
      report.style.removeProperty("margin-left");
      report.querySelector(".report-actions")?.remove();
      prepareDashboardLayout(report);
      report.querySelectorAll("input").forEach((input) => {
        const value = document.createElement("strong");
        value.className = input.className;
        value.textContent = input.value;
        input.replaceWith(value);
      });
      stage.append(report);
      document.body.append(stage);
      stabilizeExportWhitespace(stage);
      await inlineImagesForExport(stage);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const correlationGrid = report.querySelector(".correlation-test-layout.correlation-test-defense");
      if (correlationGrid) syncCorrelationDefenseTileHeight(correlationGrid);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      syncReportHeaderAccent(report);

      const canvas = await html2canvas(stage, {
        scale: 2,
        backgroundColor: "#0b0d10",
        logging: false,
        useCORS: true,
        allowTaint: false,
        imageTimeout: 15000,
        width: stage.scrollWidth,
        height: stage.scrollHeight,
        windowWidth: 2022,
        windowHeight: Math.max(stage.scrollHeight, 1080),
      });
      const blob = await new Promise((resolve, reject) => canvas.toBlob(
        (result) => result ? resolve(result) : reject(new Error("The report image could not be encoded.")),
        "image/png",
      ));
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      showToast("Run image copied to the clipboard.", false, true);
    } catch (error) {
      showToast(`Clipboard copy failed: ${error.message || error}`, true);
    } finally {
      stage?.remove();
      button.disabled = false;
      button.innerHTML = `<svg width="17" height="17"><use href="#icon-copy"></use></svg> COPY RUN IMAGE`;
    }
  }

  function stabilizeExportWhitespace(root) {
    const walker = document.createTreeWalker(root, 4);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach((node) => {
      const value = node.nodeValue || "";
      const parent = node.parentElement;
      if (!parent || !/\S/.test(value) || parent.closest("script, style, textarea, pre, code")) return;
      node.nodeValue = exportSafeWhitespace(value);
    });
  }

  function exportSafeWhitespace(value) {
    return String(value).replace(/[ \t]+/g, (spaces) => "\u00a0".repeat(spaces.length));
  }

  async function inlineImagesForExport(root) {
    await Promise.all($$("img", root).map(async (img) => {
      const source = img.currentSrc || img.src || img.getAttribute("src");
      if (!source) throw new Error("A report image has no source.");
      let failure = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const response = await fetch(source, {
            cache: attempt === 0 ? "default" : "reload",
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const blob = await response.blob();
          if (!blob.size || !blob.type.startsWith("image/")) {
            throw new Error("the response was not an image");
          }
          img.removeAttribute("srcset");
          img.src = await blobDataUrl(blob);
          await img.decode();
          if (!img.naturalWidth || !img.naturalHeight) {
            throw new Error("the browser decoded an empty image");
          }
          return;
        } catch (error) {
          failure = error;
          if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
          }
        }
      }
      throw new Error(`The tile image could not be embedded: ${failure?.message || failure}`);
    }));
  }

  function blobDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(reader.result), { once: true });
      reader.addEventListener("error", () => reject(reader.error || new Error("Image embedding failed.")), { once: true });
      reader.readAsDataURL(blob);
    });
  }

  function showToast(message,error=false,attention=false){const toast=$("#toast");clearTimeout(state.toastTimer);toast.textContent=message;toast.className=`toast visible${error?" error":""}${attention?" attention":""}`;state.toastTimer=setTimeout(()=>toast.className="toast",5000);}

  function setRunQuery(value) {
    state.query = value;
    $("#runSearch").value = value;
    $("#mobileRunSearch").value = value;
    renderRunList();
  }

  function moveRunSelection(direction) {
    const query = state.query.trim().toLocaleLowerCase();
    const matches = state.runs.map((run,index)=>({run,index})).filter(({run})=>!query || `${run.node} ${run.planet} ${run.missionType} ${run.tileset}`.toLocaleLowerCase().includes(query));
    if (!matches.length) return;
    const current = matches.findIndex(({index}) => index === state.activeIndex);
    const next = matches[(current + direction + matches.length) % matches.length];
    state.activeIndex = next.index;
    renderRunList();
    renderReport(next.run);
    focusActualVitusEntry();
  }

  function applyDisplayControls() {
    const root = document.documentElement;
    root.style.setProperty("--report-scale", String(1 + state.fontStep * .05));
    root.style.setProperty("--report-gap", `${16 + state.spacingStep * 2}px`);
    scheduleReportFit();
  }

  function changeDisplay(key, delta) {
    state[key] = clamp(state[key] + delta, -3, 4);
    applyDisplayControls();
  }

  let lastMinimapTrigger = null;

  function openMinimapLightbox(trigger) {
    const lightbox = $("#minimapLightbox");
    const body = $("#minimapLightboxBody");
    const copy = trigger.cloneNode(true);
    copy.classList.add("minimap-lightbox-content");
    copy.removeAttribute("role");
    copy.removeAttribute("tabindex");
    copy.removeAttribute("aria-label");
    lastMinimapTrigger = trigger;
    body.replaceChildren(copy);
    lightbox.hidden = false;
    document.body.classList.add("minimap-lightbox-open");
  }

  function closeMinimapLightbox() {
    const lightbox = $("#minimapLightbox");
    if (lightbox.hidden) return;
    lightbox.hidden = true;
    $("#minimapLightboxBody").replaceChildren();
    document.body.classList.remove("minimap-lightbox-open");
    lastMinimapTrigger?.focus({ preventScroll: true });
    lastMinimapTrigger = null;
  }

  function setSpawnBubbleHighlight(spawnId, active) {
    const matches = $$(".spawn-bubble[data-spawn-id], .spawn-label[data-spawn-id]", $("#reportRoot"))
      .filter((marker) => marker.dataset.spawnId === spawnId);
    matches.forEach((marker) => marker.classList.toggle("is-rank-highlighted", active));
    if (active) {
      matches.filter((marker) => marker.classList.contains("spawn-bubble")).forEach((bubble) => bubble.parentNode.append(bubble));
      matches.filter((marker) => marker.classList.contains("spawn-label")).forEach((label) => label.parentNode.append(label));
    }
  }

  function startParticles() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = $("#particleField");
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const particleCount = 48;
    const maxDistance = 155;
    const contentGap = 20;
    let cssWidth = 0;
    let cssHeight = 0;
    let topbarHeight = 0;
    let lastFrame = 0;
    let particles = [];

    const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

    function getContentBounds() {
      const report = $("#reportRoot");
      if (report?.childElementCount) return report.getBoundingClientRect();

      const emptyState = $("#emptyState");
      const children = emptyState ? [...emptyState.children].filter((child) => {
        const rect = child.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }) : [];
      if (!children.length) return null;

      const rects = children.map((child) => child.getBoundingClientRect());
      return {
        left: Math.min(...rects.map((rect) => rect.left)),
        right: Math.max(...rects.map((rect) => rect.right)),
        top: Math.min(...rects.map((rect) => rect.top)),
        bottom: Math.max(...rects.map((rect) => rect.bottom)),
      };
    }

    function measure() {
      const topbar = $(".topbar");
      const nextTopbarHeight = Math.ceil(topbar?.getBoundingClientRect().height || 0);
      const nextWidth = Math.max(1, innerWidth);
      const nextHeight = Math.max(1, innerHeight - nextTopbarHeight);
      const ratio = Math.min(devicePixelRatio || 1, 2);

      if (nextWidth !== cssWidth || nextHeight !== cssHeight || nextTopbarHeight !== topbarHeight) {
        cssWidth = nextWidth;
        cssHeight = nextHeight;
        topbarHeight = nextTopbarHeight;
        canvas.style.top = `${topbarHeight}px`;
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${cssHeight}px`;
        canvas.width = Math.round(cssWidth * ratio);
        canvas.height = Math.round(cssHeight * ratio);
        context.setTransform(ratio, 0, 0, ratio, 0, 0);

        if (!particles.length) {
          particles = Array.from({ length: particleCount }, () => ({
            x: Math.random() * cssWidth,
            y: Math.random() * cssHeight,
            radius: Math.random() * 1.4 + .5,
            vx: (Math.random() - .5) * .28,
            vy: (Math.random() - .5) * .28,
          }));
        } else {
          particles.forEach((particle) => {
            particle.x = clamp(particle.x, 0, cssWidth);
            particle.y = clamp(particle.y, 0, cssHeight);
          });
        }
      }

      const content = getContentBounds();
      if (!content) return null;
      return {
        left: clamp(content.left - contentGap, 0, cssWidth),
        right: clamp(content.right + contentGap, 0, cssWidth),
        top: clamp(content.top - topbarHeight - contentGap, 0, cssHeight),
        bottom: clamp(content.bottom - topbarHeight + contentGap, 0, cssHeight),
      };
    }

    function draw(timestamp) {
      requestAnimationFrame(draw);
      if (timestamp - lastFrame < 33) return;
      lastFrame = timestamp;
      const readabilityHole = measure();

      context.clearRect(0, 0, cssWidth, cssHeight);
      particles.forEach((particle) => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        if (particle.x < -3) particle.x = cssWidth + 3;
        if (particle.x > cssWidth + 3) particle.x = -3;
        if (particle.y < -3) particle.y = cssHeight + 3;
        if (particle.y > cssHeight + 3) particle.y = -3;
      });

      for (let first = 0; first < particles.length; first += 1) {
        for (let second = first + 1; second < particles.length; second += 1) {
          const dx = particles[first].x - particles[second].x;
          const dy = particles[first].y - particles[second].y;
          const distance = Math.hypot(dx, dy);
          if (distance >= maxDistance) continue;
          context.strokeStyle = `rgba(114,199,255,${(1 - distance / maxDistance) * .25})`;
          context.lineWidth = .6;
          context.beginPath();
          context.moveTo(particles[first].x, particles[first].y);
          context.lineTo(particles[second].x, particles[second].y);
          context.stroke();
        }
      }

      context.fillStyle = "rgba(114,199,255,.55)";
      particles.forEach((particle) => {
        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fill();
      });

      if (readabilityHole) {
        context.clearRect(
          readabilityHole.left,
          readabilityHole.top,
          readabilityHole.right - readabilityHole.left,
          readabilityHole.bottom - readabilityHole.top,
        );
      }
    }

    requestAnimationFrame(draw);
  }

  function initViewerCount() {
    const workerUrl = "https://arbi-presence.7llewellyn.workers.dev";
    const number = $("#viewerCountNum");
    const wrapper = $("#viewerCount");
    const mobileNumber = $("#mobileTopbarViewerNum");
    const mobileWrapper = $("#mobileTopbarViewer");
    if (!number || !wrapper) return;
    const createSessionId = () => {
      if (crypto?.randomUUID) return crypto.randomUUID();
      if (crypto?.getRandomValues) {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 15) | 64;
        bytes[8] = (bytes[8] & 63) | 128;
        const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
        return `${hex.slice(0,4).join("")}-${hex.slice(4,6).join("")}-${hex.slice(6,8).join("")}-${hex.slice(8,10).join("")}-${hex.slice(10).join("")}`;
      }
      return `sid-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    };
    let sid = sessionStorage.getItem("arbi_sid");
    if (!sid) {
      sid = createSessionId();
      sessionStorage.setItem("arbi_sid", sid);
    }
    const beat = () => fetch(workerUrl, { method: "POST", body: JSON.stringify({ sid }) })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!data || typeof data.count !== "number") return;
        number.textContent = data.count;
        wrapper.classList.add("is-ready");
        if (mobileNumber) mobileNumber.textContent = data.count;
        if (mobileWrapper) mobileWrapper.classList.add("is-ready");
      })
      .catch(() => {});
    const sendLeave = () => {
      const body = JSON.stringify({ sid, leave: true });
      if (navigator.sendBeacon) {
        try {
          if (navigator.sendBeacon(workerUrl, new Blob([body], { type: "text/plain" }))) return;
        } catch (_) {}
      }
      fetch(workerUrl, { method: "POST", body, keepalive: true }).catch(() => {});
    };
    let timer = null;
    const schedule = () => { timer = setTimeout(tick, 60000); };
    const tick = () => { timer = null; beat(); schedule(); };
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) return;
      if (timer !== null) clearTimeout(timer);
      tick();
    });
    addEventListener("pagehide", sendLeave);
    tick();
  }

  function chooseLogFile(input) {
    input.click();
  }

  function bindEvents() {
    const input=$("#logFileInput"), zone=$(".import-zone");
    const isFileDrag=(event)=>Array.from(event.dataTransfer?.types||[]).includes("Files");
    let pageDragDepth=0;
    input.addEventListener("change",()=>importFile(input.files[0]));
    $("#clearRunsBtn").addEventListener("click", clearRuns);
    zone.addEventListener("click",(event)=>{
      if(event.target===input) return;
      event.preventDefault();
      void chooseLogFile(input);
    });
    $("#emptyImportBtn").addEventListener("click",()=>void chooseLogFile(input));
    ["dragenter","dragover"].forEach((name)=>zone.addEventListener(name,(event)=>{event.preventDefault();zone.classList.add("dragging");}));
    ["dragleave","drop"].forEach((name)=>zone.addEventListener(name,(event)=>{event.preventDefault();zone.classList.remove("dragging");}));
    zone.addEventListener("drop",(event)=>importFile(event.dataTransfer.files[0], true));
    document.addEventListener("dragenter",(event)=>{
      if(!isFileDrag(event)) return;
      event.preventDefault();
      if(state.runs.length) return;
      pageDragDepth+=1;
      document.body.classList.add("empty-page-drag");
    });
    document.addEventListener("dragover",(event)=>{
      if(!isFileDrag(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect="copy";
    });
    document.addEventListener("dragleave",()=>{
      if(!document.body.classList.contains("empty-page-drag")) return;
      pageDragDepth=Math.max(0,pageDragDepth-1);
      if(!pageDragDepth) document.body.classList.remove("empty-page-drag");
    });
    document.addEventListener("drop",(event)=>{
      if(!isFileDrag(event)) return;
      event.preventDefault();
      pageDragDepth=0;
      document.body.classList.remove("empty-page-drag");
      if(state.runs.length||zone.contains(event.target)) return;
      importFile(event.dataTransfer.files[0], true);
    });
    $("#runSearch").addEventListener("input",(event)=>setRunQuery(event.target.value));
    $("#mobileRunSearch").addEventListener("input",(event)=>setRunQuery(event.target.value));
    $("#searchPrevBtn").addEventListener("click",()=>moveRunSelection(-1));
    $("#searchNextBtn").addEventListener("click",()=>moveRunSelection(1));
    $("#mobileSearchPrevBtn").addEventListener("click",()=>moveRunSelection(-1));
    $("#mobileSearchNextBtn").addEventListener("click",()=>moveRunSelection(1));
    $("#mobileSearchToggle").addEventListener("click",()=>{
      const bar=$("#mobileSearchBar");
      bar.hidden=!bar.hidden;
      document.body.classList.toggle("mobile-search-active", !bar.hidden);
      if(!bar.hidden) $("#mobileRunSearch").focus();
    });
    $("#mobileMenuBtn").addEventListener("click",()=>document.body.classList.toggle("sidebar-open"));
    $("#brandLink").addEventListener("click",(event)=>{if(matchMedia("(max-width: 900px)").matches){event.preventDefault();document.body.classList.toggle("sidebar-open");}});
    $("#sidebarCloseBtn").addEventListener("click",()=>document.body.classList.remove("sidebar-open"));
    $("#sidebarScrim").addEventListener("click",()=>document.body.classList.remove("sidebar-open"));
    $("#copyLogPathBtn").addEventListener("click",async()=>{try{await navigator.clipboard.writeText("%localappdata%\\Warframe\\");showToast("Warframe log folder path copied.");}catch(error){showToast(`Clipboard write failed: ${error.message||error}`,true);}});
    $("#fontIncreaseBtn").addEventListener("click",()=>changeDisplay("fontStep",1));
    $("#fontDecreaseBtn").addEventListener("click",()=>changeDisplay("fontStep",-1));
    $("#spacingIncreaseBtn").addEventListener("click",()=>changeDisplay("spacingStep",1));
    $("#spacingDecreaseBtn").addEventListener("click",()=>changeDisplay("spacingStep",-1));
    $("#widthIncreaseBtn").addEventListener("click",()=>changeDisplay("widthStep",1));
    $("#widthDecreaseBtn").addEventListener("click",()=>changeDisplay("widthStep",-1));
    $("#resetControlsBtn").addEventListener("click",()=>{state.fontStep=0;state.spacingStep=0;state.widthStep=0;applyDisplayControls();});
    $("#reportRoot").addEventListener("click", (event) => {
      const trigger = event.target.closest(".minimap-wrap[role='button']");
      if (trigger) openMinimapLightbox(trigger);
    });
    $("#reportRoot").addEventListener("keydown", (event) => {
      const trigger = event.target.closest(".minimap-wrap[role='button']");
      if (!trigger || !["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      openMinimapLightbox(trigger);
    });
    $("#reportRoot").addEventListener("pointerover", (event) => {
      const row = event.target.closest(".rank-row[data-spawn-id]");
      if (!row || row.contains(event.relatedTarget)) return;
      setSpawnBubbleHighlight(row.dataset.spawnId, true);
    });
    $("#reportRoot").addEventListener("pointerout", (event) => {
      const row = event.target.closest(".rank-row[data-spawn-id]");
      if (!row || row.contains(event.relatedTarget)) return;
      setSpawnBubbleHighlight(row.dataset.spawnId, false);
    });
    $("#minimapLightbox").addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeMinimapLightbox();
    }, true);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMinimapLightbox();
    });
  }

  bindEvents();
  setupTopbarHeightObserver();
  setupReportFitObserver();
  applyDisplayControls();
  startParticles();
  initViewerCount();
  renderRunList();
  renderReport(null);
})();
