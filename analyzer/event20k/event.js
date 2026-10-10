(function () {
  "use strict";
  const event20kStart = 1791691200000;
  const event20kEnd = 1792468800000;
  const event20kRequests = new WeakMap();
  let event20kQueue = Promise.resolve();

  function event20kRound(event20kValue) { return Math.round(event20kValue * 1000); }
  function event20kRelative(event20kRun, event20kValue) { return event20kRound(event20kValue - event20kRun.startTime); }

  function event20kEvidence(event20kRun) {
    if (!Number.isFinite(event20kRun.event20kEpochMs) || !event20kRun.event20kHostAt || !event20kRun.event20kSuccessAt
      || !event20kRun.event20kFinishAt || event20kRun.event20kFailed || event20kRun.event20kClient || event20kRun.event20kDisordered) return null;
    const event20kStartMs = event20kRun.event20kEpochMs + event20kRound(event20kRun.startTime);
    const event20kLaunchMs = event20kRun.event20kEpochMs + event20kRound(event20kRun.missionStart);
    const event20kFinishMs = event20kRun.event20kEpochMs + event20kRound(event20kRun.event20kFinishAt);
    if (event20kLaunchMs < event20kStart || event20kFinishMs >= event20kEnd) return null;
    const event20kDuration = event20kFinishMs - event20kStartMs;
    const event20kPlayers = (event20kRun.event20kPresence || []).map((event20kPlayer) => ({
      event20kName: event20kPlayer.event20kName,
      event20kIntervals: event20kPlayer.event20kIntervals.map((event20kPair) => event20kPair.map((event20kTime) => event20kRelative(event20kRun, event20kTime))),
    }));
    const event20kWaves = Object.entries(event20kRun.waveStarts || {}).map(([event20kWave, event20kTime]) => [Number(event20kWave), event20kRelative(event20kRun, event20kTime)])
      .sort((event20kLeft, event20kRight) => event20kLeft[0] - event20kRight[0]);
    const event20kInside = (event20kTime) => event20kTime >= event20kRun.startTime && event20kTime <= event20kRun.event20kFinishAt;
    const event20kWaveEnds = (event20kRun.waveEnds || []).filter(event20kInside).map((event20kTime) => event20kRelative(event20kRun, event20kTime));
    const event20kDrones = (event20kRun.droneTimestamps || []).filter((event20kTime) => event20kTime >= event20kRun.startTime && event20kTime <= event20kRun.event20kFinishAt);
    const event20kEnemies = (event20kRun.enemyTimestamps || []).filter((event20kTime) => event20kTime >= event20kRun.startTime && event20kTime <= event20kRun.event20kFinishAt);
    const event20kBlocks = [];
    for (let event20kIndex = 0; event20kIndex < 24; event20kIndex += 1) {
      const event20kOffset = Math.floor(event20kIndex * Math.max(0, event20kEnemies.length - 25) / 24);
      if (event20kOffset + 24 >= event20kEnemies.length) break;
      event20kBlocks.push(event20kEnemies.slice(event20kOffset + 1, event20kOffset + 25).map((event20kTime, event20kInner) => event20kRound(event20kTime - event20kEnemies[event20kOffset + event20kInner])));
    }
    return {
      event20kSchema: 1, event20kRunCode: event20kRun.shortId, event20kNode: event20kRun.nodeKey,
      event20kMode: event20kRun.missionType, event20kLaunchMs, event20kStartMs, event20kFinishMs,
      event20kSuccessMs: event20kRun.event20kEpochMs + event20kRound(event20kRun.event20kSuccessAt),
      event20kDuration, event20kReportDuration: event20kRound(event20kRun.totalDuration), event20kPlayers,
      event20kPauses: (event20kRun.pauseIntervals || []).map((event20kPair) => event20kPair.map((event20kTime) => event20kRelative(event20kRun, event20kTime))),
      event20kWaves, event20kWaveEnds,
      event20kWaveVotes: (event20kRun.waveCountdowns || []).filter(event20kInside).map((event20kTime) => event20kRelative(event20kRun, event20kTime)),
      event20kDrones: event20kDrones.slice(0, 4096).map((event20kTime) => event20kRelative(event20kRun, event20kTime)),
      event20kEnemyBlocks: event20kBlocks,
      event20kRewardTimes: (event20kRun.rewardTimestamps || []).filter(event20kInside).map((event20kTime) => event20kRelative(event20kRun, event20kTime)),
    };
  }

  async function event20kClaim(event20kRun) {
    if (event20kRun.event20kResult?.event20kStatus === "accepted") return event20kRun.event20kResult;
    const event20kPayload = event20kEvidence(event20kRun);
    if (!event20kPayload || globalThis.location?.hostname !== "arbi.guide") return null;
    if (event20kRequests.has(event20kRun)) return event20kRequests.get(event20kRun);
    const event20kPending = event20kQueue.then(async () => {
      const event20kController = new AbortController();
      const event20kTimer = setTimeout(() => event20kController.abort(), 20000);
      try {
        const event20kResponse = await fetch("/api/event20k/claim", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(event20kPayload), signal: event20kController.signal,
        });
        const event20kResult = await event20kResponse.json();
        if (!event20kResponse.ok && (event20kResponse.status >= 500 || event20kResponse.status === 429)) throw new Error("Cat results are unavailable. Try copying again shortly.");
        event20kRun.event20kResult = event20kResult;
        return event20kResult;
      } finally { clearTimeout(event20kTimer); }
    });
    event20kRequests.set(event20kRun, event20kPending);
    event20kQueue = event20kPending.catch(() => null);
    try { return await event20kPending; }
    finally { event20kRequests.delete(event20kRun); }
  }

  function event20kCats(event20kRun, event20kName) {
    const event20kAward = event20kRun.event20kResult?.event20kAwards?.find((event20kItem) => event20kItem.event20kName.toLowerCase() === String(event20kName).toLowerCase());
    if (!event20kAward?.event20kCounted) return "";
    return `<span class="event20k-cats" aria-label="${event20kAward.event20kCats} cats">${event20kAward.event20kIcons.map((event20kIcon) => `<img class="event20k-cat" src="./event20k/cat${Number(event20kIcon)}.png" alt="" width="22" height="22">`).join("")}</span>`;
  }

  function event20kMessage(event20kRun) {
    const event20kResult = event20kRun.event20kResult;
    if (!event20kResult || event20kResult.event20kStatus === "inactive") return "";
    return event20kResult.event20kMessage || "";
  }

  globalThis.event20k = { event20kClaim, event20kCats, event20kMessage, event20kEvidence, event20kStart, event20kEnd };
})();
