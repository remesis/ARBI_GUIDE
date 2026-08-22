const test = require("node:test");
const assert = require("node:assert/strict");
const Alignment = require("../spawn-alignment.js");
require("../minimaps/catalog.js");

const referencePositions = [
  [-46.7, 4.75, -64.125],
  [-46.7, 4.75, -56.375],
  [23.8, 5.25, -95.875],
  [23.8, 5.25, -90.625],
  [54.8, 4.5, -69.875],
  [54.8, 4.5, -52.375],
];

const config = {
  spawnPoints: Object.fromEntries(referencePositions.map((position, index) => [String(2858 + index), [position]])),
};

function proceduralPoint(position, index) {
  const offset = [-171.1975, -7, -92.375];
  return {
    ident: `NpcSpawnPoint${index}`,
    x: offset[2] - position[2],
    y: position[1] - offset[1],
    z: offset[0] - position[0],
  };
}

test("aligns renumbered procedural spawn points through their coordinates", () => {
  const points = referencePositions.map(proceduralPoint);
  const result = Alignment.verifySpawnPositions(points, config);
  assert.equal(result.mode, "transformed");
  assert.equal(result.matches.length, referencePositions.length);
  assert.deepEqual(result.matches.map((match) => match.position), referencePositions);
});

test("withholds a procedural overlay when any point does not fit the tile", () => {
  const points = referencePositions.map(proceduralPoint);
  points.push({ ident: "NpcSpawnPoint999", x: 999, y: 999, z: 999 });
  const result = Alignment.verifySpawnPositions(points, config);
  assert.equal(result.mode, "none");
  assert.deepEqual(result.matches, []);
});

test("maps reviewed procedural extras after a high-confidence tile match", () => {
  const reviewedConfig = {
    ...config,
    proceduralSpawnExtras: { minMatchedPoints: 4, minObservedCoverage: .8 },
  };
  const extraPosition = [81.25, 4.5, 72.75];
  const points = [...referencePositions, extraPosition].map(proceduralPoint);
  const result = Alignment.verifyDisplayPositions(points, reviewedConfig);
  assert.equal(result.mode, "mapped-subset");
  assert.equal(result.matchedCount, referencePositions.length);
  assert.equal(result.matches.length, points.length);
  assert.deepEqual(
    result.matches.at(-1).position.map((value) => Math.round(value * 1000) / 1000),
    extraPosition,
  );
});

test("finds a floor-specific subset inside a translated multi-floor run", () => {
  const bottom = referencePositions.map(proceduralPoint);
  const upper = [
    { ident: "NpcSpawnPoint90", x: 400, y: 100, z: 400 },
    { ident: "NpcSpawnPoint91", x: 410, y: 110, z: 410 },
  ];
  const result = Alignment.matchingSubset([...upper, ...bottom], config);
  assert.equal(result.mode, "subset");
  assert.equal(result.matches.length, bottom.length);
  assert.deepEqual(result.matches.map((match) => match.position), referencePositions);
});

test("GasSpawn02 includes its live procedural edge points", () => {
  const gasSpawn02 = globalThis.ArbitrationMinimapCatalog.catalog["callisto+sinai+io~2"];
  assert.equal(gasSpawn02.width, 1000);
  assert.equal(gasSpawn02.height, 1000);
  assert.match(gasSpawn02.src, /shared-main-mesh-stairs-20260821/);
  const references = [
    ...["1096", "1097", "1098", "1099", "1100", "1101"].map((id) => gasSpawn02.spawnPoints[id][0]),
    ...[
      "runtime-edge-1", "runtime-edge-2", "runtime-edge-3",
      "runtime-edge-4", "runtime-edge-5", "runtime-edge-6",
    ]
      .map((id) => gasSpawn02.spawnPoints[id][0]),
  ];
  const procedural = references.map((position, index) => ({
    ident: `NpcSpawnPoint${index + 1}`,
    x: position[0] - .254,
    y: position[1] - 22,
    z: -position[2] - 3.561,
  }));

  const result = Alignment.verifySpawnPositions(procedural, gasSpawn02);
  assert.equal(result.mode, "transformed");
  assert.equal(result.matches.length, procedural.length);
});

test("both Gas City layouts tolerate a small number of procedural extras", () => {
  for (const id of ["callisto+sinai+io", "callisto+sinai+io~2"]) {
    const layout = globalThis.ArbitrationMinimapCatalog.catalog[id];
    assert.equal(layout.proceduralSpawnExtras.minMatchedPoints, 24);
    assert.equal(layout.proceduralSpawnExtras.minObservedCoverage, .9);
  }
});

test("guarded Defense layouts display a high-confidence run with one unknown point", () => {
  const layoutIds = [
    "sechura+tessera+outer_terminus+cerberus",
    "sechura+tessera+outer_terminus+cerberus~2",
    "sechura+tessera+outer_terminus+cerberus~3",
    "rhea+lares+sangeru",
  ];
  for (const id of layoutIds) {
    const layout = globalThis.ArbitrationMinimapCatalog.catalog[id];
    const seen = new Set();
    const references = Object.values(layout.spawnPoints).flat()
      .filter((position) => {
        const key = JSON.stringify(position);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 30);
    assert.ok(references.length >= 24, `${id} needs enough references for the guard`);
    const points = [
      ...references.map(proceduralPoint),
      proceduralPoint([999, 999, 999], 9999),
    ];
    const result = Alignment.verifyDisplayPositions(points, layout);
    assert.equal(result.mode, "mapped-subset", id);
    assert.equal(result.matchedCount, references.length, id);
    assert.equal(result.matches.length, points.length, id);
  }
});

test("Corpus Ship Defense includes the reviewed D1 runtime references", () => {
  const corpusShip = globalThis.ArbitrationMinimapCatalog.catalog[
    "cytherean+xini+gulliver+romula+proteus"
  ];
  const references = [
    ...Object.entries(corpusShip.spawnPoints)
      .filter(([id]) => !id.startsWith("d1-defense-"))
      .slice(0, 8)
      .map(([, positions]) => positions[0]),
    ...["d1-defense-001", "d1-defense-035", "d1-defense-068", "d1-defense-090"]
      .map((id) => corpusShip.spawnPoints[id][0]),
  ];
  const procedural = references.map(proceduralPoint);
  const result = Alignment.verifySpawnPositions(procedural, corpusShip);
  assert.equal(result.mode, "transformed");
  assert.equal(result.matches.length, references.length);
});
