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
  assert.match(html, /minimaps\/catalog-20260825-7\.js/);
  assert.match(html, /analyzer-20260901-136\.js/);
  assert.match(html, /analyzer\.css\?v=20260830-98/);
  assert.match(html, /document\.documentElement\.dataset\.analyzerLayout = "correlation-test"/);
  assert.match(html, /correlation-test\.css\?v=20260825-40/);
  assert.doesNotMatch(html, /URLSearchParams\(location\.search\).*layout/);
  assert.match(html, /submission\.js/);
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  assert.match(js, /image\/png/);
  assert.match(js, /new ClipboardItem/);
  assert.match(js, /const DISPLAY_PREFERENCES_KEY = "arbi-analyzer-display-v1"/);
  assert.match(js, /localStorage\.getItem\(DISPLAY_PREFERENCES_KEY\)/);
  assert.match(js, /localStorage\.setItem\(DISPLAY_PREFERENCES_KEY, JSON\.stringify/);
  assert.match(js, /widthStep: initialDisplayPreferences\.widthStep/);
  assert.match(js, /saveDisplayPreferences\(\);\s*applyDisplayControls\(\)/);
  assert.match(js, /await inlineImagesForExport\(stage\)/);
  assert.match(js, /stabilizeExportWhitespace\(stage\)/);
  assert.match(js, /function stabilizeExportWhitespace\(root\)/);
  assert.match(js, /document\.createTreeWalker\(root, 4\)/);
  assert.match(js, /node\.nodeValue = exportSafeWhitespace\(value\)/);
  const whitespaceSource = js.match(/function exportSafeWhitespace\(value\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(whitespaceSource);
  const whitespaceContext = {};
  vm.runInNewContext(`${whitespaceSource}; result = exportSafeWhitespace("20s Drone despawns: 0");`, whitespaceContext);
  assert.equal(whitespaceContext.result, "20s\u00a0Drone\u00a0despawns:\u00a00");
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
  assert.match(html, /id="savedRunsToggle"[^>]*aria-expanded="false"/);
  assert.match(html, /id="tilesetAverageToggle"[^>]*aria-pressed="true"[^>]*>Toggle \+\/- tileset averages<\/button>/);
  assert.ok(html.indexOf('id="tilesetAverageToggle"') < html.indexOf('id="savedRunsToggle"'));
  assert.match(html, /SAVED ANALYZED ARBIS/);
  assert.match(html, /id="savedRunList"[^>]*hidden/);
  assert.match(js, /function clearRuns\(\)/);
  assert.match(js, /const SAVED_RUN_DB_NAME = "arbi-analyzer-saved-runs"/);
  assert.match(js, /const TILESET_AVERAGES_VISIBLE_KEY = "arbi-analyzer-tileset-averages-visible-v1"/);
  assert.match(js, /return saved === null \? true : saved !== "false"/);
  assert.match(js, /localStorage\.setItem\(TILESET_AVERAGES_VISIBLE_KEY, String\(state\.showTilesetAverages\)\)/);
  assert.match(js, /button\.setAttribute\("aria-pressed", String\(state\.showTilesetAverages\)\)/);
  assert.match(js, /indexedDB\.open\(SAVED_RUN_DB_NAME, SAVED_RUN_SCHEMA_VERSION\)/);
  assert.match(js, /function savedRunSnapshot\(run\)/);
  assert.match(js, /snapshot\.actualVitus = cleanVitusDigits\(run\.actualVitus\)/);
  assert.match(js, /function persistSavedActualVitus\(run\)/);
  assert.match(js, /record\.run\.actualVitus = actualVitus/);
  assert.match(js, /persistSavedActualVitus\(run\);/);
  assert.match(js, /await initializeSavedRuns\(\)/);
  assert.match(js, /restoreSavedActualVitus\(run\)/);
  assert.match(js, /never stores the source EE\.log text/);
  assert.match(js, /"sourceName"/);
  assert.match(js, /transaction\.objectStore\(SAVED_RUN_STORE_NAME\)\.put\(record\)/);
  assert.match(js, /state\.savedRuns\.push\(\{ \.\.\.record, run: reviveSavedRun\(record\) \}\)/);
  assert.match(js, /data-saved-delete=/);
  assert.match(js, /localRunDate\(run\)/);
  assert.match(js, /function sortSavedRuns\(records\)/);
  assert.match(js, /normalizedRunDate\(left\.run\)\?\.valueOf\(\)/);
  assert.match(js, /sortSavedRuns\(state\.savedRuns\)/);
  assert.match(js, /id="saveRunBtn" class="save-run-button"/);
  assert.match(js, /pulseSavedRunsHeading\(\)/);
  assert.match(js, /SpawnSubmission\.submitRuns\(runs, buildContribution, options\)/);
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
  assert.match(js, /replaceVitusCard\(run, \{ focusInput: true \}\)/);
  assert.match(js, /function focusActualVitusEntry\(settle = false\)/);
  assert.match(js, /input\.focus\(\{ preventScroll: true \}\)/);
  assert.match(js, /const end = input\.value\.length;\s*input\.setSelectionRange\(end, end\)/);
  assert.match(js, /if \(settle\) setTimeout\(\(\) => requestAnimationFrame\(applyFocus\), 0\)/);
  assert.match(js, /type="text" inputmode="numeric" pattern="\[0-9\]\*" maxlength="4" autocomplete="off"/);
  assert.match(js, /const digits = cleanVitusDigits\(input\.value\)/);
  assert.match(js, /function cleanVitusDigits\(value\)\s*\{\s*return String\(value \?\? ""\)\.replace\(\/\\D\/g, ""\)\.slice\(0, 4\)/);
  assert.match(js, /run\.actualVitus = ""/);
  assert.match(js, /renderReport\(state\.runs\[state\.activeIndex\]\);\s*focusActualVitusEntry\(\)/);
  assert.match(js, /if \(settleFocus\) focusActualVitusEntry\(true\)/);
  assert.match(js, /zone\.addEventListener\("drop",\(event\)=>importFile\(event\.dataTransfer\.files\[0\], true\)\)/);
  assert.match(js, /importFile\(event\.dataTransfer\.files\[0\], true\)/);
  assert.match(js, /renderReport\(state\.runs\[state\.activeIndex\]\); focusActualVitusEntry\(\)/);
  assert.match(js, /renderReport\(next\.run\);\s*focusActualVitusEntry\(\)/);
  assert.match(js, /PLAYER_PRIVACY_TTL_MS = 365 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(js, /hidePlayerNames: loadPlayerNamePrivacy\(\)/);
  assert.match(js, /expiresAt: Date\.now\(\) \+ PLAYER_PRIVACY_TTL_MS/);
  assert.match(js, /names\.map\(\(_, index\) => `Player \$\{index \+ 1\}`\)/);
  assert.match(js, /id="squadPrivacyToggle"/);
  assert.match(js, /savePlayerNamePrivacy\(\)/);
  assert.match(js, /function syncSquadPrivacy\(root, run\)/);
  assert.match(js, /root\.querySelectorAll\("\.squad-player"\)\.forEach/);
  assert.match(js, /savePlayerNamePrivacy\(\);\s*syncSquadPrivacy\(\$\("#reportRoot"\), run\)/);
  assert.doesNotMatch(js, /savePlayerNamePrivacy\(\);\s*renderReport\(run\)/);
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
  assert.match(js, /class="minimap-stage" data-minimap-width="\$\{mapWidth\}" data-minimap-height="\$\{mapHeight\}"/);
  assert.match(js, /preserveAspectRatio="none"/);
  assert.match(js, /function syncMinimapStages\(root = document\)/);
  assert.match(js, /const scale = Math\.min\(availableWidth \/ mapWidth, availableHeight \/ mapHeight\)/);
  assert.match(js, /syncMinimapStages\(minimap\)/);
  assert.match(js, /syncMinimapStages\(report\)/);
  assert.match(css, /\.minimap-wrap\s*\{[^}]*display:\s*flex[^}]*align-items:\s*center[^}]*justify-content:\s*center/);
  assert.match(css, /\.minimap-stage\s*\{[^}]*position:\s*relative[^}]*flex:\s*0 0 auto/);
  assert.match(css, /\.minimap-stage > img\s*\{[^}]*position:\s*absolute[^}]*width:\s*100%[^}]*height:\s*100%[^}]*object-fit:\s*fill/);
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
  assert.match(css, /\.report-sheet\s*\{[^}]*width:\s*1600px/);
  assert.match(css, /\.export-stage\s*\{[^}]*width:\s*1652px/);
  assert.doesNotMatch(css, /\.export-stage\s*\{[^}]*--report-scale|\.export-stage\s*\{[^}]*--report-gap/);
  assert.doesNotMatch(css, /\.export-stage \.report-sheet\s*\{[^}]*width:|\.export-stage \.report-sheet\s*\{[^}]*font-size:/);
  assert.doesNotMatch(css, /\.export-stage \.card\s*\{|\.export-stage \.clear-heat-map\s*\{/);
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
  assert.match(css, /\.dashboard-cadence-card > \.cadence-summary\s*\{[^}]*margin-top:\s*13px/);
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
  assert.match(js, /\["SURVIVAL", "DISRUPTION", "VOID CASCADE"\]\.includes\(run\.missionType\)/);
  assert.match(js, /kpi\("Drones despawned", fmt\(run\.dronesDespawned \|\| 0\), "Despawn after 20s"\)/);
  assert.match(js, /: kpi\(`Drones \/ \$\{phase\.noun\}`/);
  assert.doesNotMatch(js, /debug-export/);
  assert.match(css, /\.dashboard-layout \.clear-heat-map\s*\{[^}]*repeat\(25/);
  assert.match(css, /\.dashboard-no-spawns \.clear-heat-map\s*\{[^}]*repeat\(10/);
  assert.match(css, /\.export-stage \.activity-card\s*\{[^}]*display:\s*none\s*!important/);
  assert.match(css, /\.squad-privacy-toggle\.is-hidden\s*\{[^}]*color:\s*var\(--red-hot\)/);
  assert.match(css, /\.squad-privacy-toggle\.is-hidden::after/);
  assert.doesNotMatch(js, /class="squad-label">Squad/);
  assert.doesNotMatch(css, /\.squad-player \+ \.squad-player::before|\.squad-player \+ \.squad-phase::before/);
  assert.match(js, /class="squad-member"><span class="squad-player">[\s\S]*?<i class="squad-separator" aria-hidden="true"><\/i>/);
  assert.match(css, /\.squad-member\s*\{[^}]*display:\s*inline-flex[^}]*align-items:\s*center[^}]*flex:\s*0 0 auto/);
  assert.match(css, /\.squad-separator\s*\{[^}]*width:\s*5px[^}]*height:\s*5px[^}]*margin:\s*0 8px[^}]*border-radius:\s*50%[^}]*background:\s*#d9dae2/);
  assert.match(css, /\.squad-player, \.squad-phase\s*\{[^}]*display:\s*inline-flex[^}]*align-items:\s*center/);
  assert.match(css, /\.squad-privacy-toggle\s*\{[^}]*margin:\s*0 6px 0 0/);
  assert.match(css, /\.export-stage \.squad-privacy-toggle\s*\{[^}]*display:\s*none\s*!important/);
  assert.match(css, /\.report-header-accent\s*\{[^}]*bottom:\s*-2px[^}]*width:\s*var\(--header-accent-width,\s*175px\)/);
  assert.doesNotMatch(css, /\.report-header::after/);
  assert.match(js, /<span class="report-header-accent" aria-hidden="true"><\/span>/);
  assert.match(js, /function syncReportHeaderAccent\(root = document\)/);
  assert.match(js, /titleRect\.right - headerRect\.left/);
  assert.match(js, /header\.style\.setProperty\("--header-accent-width"/);
  assert.match(js, /accent\.style\.width = cssWidth/);
  assert.match(js, /function measureExportStage\(stage, report\)/);
  assert.match(js, /report\.getBoundingClientRect\(\)/);
  assert.doesNotMatch(js, /width:\s*stage\.scrollWidth|height:\s*stage\.scrollHeight|windowHeight:\s*Math\.max\(stage\.scrollHeight/);
  assert.match(js, /setupAnalyzerTooltips\(\$\("#reportRoot"\)\);\s*syncMinimapStages\(\$\("#reportRoot"\)\);\s*syncReportHeaderAccent\(\$\("#reportRoot"\)\);\s*scheduleReportFit\(\)/);
  assert.match(js, /syncReportHeaderAccent\(report\);\s*const captureBounds = measureExportStage\(stage, report\)/);
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
    path.join(analyzerDir, "minimaps", "catalog-20260825-7.js"),
    "utf8",
  );
  assert.match(html, /minimaps\/catalog-20260825-7\.js/);
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
  assert.match(minimapBuilder, /INFESTED_SHIP_SURFACE_BANDS = \(/);
  assert.match(minimapBuilder, /def render_infested_ship_walkable_floor\(/);
  assert.match(catalog, /akkad\+kala-azar\.webp\?v=walkable-layers-20260827/);
  assert.match(minimapBuilder, /KADESH_COMPONENT_BAND_ANCHORS/);
  assert.match(minimapBuilder, /16\.4: \(\(21\.0, 16\.4, 39\.0\),\)/);
  assert.match(catalog, /alator\+kadesh\+spear\.webp\?v=upper-floors-20260823/);
});

test("production Analyzer starts cleared instead of loading bundled demo runs", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  assert.doesNotMatch(js, /prepareRuns\(makeDemoRuns\(\)/);
  assert.match(js, /renderRunList\(\);\s*renderReport\(null\);/);
  assert.match(js, />Most Active</);
  assert.doesNotMatch(js, />Busiest spawn points</i);
});

test("minimap image and spawn overlay share one fitted stage after card stretching", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  const functionSource = js.match(/function syncMinimapStages\(root = document\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(functionSource);
  const wideStage = { dataset: { minimapWidth: "1000", minimapHeight: "1000" }, style: {} };
  const shortStage = { dataset: { minimapWidth: "1000", minimapHeight: "1000" }, style: {} };
  const root = {
    querySelectorAll() {
      return [
        { clientWidth: 500, clientHeight: 900, querySelector: () => wideStage },
        { clientWidth: 500, clientHeight: 420, querySelector: () => shortStage },
      ];
    },
  };
  vm.runInNewContext(`${functionSource}; syncMinimapStages(root);`, { root });
  assert.deepEqual(wideStage.style, { width: "500px", height: "500px" });
  assert.deepEqual(shortStage.style, { width: "420px", height: "420px" });
});

test("large logs use the same parser through a same-origin parallel scanner", () => {
  const html = fs.readFileSync(path.join(analyzerDir, "index.html"), "utf8");
  const parser = fs.readFileSync(path.join(analyzerDir, "parser.js"), "utf8");
  const worker = fs.readFileSync(path.join(analyzerDir, "scanner-worker.js"), "utf8");
  assert.match(parser, /PARALLEL_PARSE_MIN_BYTES = 512 \* 1024 \* 1024/);
  assert.match(parser, /return await parseFileParallel\(file, onProgress\)/);
  assert.match(parser, /new Worker\(workerUrl/);
  assert.match(parser, /parser\.feedLine\(lines\[index \+ 1\], lines\[index\]\)/);
  assert.match(worker, /importScripts\("\.\/parser\.js\?v=20260901-82"\)/);
  assert.match(worker, /Parser\.forEachRelevantLine/);
  assert.match(worker, /lines\.push\(internToken\(token\), detach\(line\)\)/);
  assert.match(parser, /scanner-worker\.js\?v=20260901-15/);
  assert.match(html, /parser\.js\?v=20260901-82/);
});

test("Expected Vitus uses explicit booster copy without unscoped mod detection", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  const immutableJs = fs.readFileSync(path.join(analyzerDir, "analyzer-20260901-136.js"), "utf8");
  assert.equal(immutableJs, js);
  const parser = fs.readFileSync(path.join(analyzerDir, "parser.js"), "utf8");
  assert.match(js, /Blessing, Both Boosters and Resourceful Retriever\./);
  assert.match(js, /Both Boosters and Resourceful Retriever\./);
  assert.doesNotMatch(js, /the logged Drop Blessing had expired/);
  assert.match(js, /computeVitus\(run\.droneKills, run\.rotations, run\.missionType, effectiveBlessedDroneKills\(run\)\)/);
  assert.match(parser, /ResourceDropChanceBlessingStoreItem/);
  assert.match(parser, /const BOOSTED_DROP_CHANCE = 0\.12/);
  assert.doesNotMatch(js, /MISSING RESOURCEFUL RETRIEVER MOD/);
  assert.doesNotMatch(parser, /BeastResourceDoublingMod|resourcefulRetrieverDetected/);
});

test("Expected Vitus card style selector persists and stays out of copied images", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  const css = fs.readFileSync(path.join(analyzerDir, "analyzer.css"), "utf8");
  assert.match(js, /const VITUS_CARD_STYLE_KEY = "arbi-analyzer-vitus-card-style-v1"/);
  assert.match(js, /Object\.freeze\(\["original", "gauge", "curve"\]\)/);
  assert.match(js, /localStorage\.getItem\(VITUS_CARD_STYLE_KEY\)/);
  assert.match(js, /localStorage\.setItem\(VITUS_CARD_STYLE_KEY, state\.vitusCardStyle\)/);
  assert.match(js, /<summary aria-label="Change Expected Vitus card">Change<\/summary>/);
  assert.match(js, /const labels = \{ original: "Original", gauge: "Gauge", curve: "Curve" \}/);
  assert.match(js, /vitus-style-option\$\{state\.vitusCardStyle === style \? " is-selected" : ""\}/);
  assert.match(js, /document\.querySelector\("\.vitus-style-selector\[open\]"\)/);
  assert.match(js, /selector&&!selector\.contains\(event\.target\)\) selector\.removeAttribute\("open"\)/);
  assert.match(js, /function renderVitusGauge\(run, result, view\)/);
  assert.match(js, /function renderVitusCurve\(run, result, view\)/);
  assert.match(js, /function renderVitusInput\(view\)[\s\S]*?class="vitus-input"/);
  assert.equal((js.match(/\$\{renderVitusInput\(view\)\}/g) || []).length, 3);
  assert.doesNotMatch(js, /vitus-design-input/);
  assert.equal((js.match(/const isMean = scenario\.label === "Average"/g) || []).length, 2);
  assert.doesNotMatch(js, /Number\(scenario\.z\) === 0/);
  assert.match(js, /const textColor = isMean \? "#72c7ff" : "#8a8b96"/);
  assert.match(js, /const rate = view\.rate === null \? "⎵"/);
  assert.match(js, /view\.tilesetExpected === null \? "⎵"/);
  assert.match(js, /TILESET_AVERAGE_ENDPOINT = "\/api\/analyzer\/spawns\/averages"/);
  assert.match(js, /tilesetAverageVitusRate/);
  assert.match(css, /\.vitus-style-option\.is-selected\s*\{[^}]*background:\s*#30313a/);
  assert.match(css, /\.vitus-style-selector\s*\{[^}]*width:\s*92px/);
  assert.match(css, /\.vitus-style-selector summary\s*\{[^}]*width:\s*100%/);
  assert.match(css, /\.vitus-style-menu\s*\{[^}]*width:\s*100%/);
  assert.match(css, /\.vitus-style-selector summary\s*\{[^}]*font-size:\s*14px/);
  assert.match(css, /\.vitus-style-option\s*\{[^}]*font:\s*800 14px/);
  assert.match(css, /\.vitus-card--curve \.vitus-design-rate\s*\{[^}]*position:\s*relative[^}]*z-index:\s*2/);
  assert.match(css, /\.vitus-card--curve \.vitus-design-rate-delta\s*\{[^}]*position:\s*absolute[^}]*top:\s*100%[^}]*right:\s*0[^}]*pointer-events:\s*none/);
  assert.match(css, /\.export-stage \.vitus-style-selector\s*\{\s*display:\s*none !important/);
});

test("rare Vitus event stars stay attached to their chart positions inside PNG-safe SVG bounds", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  assert.match(js, /const cy = 154/);
  assert.match(js, /vitusStarPath\(marker\[0\], marker\[1\], 16\.5, 7\)/);
  assert.match(js, /vitusStarPath\(marker\[0\] \+ tangent\[0\] \* 19, marker\[1\] \+ tangent\[1\] \* 19, 10, 4\.3\)/);
  assert.match(js, /const curveHeight = 176;\s*const axisHeight = 44;\s*const height = curveHeight \+ axisHeight/);
  assert.match(js, /vitusStarPath\(actualX, actualY, 13, 5\.5\)/);
  assert.match(js, /vitusStarPath\(actualX \+ 11, actualY \+ 11, 9, 3\.9\)/);
  assert.match(js, /<g transform="translate\(0 \$\{curveHeight\}\)">\$\{axis\}<\/g>/);
  assert.doesNotMatch(js, /const starMarker|const starX = clamp\(actualX/);
});

test("empty analyzer drag overlay releases when a file leaves or drag events stop", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  assert.match(js, /const clearEmptyPageDrag=\(\)=>\{/);
  assert.match(js, /pageDragReleaseTimer=setTimeout\(clearEmptyPageDrag,750\)/);
  assert.match(js, /const leftViewport=event\.target===document\|\|event\.target===document\.documentElement/);
  assert.match(js, /document\.addEventListener\("dragend",clearEmptyPageDrag\)/);
  assert.match(js, /addEventListener\("blur",clearEmptyPageDrag\)/);
});

test("fresh client Blessing override lasts three hours from mission start", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  const blessedSource = js.match(/function effectiveBlessedDroneKills\(run\) \{[\s\S]*?\n  \}/)?.[0];
  const expirySource = js.match(/function effectiveBlessingExpiry\(run\) \{[\s\S]*?\n  \}/)?.[0];
  const eligibilitySource = js.match(/function canUseClientFreshBlessing\(run\) \{[\s\S]*?\n  \}/)?.[0];
  const copySource = js.match(/function vitusAssumptionCopy\(run\) \{[\s\S]*?\n  \}/)?.[0];
  const durationSource = js.match(/function blessingDuration\(seconds\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(blessedSource);
  assert.ok(expirySource);
  assert.ok(eligibilitySource);
  assert.ok(copySource);
  assert.ok(durationSource);
  const context = {};
  vm.runInNewContext(`
    const RESOURCE_BLESSING_SECONDS = 3 * 60 * 60;
    ${blessedSource}
    ${expirySource}
    ${eligibilitySource}
    ${durationSource}
    ${copySource}
    const shortRun = { clientFreshBlessing: true, startTime: 100, totalDuration: 8100, droneKills: 3, droneTimestamps: [200, 1000, 8000] };
    const longRun = { clientFreshBlessing: true, startTime: 100, totalDuration: 14400, droneKills: 3, droneTimestamps: [200, 10900, 10901] };
    const expiredBeforeRun = { clientFreshBlessing: false, startTime: 11000, endTime: 12000, resourceBlessingExpiresAt: 10900 };
    result = {
      shortKills: effectiveBlessedDroneKills(shortRun),
      shortExpiry: effectiveBlessingExpiry(shortRun),
      longKills: effectiveBlessedDroneKills(longRun),
      longExpiry: effectiveBlessingExpiry(longRun),
      expiredBeforeRunExpiry: effectiveBlessingExpiry(expiredBeforeRun),
      expiredBeforeRunEligible: canUseClientFreshBlessing(expiredBeforeRun),
      expiredBeforeRunCopy: vitusAssumptionCopy(expiredBeforeRun),
      shortCopy: vitusAssumptionCopy({ ...shortRun, blessedDroneKills: 0 }),
      threeHourLabel: blessingDuration(RESOURCE_BLESSING_SECONDS),
    };
  `, context);
  assert.equal(context.result.shortKills, 3);
  assert.equal(context.result.shortExpiry, null);
  assert.equal(context.result.longKills, 2);
  assert.equal(context.result.longExpiry.elapsed, 10800);
  assert.equal(context.result.longExpiry.timestamp, 10900);
  assert.equal(context.result.expiredBeforeRunExpiry.elapsed, 0);
  assert.equal(context.result.expiredBeforeRunExpiry.timestamp, 11000);
  assert.equal(context.result.expiredBeforeRunExpiry.expiredBeforeRun, true);
  assert.equal(context.result.expiredBeforeRunEligible, true);
  assert.equal(context.result.expiredBeforeRunCopy, "Both Boosters and Resourceful Retriever.");
  assert.equal(context.result.shortCopy, "Blessing, Both Boosters and Resourceful Retriever.");
  assert.equal(context.result.threeHourLabel, "3h 0m 0s");
});

test("Actual Vitus input accepts only the first four numeric digits", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  const functionSource = js.match(/function cleanVitusDigits\(value\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(functionSource);
  const context = {};
  vm.runInNewContext(`${functionSource}; result = [cleanVitusDigits("12ab345"), cleanVitusDigits(98765), cleanVitusDigits(null)];`, context);
  assert.deepEqual(Array.from(context.result), ["1234", "9876", ""]);
});

test("Disruption and markerless Void Cascade drone pace use six-minute active-time windows", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  const parser = fs.readFileSync(path.join(analyzerDir, "parser.js"), "utf8");
  assert.match(parser, /run\.dpmWindows6m = \["DISRUPTION", "VOID CASCADE"\]\.includes\(run\.missionType\)/);
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
  const excludedSource = js.match(/function isExcludedCompositionAgent\(value\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(excludedSource);
  const isExcluded = new Function(`${excludedSource}; return isExcludedCompositionAgent;`)();
  for (const companion of ["CatbrowPetAgent", "KubrowPetAgent", "MoaPetAgent", "SentinelAgent", "VulpaphylaPetAgent", "PredasitePodMinionAgent", "HelminthChargerAgent", "CompanionDroneAgent"]) {
    assert.equal(isExcluded(companion), true);
  }
  for (const enemy of ["ShipMoaDeraAgent", "CombatKubrowAgent", "CombatCatbrowAgent", "InfestedCritterSentinelAgent"]) {
    assert.equal(isExcluded(enemy), false);
  }
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
  assert.match(js, /function defenseWaveSeconds\(seconds\)/);
  assert.match(js, /function defenseWaveScore\(seconds\)/);
  assert.match(js, /Math\.floor\(Number\(seconds \|\| 0\)\)/);
  assert.match(js, /defenseWaveSeconds\(seconds\) <= DEFENSE_WAVE_TARGET_SECONDS/);
  assert.match(js, /phase\.defense\s*\? defenseWaveScore\(item\.seconds\)/);
});

test("Defense wave cells truncate seconds and turn red at a full 26 seconds", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  const secondsSource = js.match(/function defenseWaveSeconds\(seconds\) \{[\s\S]*?\n  \}/)?.[0];
  const scoreSource = js.match(/function defenseWaveScore\(seconds\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(secondsSource);
  assert.ok(scoreSource);
  const score = new Function(
    "DEFENSE_WAVE_TARGET_SECONDS",
    `${secondsSource}; ${scoreSource}; return defenseWaveScore;`,
  )(25);
  assert.equal(score(24.5), 1);
  assert.equal(score(25), 1);
  assert.equal(score(25.4), 1);
  assert.equal(score(25.99999), 1);
  assert.equal(score(26), 0);
  assert.match(js, /String\(defenseWaveSeconds\(item\.seconds\)\)/);
  assert.match(js, /`>\$\{threshold\}s`/);
});

test("Interception clear-map colors peak at 6m30s and normalize red to the run's furthest deviation", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  assert.match(js, /INTERCEPTION_ROTATION_TARGET = 6 \* 60 \+ 30/);
  assert.doesNotMatch(js, /INTERCEPTION_ROTATION_FADE_SECONDS/);
  assert.match(js, /function interceptionRotationScore\(seconds, maxDeviation\)/);
  assert.match(js, /Math\.abs\(value - INTERCEPTION_ROTATION_TARGET\)/);
  assert.match(js, /interceptionMaxDeviation[\s\S]*Math\.max\(0, \.\.\.values\.map/);
  assert.match(js, /interception\s*\?\s*interceptionRotationScore\(item\.seconds, interceptionMaxDeviation\)/);
  assert.match(js, /Color is time per rotation, number is Drones per rotation\./);
  assert.match(js, /interception \? "target 6m 30s"/);
  assert.match(js, /interception \? `furthest \$\{shortDuration\(interceptionFarthest\)\}`/);
});

test("saturation rows and summary thresholds follow each mission mode", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  const parser = fs.readFileSync(path.join(analyzerDir, "parser.js"), "utf8");
  assert.match(parser, /HIGH_DENSITY_SATURATION_TYPES = new Set\(\["SURVIVAL", "DISRUPTION", "VOID CASCADE"\]\)/);
  assert.match(parser, /EXPANDED_SATURATION_TYPES = new Set\(\["SURVIVAL", "DISRUPTION", "MIRROR DEFENSE", "VOID CASCADE"\]\)/);
  assert.match(parser, /EXPANDED_SATURATION_EDGES = \[5, 10, 15, 20, 25, 30, 33, 36, 40\]/);
  assert.match(parser, /edges: EXPANDED_SATURATION_TYPES\.has\(normalized\) \? EXPANDED_SATURATION_EDGES : DEFAULT_SATURATION_EDGES/);
  assert.match(parser, /threshold: HIGH_DENSITY_SATURATION_TYPES\.has\(normalized\) \? 30 : 15/);
  assert.match(parser, /calculateRangeSaturation\(run, phase\.from, phase\.to, saturationScale\.threshold\)/);
  assert.match(js, /Parser\.helpers\.calculateMissionSaturation\(run\)/);
  assert.match(js, /Time at \$\{threshold\}\+ enemies/);
});

test("Void Cascade prefers logged reward cycles and falls back to active six-minute intervals", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  const parser = fs.readFileSync(path.join(analyzerDir, "parser.js"), "utf8");
  assert.match(parser, /SolNode232: \["Tuvul Commons", "Zariman", "Void Cascade", "Corpus \/ Grineer", "Zariman"\]/);
  assert.match(parser, /Zariman Survival \\\(Void Cascade\\\): State Change: ENDLESS/);
  assert.match(parser, /ZarimanSurvivalMission\\\.lua: Gave reward tier/);
  assert.match(parser, /enemySpec=.*Zariman.*\(Corpus\|Grineer\)ZarimanSurvival/);
  assert.match(js, /const rotationPhases = Parser\.helpers\.calculateRotationPhases\(run\)/);
  assert.match(js, /run\.missionType === "VOID CASCADE" && !rotationPhases\.length/);
  assert.match(js, /run\.missionType === "VOID CASCADE" && !hasRotationData/);
  assert.match(js, /\["SURVIVAL", "DISRUPTION", "VOID CASCADE"\]\.includes\(run\.missionType\) \? 30 : 15/);
});

test("saturation summary displays telemetry coverage as a smaller muted right-side metric", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  const css = fs.readFileSync(path.join(analyzerDir, "analyzer.css"), "utf8");
  assert.match(js, /class="saturation-summary-item telemetry-coverage"/);
  assert.match(js, /style="color:\$\{saturationSummaryColor\(saturation\.abovePercent\)\}"/);
  assert.match(js, /function saturationSummaryColor\(percent\) \{\s*const hue = 120 - clamp\(Number\(percent \|\| 0\), 0, 18\) \/ 18 \* 120;/);
  assert.match(js, /Telemetry coverage/);
  assert.match(js, /telemetryLabel/);
  assert.match(js, /=== 100 \? "100"/);
  assert.match(css, /\.saturation-summary\s*\{[^}]*grid-template-columns:\s*repeat\(2,/);
  assert.match(css, /\.saturation-summary-item\s*\{[^}]*grid-template-rows:\s*auto auto[^}]*row-gap:\s*10px/);
  assert.match(css, /\.saturation-summary \.big\s*\{[^}]*line-height:\s*1/);
  assert.match(css, /\.telemetry-coverage\s*\{[^}]*width:\s*100%[^}]*justify-self:\s*stretch[^}]*justify-items:\s*end[^}]*text-align:\s*right/);
  assert.match(css, /\.saturation-card \.telemetry-coverage \.big\s*\{[^}]*color:\s*var\(--muted\)[^}]*font-size:\s*30px/);
  assert.match(js, /const comparison = state\.showTilesetAverages[\s\S]*?renderAverageDelta\(averageDelta,[\s\S]*?false\)/);
  assert.match(css, /\.saturation-value-row\s*\{[^}]*display:\s*flex[^}]*align-items:\s*baseline/);
  assert.match(css, /\.cadence-summary-dry \.big,[\s\S]*?\.cadence-summary-peak \.big\s*\{[^}]*color:\s*var\(--muted\)/);
});

test("clear efficiency excludes drones and uses the approved gauge KPI", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  const css = fs.readFileSync(path.join(analyzerDir, "analyzer.css"), "utf8");
  const functionSource = js.match(/function droneClearMetrics\(run\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(functionSource);
  const calculate = new Function(`${functionSource}; return droneClearMetrics;`)();
  const metrics = calculate({ enemySpawns: 15681, droneKills: 2433 });
  assert.equal(metrics.nonDroneEnemies, 13248);
  assert.ok(Math.abs(metrics.enemiesPerDrone - 5.445129469790382) < 1e-12);
  assert.ok(Math.abs(metrics.observedChancePercent - 18.36503623188406) < 1e-12);
  assert.ok(Math.abs(metrics.efficiencyPercent - 91.8251811594203) < 1e-12);
  assert.match(js, /renderDroneClearEfficiency\(run\)/);
  assert.match(js, /<div class="kpi-label">Clear efficiency<\/div>/);
  assert.match(js, /Enemies \/ Drone/);
  assert.match(js, /observed · 20% Drone chance before 3\/3 cap\./);
  assert.match(js, /Math\.max\(0, count - droneValues\[index\]\) \/ droneValues\[index\]/);
  assert.match(css, /\.drone-clear-efficiency-kpi\s*\{[^}]*grid-column:\s*span 2/);
  assert.match(js, /class="drone-clear-labels"><div class="kpi-label">Clear efficiency<\/div><div class="kpi-label">Enemies \/ Drone<\/div>/);
  assert.match(js, /class="drone-clear-values"><div class="kpi-value">\$\{h\(efficiencyLabel\)\}<\/div><div class="drone-clear-gauge"/);
  assert.match(css, /\.drone-clear-values\s*\{[^}]*grid-template-columns:\s*max-content minmax\(48px, 1fr\) max-content/);
  assert.match(css, /\.drone-clear-values \.kpi-value\s*\{[^}]*font-size:\s*clamp\(20px, calc\(11\.5cqi - 4px\), 37px\)/);
  assert.match(css, /\.drone-clear-gauge\s*\{[^}]*height:\s*12px[^}]*box-shadow:/);
  assert.match(css, /\.drone-clear-gauge-fill\s*\{[^}]*width:\s*var\(--drone-clear-width\)/);
  assert.match(css, /\.drone-clear-note\s*\{[^}]*font-size:\s*clamp\(12px, 3\.7cqi, 14px\)[^}]*line-height:\s*14px[^}]*text-align:\s*center[^}]*white-space:\s*nowrap/);
});

test("tileset averages normalize totals by rotations and Disruption by six-minute intervals", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  const css = fs.readFileSync(path.join(analyzerDir, "analyzer.css"), "utf8");
  const intervalsSource = js.match(/function comparisonIntervals\(run\) \{[\s\S]*?\n  \}/)?.[0];
  const deltasSource = js.match(/function runAverageDeltas\(run, enemyRate\) \{[\s\S]*?\n  \}/)?.[0];
  const classSource = js.match(/function averageDeltaClass\(delta, goodWhenHigher = true\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(intervalsSource && deltasSource && classSource);
  const helpers = new Function(`${intervalsSource}\n${deltasSource}\n${classSource}\nreturn { comparisonIntervals, runAverageDeltas, averageDeltaClass };`)();
  const averages = {
    enemiesPerComparisonInterval: 1300,
    dronesPerComparisonInterval: 200,
    enemiesPerMinute: 200,
    durationSecondsPerComparisonInterval: 400,
    droneIntervalSeconds: 2.25,
    highEnemyPercent: 5,
    highEnemyThreshold: 15,
  };
  const run = {
    missionType: "DEFENSE", rotations: 20, activeDuration: 7700, totalDuration: 8100,
    enemySpawns: 27141, droneKills: 4091, avgDroneInterval: 2.03, saturation: { threshold: 15, abovePercent: 7.7 },
    tilesetAverages: averages,
  };
  const deltas = helpers.runAverageDeltas(run, run.enemySpawns / run.activeDuration * 60);
  assert.equal(helpers.comparisonIntervals(run), 20);
  assert.equal(deltas.enemies, 1141);
  assert.equal(deltas.drones, 91);
  assert.equal(deltas.duration, 100);
  assert.ok(Math.abs(deltas.droneInterval + 0.22) < 1e-12);
  assert.ok(Math.abs(deltas.highEnemyPercent - 2.7) < 1e-12);
  assert.equal(helpers.comparisonIntervals({ missionType: "DISRUPTION", activeDuration: 7200, rotations: 99 }), 20);
  assert.equal(helpers.averageDeltaClass(1, true), "is-positive");
  assert.equal(helpers.averageDeltaClass(1, false), "is-negative");
  assert.match(js, /averageKpi\("Total enemies"/);
  assert.match(js, /averageKpi\("Drones killed"/);
  assert.match(js, /averageKpi\("Enemies \/ min"/);
  assert.match(js, /averageKpi\("Total duration"[\s\S]*?formatSignedDuration, false,/);
  assert.match(js, /response\.status === 404\) return \{ noBenchmark: true \}/);
  assert.match(js, /function fillMissingTilesetAverages\(run, average\)/);
  assert.match(js, /const average = fillMissingTilesetAverages\(run, result\)/);
  assert.match(js, /droneIntervalSeconds: finiteAverage\(payload\.drone_interval_seconds\)/);
  assert.match(js, /if \(!state\.showTilesetAverages\) return kpi\(label, value, fallbackNote\)/);
  assert.match(css, /\.kpi-note\s*\{[^}]*margin-top:\s*8px[^}]*line-height:\s*14px[^}]*white-space:\s*nowrap/);
  assert.match(css, /\.metric-average-delta\s*\{[^}]*margin-top:\s*8px[^}]*font:\s*850 14px\/1/);
  assert.match(css, /\.metric-average-delta\.is-positive\s*\{[^}]*color:\s*var\(--good\)/);
  assert.match(css, /\.metric-average-delta\.is-negative\s*\{[^}]*color:\s*var\(--red-hot\)/);
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
  assert.doesNotMatch(js, /at \$\{elapsedAt\(run, peak\.time\)\}/);
  assert.match(js, /at \$\{elapsedAt\(run, item\[1\]\)\}/);
  assert.match(js, /timestamp >= run\.startTime && timestamp <= run\.endTime/);
  assert.doesNotMatch(js, /at \$\{shortDuration\(peak\.time\)\}/);
});

test("actual Vitus luck uses the shared percentile bands instead of nearest totals", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  assert.match(js, /Parser\.classifyVitusScenario\(result\.scenarios, entered\)/);
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
  assert.match(js, /id="vitusLuck"[\s\S]*?<strong>\$\{h\(view\.classified\.label\)\}<\/strong><div class="mini vitus-tail">/);
  assert.match(js, /const color = vitusLuckColor\(result\.scenarios, classified\)/);
  assert.match(css, /\.vitus-luck strong\s*\{[^}]*color:\s*var\(--luck-color, #f5f5f7\)/);
  assert.match(css, /\.vitus-actual,\s*\.vitus-luck\s*\{[^}]*display:\s*grid;[^}]*grid-template-rows:\s*17px calc\(var\(--report-subtext-size\) \* 1\.55\);[^}]*row-gap:\s*4px/);
  assert.match(css, /\.vitus-entry-label,\s*\.vitus-luck strong\s*\{[^}]*font:\s*850 17px\/1 system-ui, sans-serif/);
  assert.match(css, /\.vitus-luck \.mini\s*\{[^}]*margin-top:\s*0/);
  assert.match(css, /\.vitus-entry-group\s*\{[^}]*column-gap:\s*12px/);
  assert.match(css, /\.vitus-rate\s*\{[^}]*font-size:\s*18px/);
  assert.match(css, /\.vitus-input\s*\{[^}]*width:\s*62px[^}]*height:\s*34px[^}]*font-size:\s*19px[^}]*line-height:\s*1/);
  assert.match(css, /\.vitus-input::placeholder\s*\{[^}]*font-size:\s*15px/);
  assert.match(js, /placeholder="####"/);
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
  assert.match(kadesh.src, /upper-floors-20260823/);
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

test("production correlation layout keeps the compact metrics and fixed hover readout", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  const css = fs.readFileSync(path.join(analyzerDir, "correlation-test.css"), "utf8");
  const branchStart = js.indexOf('${CORRELATION_LAYOUT_ACTIVE ? `');
  const branchEnd = js.indexOf('` : `', branchStart);
  assert.ok(branchStart >= 0 && branchEnd > branchStart);
  const compactKpis = js.slice(branchStart, branchEnd);
  const labels = ["Total enemies", "Drones killed", "Enemies / min", "Total duration"];
  let previous = -1;
  for (const label of labels) {
    const index = compactKpis.indexOf(`averageKpi("${label}"`);
    assert.ok(index > previous, `${label} should follow the requested compact KPI order`);
    previous = index;
  }
  assert.match(js, /function droneDespawnColor\(count\)/);
  assert.match(js, /1 - clamp\(\(value - 1\) \/ 4, 0, 1\)/);
  assert.match(js, /<span>20s Drone despawns:<\/span><strong style="--despawn-color:\$\{droneDespawnColor\(droneDespawns\)\}">\$\{fmt\(droneDespawns\)\}/);
  assert.match(fs.readFileSync(path.join(analyzerDir, "analyzer.css"), "utf8"), /\.composition-despawns\s*\{[^}]*display:\s*inline-flex[^}]*gap:\s*\.34em/);
  assert.match(fs.readFileSync(path.join(analyzerDir, "analyzer.css"), "utf8"), /\.composition-despawns strong\s*\{[^}]*color:\s*var\(--despawn-color, var\(--text\)\)[^}]*font-size:\s*calc\(1em \+ 2px\)/);
  assert.match(css, /\.composition-despawns\s*\{[^}]*font-size:\s*calc\(var\(--report-subtext-size\) \+ 2px\)/);
  assert.match(js, /class="highlight-panel cadence-summary"/);
  assert.match(js, /<span class="mini">Drone Interval<\/span>/);
  assert.match(js, /class="cadence-interval-value-row"[\s\S]*?\$\{intervalComparison\}/);
  assert.match(js, /formatSignedVitus\(value, 2\)\}s`?, false/);
  assert.match(js, /<span class="mini">Dry ≥12s<\/span>/);
  assert.match(js, /<span class="mini">Peak \/ 10s<\/span><div class="big">\$\{fmt\(peak\.count\)\}<\/div>/);
  assert.doesNotMatch(js, /peak-value-row/);
  assert.match(fs.readFileSync(path.join(analyzerDir, "analyzer.css"), "utf8"), /\.cadence-summary\s*\{[^}]*display:\s*flex[^}]*justify-content:\s*space-between/);
  assert.match(js, /class="correlation-tooltip-stage"/);
  assert.match(js, /class="correlation-blessing-expiry"/);
  assert.match(js, /Blessing ran out at:/);
  assert.match(js, /Blessing had expired before this run/);
  assert.match(js, /Click this button if Client had Fresher Blessing/);
  assert.match(js, /const RESOURCE_BLESSING_SECONDS = 3 \* 60 \* 60/);
  assert.match(js, /Parser\.computeVitus\(run\.droneKills, run\.rotations, run\.missionType, effectiveBlessedDroneKills\(run\)\)/);
  assert.match(js, /Number\(run\.totalDuration\) <= RESOURCE_BLESSING_SECONDS/);
  assert.match(js, /run\.clientFreshBlessing = !run\.clientFreshBlessing/);
  assert.match(js, /scheduleBlessingMetricSync\(run\)/);
  assert.match(js, /BLESSING_METRIC_SYNC_DELAY_MS = 2000/);
  assert.match(js, /force: true/);
  assert.match(js, /Parser\.buildContribution\(target, \{ blessedDroneKills \}\)/);
  assert.match(js, /sync\.pending \|\| currentBlessedDroneKills !== blessedDroneKills/);
  assert.match(js, /data-html2canvas-ignore="true">Click this button if Client had Fresher Blessing/);
  assert.match(fs.readFileSync(path.join(analyzerDir, "analyzer.css"), "utf8"), /\.export-stage \.client-fresh-blessing-button\s*\{\s*display:\s*none !important/);
  assert.match(css, /\.client-fresh-blessing-button\s*\{[^}]*color:\s*#67e8f9/);
  assert.match(css, /\.correlation-blessing-status\s*\{[^}]*position:\s*absolute/);
  assert.match(js, /y1="\$\{pad\.top\}"[^>]*y2="\$\{height - pad\.bottom\}"/);
  assert.match(css, /\.correlation-blessing-expiry\s*\{[^}]*stroke:\s*#ff2838[^}]*stroke-width:\s*2/);
  assert.doesNotMatch(js, /const xPercent = Number\(hit\.dataset\.correlationX\)/);
  assert.match(css, /\.correlation-tooltip-stage\s*\{[^}]*position:\s*absolute/);
  assert.match(css, /\.correlation-tooltip-stage\s*\{[^}]*left:\s*50%/);
  assert.match(css, /\.correlation-tooltip\s*\{[^}]*grid-template-columns:\s*repeat\(4/);
  assert.match(css, /\.correlation-legend\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*max-content\)/);
  assert.match(css, /\.correlation-legend-item\s*\{[^}]*font-size:\s*14px/);
  assert.match(css, /\.correlation-legend-item\s*\{[^}]*display:\s*inline-flex/);
  assert.match(css, /\.correlation-legend-item i\s*\{[^}]*margin-right:\s*3px/);
  assert.match(css, /\.correlation-legend-item em\s*\{[^}]*margin-left:\s*8px/);
  assert.match(css, /\.correlation-legend-item\[aria-pressed="false"\] span::after\s*\{[^}]*top:\s*58%/);
  assert.match(css, /\.correlation-legend-item\[aria-pressed="false"\] span::after\s*\{[^}]*height:\s*2px/);
  assert.match(css, /\.correlation-legend-item\[aria-pressed="false"\] span::after\s*\{[^}]*background:\s*#ff2838/);
  assert.doesNotMatch(js, /className = "correlation-test-defense-bottom"/);
  assert.match(js, /className = "correlation-test-detail-column correlation-test-detail-right"/);
  assert.match(css, /\.correlation-test-defense \.correlation-test-detail-right\s*\{[^}]*position:\s*absolute/);
  assert.match(css, /\.correlation-test-defense > \.correlation-test-clear-map\s*\{[^}]*grid-column:\s*1 \/ 3/);
  assert.match(css, /\.correlation-test-defense > \.correlation-test-clear-map\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column/);
  assert.match(css, /\.correlation-test-defense > \.correlation-test-clear-map > \.heat-legend\s*\{[^}]*justify-content:\s*flex-start[^}]*margin-top:\s*auto[^}]*padding-top:\s*10px/);
  assert.match(css, /\.correlation-test-defense > \.correlation-test-clear-map \.clear-heat-map\s*\{[^}]*repeat\(25,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(js, /const drones = run\.dronesPerRotation \|\| \[\]/);
  assert.match(js, /drones:\s*drones\[index\]/);
  assert.match(js, /showRotationDrones = !phase\.defense && \["INTERCEPTION", "SURVIVAL", "MIRROR DEFENSE", "INFESTED SALVAGE", "VOID CASCADE"\]\.includes\(run\.missionType\)/);
  assert.match(js, /showRotationDrones[\s\S]*Number\.isFinite\(item\.drones\)[\s\S]*fmt\(item\.drones\)/);
  assert.doesNotMatch(js, /droneTooltip/);
  assert.match(js, /const tooltipDuration = phase\.defense \? `\$\{defenseWaveSeconds\(item\.seconds\)\}s` : shortDuration\(item\.seconds\)/);
  assert.match(js, /\$\{tooltipDuration\} · Saturation \$\{saturation\}/);
  assert.match(js, /Color is time per rotation, number is Drones per rotation\./);
  assert.match(css, /\.correlation-test-non-defense \.correlation-test-clear-map \.clear-heat-map\s*\{[^}]*repeat\(10,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /\.correlation-test-non-defense \.correlation-test-clear-map \.heat-cell\s*\{[^}]*min-height:\s*0[^}]*aspect-ratio:\s*1/);
  assert.match(js, /visibleDuration = CORRELATION_LAYOUT_ACTIVE && phase\.defense[\s\S]*String\(defenseWaveSeconds\(item\.seconds\)\)/);
  assert.match(js, /visibleDuration\.split\(\/\\s\+\/\)[\s\S]*class="clear-duration-stack"/);
  assert.match(css, /\.clear-duration-stack\s*\{[^}]*display:\s*grid[^}]*white-space:\s*nowrap/);
  assert.match(css, /\.clear-duration-stack > span\s*\{[^}]*display:\s*block/);
  assert.match(js, /defenseWaveCount > 125/);
  assert.match(css, /\.correlation-test-clear-map\.correlation-test-clear-map-dense \.clear-heat-map\s*\{[^}]*repeat\(50,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(js, /canStretchMinimap = grid\.classList\.contains\("correlation-test-defense-102"\)/);
  assert.match(js, /if \(canStretchMinimap && clearMapRect\.bottom > minimapRect\.bottom\)[\s\S]*minimap\.style\.height/);
  assert.match(js, /else if \(minimapRect\.bottom > clearMapRect\.bottom\)[\s\S]*clearMap\.style\.height/);
  assert.match(js, /if \(run\.missionType === "DEFENSE"\)[\s\S]*observeCorrelationDefenseLayout\(grid\)/);
  assert.match(js, /correlationGrid = report\.querySelector\("\.correlation-test-layout\.correlation-test-defense"\)/);
  assert.match(js, /if \(correlationGrid\) syncCorrelationDefenseTileHeight\(correlationGrid\)/);
  assert.match(js, /await inlineImagesForExport\(stage\);[\s\S]*correlationGrid = report\.querySelector\("\.correlation-test-layout\.correlation-test-defense"\)[\s\S]*syncCorrelationDefenseTileHeight\(correlationGrid\)[\s\S]*html2canvas\(stage/);
  assert.match(js, /minimap\.style\.height = "";\s*clearMap\.style\.height = "";/);
  assert.match(js, /function observeCorrelationDefenseLayout\(grid\)[\s\S]*new ResizeObserver\(\(\) => scheduleCorrelationDefenseLayout\(grid\)\)/);
  assert.match(js, /image\.addEventListener\("load", \(\) => scheduleCorrelationDefenseLayout\(grid\), \{ once: true \}\)/);
  assert.match(css, /\.correlation-test-cadence \.metric-row\s*\{[^}]*font-size:\s*14px/);
  assert.match(css, /\.correlation-test-workspace\s*\{[^}]*grid-template-rows:\s*auto minmax\(0,\s*1fr\)/);
  assert.match(css, /\.correlation-test-workspace\s*\{[^}]*align-self:\s*stretch/);
  assert.match(css, /\.correlation-test-layout > \.left-column\s*\{[^}]*grid-template-rows:\s*auto auto minmax\(0,\s*1fr\)/);
  assert.match(css, /\.correlation-test-layout > \.left-column\s*\{[^}]*align-self:\s*stretch/);
  assert.match(css, /\.correlation-test-detail-column:not\(\.correlation-test-detail-right\)\s*\{[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /\.correlation-test-detail-column:not\(\.correlation-test-detail-right\) > \.correlation-test-saturation\s*\{[^}]*grid-template-rows:\s*auto auto minmax\(0,\s*1fr\) auto/);
  assert.doesNotMatch(css, /\.correlation-test-detail-column:not\(\.correlation-test-detail-right\) > \.correlation-test-saturation\s*\{[^}]*margin-bottom/);
  assert.match(css, /\.correlation-test-cadence\s*\{[^}]*grid-template-rows:\s*auto auto minmax\(0,\s*1fr\) auto/);
  assert.match(css, /\.correlation-test-saturation\s*\{[^}]*padding-bottom:\s*16px/);
  assert.match(css, /\.correlation-test-saturation \.metric-bars\s*\{[^}]*align-content:\s*space-between/);
  assert.match(css, /\.correlation-test-cadence \.metric-bars\s*\{[^}]*align-content:\s*space-between/);
  assert.match(css, /\.correlation-test-saturation > \.saturation-summary,[\s\S]*?\.correlation-test-cadence > \.cadence-summary\s*\{[^}]*align-self:\s*end/);
  assert.match(js, /fixedIntervals = run\.missionType === "DISRUPTION"/);
  assert.match(js, /fixedIntervals\s*\? correlationFixedActivePhases\(run\)/);
  assert.match(js, /calculateFixedDpmWindows\(run, windowSeconds\)/);
  assert.match(js, /axisPrefix = fixedIntervals \? "I" : "R"/);
  assert.match(js, /6-minute interval correlation/);
  assert.match(js, /axisLabel: String\(Math\.round\(window\.to \/ 60\)\)/);
  assert.match(js, /data\.fixedIntervals \? h\(phase\.axisLabel\)/);
  assert.match(js, /data\.fixedIntervals[\s\S]*`\$\{data\.phases\[index\]\.axisLabel\} minutes`/);
  assert.match(js, /CORRELATION_VISIBILITY_KEY = "arbi-analyzer-correlation-series-v2"/);
  assert.match(js, /LEGACY_CORRELATION_VISIBILITY_KEY = "arbi-analyzer-correlation-series-v1"/);
  assert.match(js, /function correlationModeKey\(missionType\)/);
  assert.match(js, /const CORRELATION_LAYOUT_ACTIVE = true/);
  assert.match(js, /if \(CORRELATION_LAYOUT_ACTIVE\) activateCorrelationVisibility\(run\.missionType\)/);
  assert.match(js, /prepareCorrelationLayout\(\$\("#reportRoot"\), run\)/);
  assert.match(js, /state\.correlationVisibilityByMode\[state\.activeCorrelationMode\] = normalizeCorrelationVisibility/);
  assert.match(js, /localStorage\.setItem\(CORRELATION_VISIBILITY_KEY, JSON\.stringify\(state\.correlationVisibilityByMode\)\)/);
});
