const test = require("node:test");
const assert = require("node:assert/strict");
const Submission = require("../submission.js");

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
}

function payload(hash = "a".repeat(64)) {
  return {
    schema: "arbi-analyzer-run/v2",
    sol_node: "SolNode130",
    level_path: "/Lotus/Levels/Example.level",
    mission_type: "DEFENSE",
    run_offset_seconds: 123.4,
    observed_spawn_events: 7,
    spawn_points: [{ point_key: "/Layer/NpcSpawnPoint1", position: [1, 2, 3], count: 7 }],
    run_metrics: {
      mission_seconds: 600,
      active_seconds: 570,
      drone_kills: 100,
      blessed_drone_kills: 100,
      enemy_spawns: 1000,
      high_enemy_seconds: 5,
      enemy_telemetry_seconds: 500,
      enemy_count_seconds: Array.from({ length: 52 }, (_, count) => count === 0 ? 495 : count === 15 ? 5 : 0),
      drone_dry_seconds: 29,
      drone_cadence_seconds: 500,
      drone_interval_span_seconds: 540,
      drone_interval_count: 99,
      reward_cycles: 2,
      defense_waves: 6,
      four_member_majority: true,
    },
    run_hash: hash,
  };
}

test("accepted and duplicate responses are cached, failed submissions are not", async () => {
  const cache = storage();
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { ok: true, status: 201, json: async () => ({ status: "accepted" }) };
  };
  const first = await Submission.postPayload(payload(), { fetchImpl, storage: cache });
  const second = await Submission.postPayload(payload(), { fetchImpl, storage: cache });
  assert.equal(first.status, "accepted");
  assert.equal(second.status, "cached");
  assert.equal(calls, 1);

  const failedHash = "b".repeat(64);
  await assert.rejects(() => Submission.postPayload(payload(failedHash), {
    storage: cache,
    fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({ error: "offline" }) }),
  }));
  assert.equal(Submission.acceptedHashes(cache).includes(failedHash), false);
});

test("repeat analysis submits only a newly appended run", async () => {
  const cache = storage();
  const sent = [];
  const fetchImpl = async (_url, options) => {
    sent.push(JSON.parse(options.body).run_hash);
    return { ok: true, status: 201, json: async () => ({ status: "accepted" }) };
  };
  const runs = [payload("1".repeat(64)), payload("2".repeat(64))];
  const build = async (run) => run;
  await Submission.submitRuns(runs, build, { hostname: "arbi.guide", storage: cache, fetchImpl });
  await Submission.submitRuns([...runs, payload("3".repeat(64))], build, { hostname: "arbi.guide", storage: cache, fetchImpl });
  assert.deepEqual(sent.sort(), ["1".repeat(64), "2".repeat(64), "3".repeat(64)]);
});

test("a forced correction bypasses the browser cache but keeps the same run hash", async () => {
  const cache = storage();
  const sent = [];
  const fetchImpl = async (_url, options) => {
    sent.push(JSON.parse(options.body));
    return { ok: true, status: 201, json: async () => ({ status: "accepted" }) };
  };
  const original = payload();
  await Submission.postPayload(original, { fetchImpl, storage: cache });
  const corrected = structuredClone(original);
  corrected.run_metrics.blessed_drone_kills = 60;
  await Submission.postPayload(corrected, { fetchImpl, storage: cache, force: true });
  assert.equal(sent.length, 2);
  assert.equal(sent[0].run_hash, sent[1].run_hash);
  assert.equal(sent[1].run_metrics.blessed_drone_kills, 60);
});

test("non-production hosts never contact the ingestion endpoint", async () => {
  let called = false;
  const result = await Submission.submitRuns([payload()], async (run) => run, {
    hostname: "127.0.0.1",
    fetchImpl: async () => { called = true; },
  });
  assert.equal(result.disabled, true);
  assert.equal(called, false);
});

test("requires a complete duration-balanced 0-50 plus overflow histogram", () => {
  const valid = payload();
  assert.equal(Submission.isValidPayload(valid), true);

  const short = structuredClone(valid);
  short.run_metrics.enemy_count_seconds.pop();
  assert.equal(Submission.isValidPayload(short), false);

  const unbalanced = structuredClone(valid);
  unbalanced.run_metrics.enemy_count_seconds[0] -= 1;
  assert.equal(Submission.isValidPayload(unbalanced), false);
});

test("accepts finalized-window drone intervals and rejects impossible totals", () => {
  const valid = payload();
  assert.equal(Submission.isValidPayload(valid), true);

  const inactive = structuredClone(valid);
  inactive.run_metrics.active_seconds = inactive.run_metrics.mission_seconds + 1;
  assert.equal(Submission.isValidPayload(inactive), false);

  const boundedIntervals = structuredClone(valid);
  boundedIntervals.run_metrics.drone_interval_count -= 4;
  assert.equal(Submission.isValidPayload(boundedIntervals), true);

  const tooManyIntervals = structuredClone(valid);
  tooManyIntervals.run_metrics.drone_interval_count += 1;
  assert.equal(Submission.isValidPayload(tooManyIntervals), false);

  const tooLongSpan = structuredClone(valid);
  tooLongSpan.run_metrics.drone_interval_span_seconds = tooLongSpan.run_metrics.mission_seconds + 1;
  assert.equal(Submission.isValidPayload(tooLongSpan), false);
});
