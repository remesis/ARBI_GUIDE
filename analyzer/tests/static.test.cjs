const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const analyzerDir = path.resolve(__dirname, "..");

test("local page includes guide navigation, log-folder helper, and PNG clipboard action", () => {
  const html = fs.readFileSync(path.join(analyzerDir, "index.html"), "utf8");
  const guideHtml = fs.readFileSync(path.resolve(analyzerDir, "..", "index.html"), "utf8");
  assert.match(html, />3D Tilesets</);
  assert.match(html, /href="\/3d_tilesets\/callisto\+sinai\+io">3D Tilesets<\/a>/);
  assert.match(guideHtml, /href="\/3d_tilesets\/callisto\+sinai\+io">3D Tilesets<\/a>/);
  assert.match(html, />Return to Guide</);
  assert.match(html, /%localappdata%\\Warframe\\/);
  assert.match(html, /html2canvas\.min\.js/);
  assert.match(html, /spawn-alignment\.js/);
  assert.match(html, /minimaps\/catalog-20260822-4\.js/);
  assert.match(html, /analyzer-20260822-99\.js/);
  assert.match(html, /submission\.js/);
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  assert.match(js, /image\/png/);
  assert.match(js, /new ClipboardItem/);
  assert.match(js, /await inlineImagesForExport\(stage\)/);
  assert.match(js, /for \(let attempt = 0; attempt < 3; attempt \+= 1\)/);
  assert.match(js, /img\.src = await blobDataUrl\(blob\)/);
  assert.match(js, /The tile image could not be embedded/);
  assert.doesNotMatch(js, /WIDTH\.stages|changeWidth/);
  assert.match(js, /openMinimapLightbox/);
  assert.match(js, /setSpawnBubbleHighlight/);
  assert.match(js, /data-spawn-id/);
  assert.match(js, /verifyDisplayPositions\(coordinatePoints, config\)/);
  assert.match(js, /run\.levelComponents/);
  assert.match(js, /const matchedCount = result\.matchedCount \?\? result\.matches\.length/);
  assert.match(js, /levelMatches \* 100000/);
  assert.match(js, /setupTopbarHeightObserver\(\)/);
  assert.match(html, /id="minimapLightbox"/);
  assert.match(html, /Last updated: 2026-08-16/);
  assert.match(html, /id="viewerCount"/);
  assert.match(html, /\(hover: none\) and \(pointer: coarse\)/);
  assert.match(html, /location\.replace\("\/"\)/);
  assert.match(html, /id="mobileTopbarViewer"/);
  assert.match(html, /id="mobileSearchPrevBtn"/);
  assert.match(html, /id="clearRunsBtn"[^>]*>Clear</);
  assert.match(js, /function clearRuns\(\)/);
  assert.match(js, /SpawnSubmission\.submitRuns\(runs, Parser\.buildContribution\)/);
  assert.doesNotMatch(js, /Spawn metrics:|Spawn metrics updated:|without usable spawn coordinates/);
  assert.match(js, /function setupDpmTooltips\(root\)/);
  assert.match(js, /function chooseLogFile\(input\)\s*\{\s*input\.click\(\);\s*\}/);
  assert.match(js, /if\(event\.target===input\) return/);
  assert.match(js, /function setupAnalyzerTooltips\(root\)/);
  assert.match(js, /data-tooltip="\$\{h\(tooltip\)\}"/);
  assert.match(js, /data-label="\$\{h\(label\)\}"/);
  assert.match(js, /id="vitusRate" class="vitus-rate"/);
  assert.match(js, /class="vitus-entry-label">Actual Vitus<\/span>/);
  assert.match(js, /actual \* 60 \/ seconds/);
  assert.match(js, /return "⎵ VE\/min"/);
  assert.match(js, /\$\("#vitusRate"\)\.textContent = formatVitusRate\(run\)/);
  assert.match(js, /function focusActualVitusEntry\(\)/);
  assert.match(js, /input\.focus\(\{ preventScroll: true \}\)/);
  assert.match(js, /const end = input\.value\.length;\s*input\.setSelectionRange\(end, end\)/);
  assert.match(js, /type="text" inputmode="numeric" pattern="\[0-9\]\*" maxlength="4" autocomplete="off"/);
  assert.match(js, /const digits = cleanVitusDigits\(vitusInput\.value\)/);
  assert.match(js, /function cleanVitusDigits\(value\)\s*\{\s*return String\(value \?\? ""\)\.replace\(\/\\D\/g, ""\)\.slice\(0, 4\)/);
  assert.match(js, /run\.actualVitus = ""/);
  assert.match(js, /renderReport\(state\.runs\[state\.activeIndex\]\);\s*focusActualVitusEntry\(\)/);
  assert.match(js, /renderReport\(state\.runs\[state\.activeIndex\]\); focusActualVitusEntry\(\)/);
  assert.match(js, /renderReport\(next\.run\);\s*focusActualVitusEntry\(\)/);
  assert.match(js, /PLAYER_PRIVACY_TTL_MS = 365 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(js, /hidePlayerNames: loadPlayerNamePrivacy\(\)/);
  assert.match(js, /expiresAt: Date\.now\(\) \+ PLAYER_PRIVACY_TTL_MS/);
  assert.match(js, /names\.map\(\(_, index\) => `Player \$\{index \+ 1\}`\)/);
  assert.match(js, /id="squadPrivacyToggle"/);
  assert.match(js, /savePlayerNamePrivacy\(\)/);
  assert.match(js, /renderReport\(null\)/);
  assert.match(js, /document\.addEventListener\("drop"/);
  assert.match(js, /if\(state\.runs\.length\|\|zone\.contains\(event\.target\)\) return/);
  assert.doesNotMatch(js, /showOpenFilePicker|showPicker/);
  assert.doesNotMatch(js, /downloadBlob|\.media_cache/);
  assert.doesNotMatch(html, /local prototype|Upload disabled/i);
  const css = fs.readFileSync(path.join(analyzerDir, "analyzer.css"), "utf8");
  assert.match(css, /\.sidebar-heading\s*\{[^}]*align-items:\s*center/);
  assert.match(css, /\.sidebar-heading \.eyebrow\s*\{[^}]*font-size:\s*12px/);
  assert.match(css, /body\.empty-page-drag::after/);
  assert.match(css, /\.report-sheet\s*\{[^}]*width:\s*1600px[^}]*max-width:\s*none/);
  assert.doesNotMatch(css, /@container\s+report/);
  assert.match(html, /id="widthIncreaseBtn"/);
  assert.match(html, /id="widthDecreaseBtn"/);
  assert.match(html, /id="reportViewport"/);
  assert.match(css, /\.analyzer-main\s*\{[^}]*overflow-x:\s*hidden/);
  assert.match(css, /\.report-viewport\s*\{[^}]*overflow:\s*hidden/);
  assert.match(js, /function fitReportToViewport/);
  assert.match(js, /const fittedScale = Math\.min\(1, availableWidth \/ canvasWidth\)/);
  assert.match(js, /Math\.min\(fittedScale \* selectedZoom, availableWidth \/ canvasWidth\)/);
  assert.match(js, /viewport\.style\.height/);
  assert.match(js, /setupReportFitObserver\(\)/);
  assert.match(css, /\.minimap-lightbox/);
  assert.match(css, /\.spawn-bubble\.is-rank-highlighted/);
  assert.match(css, /\.spawn-label\s*\{[^}]*visibility:\s*hidden[^}]*opacity:\s*0/);
  assert.match(css, /\.spawn-label\.is-rank-highlighted\s*\{[^}]*visibility:\s*visible[^}]*opacity:\s*1/);
  assert.match(css, /\.spawn-bubble\s*\{[^}]*--bubble-fill-compact[^}]*--bubble-fill[^}]*--elevation-ring[^}]*stroke-width:\s*1/);
  assert.match(css, /\.minimap-lightbox \.spawn-bubble, \.export-stage \.spawn-bubble\s*\{[^}]*fill:\s*var\(--bubble-fill[^}]*stroke-width:\s*2/);
  assert.match(js, /function spawnBubbleHeatColor/);
  assert.match(js, /compactFill: `hsla\(\$\{hue\},100%,50%,\$\{\(\.46 \+ t \* \.34\)\.toFixed\(2\)\}\)`/);
  assert.match(js, /SPAWN_ELEVATION_COLORS = \["#0b4399", "#1768c5", "#2d91eb", "#67b7f5", "#b9ddff"\]/);
  assert.match(js, /function tileElevationBands\(config\)/);
  assert.match(js, /\.2, \.4, \.6, \.8/);
  assert.match(js, /function spawnElevationLevel\(height, bands\)/);
  assert.match(js, /bands\.findIndex\(\(maximum\) => height <= maximum\)/);
  assert.match(js, /--bubble-fill:\$\{heat\.fill\};--bubble-fill-compact:\$\{heat\.compactFill\};--elevation-ring:\$\{elevationColor\}/);
  assert.match(js, /class="elevation-legend"/);
  assert.match(js, /Five elevation levels from low to high/);
  assert.match(css, /\.elevation-scale\s*\{[^}]*grid-template-columns:\s*repeat\(5, 1fr\)/);
  assert.match(css, /\.report-logo\s*\{[^}]*display:\s*none/);
  assert.match(css, /\.export-stage \.report-logo\s*\{[^}]*display:\s*block/);
  assert.match(css, /\.export-stage\s*\{[^}]*width:\s*2022px/);
  assert.match(css, /\.export-stage\s*\{[^}]*--report-scale:\s*1[^}]*--report-gap:\s*16px/);
  assert.match(css, /\.export-stage \.report-sheet\s*\{[^}]*width:\s*1970px[^}]*font-size:\s*15px/);
  assert.match(css, /\.export-stage \.report-footer\s*\{[^}]*color:\s*#fff[^}]*font-size:\s*14px/);
  assert.match(css, /\.export-stage \.goons-label\s*\{[^}]*font-size:\s*15px/);
  assert.match(css, /\.report-grid\.dashboard-layout\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.report-grid\.dashboard-no-spawns\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.dashboard-workspace\s*\{[^}]*grid-column:\s*2 \/ 4/);
  assert.match(css, /\.dashboard-workspace-top\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.dashboard-spawn-detail\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1\.2fr\) minmax\(0, \.8fr\)/);
  assert.match(css, /\.report-grid\.dashboard-layout\s*\{[^}]*align-items:\s*start/);
  assert.match(css, /\.dashboard-layout \.left-column\s*\{[^}]*align-self:\s*stretch/);
  assert.match(css, /\.dashboard-layout:not\(\.dashboard-no-spawns\) \.left-column\s*\{[^}]*grid-template-rows:\s*auto auto auto 1fr[^}]*align-content:\s*stretch/);
  assert.match(css, /\.dashboard-no-spawns \.left-column\s*\{[^}]*grid-template-rows:\s*auto auto 1fr[^}]*align-content:\s*stretch/);
  assert.match(css, /\.dashboard-composition-card\s*\{[^}]*height:\s*100%[^}]*align-self:\s*stretch/);
  assert.match(css, /\.dashboard-composition-card \.composition-list\s*\{[^}]*grid-auto-rows:\s*auto/);
  assert.match(css, /\.dashboard-cadence-card \.metric-bars\s*\{[^}]*flex:\s*0 0 auto[^}]*align-content:\s*start/);
  assert.match(css, /\.dashboard-cadence-card > \.split-row\s*\{[^}]*margin-top:\s*13px/);
  assert.match(css, /\.dashboard-layout \.center-column\s*\{[^}]*align-content:\s*start/);
  assert.match(css, /\.dashboard-layout\.dashboard-defense \.center-column\s*\{[^}]*grid-template-rows:\s*auto auto minmax\(0, 1fr\)[^}]*align-content:\s*stretch/);
  assert.match(css, /\.dashboard-workspace-top \.right-column\s*\{[^}]*grid-template-rows:\s*auto auto 1fr/);
  assert.match(css, /\.dashboard-minimap-card \.minimap-wrap\s*\{[^}]*flex:\s*1/);
  assert.match(js, /composition\.classList\.add\("dashboard-composition-card"\)/);
  assert.match(js, /cadence\.classList\.add\("dashboard-cadence-card"\)/);
  assert.match(js, /interceptionColumn\.className = "column right-column dashboard-interception-column"/);
  assert.match(js, /grid\.replaceChildren\(left, center, interceptionColumn\)/);
  assert.match(css, /\.dashboard-layout > \.activity-card\s*\{[^}]*grid-column:\s*1 \/ 4/);
  assert.match(css, /\.dashboard-layout > \.dashboard-clear-map-full\s*\{[^}]*grid-column:\s*1 \/ 4/);
  assert.match(css, /\.dashboard-per-rotation \.heat-map\s*\{[^}]*repeat\(10/);
  assert.match(css, /\.dashboard-layout \.clear-heat-map\s*\{[^}]*repeat\(25/);
  assert.match(css, /\.dashboard-no-spawns \.clear-heat-map\s*\{[^}]*repeat\(10/);
  assert.match(css, /\.dashboard-layout \.clear-heat-map \.heat-cell small\s*\{[^}]*font-size:\s*11px/);
  assert.doesNotMatch(css, /\.dashboard-no-spawns \.dashboard-dpm \.line-chart\s*\{[^}]*height:\s*125px/);
  assert.match(css, /\.line-chart-wrap\s*\{[^}]*--chart-side-padding:\s*4\.8077%/);
  assert.match(css, /\.line-chart\s*\{[^}]*height:\s*auto[^}]*aspect-ratio:\s*520 \/ 190/);
  assert.match(js, /pad = \{ l: 25, r: 25, t: 15, b: 25 \}/);
  assert.match(js, /preserveAspectRatio="xMidYMid meet" aria-label="Drones per minute line chart"/);
  assert.doesNotMatch(js, /preserveAspectRatio="none" aria-label="Drones per minute line chart"/);
  assert.match(js, /x="\$\{width-pad\.r\}" y="\$\{height-5\}" text-anchor="end"/);
  assert.match(js, /class="chart-average-badge" style="--average-top:/);
  assert.match(css, /\.chart-average-badge\s*\{[^}]*position:\s*absolute[^}]*right:\s*var\(--chart-side-padding\)[^}]*font-size:\s*16px/);
  assert.match(css, /\.chart-tooltip\s*\{[^}]*position:\s*absolute/);
  assert.match(css, /\.analyzer-hover-tooltip\s*\{[^}]*position:\s*fixed[^}]*z-index:\s*10000/);
  assert.match(css, /\.dashboard-no-spawns \.dashboard-cadence-card\s*\{[^}]*height:\s*auto/);
  assert.match(js, /function prepareDashboardLayout/);
  assert.match(js, /function syncDashboardClearMapLayout/);
  assert.match(js, /syncDashboardClearMapLayout\(report\)/);
  assert.match(js, /compositionContentBottom < clearMapTop - Math\.max\(\.5, scale\)/);
  assert.match(js, /grid\.insertBefore\(clearMap, activity\)/);
  assert.match(js, /else workspace\.append\(clearMap\)/);
  assert.match(js, /prepareDashboardLayout\(\$\("#reportRoot"\), run\)/);
  assert.match(js, /run\?\.missionType === "DEFENSE"/);
  assert.match(js, /left\.replaceChildren\(coreKpis, vitus, bottlenecks, composition\)/);
  assert.match(js, /center\.replaceChildren\(perRotation, saturation, dpm\)/);
  assert.match(js, /workspace\.append\(workspaceTop, clearMap\)/);
  assert.match(js, /grid\.replaceChildren\(left, workspace, activity\)/);
  assert.match(js, /Spawn points observed/);
  assert.match(js, /\["SURVIVAL", "DISRUPTION"\]\.includes\(run\.missionType\)/);
  assert.match(js, /kpi\("Drones despawned", fmt\(run\.dronesDespawned \|\| 0\), "Despawn after 20s"\)/);
  assert.match(js, /: kpi\(`Drones \/ \$\{phase\.noun\}`/);
  assert.doesNotMatch(js, /debug-export/);
  assert.match(css, /\.export-stage \.clear-heat-map\s*\{[^}]*repeat\(25/);
  assert.match(css, /\.export-stage \.dashboard-no-spawns \.clear-heat-map\s*\{[^}]*repeat\(10/);
  assert.match(css, /\.export-stage \.activity-card\s*\{[^}]*display:\s*none\s*!important/);
  assert.match(css, /\.squad-privacy-toggle\.is-hidden\s*\{[^}]*color:\s*var\(--red-hot\)/);
  assert.match(css, /\.squad-privacy-toggle\.is-hidden::after/);
  assert.match(css, /\.export-stage \.squad-privacy-toggle\s*\{[^}]*display:\s*none\s*!important/);
  assert.match(css, /\.saturation-card/);
  assert.match(js, /saturation\.rows\.map\(\(row,index\) => \{ const heat=heatColor\(1-index\/Math\.max\(1,saturation\.rows\.length-1\)\)/);
  assert.match(css, /\.clear-heat-map/);
  assert.match(css, /\.activity-scroll\s*\{[^}]*overflow:\s*visible/);
  assert.match(css, /\.activity-grid\s*\{[^}]*gap:\s*1px[^}]*width:\s*100%[^}]*min-width:\s*0/);
  assert.match(css, /\.activity-grid\.is-compact\s*\{[^}]*width:\s*max-content/);
  assert.match(css, /\.activity-axis-label\s*\{[^}]*font:\s*850 13px\/15px/);
  assert.match(js, /function activityHeatColor/);
  assert.match(js, /const low = \[31, 35, 39\]/);
  assert.match(js, /const high = \[0, 230, 118\]/);
  assert.match(js, /windowWidth:\s*2022/);
  assert.match(js, /class="activity-axis-label"/);
  assert.match(css, /\.clear-heat-map\s*\{[^}]*grid-template-columns:\s*repeat\(var\(--heat-cols, 12\), minmax\(24px, 1fr\)\)/);
  assert.match(html, /ANALYZED ARBIS IN EE\.LOG/);
  assert.doesNotMatch(html, /ANALYZED ARBITRATIONS IN EE\.LOG/);
  assert.match(css, /\.search-wrap input\s*\{[^}]*width:\s*min\(420px, 50vw\)/);
  assert.doesNotMatch(css, /\.brand span\s*\{\s*white-space:\s*nowrap/);
  assert.match(css, /@view-transition\s*\{\s*navigation:\s*auto/);
  assert.match(css, /view-transition-name:\s*arbi-site-topbar/);
  assert.match(css, /\.topbar\s*\{[^}]*--panel:\s*#121821[^}]*--border:\s*#273242[^}]*--text:\s*#e9eef5/);
  assert.match(css, /\.topbar \.search-wrap input, \.topbar \.search-wrap button\s*\{\s*font:\s*revert/);
  const catalog = fs.readFileSync(path.join(analyzerDir, "minimaps", "catalog.js"), "utf8");
  const immutableCatalog = fs.readFileSync(
    path.join(analyzerDir, "minimaps", "catalog-20260822-4.js"),
    "utf8",
  );
  assert.match(html, /minimaps\/catalog-20260822-4\.js/);
  assert.equal(immutableCatalog, catalog);
  assert.match(catalog, /tile-geometry/);
  assert.match(catalog, /spawnPoints/);
  assert.match(catalog, /interceptionMarkers/);
  const minimapBuilder = fs.readFileSync(path.join(analyzerDir, "tools", "build_game_minimaps.py"), "utf8");
  assert.match(minimapBuilder, /text_width \/ 2 \+ 1/);
  assert.match(minimapBuilder, /text_height - baseline\) \/ 2 \+ 4/);
  assert.match(minimapBuilder, /CORPUS_SHIP_RUNTIME_SPAWN_ROOMS/);
  assert.match(minimapBuilder, /merge_spawn_supplements/);
  assert.match(minimapBuilder, /group_id == CORPUS_SHIP_DEFENSE_GROUP/);
  assert.match(minimapBuilder, /10\.5: \(\(-23\.3, 10\.5, 52\.3\),\)/);
  assert.match(minimapBuilder, /LARZAC_Y_BUILDING_HEIGHT = 8\.5/);
  assert.match(minimapBuilder, /LARZAC_FRAMEWORK_MIN/);
});

test("production Analyzer starts cleared instead of loading bundled demo runs", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  assert.doesNotMatch(js, /prepareRuns\(makeDemoRuns\(\)/);
  assert.match(js, /renderRunList\(\);\s*renderReport\(null\);/);
  assert.match(js, />Most Active</);
  assert.doesNotMatch(js, />Busiest spawn points</i);
});

test("large logs use the same parser through a same-origin parallel scanner", () => {
  const html = fs.readFileSync(path.join(analyzerDir, "index.html"), "utf8");
  const parser = fs.readFileSync(path.join(analyzerDir, "parser.js"), "utf8");
  const worker = fs.readFileSync(path.join(analyzerDir, "scanner-worker.js"), "utf8");
  assert.match(parser, /PARALLEL_PARSE_MIN_BYTES = 512 \* 1024 \* 1024/);
  assert.match(parser, /return await parseFileParallel\(file, onProgress\)/);
  assert.match(parser, /new Worker\(workerUrl/);
  assert.match(parser, /parser\.feedLine\(lines\[index \+ 1\], lines\[index\]\)/);
  assert.match(worker, /importScripts\("\.\/parser\.js\?v=20260822-71"\)/);
  assert.match(worker, /Parser\.forEachRelevantLine/);
  assert.match(worker, /lines\.push\(internToken\(token\), detach\(line\)\)/);
  assert.match(html, /parser\.js\?v=20260822-71/);
});

test("Expected Vitus uses explicit booster copy without unscoped mod detection", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  const immutableJs = fs.readFileSync(path.join(analyzerDir, "analyzer-20260822-99.js"), "utf8");
  assert.equal(immutableJs, js);
  const parser = fs.readFileSync(path.join(analyzerDir, "parser.js"), "utf8");
  assert.match(js, /Both Boosters, Drop Blessing and Resourceful Retriever\./);
  assert.doesNotMatch(js, /MISSING RESOURCEFUL RETRIEVER MOD/);
  assert.doesNotMatch(parser, /BeastResourceDoublingMod|resourcefulRetrieverDetected/);
});

test("Actual Vitus input accepts only the first four numeric digits", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  const functionSource = js.match(/function cleanVitusDigits\(value\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(functionSource);
  const context = {};
  vm.runInNewContext(`${functionSource}; result = [cleanVitusDigits("12ab345"), cleanVitusDigits(98765), cleanVitusDigits(null)];`, context);
  assert.deepEqual(Array.from(context.result), ["1234", "9876", ""]);
});

test("Disruption drone pace uses six-minute active-time windows", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  const parser = fs.readFileSync(path.join(analyzerDir, "parser.js"), "utf8");
  assert.match(parser, /run\.dpmWindows6m = run\.missionType === "DISRUPTION"/);
  assert.match(parser, /calculateFixedDpmWindows\(run, 6 \* 60\)/);
  assert.match(js, /run\.missionType === "DISRUPTION"/);
  assert.match(js, /Six-minute active-time windows, against the run average\./);
  assert.match(js, /labels: windows\.map\(\(window\) => `\$\{dpmElapsed\(window\.from\)\}–\$\{dpmElapsed\(window\.to\)\}`\)/);
  assert.match(js, /mean: runDroneRate\(run\)/);
});

test("DPM KPI and chart use the same run-wide average", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  assert.match(js, /const runDroneRate = \(run\) => run\?\.activeDuration \? Number\(run\.droneKills \|\| 0\) \/ run\.activeDuration \* 60 : 0/);
  assert.match(js, /const droneRate = runDroneRate\(run\)/);
  assert.equal((js.match(/mean: runDroneRate\(run\)/g) || []).length, 2);
  assert.doesNotMatch(js, /mean: avg\(values\)/);
});

test("loading a log selects its newest run longer than five minutes", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  assert.match(js, /INITIAL_RUN_MIN_SECONDS = 5 \* 60/);
  assert.match(js, /function initialRunIndex\(runs\)/);
  assert.match(js, /for \(let index = runs\.length - 1; index >= 0; index -= 1\)/);
  assert.match(js, /Number\(runs\[index\]\?\.totalDuration\) > INITIAL_RUN_MIN_SECONDS/);
  assert.match(js, /return Math\.max\(0, runs\.length - 1\)/);
  assert.match(js, /state\.activeIndex = initialRunIndex\(runs\)/);
  assert.match(js, /renderReport\(state\.runs\[state\.activeIndex\]\)/);
});

test("left-panel durations under five minutes receive a red text outline without changing rows", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  const css = fs.readFileSync(path.join(analyzerDir, "analyzer.css"), "utf8");
  assert.match(js, /Number\(run\.totalDuration\) < INITIAL_RUN_MIN_SECONDS \? "short-run-duration"/);
  assert.match(css, /\.run-meta \.short-run-duration\s*\{[^}]*display:\s*block/);
  assert.match(css, /\.run-meta \.short-run-duration\s*\{[^}]*text-shadow:[^}]*-1px -1px 0 var\(--red\)/);
  assert.doesNotMatch(css, /\.run-meta \.short-run-duration\s*\{[^}]*border:/);
});

test("analyzer uses the full composition list and green performance scale", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  const css = fs.readFileSync(path.join(analyzerDir, "analyzer.css"), "utf8");
  assert.doesNotMatch(js, /entries\.slice\(0,(?:8|10)\)/);
  assert.match(js, /\.filter\(\(\[name\]\) => !isExcludedCompositionAgent\(name\)\)/);
  assert.match(js, /=== "summonmotorcycle"/);
  assert.match(js, /<footer class="report-footer"><span>https:\/\/arbi\.guide\/analyzer<\/span><span>discord\.gg\/Arbitrations<\/span><\/footer>/);
  assert.match(js, /Greener = more enemies/);
  assert.match(js, /const PERFORMANCE_SUCCESS = "#00e676"/);
  assert.match(js, /const PERFORMANCE_DANGER = "#ff5252"/);
  assert.match(js, /return clamp\(Number\(intensity \|\| 0\), 0, 1\) \* 120/);
  assert.match(js, /`hsl\(\$\{hue\},100%,50%\)`/);
  assert.match(js, /return \{ color: `hsl\(\$\{hue\},100%,50%\)`, ink: "#121212" \}/);
  assert.match(js, /function rotationHeatColor/);
  assert.match(js, /const saturation = 12 \+ 63 \* t/);
  assert.match(js, /const lightness = 44 \+ 8 \* t/);
  assert.match(js, /`hsl\(150,\$\{saturation\.toFixed\(1\)\}%,\$\{lightness\.toFixed\(1\)\}%\)`/);
  assert.match(js, /const heat=rotationHeatColor\(\(value-low\)\/Math\.max\(1,high-low\)\)/);
  assert.match(js, /phase\.defense\s*\? defenseWaveScore\(item\.seconds\)/);
  assert.match(css, /--good:\s*#00e676/);
  assert.match(css, /--bad:\s*#ff5252/);
  assert.match(css, /--orange:\s*#f59e0b/);
  assert.match(css, /\.chart-line\s*\{[^}]*stroke:\s*var\(--orange\)/);
  assert.match(css, /\.highlight-panel \.big\s*\{[^}]*color:\s*var\(--red-hot\)/);
});

test("clear maps display per-wave and per-rotation saturation", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  const parser = fs.readFileSync(path.join(analyzerDir, "parser.js"), "utf8");
  const css = fs.readFileSync(path.join(analyzerDir, "analyzer.css"), "utf8");
  assert.match(parser, /run\.saturationPerWave = wavePhases\.map\(\(phase\) => calculateRangeOccupancy/);
  assert.match(parser, /run\.saturationPerRotation = rotationPhases\.map\(\(phase\) => calculateRangeSaturation/);
  assert.match(js, /class="phase-saturation"/);
  assert.match(js, /Number\.isFinite\(item\.saturation\)/);
  assert.match(js, /label: String\(index \+ 1\)/);
  assert.match(js, /Round \$\{item\.label\} - Saturation \$\{saturation\}/);
  assert.doesNotMatch(js, /<strong>\$\{h\(item\.label\)\}<\/strong>/);
  assert.match(js, /<small>\$\{shortDuration\(item\.seconds\)\}<\/small><small class="phase-saturation">/);
  assert.match(js, /##\.#% is Saturation per round/);
  assert.match(css, /\.clear-cell-content \.phase-saturation/);
  assert.match(css, /\.round-saturation-legend\s*\{[^}]*margin-left:\s*auto/);
  assert.match(js, /DEFENSE_WAVE_TARGET_SECONDS = 25/);
  assert.match(js, /function defenseWaveScore\(seconds\)/);
  assert.match(js, /Math\.round\(Number\(seconds \|\| 0\)\) <= DEFENSE_WAVE_TARGET_SECONDS/);
  assert.match(js, /phase\.defense\s*\? defenseWaveScore\(item\.seconds\)/);
});

test("Defense wave colors use the same rounded seconds shown in each cell", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  const functionSource = js.match(/function defenseWaveScore\(seconds\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(functionSource);
  const score = new Function(
    "DEFENSE_WAVE_TARGET_SECONDS",
    `${functionSource}; return defenseWaveScore;`,
  )(25);
  assert.equal(score(24.5), 1);
  assert.equal(score(25), 1);
  assert.equal(score(25.4), 1);
  assert.equal(score(25.499), 1);
  assert.equal(score(25.5), 0);
  assert.equal(score(26), 0);
});

test("Interception clear-map colors peak at 6m30s and reach red 10 seconds away", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  assert.match(js, /INTERCEPTION_ROTATION_TARGET = 6 \* 60 \+ 30/);
  assert.match(js, /INTERCEPTION_ROTATION_FADE_SECONDS = 10/);
  assert.match(js, /function interceptionRotationScore\(seconds\)/);
  assert.match(js, /Math\.abs\(value - INTERCEPTION_ROTATION_TARGET\)/);
  assert.match(js, /interception\s*\?\s*interceptionRotationScore\(item\.seconds\)/);
  assert.match(js, /Green at 6m 30s; red at 6m 20s \/ 6m 40s\./);
  assert.match(js, /interception \? "target 6m 30s"/);
  assert.match(js, /interception \? "red ±10s"/);
});

test("saturation labels use each mission mode's configured threshold", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  const parser = fs.readFileSync(path.join(analyzerDir, "parser.js"), "utf8");
  assert.match(parser, /HIGH_DENSITY_SATURATION_TYPES = new Set\(\["SURVIVAL", "DISRUPTION"\]\)/);
  assert.match(parser, /HIGH_DENSITY_SATURATION_EDGES = \[8, 15, 23, 30, 33, 36, 39, 42, 45\]/);
  assert.match(parser, /\? \{ edges: HIGH_DENSITY_SATURATION_EDGES, threshold: 30 \}/);
  assert.match(parser, /calculateRangeSaturation\(run, phase\.from, phase\.to, saturationScale\.threshold\)/);
  assert.match(js, /Time at \$\{threshold\}\+ enemies/);
});

test("saturation summary displays telemetry coverage as a smaller muted right-side metric", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  const css = fs.readFileSync(path.join(analyzerDir, "analyzer.css"), "utf8");
  assert.match(js, /class="saturation-summary-item telemetry-coverage"/);
  assert.match(js, /Telemetry coverage/);
  assert.match(js, /telemetryLabel/);
  assert.match(js, /=== 100 \? "100"/);
  assert.match(css, /\.saturation-summary\s*\{[^}]*grid-template-columns:\s*repeat\(2,/);
  assert.match(css, /\.saturation-summary-item\s*\{[^}]*grid-template-rows:\s*auto auto[^}]*row-gap:\s*10px/);
  assert.match(css, /\.saturation-summary \.big\s*\{[^}]*line-height:\s*1/);
  assert.match(css, /\.telemetry-coverage\s*\{[^}]*width:\s*100%[^}]*justify-self:\s*stretch[^}]*justify-items:\s*end[^}]*text-align:\s*right/);
  assert.match(css, /\.saturation-card \.telemetry-coverage \.big\s*\{[^}]*color:\s*var\(--muted\)[^}]*font-size:\s*30px/);
});

test("small report annotations use brighter colors and larger type", () => {
  const css = fs.readFileSync(path.join(analyzerDir, "analyzer.css"), "utf8");
  assert.match(css, /\.report-sheet\s*\{[^}]*--muted:\s*#aaaab5;[^}]*--muted-2:\s*#858691;[^}]*--report-subtext-size:\s*12px/);
  assert.match(css, /\.card-subtitle\s*\{[^}]*font-size:\s*var\(--report-subtext-size\)/);
  assert.match(css, /\.kpi-label\s*\{[^}]*font-size:\s*10px/);
  assert.match(css, /\.kpi-note\s*\{[^}]*font-size:\s*var\(--report-subtext-size\)/);
  assert.match(css, /\.highlight-panel \.mini\s*\{[^}]*font-size:\s*var\(--report-subtext-size\)/);
  assert.match(css, /\.chart-label\s*\{[^}]*font-size:\s*var\(--report-subtext-size\)/);
  assert.match(css, /\.chart-accent\s*\{[^}]*font-size:\s*var\(--report-subtext-size\)/);
  assert.match(css, /\.heat-legend\s*\{[^}]*font-size:\s*var\(--report-subtext-size\)/);
  assert.match(css, /\.minimap-status\s*\{[^}]*font-size:\s*var\(--report-subtext-size\)/);
  assert.match(css, /\.report-footer\s*\{[^}]*font-size:\s*var\(--report-subtext-size\)/);
  assert.match(css, /\.saturation-card \.metric-row\s*\{[^}]*font-size:\s*13px/);
});

test("report timestamps use readable mission-relative elapsed time", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  assert.match(js, /function phaseDuration\(seconds\)/);
  assert.match(js, /value < 60 \? `\$\{fmt\(value, 1\)\}s` : shortDuration\(value\)/);
  assert.match(js, /phaseDuration\(avg\(phase\.items\.map/);
  assert.match(js, /phaseDuration\(item\.seconds\)/);
  assert.match(js, /function elapsedAt\(run, timestamp\)/);
  assert.match(js, /Number\(timestamp \|\| 0\) - start/);
  assert.match(js, /parts\.push\(`\$\{hours\}h`\)/);
  assert.match(js, /parts\.push\(`\$\{minutes\}m`\)/);
  assert.match(js, /parts\.push\(`\$\{secs\}s`\)/);
  assert.match(js, /at \$\{elapsedAt\(run, peak\.time\)\}/);
  assert.match(js, /at \$\{elapsedAt\(run, item\[1\]\)\}/);
  assert.match(js, /timestamp >= run\.startTime && timestamp <= run\.endTime/);
  assert.doesNotMatch(js, /at \$\{shortDuration\(peak\.time\)\}/);
});

test("actual Vitus luck uses upper-bound bands instead of nearest totals", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  assert.match(js, /Parser\.classifyVitusScenario\(result\.scenarios, actual\)/);
  assert.doesNotMatch(js, /Math\.abs\(a\.total-actual\)/);
});

test("actual Vitus luck headline follows the red-to-green performance grade", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  const css = fs.readFileSync(path.join(analyzerDir, "analyzer.css"), "utf8");
  assert.match(js, /function vitusLuckColor\(scenarios, classified\)/);
  assert.match(js, /heatColor\(index \/ Math\.max\(1, scenarios\.length - 1\)\)\.color/);
  assert.match(js, /function standardNormalCdf\(z\)/);
  assert.match(js, /function vitusTailChance\(result, actual\)/);
  assert.match(js, /const lowerTail = actual <= mean/);
  assert.match(js, /lowerTail \? cumulative : 1 - cumulative/);
  assert.match(js, /return `\$\{actual <= result\.mean \? "Bottom" : "Top"\} \$\{chance\} Luck`/);
  assert.match(js, /<th>CHANCE<\/th><th>TOTAL<\/th><th>LUCK LEVEL<\/th>/);
  assert.match(js, /id="vitusDelta" class="mini vitus-delta"/);
  assert.match(js, /id="vitusLuck"[\s\S]*?<strong>\$\{h\(classified\.label\)\}<\/strong><div class="mini vitus-tail">/);
  assert.match(js, /luck\.style\.setProperty\("--luck-color", vitusLuckColor\(result\.scenarios, classified\)\)/);
  assert.match(css, /\.vitus-luck strong\s*\{[^}]*color:\s*var\(--luck-color, #f5f5f7\)/);
  assert.match(css, /\.vitus-actual,\s*\.vitus-luck\s*\{[^}]*display:\s*grid;[^}]*grid-template-rows:\s*17px calc\(var\(--report-subtext-size\) \* 1\.55\);[^}]*row-gap:\s*4px/);
  assert.match(css, /\.vitus-entry-label,\s*\.vitus-luck strong\s*\{[^}]*font:\s*850 17px\/1 system-ui, sans-serif/);
  assert.match(css, /\.vitus-luck \.mini\s*\{[^}]*margin-top:\s*0/);
  assert.match(css, /\.vitus-entry-group\s*\{[^}]*column-gap:\s*12px/);
  assert.match(css, /\.vitus-rate\s*\{[^}]*font-size:\s*18px/);
  assert.match(css, /\.vitus-input\s*\{[^}]*width:\s*72px/);
  assert.match(css, /\.vitus-table\s*\{[^}]*table-layout:\s*fixed/);
  assert.match(css, /\.vitus-table th,\s*\.vitus-table td\s*\{[^}]*width:\s*33\.333%[^}]*text-align:\s*left/);
});

test("actual Vitus chance appears for every luck level as a top or bottom tail", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  const cdfSource = js.match(/function standardNormalCdf\(z\) \{[\s\S]*?\n  \}/)?.[0];
  const percentSource = js.match(/function formatChancePercent\(percentile\) \{[\s\S]*?\n  \}/)?.[0];
  const tailSource = js.match(/function vitusTailChance\(result, actual\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(cdfSource);
  assert.ok(percentSource);
  assert.ok(tailSource);
  const tailChance = new Function(
    "clamp",
    `${cdfSource}; ${percentSource}; ${tailSource}; return vitusTailChance;`,
  )((value, low, high) => Math.min(high, Math.max(low, value)));
  const formatPercent = new Function(
    "clamp",
    `${percentSource}; return formatChancePercent;`,
  )((value, low, high) => Math.min(high, Math.max(low, value)));
  const worst = { label: "Worst Case" };
  const unlucky = { label: "Unlucky" };
  const average = { label: "Average" };
  const high = { label: "High Roll" };
  const god = { label: "God Roll" };
  const result = { mean: 624, standardDeviation: 40, scenarios: [worst, unlucky, average, high, god] };
  assert.equal(tailChance(result, 69, worst), "<0.01%");
  assert.equal(tailChance(result, 580, unlucky), "13.6%");
  assert.equal(tailChance(result, 624, average), "50%");
  assert.equal(tailChance(result, 668, high), "13.6%");
  assert.equal(tailChance(result, 1200, god), "<0.01%");
  assert.equal(tailChance(result, 624 + 2.326 * 40, god), "1%");
  assert.equal(formatPercent(.094), "0.09%");
  assert.equal(formatPercent(.0094), "<0.01%");
});

test("Expected Vitus table presents descending chances to reach each total", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  const source = js.match(/function formatVitusScenarioChance\(chance\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(source);
  const context = {};
  vm.runInNewContext(`${source}; result = ["99%", "90%", "75%", "50%", "25%", "10%", "1%"].map(formatVitusScenarioChance);`, context);
  assert.deepEqual(Array.from(context.result), ["99%", "90%", "75%", "50%", "25%", "10%", "1%"]);
});

test("every 3D tileset page groups its guide links like the homepage", () => {
  const tilesetsDir = path.resolve(analyzerDir, "..", "3d_tilesets");
  const pages = [tilesetsDir, ...fs.readdirSync(tilesetsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(tilesetsDir, entry.name))]
    .map((directory) => path.join(directory, "index.html"))
    .filter((file) => fs.existsSync(file));
  assert.ok(pages.length > 1);
  pages.forEach((file) => {
    const source = fs.readFileSync(file, "utf8");
    assert.match(
      source,
      /<nav class="guide-tab-links"[\s\S]*?href="\/">Return to Guide<\/a>[\s\S]*?href="\/analyzer\/">Analyzer<\/a>[\s\S]*?<\/nav>/,
      file,
    );
    assert.match(source, /@view-transition\s*\{\s*navigation:\s*auto/);
    assert.match(source, /@media \(hover: none\) and \(pointer: coarse\)[\s\S]*?href="\/analyzer\/"/);
  });
});

test("minimap catalog covers every supported Arbitration node and alternate layout", () => {
  const source = fs.readFileSync(path.join(analyzerDir, "minimaps", "catalog.js"), "utf8");
  const context = {};
  vm.runInNewContext(source, context);
  const bundle = context.ArbitrationMinimapCatalog;
  assert.equal(bundle.version, 2);
  assert.equal(Object.keys(bundle.nodes).length, 43);
  assert.equal(Object.keys(bundle.catalog).length, 24);
  assert.deepEqual(Array.from(bundle.nodes.SolNode305), ["stofler"]);
  assert.equal(bundle.catalog.stofler.floorFilter.label, "bottom");
  assert.ok(Math.abs(bundle.catalog.stofler.floorFilter.maxY - (-17.9305)) < .001);
  assert.equal(bundle.catalog.stofler.floorFilter.minWave, 7);
  assert.equal(Object.keys(bundle.catalog.stofler.spawnPoints).length, 84);
  assert.ok(bundle.catalog.stofler.spawnPoints[293]);
  assert.ok(bundle.catalog.stofler.spawnPoints[299]);
  assert.ok(bundle.catalog.stofler.spawnPoints[335]);
  assert.match(bundle.catalog.stofler.src, /bottom-floor-20260816/);
  const gasSpawn04 = bundle.catalog["callisto+sinai+io"];
  assert.match(gasSpawn04.src, /runtime-edge-rooms-20260822/);
  assert.equal(gasSpawn04.proceduralSpawnExtras.minMatchedPoints, 24);
  assert.equal(gasSpawn04.proceduralSpawnExtras.minObservedCoverage, .9);
  for (const id of ["runtime-edge-1", "runtime-edge-2", "runtime-edge-3"]) {
    const [x, , z] = gasSpawn04.spawnPoints[id][0];
    const pixelX = gasSpawn04.matrix[0] * x + gasSpawn04.matrix[2];
    const pixelY = gasSpawn04.matrix[4] * z + gasSpawn04.matrix[5];
    assert.ok(pixelX >= 20 && pixelX <= 980);
    assert.ok(pixelY >= 20 && pixelY <= 980);
  }
  const gasSpawn02 = bundle.catalog["callisto+sinai+io~2"];
  assert.equal(gasSpawn02.proceduralSpawnExtras.minMatchedPoints, 24);
  assert.equal(gasSpawn02.proceduralSpawnExtras.minObservedCoverage, .9);
  assert.deepEqual(
    Array.from(gasSpawn02.spawnPoints["runtime-edge-6"][0]),
    [77.0371, -4, 78.7949],
  );
  const kadesh = bundle.catalog["alator+kadesh+spear"];
  assert.match(kadesh.src, /clockwise-20260821/);
  assert.equal(kadesh.matrix[0], 0);
  assert.ok(kadesh.matrix[1] > 0);
  assert.ok(kadesh.matrix[3] < 0);
  assert.equal(kadesh.matrix[4], 0);
  const outpost1 = bundle.catalog["sechura+tessera+outer_terminus+cerberus"];
  const outpost2 = bundle.catalog["sechura+tessera+outer_terminus+cerberus~2"];
  const outpost3 = bundle.catalog["sechura+tessera+outer_terminus+cerberus~3"];
  for (const outpost of [outpost1, outpost2, outpost3]) {
    assert.equal(outpost.proceduralSpawnExtras.minMatchedPoints, 24);
    assert.equal(outpost.proceduralSpawnExtras.minObservedCoverage, .9);
  }
  assert.match(outpost1.src, /north-spawn-room-20260822/);
  assert.match(outpost2.src, /clean-floor-20260821/);
  assert.match(outpost3.src, /right-spawn-floor-20260821/);
  const asteroidDefense = bundle.catalog["rhea+lares+sangeru"];
  assert.equal(asteroidDefense.proceduralSpawnExtras.minMatchedPoints, 24);
  assert.equal(asteroidDefense.proceduralSpawnExtras.minObservedCoverage, .9);
  const corpusShip = bundle.catalog["cytherean+xini+gulliver+romula+proteus"];
  assert.match(corpusShip.src, /cytherean\+xini\+gulliver\+romula\+proteus-clockwise\.webp/);
  assert.match(corpusShip.src, /runtime-side-rooms-20260821/);
  assert.equal(corpusShip.matrix[0], 0);
  assert.ok(corpusShip.matrix[1] > 0);
  assert.ok(corpusShip.matrix[3] < 0);
  assert.equal(corpusShip.matrix[4], 0);
  assert.equal(corpusShip.proceduralSpawnExtras.minMatchedPoints, 24);
  assert.equal(corpusShip.proceduralSpawnExtras.minObservedCoverage, .9);
  assert.equal(Object.values(corpusShip.spawnPoints).flat().length, 406);
  assert.deepEqual(Array.from(corpusShip.spawnPoints["392"][0]), [6.522, -20, -31.078]);
  assert.deepEqual(Array.from(corpusShip.spawnPoints["578"][0]), [66.95, 1.15, -6.25]);
  assert.deepEqual(Array.from(corpusShip.spawnPoints["d1-defense-001"][0]), [-83.3, -1.889, -2.4]);
  assert.deepEqual(Array.from(corpusShip.spawnPoints["d1-defense-090"][0]), [64.869, -19.954, 19.272]);
  const elevatedRuntimePoints = Object.values(corpusShip.spawnPoints).flat()
    .filter(([, y, z]) => y >= 12 && Math.abs(z) >= 80);
  assert.equal(elevatedRuntimePoints.length, 24);
  for (const [x, , z] of elevatedRuntimePoints) {
    const pixelX = corpusShip.matrix[0] * x + corpusShip.matrix[1] * z + corpusShip.matrix[2];
    const pixelY = corpusShip.matrix[3] * x + corpusShip.matrix[4] * z + corpusShip.matrix[5];
    assert.ok(pixelX >= 60 && pixelX <= 940);
    assert.ok(pixelY >= 60 && pixelY <= 940);
  }
  const hydron = bundle.catalog["hydron+helene+odin"];
  assert.match(hydron.src, /hydron\+helene\+odin-counterclockwise\.webp/);
  assert.match(hydron.src, /counterclockwise-20260821/);
  assert.equal(hydron.matrix[0], 0);
  assert.ok(hydron.matrix[1] < 0);
  assert.ok(hydron.matrix[3] > 0);
  assert.equal(hydron.matrix[4], 0);
  for (const [, positions] of Object.entries(hydron.spawnPoints)) {
    for (const [x, , z] of positions) {
      const pixelX = hydron.matrix[0] * x + hydron.matrix[1] * z + hydron.matrix[2];
      const pixelY = hydron.matrix[3] * x + hydron.matrix[4] * z + hydron.matrix[5];
      assert.ok(pixelX >= 0 && pixelX <= hydron.width);
      assert.ok(pixelY >= 0 && pixelY <= hydron.height);
    }
  }
  const hyf = bundle.catalog.hyf;
  assert.match(hyf.src, /multi-floor-20260821/);
  assert.equal(Object.values(hyf.spawnPoints).flat().length, 146);
  const orokinTower = bundle.catalog["mithra+taranis+belenus"];
  assert.match(orokinTower.src, /ceiling-trim-20260820/);
  assert.deepEqual(Array.from(orokinTower.matrix), [
    -5.205633803, 0, 499.999969482,
    0, -5.205633803, 500,
  ]);
  assert.equal(orokinTower.interceptionMarkers, 4);
  assert.equal(Object.keys(orokinTower.spawnPoints).length, 95);
  assert.equal(bundle.nodes.SolNode85.length, 2);
});

test("Stofler spawn analysis keeps wave 7+ points that align to the bottom-floor minimap", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  assert.match(js, /function analyzerSpawnPoints\(run\)/);
  assert.match(js, /Number\.isFinite\(floorFilter\?\.minWave\)/);
  assert.match(js, /Number\(wave\) >= floorFilter\.minWave/);
  assert.match(js, /SpawnAlignment\.matchingSubset\(points, floorConfig\)/);
  assert.match(js, /function renderSpawnColumn\(run\) \{\s*const points = analyzerSpawnPoints\(run\);/);
});
