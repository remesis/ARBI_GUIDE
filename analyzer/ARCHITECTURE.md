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
5. Eligible Defense and Interception runs are reduced to
   `arbi-solnode-spawns/v1` and submitted to `POST /api/analyzer/spawns` only on
   the canonical `arbi.guide` host.

The exact submitted fields are:

- schema version;
- SolNode/ClanNode/SettlementNode identifier;
- level path and mission type, which distinguish layout variants;
- the mission's process-relative offset, used only to distinguish two otherwise
  identical runs in one growing log;
- total observed spawn events;
- each observed spawn-point key, XYZ position, and aggregate count;
- a canonical SHA-256 hash over all preceding fields.

No raw lines, player names, squad names, hardware identifiers, absolute
timestamps, per-wave histories, NPC composition, unrelated metrics, or full log
files are submitted. The hash is a duplicate key, not proof that public-client
data is honest.

## Duplicate behavior

`submission.js` remembers only hashes that the endpoint accepted or reported as
duplicates. A failed request is not cached and is retried the next time the user
analyzes the log. This gives the desired growing-log behavior: after two runs are
accepted, analyzing the same still-growing file after a third run submits only
the third hash.

The browser cache is an optimization. D1's primary key on `run_hash` is the
authoritative cross-browser and cache-clear duplicate guard.

## Cloudflare ingestion

The separately deployed source lives in the gitignored `workers/` directory:

- `workers/analyzer-ingest.js` — strict Worker endpoint;
- `workers/analyzer-ingest-schema.sql` — D1 table and node index;
- `workers/wrangler-analyzer.example.jsonc` — example D1 and Rate Limiting
  bindings.

Deploy the Worker on the exact route `arbi.guide/api/analyzer/spawns`. It:

- requires the exact `https://arbi.guide` Origin and JSON content type;
- rejects unknown fields, excessive bodies, invalid bounds, duplicate point
  keys, and mismatched event totals;
- recomputes the canonical SHA-256 hash rather than trusting the client;
- uses `INSERT OR IGNORE` under the D1 `run_hash` primary key;
- stores one privacy-reduced canonical JSON record per run;
- applies a Rate Limiting binding when configured;
- returns `201 accepted`, `200 duplicate`, or a validation error;
- never stores raw logs or user identifiers.

D1 is sufficient. R2 is unnecessary because raw uploads and immutable log
objects are explicitly out of scope. The collected table is a quarantine/input
dataset for later local review, not a live source for the 3D viewer.

The endpoint is public and cannot prove a payload came from an honest game
session. Origin checking is only a browser control and no secret belongs in the
client bundle. Before publishing any aggregate spawn percentages, export the
reduced D1 rows, match node/layout/point coordinates to the maintained catalog,
reject impossible values and outliers, and manually review the result.

## Tile-map alignment

The generated floor plan, Interception markers, and spawn overlay use one affine
transform:

```text
image_x = a * world_x + b * world_z + c
image_y = d * world_x + e * world_z + f
```

The Analyzer requires every displayed spawn-point XYZ position to match the
selected tile catalog before drawing bubbles. If one coordinate-bearing point
does not match, the full overlay is withheld rather than drawn on a potentially
wrong variation. Multi-floor Defense tiles first select the configured mission
phase and then retain only the coordinate-consistent subset for the displayed
floor; this handles procedural world offsets without leaking other floors into
the overlay. Rebuild map assets with
`python analyzer/tools/build_game_minimaps.py` from the repository root after
tile data changes.

## Verification

Run from `ARBI_GUIDE`:

```text
node --test analyzer/tests/*.test.cjs
node --check analyzer/parser.js
node --check analyzer/submission.js
node --check analyzer/analyzer.js
```
