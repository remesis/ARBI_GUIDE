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
  const INITIAL_RUN_MIN_SECONDS = 5 * 60;
  const state = {
    runs: [], activeIndex: 0, query: "", sourceName: "", toastTimer: 0,
    fontStep: 0, spacingStep: 0, widthStep: 0,
    hidePlayerNames: loadPlayerNamePrivacy(),
  };
  let topbarResizeObserver = null;
  let reportResizeObserver = null;
  let reportFitFrame = 0;

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

  function fitReportToViewport() {
    const viewport = $("#reportViewport");
    const report = $("#reportRoot");
    if (!viewport || !report) return;
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
  const INTERCEPTION_ROTATION_FADE_SECONDS = 10;

  function performanceHue(intensity) {
    return clamp(Number(intensity || 0), 0, 1) * 120;
  }

  function heatColor(intensity) {
    const hue = performanceHue(intensity);
    return { color: `hsl(${hue},100%,50%)`, ink: "#121212" };
  }

  function interceptionRotationScore(seconds) {
    const value = Number(seconds);
    if (!Number.isFinite(value)) return 0;
    const distance = Math.abs(value - INTERCEPTION_ROTATION_TARGET);
    return clamp(1 - distance / INTERCEPTION_ROTATION_FADE_SECONDS, 0, 1);
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
      stroke: `hsl(${hue},100%,65%)`,
    };
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
    $("#emptyState").hidden = true;
    const phase = phaseInfo(run);
    const droneRate = run.activeDuration ? run.droneKills / run.activeDuration * 60 : 0;
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
            <span class="squad-label">Squad</span>
            <button id="squadPrivacyToggle" class="squad-privacy-toggle${state.hidePlayerNames ? " is-hidden" : ""}" type="button" aria-pressed="${state.hidePlayerNames}" aria-label="${state.hidePlayerNames ? "Show" : "Hide"} squad names" data-tooltip="${state.hidePlayerNames ? "Show" : "Hide"} squad names">
              <svg aria-hidden="true"><use href="#icon-eye"></use></svg>
            </button>
            ${squadNames(run).map((name) => `<span class="squad-player">${h(name)}</span>`).join("")}
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
            ${kpi("Drones killed", fmt(run.droneKills), "Shield drones")}
            ${kpi("Enemies spawned", fmt(run.enemySpawns), "Non-ticking filtered")}
            ${kpi("Enemies / drone", fmt(run.droneKills ? run.enemySpawns / run.droneKills : 0, 2), "Spawned per drone")}
            ${kpi("Total duration", duration(run.totalDuration), `${phase.items.length} ${phase.noun}${phase.items.length === 1 ? "" : "s"}`) }
            ${kpi("Drones / min", fmt(droneRate, 1), "Drone pace")}
            ${kpi("Avg drone interval", `${fmt(run.avgDroneInterval, 2)}s`, "Between spawns")}
            ${kpi(`Avg ${phase.noun}`, phase.items.length ? phaseDuration(avg(phase.items.map((item) => item.seconds))) : "—", "Active phase time")}
            ${kpi("Enemies / min", fmt(enemyRate), "Spawn pace")}
            ${phaseDroneKpi}
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

    prepareDashboardLayout($("#reportRoot"), run);
    setupDpmTooltips($("#reportRoot"));
    setupAnalyzerTooltips($("#reportRoot"));
    scheduleReportFit();
    $("#copyImageBtn").addEventListener("click", () => copyReportImage());
    $("#squadPrivacyToggle").addEventListener("click", () => {
      state.hidePlayerNames = !state.hidePlayerNames;
      savePlayerNamePrivacy();
      renderReport(run);
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
    const cells = phase.items.map((item) => {
      const good = phase.defense
        ? defenseWaveScore(item.seconds)
        : (interception
          ? interceptionRotationScore(item.seconds)
          : (high === low ? .6 : 1 - (item.seconds - low) / (high - low)));
      const color = phase.defense
        ? { color: good ? PERFORMANCE_SUCCESS : PERFORMANCE_DANGER, ink: "#121212" }
        : heatColor(good);
      const saturation = Number.isFinite(item.saturation) ? `${fmt(item.saturation, 1)}%` : "—";
      const content = `<span class="clear-cell-content"><small>${shortDuration(item.seconds)}</small><small class="phase-saturation">${h(saturation)}</small></span>`;
      const tooltip = `Round ${item.label} - Saturation ${saturation}`;
      return `<div class="heat-cell" data-tooltip="${h(tooltip)}" aria-label="${h(tooltip)}" style="--heat:${color.color};--ink:${color.ink}">${content}</div>`;
    }).join("");
    const subtitle = phase.defense
      ? "Fight time per wave, downtime excluded. Greener = faster."
      : (interception
        ? "Time per rotation. Green at 6m 30s; red at 6m 20s / 6m 40s."
        : "Time per rotation. Greener = faster for this local comparison.");
    const goodLegend = phase.defense
      ? `≤${threshold}s`
      : (interception ? "target 6m 30s" : `fastest ${shortDuration(low)}`);
    const badLegend = phase.defense
      ? `>${threshold}s`
      : (interception ? "red ±10s" : `slowest ${shortDuration(high)}`);
    return `<section class="card"><h3 class="card-title">${h(phase.noun)} clear map</h3><p class="card-subtitle">${subtitle}</p><div class="heat-map clear-heat-map" style="--heat-cols:${Math.min(12, phase.items.length)};--mobile-heat-cols:${Math.min(8, phase.items.length)}">${cells}</div><div class="heat-legend"><span class="legend-chip"><i style="--swatch:${PERFORMANCE_SUCCESS}"></i>${goodLegend}</span><span class="legend-chip"><i style="--swatch:${PERFORMANCE_DANGER}"></i>${badLegend}</span><span class="round-saturation-legend">##.#% is Saturation per round</span></div></section>`;
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
      const seconds = sum(windows.map((window) => window.seconds));
      const count = sum(windows.map((window) => window.count));
      return {
        values: windows.map((window) => window.dpm),
        labels: windows.map((window) => `${dpmElapsed(window.from)}–${dpmElapsed(window.to)}`),
        tooltips: windows.map((window) => `${dpmElapsed(window.from)}–${dpmElapsed(window.to)}`),
        axis: windows.map((window) => dpmElapsed(window.to)),
        mean: seconds ? count / seconds * 60 : 0,
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
      mean: avg(values),
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
    const result = Parser.computeVitus(run.droneKills, run.rotations, run.missionType);
    const actualDigits = cleanVitusDigits(run.actualVitus);
    run.actualVitus = actualDigits;
    const actual = Number(actualDigits);
    const classified = Number.isFinite(actual) && actual > 0 ? Parser.classifyVitusScenario(result.scenarios, actual) : result.scenarios[3];
    const luckColor = vitusLuckColor(result.scenarios, classified);
    return `<section class="card vitus-card"><h3 class="card-title">Expected Vitus</h3><p class="card-subtitle">Both Boosters, Drop Blessing and Resourceful Retriever.</p><div class="highlight-panel vitus-entry-panel"><div class="vitus-entry-group"><span class="vitus-actual"><span class="vitus-entry-label">Actual Vitus</span><span id="vitusDelta" class="mini vitus-delta">${h(formatVitusDelta(result, actual))}</span></span><input id="actualVitusInput" class="vitus-input" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" placeholder="enter" value="${h(actualDigits)}"><span id="vitusRate" class="vitus-rate">${h(formatVitusRate(run))}</span></div><div id="vitusLuck" class="vitus-luck" style="--luck-color:${luckColor}"><strong>${h(classified.label)}</strong><div class="mini vitus-tail">${h(formatVitusTailRarity(result, actual))}</div></div></div><table class="vitus-table"><thead><tr><th>CHANCE</th><th>TOTAL</th><th>LUCK LEVEL</th></tr></thead><tbody>${result.scenarios.map((scenario) => `<tr class="${scenario === classified ? "active" : ""}"><td>${h(formatVitusScenarioChance(scenario.chance))}</td><td><strong>${fmt(scenario.total)}</strong></td><td>${h(scenario.label)}</td></tr>`).join("")}</tbody></table></section>`;
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
    const result = Parser.computeVitus(run.droneKills, run.rotations, run.missionType);
    const actual = Number(run.actualVitus);
    const classified = Number.isFinite(actual) && actual > 0 ? Parser.classifyVitusScenario(result.scenarios, actual) : result.scenarios[3];
    $("#vitusRate").textContent = formatVitusRate(run);
    $("#vitusDelta").textContent = formatVitusDelta(result, actual);
    const luck = $("#vitusLuck");
    luck.style.setProperty("--luck-color", vitusLuckColor(result.scenarios, classified));
    luck.innerHTML = `<strong>${h(classified.label)}</strong><div class="mini vitus-tail">${h(formatVitusTailRarity(result, actual))}</div>`;
    $$(".vitus-table tbody tr").forEach((row,index) => row.classList.toggle("active", result.scenarios[index] === classified));
  }

  function focusActualVitusEntry() {
    requestAnimationFrame(() => {
      const input = $("#actualVitusInput");
      if (!input?.isConnected) return;
      input.focus({ preventScroll: true });
      const end = input.value.length;
      input.setSelectionRange(end, end);
    });
  }

  function renderSaturation(run) {
    const saturation = run.saturation || { rows: [], abovePercent: 0 };
    const threshold = Number.isFinite(saturation.threshold) ? saturation.threshold : 15;
    const telemetryCoverage = Number.isFinite(run.telemetryCoverage) ? run.telemetryCoverage : 0;
    const telemetryLabel = Math.round(telemetryCoverage * 10) / 10 === 100 ? "100" : fmt(telemetryCoverage, 1);
    const max = Math.max(1, ...saturation.rows.map((row) => row.percent));
    return `<section class="card saturation-card"><h3 class="card-title">Enemy saturation</h3><p class="card-subtitle">Share of run time at each enemy count.</p><div class="metric-bars">${saturation.rows.map((row,index) => { const heat=heatColor(1-index/Math.max(1,saturation.rows.length-1)); return `<div class="metric-row"><span>${h(row.label)}</span><div class="bar-track"><div class="bar-fill" style="--width:${row.percent/max*100}%;--color:${heat.color}"></div></div><strong>${fmt(row.percent,1)}%</strong></div>`; }).join("")}</div><div class="highlight-panel saturation-summary" style="margin-top:13px"><div class="saturation-summary-item"><span class="mini">Time at ${threshold}+ enemies</span><div class="big">${fmt(saturation.abovePercent,1)}%</div></div><div class="saturation-summary-item telemetry-coverage"><span class="mini">Telemetry coverage</span><div class="big">${telemetryLabel}%</div></div></div></section>`;
  }

  function renderCadence(run) {
    const cadence = run.cadence || { rows: [], droughtPercent: 0 };
    const max = Math.max(1, ...cadence.rows.map((row) => row.percent));
    const activeDrones = (run.droneTimestamps || []).filter((timestamp) => timestamp >= run.startTime && timestamp <= run.endTime);
    const peak = peakInWindow(activeDrones, 10);
    return `<section class="card"><h3 class="card-title">Drone cadence</h3><p class="card-subtitle">Share of wait time spent waiting this long for the next drone.</p><div class="metric-bars">${cadence.rows.map((row,index) => { const heat=heatColor(1-index/Math.max(1,cadence.rows.length-1)); return `<div class="metric-row"><span>${h(row.label)}</span><div class="bar-track"><div class="bar-fill" style="--width:${row.percent/max*100}%;--color:${heat.color}"></div></div><strong>${fmt(row.percent,1)}%</strong></div>`; }).join("")}</div><div class="split-row" style="margin-top:13px"><div class="highlight-panel"><span class="mini">Dry ≥12s</span><div class="big">${fmt(cadence.droughtPercent,1)}%</div></div><div class="highlight-panel"><span class="mini">Peak / 10s</span><div class="big">${fmt(peak.count)}</div><span class="mini">at ${elapsedAt(run, peak.time)}</span></div></div></section>`;
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
    if (!entries.length) return `<section class="card"><h3 class="card-title">Enemy composition</h3><p class="card-subtitle">Unit names were unavailable in this log.</p></section>`;
    const total = sum(entries.map((entry) => entry[1]));
    return `<section class="card"><h3 class="card-title">Enemy composition</h3><p class="card-subtitle">Share of locally parsed spawns by unit.</p><div class="composition-bar">${entries.map(([name,count],index) => { const heat=heatColor(1-index/Math.max(1,entries.length-1)); const tooltip=`${prettyNpc(name)}: ${fmt(count)}`; return `<div class="composition-segment" style="width:${count/total*100}%;--segment:${heat.color}" data-tooltip="${h(tooltip)}">${count/total>.1 ? `${fmt(count/total*100)}%` : ""}</div>`; }).join("")}</div><div class="composition-list">${entries.map(([name,count],index) => { const heat=heatColor(1-index/Math.max(1,entries.length-1)); return `<div class="composition-item" style="--segment:${heat.color}"><i></i><span data-tooltip="${h(name)}">${h(prettyNpc(name))}</span><strong>${fmt(count)}</strong></div>`; }).join("")}</div></section>`;
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
    if (config.calibrated && exactTileMatch) {
      const max = Math.max(1,...verified.map(({point})=>point.count));
      const min = Math.min(max,...verified.map(({point})=>point.count));
      bubbles = verified.map(({point,position}) => {
        const [a,b,c,d,e,f] = config.matrix;
        const x = a*position[0]+b*position[2]+c, y=d*position[0]+e*position[2]+f;
        const radius = 8 + Math.sqrt(point.count/max)*13;
        const heat = spawnBubbleHeatColor(max === min ? .65 : (point.count - min) / (max - min));
        const spawnId = pointNumber(point);
        const tooltip = `${point.ident || point.key} · ${fmt(point.count)} spawns`;
        return `<circle class="spawn-bubble" data-spawn-id="${h(spawnId)}" data-tooltip="${h(tooltip)}" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${radius.toFixed(2)}" style="--bubble-fill:${heat.fill};--bubble-stroke:${heat.stroke}"></circle><text class="spawn-label" data-spawn-id="${h(spawnId)}" x="${x.toFixed(2)}" y="${y.toFixed(2)}">${h(spawnId)}</text>`;
      }).join("");
    }
    const subtitle = exactTileMatch
      ? `${config.floorFilter?.label === "bottom" ? "Bottom floor only. " : ""}Bubble size and heat = enemies produced.`
      : `Spawn overlay unavailable for this tile variation.`;
    return `<section class="card"><h3 class="card-title">Tile layout</h3><p class="card-subtitle">${subtitle}</p><div class="minimap-wrap" role="button" tabindex="0" aria-label="Expand tile layout for ${h(config.label)}"><img src="${h(config.src)}" alt="Tile layout for ${h(config.label)}"><svg class="minimap-overlay" ${dimensions} preserveAspectRatio="xMidYMid meet">${bubbles}</svg></div></section>`;
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

  async function importFile(file) {
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
      await waitForImages(stage);

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

  async function waitForImages(root) {
    await Promise.all($$("img", root).map(async (img) => {
      if (img.complete && img.naturalWidth) return;
      try { await img.decode(); } catch (_) { /* html2canvas will report a missing image if needed */ }
    }));
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
    zone.addEventListener("drop",(event)=>importFile(event.dataTransfer.files[0]));
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
      importFile(event.dataTransfer.files[0]);
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
