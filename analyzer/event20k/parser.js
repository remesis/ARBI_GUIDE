(function (event20kRoot, event20kFactory) {
  const event20kApi = event20kFactory();
  if (typeof module === "object" && module.exports) module.exports = event20kApi;
  event20kRoot.event20kParser = event20kApi;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function event20kCompleted(event20kRun) {
    return Number.isFinite(event20kRun.event20kFinishAt) && Number.isFinite(event20kRun.event20kSuccessAt)
      && event20kRun.event20kSuccessAt >= event20kRun.event20kFinishAt
      && event20kRun.event20kSuccessAt - event20kRun.event20kFinishAt <= 120;
  }

  function event20kObserve(event20kParser, event20kLine) {
    const event20kRun = event20kParser.cur;
    const event20kTime = Number(event20kLine.match(/^!?(\d+\.\d+)/)?.[1]);
    if (!Number.isFinite(event20kTime)) return;
    if (!event20kRun.isArbitration || event20kCompleted(event20kRun)) return;
    if (event20kTime + 10 < (event20kRun.event20kLastTime || 0)) event20kRun.event20kDisordered = true;
    event20kRun.event20kLastTime = Math.max(event20kTime, event20kRun.event20kLastTime || 0);
    if (event20kLine.includes("Starting session on HOST")) {
      event20kRun.event20kHostAt ||= event20kTime;
    }
    if (/Starting session on CLIENT|Client joining mission in-progress/.test(event20kLine)
      || /HostMigration::(?!ResetOldServerConnection\(\))/.test(event20kLine)) event20kRun.event20kClient = true;
    if (event20kLine.includes("LotusGameRules::EndMissionRMI(0)") || event20kLine.includes("EOM: All players extracting")
      || (event20kRun.isVoidCascade && event20kLine.includes("EidolonMP.lua: EIDOLONMP: Going back to hub"))) {
      event20kRun.event20kFinishAt = event20kTime;
    }
    if (/EndOfMatch\.lua: Mission Succeeded\b/.test(event20kLine)) event20kRun.event20kSuccessAt = event20kTime;
    if (/EndOfMatch\.lua: Mission (?:Failed|Aborted)\b|GiveMissionRewards\. success=false/.test(event20kLine)) event20kRun.event20kFailed = true;
    if (event20kCompleted(event20kRun)) event20kCaptureClock(event20kRun);
  }

  function event20kCapturePresence(event20kRun) {
    const event20kEnd = event20kRun.event20kFinishAt || event20kRun.endTime;
    event20kRun.event20kPresence = [event20kRun.host, ...event20kRun.squadmates].map((event20kName, event20kIndex) => {
      const event20kPresence = event20kRun.playerPresence.get(event20kName);
      const event20kIntervals = event20kIndex === 0 ? [[event20kRun.startTime, event20kEnd]]
        : [...(event20kPresence?.intervals || []), ...(event20kPresence?.since != null ? [[event20kPresence.since, event20kEnd]] : [])];
      return { event20kName, event20kIntervals };
    });
  }

  function event20kCaptureClock(event20kRun) {
    if (!Number.isFinite(event20kRun.event20kEpochMs) && Number.isFinite(event20kRun.processUtcEpochMs)) event20kRun.event20kEpochMs = event20kRun.processUtcEpochMs;
  }

  function event20kObserveClock(event20kParser, event20kEpochMs) {
    const event20kRun = event20kParser.cur;
    if (event20kRun.isArbitration && !event20kCompleted(event20kRun) && Number.isFinite(event20kRun.processUtcEpochMs)
      && Math.abs(event20kRun.processUtcEpochMs - event20kEpochMs) > 2000) event20kRun.event20kDisordered = true;
  }

  return { event20kObserve, event20kCapturePresence, event20kCaptureClock, event20kObserveClock };
});
