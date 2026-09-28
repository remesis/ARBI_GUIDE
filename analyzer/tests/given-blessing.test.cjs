const test = require("node:test");
const assert = require("node:assert/strict");
const Parser = require("../parser.js");
const resource = "/Lotus/Types/StoreItems/Boosters/ResourceDropChanceBlessingStoreItem";
const booster = "/Lotus/Types/Boosters/ResourceDropChanceBlessing";
const old = [
  `10.0 Sys [Info]: LotusProfileData::AddPendingHubBlessing ${resource}`,
  "20.0 Sys [Info]: LotusProfileData::OnRequestHubBlessings success",
];
function reply(timestamp = 101, changes = {}, result = 1) {
  return `${timestamp}.0 Sys [Info]: LotusProfileData::OnSendHubBlessing result=${result} body=${JSON.stringify({
    SendTime: "1800000000", Expiry: "1800010800",
    InventoryChanges: { Boosters: [{ ItemType: booster, ExpiryDate: 90 }] }, ...changes,
  })}`;
}
function runLines(offset = 10820) {
  return [
    `${offset}.0 Game [Info]: EliteAlertMission at SolNode130`,
    `${offset + 1}.0 ThemedSquadOverlay.lua: Mission name: Lares (Mercury) - Arbitration`,
    `${offset + 2}.0 WaveDefend.lua: Starting wave 1 (32 simultaneous)`,
    ...Array.from({ length: 40 }, (_, i) => `${offset + 3 + i}.0 AI [Info]: OnAgentCreated /Npc/${i < 6 ? "CorpusEliteShieldDroneAgent" : "LancerAgent"}${i} AI [Info]: MonitoredTicking ${i}`),
  ];
}
function parsed(events, offset) {
  return Parser.parseText([...old, ...events, ...runLines(offset)].join("\n"))[0];
}
test("a successfully given Drop Blessing replaces the old received timer in every parsing path", async () => {
  const lines = [...old, `100.0 Sys [Info]: LotusProfileData::SendHubBlessing ${resource}`, reply(),
    "130.0 Sys [Info]: LotusProfileData::AddPendingHubBlessing /Lotus/Types/StoreItems/Boosters/AffinityBlessingStoreItem",
    "140.0 Sys [Info]: LotusProfileData::OnRequestHubBlessings success", ...runLines()];
  const runs = Parser.parseText(lines.join("\n"));
  const direct = new Parser.Parser(), scanned = new Parser.Parser();
  lines.forEach(line => direct.feedLine(line));
  Parser.forEachRelevantLine(lines.join("\n"), (line, token) => scanned.feedLine(line, token));
  assert.deepEqual(direct.finish(), runs);
  assert.deepEqual(scanned.finish(), runs);
  const [run] = runs;
  assert.equal(run.resourceBlessingAt, 100);
  assert.equal(run.resourceBlessingConfirmedAt, 101);
  assert.equal(run.resourceBlessingExpiresAt, 10900);
  assert.equal(run.resourceBlessingSelfGiven, true);
  assert.equal(run.blessedDroneKills, 6);
  const original = await Parser.buildContribution(parsed([]));
  const corrected = await Parser.buildContribution(run);
  assert.equal(corrected.run_hash, original.run_hash);
  assert.equal(corrected.run_metrics.blessed_drone_kills, 6);
  assert.equal(original.run_metrics.blessed_drone_kills, 0);
  assert.doesNotMatch(JSON.stringify(corrected), /SendTime|InventoryChanges|selfGiven|resourceBlessingSelfGiven/);
});
test("sending alone, failed, malformed and unrelated responses cannot refresh a Drop Blessing", () => {
  for (const response of [null, reply(101, {}, 0), "101.0 Sys [Info]: LotusProfileData::OnSendHubBlessing result=1 body={broken}",
    reply(101, { InventoryChanges: { Boosters: [{ ItemType: "/Lotus/Types/Boosters/AffinityBlessing" }] } }),
    reply(101, { InventoryChanges: null }), reply(101, { SendTime: "bad" }),
    reply(101, { Expiry: "1799999999" }), reply(101, { Expiry: "1800020000" }),
  ]) {
    const run = parsed([`100.0 Sys [Info]: LotusProfileData::SendHubBlessing ${resource}`, ...(response ? [response] : [])]);
    assert.equal(run.resourceBlessingAt, 10);
    assert.equal(run.blessedDroneKills, 0);
  }
});
test("a typed success can recover a missing send line, and duplicate responses do not extend its timer", () => {
  const run = parsed([reply(), reply(120)]);
  assert.equal(run.resourceBlessingAt, 101);
  assert.equal(run.resourceBlessingExpiresAt, 10901);
});
test("an unrelated send cannot borrow a previous resource request", () => {
  const run = parsed([`90.0 Sys [Info]: LotusProfileData::SendHubBlessing ${resource}`,
    "100.0 Sys [Info]: LotusProfileData::SendHubBlessing /Lotus/Types/StoreItems/Boosters/AffinityBlessingStoreItem", reply()]);
  assert.equal(run.resourceBlessingAt, 10);
});
test("late self-given confirmation applies only to subsequent launches", () => {
  const lines = [...old, `100.0 Sys [Info]: LotusProfileData::SendHubBlessing ${resource}`, ...runLines(200), reply(220), ...runLines(400)]
    .sort((a, b) => parseFloat(a) - parseFloat(b));
  const [first, second] = Parser.parseText(lines.join("\n"));
  assert.equal(first.resourceBlessingAt, 10);
  assert.equal(first.resourceBlessingRefreshUnconfirmed, true);
  assert.equal(second.resourceBlessingAt, 100);
});
test("a newer received blessing supersedes a self-given blessing", () => {
  const run = parsed([`100.0 Sys [Info]: LotusProfileData::SendHubBlessing ${resource}`, reply(),
    `120.0 Sys [Info]: LotusProfileData::AddPendingHubBlessing ${resource}`, "130.0 Sys [Info]: LotusProfileData::OnRequestHubBlessings success"]);
  assert.equal(run.resourceBlessingAt, 120);
  assert.equal(run.resourceBlessingSelfGiven, undefined);
});
test("a received blessing arriving during a send keeps chronological priority", () => {
  const run = parsed([`100.0 Sys [Info]: LotusProfileData::SendHubBlessing ${resource}`,
    `100.5 Sys [Info]: LotusProfileData::AddPendingHubBlessing ${resource}`, reply(),
    "110.0 Sys [Info]: LotusProfileData::OnRequestHubBlessings success"]);
  assert.equal(run.resourceBlessingAt, 100.5);
  assert.equal(run.resourceBlessingConfirmedAt, 110);
});
