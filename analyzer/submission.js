(function () {
  "use strict";

  const ENDPOINT = "/api/analyzer/spawns";
  // v6 intentionally gets a fresh browser cache so records accepted before
  // reduced drone-cadence timing can be reconciled under the same canonical hash.
  const CACHE_KEY = "arbi-analyzer-accepted-run-hashes-v6";
  const CACHE_LIMIT = 5000;
  const PRODUCTION_HOSTS = new Set(["arbi.guide"]);

  function isProductionHost(hostname = globalThis.location?.hostname || "") {
    return PRODUCTION_HOSTS.has(String(hostname).toLowerCase());
  }

  function acceptedHashes(storage = globalThis.localStorage) {
    if (!storage) return [];
    try {
      const value = JSON.parse(storage.getItem(CACHE_KEY) || "[]");
      return Array.isArray(value) ? value.filter((item) => /^[a-f0-9]{64}$/.test(item)).slice(-CACHE_LIMIT) : [];
    } catch (_) {
      return [];
    }
  }

  function rememberAccepted(runHash, storage = globalThis.localStorage) {
    if (!storage || !/^[a-f0-9]{64}$/.test(runHash)) return;
    const hashes = acceptedHashes(storage).filter((value) => value !== runHash);
    hashes.push(runHash);
    try { storage.setItem(CACHE_KEY, JSON.stringify(hashes.slice(-CACHE_LIMIT))); } catch (_) { /* private mode/quota */ }
  }

  function isValidPayload(payload) {
    const metrics = payload?.run_metrics;
    return Boolean(
      payload
      && payload.schema === "arbi-analyzer-run/v2"
      && /^(?:SolNode|ClanNode|SettlementNode)\d+$/.test(payload.sol_node || "")
      && typeof payload.mission_type === "string"
      && payload.mission_type.length > 0
      && payload.mission_type.length <= 40
      && /^[a-f0-9]{64}$/.test(payload.run_hash || "")
      && Number.isFinite(payload.run_offset_seconds)
      && payload.run_offset_seconds >= 0
      && Number.isInteger(payload.observed_spawn_events)
      && payload.observed_spawn_events >= 0
      && Array.isArray(payload.spawn_points)
      && metrics
      && Number.isFinite(metrics.mission_seconds)
      && metrics.mission_seconds > 0
      && Number.isInteger(metrics.drone_kills)
      && metrics.drone_kills >= 0
      && Number.isInteger(metrics.enemy_spawns)
      && metrics.enemy_spawns >= 0
      && Number.isFinite(metrics.high_enemy_seconds)
      && metrics.high_enemy_seconds >= 0
      && Number.isFinite(metrics.enemy_telemetry_seconds)
      && metrics.enemy_telemetry_seconds >= metrics.high_enemy_seconds
      && metrics.enemy_telemetry_seconds <= metrics.mission_seconds + 0.01
      && Number.isFinite(metrics.drone_dry_seconds)
      && metrics.drone_dry_seconds >= 0
      && Number.isFinite(metrics.drone_cadence_seconds)
      && metrics.drone_cadence_seconds >= metrics.drone_dry_seconds
      && Number.isInteger(metrics.reward_cycles)
      && metrics.reward_cycles >= 0
      && Number.isInteger(metrics.defense_waves)
      && metrics.defense_waves >= 0
      && typeof metrics.four_member_majority === "boolean"
    );
  }

  async function postPayload(payload, options = {}) {
    const storage = options.storage === undefined ? globalThis.localStorage : options.storage;
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    const cached = new Set(acceptedHashes(storage));
    if (cached.has(payload.run_hash)) return { status: "cached", run_hash: payload.run_hash };

    const controller = typeof AbortController === "undefined" ? null : new AbortController();
    const timer = controller ? setTimeout(() => controller.abort(), options.timeoutMs || 10000) : null;
    try {
      const response = await fetchImpl(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "omit",
        cache: "no-store",
        signal: controller?.signal,
      });
      let result = null;
      try { result = await response.json(); } catch (_) { /* handled below */ }
      if (!response.ok || !["accepted", "duplicate"].includes(result?.status)) {
        throw new Error(result?.error || `metrics endpoint returned ${response.status}`);
      }
      rememberAccepted(payload.run_hash, storage);
      return { status: result.status, run_hash: payload.run_hash };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function submitRuns(runs, buildContribution, options = {}) {
    const summary = { accepted: 0, duplicate: 0, cached: 0, ineligible: 0, failed: 0 };
    if (!isProductionHost(options.hostname)) return { ...summary, disabled: true };

    const payloads = [];
    const seen = new Set();
    for (const run of runs) {
      try {
        const payload = await buildContribution(run);
        if (!isValidPayload(payload) || seen.has(payload.run_hash)) {
          summary.ineligible += 1;
          continue;
        }
        seen.add(payload.run_hash);
        payloads.push(payload);
      } catch (_) {
        summary.ineligible += 1;
      }
    }

    // A small fixed worker pool avoids flooding the endpoint for a very large
    // EE.log while still letting normal multi-run logs finish promptly.
    let cursor = 0;
    const worker = async () => {
      while (cursor < payloads.length) {
        const payload = payloads[cursor++];
        try {
          const result = await postPayload(payload, options);
          summary[result.status] += 1;
        } catch (_) {
          summary.failed += 1;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, payloads.length) }, worker));
    return summary;
  }

  const api = { ENDPOINT, CACHE_KEY, isProductionHost, acceptedHashes, rememberAccepted, isValidPayload, postPayload, submitRuns };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalThis.ArbitrationSpawnSubmission = api;
})();
