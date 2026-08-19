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
    run_metrics: { mission_seconds: 600, drone_kills: 100, reward_cycles: 2, defense_waves: 6 },
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

test("non-production hosts never contact the ingestion endpoint", async () => {
  let called = false;
  const result = await Submission.submitRuns([payload()], async (run) => run, {
    hostname: "127.0.0.1",
    fetchImpl: async () => { called = true; },
  });
  assert.equal(result.disabled, true);
  assert.equal(called, false);
});
