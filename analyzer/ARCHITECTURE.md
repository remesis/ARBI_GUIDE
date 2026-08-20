# Analyzer production contract

`/analyzer/` is a static desktop-only report application inside the guide shell.
Parsing, metrics, report rendering, and PNG clipboard generation happen in the
browser. The Pages bundle never uploads an `EE.log` or arbitrary log lines.

## Browser-side boundary

1. The user selects a `.log`, `.txt`, or `.gz` file.
2. `parser.js` streams it locally and retains structured Arbitration events.
3. Unrelated lines are discarded as they are read. Raw log text is not retained
   by the UI.
4. Player and squad names can appear in the local report but never enter the
   contribution payload.
5. Every recognized Arbitration run is reduced to
   `arbi-analyzer-run/v2` and submitted to `POST /api/analyzer/spawns` only on
   the canonical `arbi.guide` host. Eligible Defense and Interception runs may
   also carry coordinate-bearing spawn points; other modes send an empty point
   list while still contributing the reduced run record.

The local report derives its displayed squad and active timer from one
finalized mission core. It correlates named join, squad-add, leave/unregister,
and local in-progress-loading evidence by cleaned player identity within a
short window, then uses `loadout loader finished` as the operational timestamp.
Only a new presence episode belonging to the presence-ranked final core can
move the start, and only during the opening window before reward progression.
The selected start is the later of finalized-core readiness and the exact
mission-active marker. Duplicate loadouts, roster refreshes, anonymous joins,
and late reconnects cannot reset it. This excludes transient prebuffers while
retaining a core player who disconnects late, and prevents Disruption's early
door/tileset-preview state from starting measured play before the final squad
is operational. Survival uses the same finalized-core lower-bound rule when a
host scouts the generated tileset before inviting the squad.

For Survival, the parser anchors active time to `Survival: Starting survival`,
uses the one-per-cycle `Survival: Gave reward tier` mission event for reward
boundaries, and ends the run at `EOM: All players extracting`. The frequently
created `SurvivalReward.swf` UI asset is deliberately ignored because it is not
a reward-cycle marker. Live enemy counters are retained for every Arbitration
mode so Survival saturation is measurable even without wave events.
For Survival and Disruption, the ninth KPI reports explicit
`Arbitration.lua: Destroying CorpusEliteShieldDroneAvatar` markers inside the
active mission window as **Drones despawned**. Defense and Interception retain
the **Drones / rotation** KPI. Its subtitle is **Despawn after 20s**, matching
the reason recorded by the mission-script marker.
Survival and Disruption split the sub-30 range across four saturation buckets
(`0-7`, `8-14`, `15-22`, `23-29`), placing the first high-density bucket
(`30-32`) on the fifth row. They measure high saturation at 30+ enemies. Other
mission types retain the original three-enemy buckets and the 15+ threshold.
Expected Vitus luck totals are inclusive upper bounds for their displayed
bands: an actual total above one row advances to the next row instead of being
assigned to the numerically nearest scenario.
Expected Vitus models a 15% drone drop chance and an 18% Resourceful Retriever
duplication chance. Each completed reward cycle adds one guaranteed Vitus plus
a bonus roll: 7% for cycles 1-4 and 10% afterward. The bonus is three Vitus in
normal modes and two in Mirror Defense. Mission type is therefore an explicit
input to the mean and variance calculation.
The headline luck label uses the report's red-to-green performance ramp from
Worst Case through God Roll and recolors immediately when Actual Vitus changes.

The exact submitted fields are:

- schema version;
- SolNode/ClanNode/SettlementNode identifier;
- level path and mission type, which distinguish layout variants;
- the mission's process-relative offset, used only to distinguish two otherwise
  identical runs in one growing log;
- total observed spawn events;
- each observed spawn-point key, XYZ position, and aggregate count;
- mission duration, drone kills, completed reward cycles, and Defense wave
  count inside `run_metrics`, plus the reduced run-eligibility boolean required
  by the current ingestion contract;
- a canonical SHA-256 hash over the original spawn-identity fields.

The v2 envelope deliberately keeps the original `arbi-solnode-spawns/v1`
identity hash. Existing Defense/Interception rows therefore deduplicate instead
of being recopied when their reduced record is reconciled. No actual-Vitus
entry is uploaded.

No raw lines, player names, squad names, hardware identifiers, absolute
timestamps, per-wave histories, NPC composition, actual Vitus, unrelated
metrics, or full log files are submitted. The hash is a duplicate key, not
proof that public-client data is honest.

## Duplicate behavior

`submission.js` remembers only hashes that the endpoint accepted or reported as
duplicates. A failed request is not cached and is retried the next time the user
analyzes the log. This gives the desired growing-log behavior: after two runs are
accepted, analyzing the same still-growing file after a third run submits only
the third hash.

The cache namespace is versioned. A contract change may advance it once so
already accepted hashes are reconciled without changing their canonical spawn
identity.

The browser cache is an optimization. D1's primary key on `run_hash` is the
authoritative cross-browser and cache-clear duplicate guard.

## Cloudflare ingestion

The separately deployed source lives in the gitignored `workers/` directory:

- `workers/analyzer-ingest.js` — strict Worker endpoint;
- `workers/analyzer-ingest-schema.sql` — D1 table and node index;
- `workers/wrangler-analyzer.example.jsonc` — example D1 and Rate Limiting
  bindings.

Deploy the Worker on the route family `arbi.guide/api/analyzer/spawns*` and set
`ANALYZER_BOT_TOKEN` as a Worker secret. `ANALYZER_BOT_IPS` is only a one-time
bootstrap allowlist: an uncredentialed bot at that address may fetch the token
from `/api/analyzer/spawns/credential`, persist it locally, and confirm receipt
at `/api/analyzer/spawns/credential/confirm`. D1 stores only the confirmation
time, never the token. Once confirmed, the credential endpoint permanently
returns `410` and the IP no longer grants any access. Remove the
`ANALYZER_BOT_IPS` binding after confirmed enrollment; production has done so.
Both the browser analyzer and the ArbiGoons Discord bot submit the exact same
`arbi-analyzer-run/v2` object to `/api/analyzer/spawns`. Both sources use the
same canonical hash and shared storage; there is no bot-specific dataset.

It:

- accepts ingestion from either the exact `https://arbi.guide` browser Origin
  or an `Authorization: Bearer …` value matching `ANALYZER_BOT_TOKEN`, and
  always requires JSON content type; an allowlisted IP alone cannot ingest;
- rejects unknown fields, excessive bodies, invalid bounds, duplicate point
  keys, and mismatched event totals;
- recomputes the canonical SHA-256 hash rather than trusting the client;
- keeps coordinate rows insert-only under the D1 `run_hash` primary key and may
  reconcile the reduced current-contract record for that same hash; rollout-era
  payloads remain insert-only and cannot overwrite a current record;
- stores the validated reduced record under its canonical run hash;
- applies a Rate Limiting binding to public browser submissions when configured
  (the authenticated bot has its own Discord command cooldown and durable
  retry queue);
- returns `201 accepted`, `200 duplicate`, or a validation error;
- never stores raw logs or user identifiers.

D1 is sufficient. R2 is unnecessary because raw uploads and immutable log
objects are explicitly out of scope. The collected table is a quarantine/input
dataset for later local review, not a live source for the 3D viewer.

The administrative `analyzer_tileset_counts` view reports
`unique_spawn_points` as the number of distinct guide-standard `point_key`
values seen across a tileset group's collected runs. It does not sum each
run's point count. This is an inventory aid, not a canonical 3D-location count:
procedural variants can reuse a key at different world coordinates and must be
aligned to the maintained tile catalog before percentage analysis.

On 2026-08-18, a D1 audit found three older submissions—one Larzac and two
Stöfler—that matched a later row in every canonical spawn field and every
per-point count, differing only in `run_offset_seconds`. The older rows were
removed and the later guide-standard submissions retained. A pre-deletion SQL
snapshot is kept in the gitignored Worker backup directory. Future percentage
exports should repeat this exact-payload-except-offset audit, but ingestion must
not generally discard the offset because it distinguishes later missions in a
still-growing log.

The browser path is public and cannot prove a payload came from an honest game
session. Origin checking is only a browser control and no secret belongs in the
client bundle. Bot authorization authenticates the bot service, not the
contents of a player-provided log. Before publishing any aggregate
spawn percentages, export the reduced D1 rows, match node/layout/point
coordinates to the maintained catalog, reject impossible values and outliers,
and manually review the result.

## Tile-map alignment

The generated floor plan, Interception markers, and spawn overlay use one affine
transform:

```text
image_x = a * world_x + b * world_z + c
image_y = d * world_x + e * world_z + f
```

The Analyzer normally requires every displayed spawn-point XYZ position to
match the selected tile catalog before drawing bubbles. If one coordinate-bearing
point does not match, the full overlay is withheld rather than drawn on a
potentially wrong variation. The fixed Corpus Ship Defense/Interception arena is
the reviewed exception: runtime Defense composition can add points beyond its
316 authored references, so at least 24 reference matches and 90% observed-point
coverage are required before the recovered procedural transform maps the extra
points. This prevents a small set of valid runtime extras from hiding the whole
Proteus/Gulliver/Romula overlay without relaxing any other tileset. Procedural
component paths found in `Required by object`
loader lines distinguish variants that share the same generated `.lp` path.
The GasSpawn02 catalog also carries five Analyzer-only live edge-point
references confirmed by host telemetry. Its Analyzer minimap omits two sparse
12.5 m/16 m helper bands that otherwise draw ceiling clutter and detached
chevrons, and adds the procedurally assembled center connector plus the two
runtime spawn closets. The image remains 1000x1000 and uses quality-100 WebP;
none of these presentation rules alter the public 3D viewer overlay. Multi-floor Defense tiles first select the
configured mission phase and then retain only the coordinate-consistent subset
for the displayed floor; this handles procedural world offsets without leaking
other floors into the overlay. Squad loader parsing accepts player names that
contain spaces. Rebuild map assets with
`python analyzer/tools/build_game_minimaps.py` from the repository root after
tile data changes.

The shared Corpus Ship arena image is displayed 90 degrees clockwise. Its map
geometry, Interception letters, and spawn matrix rotate together, and an
Analyzer-only connected-component trim removes the four detached ceiling-fragment
pairs while preserving the single connected playable arena. This presentation
cleanup applies to Cytherean, Xini, Gulliver, Romula, and Proteus and does not
modify their public 3D mesh or authored spawn overlay.

## Verification

Run from `ARBI_GUIDE`:

```text
node --test analyzer/tests/*.test.cjs
node --check analyzer/parser.js
node --check analyzer/submission.js
node --check analyzer/analyzer.js
```
