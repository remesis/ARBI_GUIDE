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
  assert.match(html, /analyzer\.js/);
  assert.match(html, /submission\.js/);
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  assert.match(js, /image\/png/);
  assert.match(js, /new ClipboardItem/);
  assert.doesNotMatch(js, /WIDTH\.stages|changeWidth/);
  assert.match(js, /openMinimapLightbox/);
  assert.match(js, /setSpawnBubbleHighlight/);
  assert.match(js, /data-spawn-id/);
  assert.match(js, /verifySpawnPositions\(coordinatePoints, config\)/);
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
  assert.match(js, /typeof input\.showPicker === "function"/);
  assert.match(js, /if\(event\.target===input\) return/);
  assert.match(js, /function setupAnalyzerTooltips\(root\)/);
  assert.match(js, /data-tooltip="\$\{h\(tooltip\)\}"/);
  assert.match(js, /data-label="\$\{h\(label\)\}"/);
  assert.match(js, /id="vitusRate" class="vitus-rate"/);
  assert.match(js, /actual \* 60 \/ seconds/);
  assert.match(js, /\$\("#vitusRate"\)\.textContent = formatVitusRate\(run\)/);
  assert.match(js, /PLAYER_PRIVACY_TTL_MS = 365 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(js, /hidePlayerNames: loadPlayerNamePrivacy\(\)/);
  assert.match(js, /expiresAt: Date\.now\(\) \+ PLAYER_PRIVACY_TTL_MS/);
  assert.match(js, /names\.map\(\(_, index\) => `Player \$\{index \+ 1\}`\)/);
  assert.match(js, /id="squadPrivacyToggle"/);
  assert.match(js, /savePlayerNamePrivacy\(\)/);
  assert.match(js, /renderReport\(null\)/);
  assert.match(js, /document\.addEventListener\("drop"/);
  assert.match(js, /if\(state\.runs\.length\|\|zone\.contains\(event\.target\)\) return/);
  assert.match(js, /window\.showOpenFilePicker/);
  assert.match(js, /id: "arbi-analyzer-ee-log"/);
  assert.match(js, /if \(typeof window\.showOpenFilePicker !== "function" \|\| !window\.isSecureContext\) \{\s*if \(typeof input\.showPicker === "function"\) input\.showPicker\(\);\s*else input\.click\(\)/);
  assert.doesNotMatch(js, /downloadBlob|\.media_cache/);
  assert.doesNotMatch(html, /local prototype|Upload disabled/i);
  const css = fs.readFileSync(path.join(analyzerDir, "analyzer.css"), "utf8");
  assert.match(css, /\.sidebar-heading\s*\{[^}]*align-items:\s*center/);
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
  assert.match(css, /\.spawn-bubble\s*\{[^}]*--bubble-fill[^}]*--bubble-stroke/);
  assert.match(js, /function spawnBubbleHeatColor/);
  assert.match(js, /--bubble-fill:\$\{heat\.fill\};--bubble-stroke:\$\{heat\.stroke\}/);
  assert.match(css, /\.report-logo\s*\{[^}]*display:\s*none/);
  assert.match(css, /\.export-stage \.report-logo\s*\{[^}]*display:\s*block/);
  assert.match(css, /\.export-stage\s*\{[^}]*width:\s*2022px/);
  assert.match(css, /\.export-stage\s*\{[^}]*--report-scale:\s*1[^}]*--report-gap:\s*16px/);
  assert.match(css, /\.export-stage \.report-sheet\s*\{[^}]*width:\s*1970px[^}]*font-size:\s*15px/);
  assert.match(css, /\.report-grid\.dashboard-layout\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.report-grid\.dashboard-no-spawns\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.dashboard-workspace\s*\{[^}]*grid-column:\s*2 \/ 4/);
  assert.match(css, /\.dashboard-workspace-top\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.dashboard-spawn-detail\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1\.2fr\) minmax\(0, \.8fr\)/);
  assert.match(css, /\.dashboard-layout:not\(\.dashboard-no-spawns\) \.left-column\s*\{[^}]*grid-template-rows:\s*auto auto auto 1fr/);
  assert.match(css, /\.dashboard-no-spawns \.left-column\s*\{[^}]*grid-template-rows:\s*auto auto 1fr/);
  assert.match(css, /\.dashboard-workspace-top \.right-column\s*\{[^}]*grid-template-rows:\s*auto auto 1fr/);
  assert.match(css, /\.dashboard-minimap-card \.minimap-wrap\s*\{[^}]*flex:\s*1/);
  assert.match(js, /composition\.classList\.add\("dashboard-composition-card"\)/);
  assert.match(js, /cadence\.classList\.add\("dashboard-cadence-card"\)/);
  assert.match(js, /interceptionColumn\.className = "column right-column dashboard-interception-column"/);
  assert.match(js, /grid\.replaceChildren\(left, center, interceptionColumn\)/);
  assert.match(css, /\.dashboard-layout > \.activity-card\s*\{[^}]*grid-column:\s*1 \/ 4/);
  assert.match(css, /\.dashboard-per-rotation \.heat-map\s*\{[^}]*repeat\(10/);
  assert.match(css, /\.dashboard-no-spawns \.clear-heat-map\s*\{[^}]*repeat\(10/);
  assert.match(css, /\.dashboard-layout \.clear-heat-map \.heat-cell small\s*\{[^}]*font-size:\s*11px/);
  assert.match(css, /\.dashboard-no-spawns \.dashboard-dpm \.line-chart\s*\{[^}]*height:\s*125px/);
  assert.match(js, /class="chart-average-badge" style="--average-top:/);
  assert.match(css, /\.chart-average-badge\s*\{[^}]*position:\s*absolute[^}]*font-size:\s*16px/);
  assert.match(css, /\.chart-tooltip\s*\{[^}]*position:\s*absolute/);
  assert.match(css, /\.analyzer-hover-tooltip\s*\{[^}]*position:\s*fixed[^}]*z-index:\s*10000/);
  assert.match(css, /\.dashboard-no-spawns \.dashboard-cadence-card\s*\{[^}]*height:\s*auto/);
  assert.match(js, /function prepareDashboardLayout/);
  assert.match(js, /left\.replaceChildren\(coreKpis, vitus, bottlenecks, composition\)/);
  assert.match(js, /center\.replaceChildren\(perRotation, saturation, dpm\)/);
  assert.match(js, /workspace\.append\(workspaceTop, clearMap\)/);
  assert.match(js, /grid\.replaceChildren\(left, workspace, activity\)/);
  assert.match(js, /Spawn points observed/);
  assert.doesNotMatch(js, /debug-export/);
  assert.match(css, /\.export-stage \.clear-heat-map\s*\{[^}]*repeat\(23/);
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
  assert.match(css, /\.activity-axis-label\s*\{[^}]*font:\s*850 12px\/14px/);
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
  assert.match(catalog, /tile-geometry/);
  assert.match(catalog, /spawnPoints/);
  assert.match(catalog, /interceptionMarkers/);
  const minimapBuilder = fs.readFileSync(path.join(analyzerDir, "tools", "build_game_minimaps.py"), "utf8");
  assert.match(minimapBuilder, /text_width \/ 2 \+ 1/);
  assert.match(minimapBuilder, /text_height - baseline\) \/ 2 \+ 4/);
});

test("production Analyzer starts cleared instead of loading bundled demo runs", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  assert.doesNotMatch(js, /prepareRuns\(makeDemoRuns\(\)/);
  assert.match(js, /renderRunList\(\);\s*renderReport\(null\);/);
  assert.match(js, />Most Active</);
  assert.doesNotMatch(js, />Busiest spawn points</i);
});

test("analyzer uses the full composition list and green performance scale", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
  const css = fs.readFileSync(path.join(analyzerDir, "analyzer.css"), "utf8");
  assert.doesNotMatch(js, /entries\.slice\(0,(?:8|10)\)/);
  assert.match(js, /\.filter\(\(\[name\]\) => !isExcludedCompositionAgent\(name\)\)/);
  assert.match(js, /=== "summonmotorcycle"/);
  assert.match(js, /green = better \/ more/);
  assert.match(js, /Greener = more enemies/);
  assert.match(js, /const SVES_SUCCESS = "#00e676"/);
  assert.match(js, /const SVES_DANGER = "#ff5252"/);
  assert.match(js, /return clamp\(Number\(intensity \|\| 0\), 0, 1\) \* 120/);
  assert.match(js, /`hsl\(\$\{hue\},100%,50%\)`/);
  assert.match(js, /return \{ color: `hsl\(\$\{hue\},100%,50%\)`, ink: "#121212" \}/);
  assert.match(js, /function rotationHeatColor/);
  assert.match(js, /const saturation = 12 \+ 63 \* t/);
  assert.match(js, /const lightness = 44 \+ 8 \* t/);
  assert.match(js, /`hsl\(150,\$\{saturation\.toFixed\(1\)\}%,\$\{lightness\.toFixed\(1\)\}%\)`/);
  assert.match(js, /const heat=rotationHeatColor\(\(value-low\)\/Math\.max\(1,high-low\)\)/);
  assert.match(js, /phase\.defense\s*\? Number\(item\.seconds <= threshold\)/);
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

test("report timestamps use readable mission-relative elapsed time", () => {
  const js = fs.readFileSync(path.join(analyzerDir, "analyzer.js"), "utf8");
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
  assert.match(js, /luck\.style\.setProperty\("--luck-color", vitusLuckColor\(result\.scenarios, classified\)\)/);
  assert.match(css, /\.vitus-luck strong\s*\{[^}]*color:\s*var\(--luck-color, #f5f5f7\)/);
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
  assert.equal(bundle.catalog.stofler.floorFilter.maxY, -50);
  assert.equal(bundle.catalog.stofler.floorFilter.minWave, 7);
  assert.equal(Object.keys(bundle.catalog.stofler.spawnPoints).length, 66);
  assert.match(bundle.catalog.stofler.src, /bottom-floor-20260816/);
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
