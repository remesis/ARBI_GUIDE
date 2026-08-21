"""Build Analyzer minimaps from the site's existing 3D tile geometry.

The source WFG/WFO files come from the site's 3D tileset pipeline. This script
never uses screenshots from the guide.
Spawn overlays and baked Interception objective markers share one exact
world-to-image transform written to ``minimaps/catalog.js`` and its current
immutable production copy.
"""

from __future__ import annotations

import json
import re
import struct
from pathlib import Path

import cv2
import numpy as np


IMMUTABLE_CATALOG_FILENAME = "catalog-20260821-7.js"


GROUP_NODES = {
    "callisto+sinai+io": ["SolNode25", "ClanNode4", "SolNode125"],
    "umbriel+stephano": ["SolNode64", "SolNode122"],
    "cytherean+xini+gulliver+romula+proteus": [
        "SolNode23", "SolNode172", "SettlementNode11", "ClanNode0", "SolNode17"
    ],
    "alator+kadesh+spear": ["SolNode106", "ClanNode8", "SolNode46"],
    "tyana_pass": ["SolNode450"],
    "munio": ["SolNode719"],
    "mithra+taranis+belenus": ["SolNode412", "SolNode402", "SolNode408"],
    "casta+seimeni+cinxia": ["SolNode149", "ClanNode22", "SolNode147"],
    "hydron+helene+odin": ["SolNode195", "SolNode42", "SolNode224"],
    "sechura+tessera+outer_terminus+cerberus": [
        "ClanNode24", "SolNode22", "SolNode72", "SolNode43"
    ],
    "ose+paimon+larzac": ["SolNode211", "SolNode212", "ClanNode6"],
    "rhea+lares+sangeru": ["SolNode18", "SolNode130", "ClanNode15"],
    "akkad+kala-azar": ["ClanNode18", "SolNode164"],
    "coba+lith": ["ClanNode2", "SolNode26"],
    "berehynia": ["SolNode185"],
    "oestrus": ["SolNode167"],
    "gaia": ["SolNode85"],
    "hyf": ["SolNode707"],
    "stofler": ["SolNode305"],
}

# The public viewer's WFG2 files are optimized for streaming. The matching WFG1
# build products retain the same world coordinates and are much cheaper to use
# for this offline minimap build.
SOURCE_GROUPS = {
    "callisto+sinai+io": ("preview", "callisto+sinai+io"),
    "umbriel+stephano": ("preview", "umbriel+stephano"),
    "cytherean+xini+gulliver+romula+proteus": ("preview", "cytherean+xini+gulliver"),
    "alator+kadesh+spear": ("preview", "alator+kadesh+spear"),
    "tyana_pass": ("preview", "tyana_pass"),
    "munio": ("preview", "munio"),
    "mithra+taranis+belenus": ("preview", "mithra+taranis+belenus"),
    "casta+seimeni+cinxia": ("preview", "casta+seimeni+cinxia"),
    "hydron+helene+odin": ("preview", "hydron+helene+odin"),
    "sechura+tessera+outer_terminus+cerberus": (
        "preview", "sechura+tessera+outer_terminus"
    ),
    "ose+paimon+larzac": ("preview", "ose+paimon+larzac"),
    "rhea+lares+sangeru": ("preview", "rhea+lares+sangeru"),
    "akkad+kala-azar": ("preview", "akkad+kala-azar"),
    "coba+lith": ("preview", "coba+lith"),
    "berehynia": ("preview", "berehynia"),
    "oestrus": ("preview", "oestrus"),
    # Gaia's preferred alternate was promoted to slot 1 in the viewer.
    "gaia": ("requested", "gaia~2"),
    "hyf": ("preview", "hyf"),
    "stofler": ("preview", "stofler"),
    "callisto+sinai+io~2": ("variants", "callisto+sinai+io~2"),
    "umbriel+stephano~2": ("umbriel_green", "umbriel+stephano~2"),
    "sechura+tessera+outer_terminus+cerberus~2": (
        "requested", "sechura+tessera+outer_terminus~2"
    ),
    "sechura+tessera+outer_terminus+cerberus~3": (
        "requested", "sechura+tessera+outer_terminus~3"
    ),
    "gaia~2": ("preview", "gaia"),
}

# Keep Stofler's existing bottom-deck minimap artwork focused on the nearly
# level arena around Y=-56. Runtime evidence shows that three authored clusters
# above this deck remain active after wave 7, so this visual cutoff must not be
# reused as the Analyzer's spawn-reference cutoff.
STOFLER_BASE_MAP_MAX_Y = -50.0

# Reviewed Corpus Ship Defense reference candidates recovered from seven
# reduced D1 coordinate rows spanning Gulliver, Romula, and Proteus. Every row
# first established the same procedural transform with 219-282 authored WFO
# matches; only then were the remaining runtime points projected into these
# canonical coordinates and clustered at the production 0.25 m tolerance.
# The 3D composite now authors 14 of these room positions, so
# `merge_spawn_supplements()` drops candidates within 0.25 m of the WFO before
# emitting the browser catalog. Keep this snapshot static: live D1 data must
# never flow directly into the browser catalog.
CORPUS_SHIP_D1_SPAWN_SUPPLEMENT_POSITIONS = (
    (-83.3, -1.889, -2.4),
    (-82.95, -1.889, 1.4),
    (-80.95, -1.889, -0.25),
    (-78.95, -1.889, -2.5),
    (-78.55, -1.889, 1.45),
    (-70.0, -19.987, -19.696),
    (-70.0, -19.987, -18.196),
    (-70.0, -19.987, -16.446),
    (-68.0, -19.987, -18.196),
    (-66.25, -19.987, -19.696),
    (-66.25, -19.987, -18.196),
    (-66.25, -19.987, -16.446),
    (-63.453, -19.987, 17.534),
    (-62.63, -19.987, -19.662),
    (-61.291, -19.987, 19.789),
    (-59.27, -19.987, -19.434),
    (-59.27, -19.987, -16.831),
    (-56.706, -19.987, -16.831),
    (-56.06, -19.987, 19.789),
    (-54.074, -19.987, -16.831),
    (-21.85, -6.8, -26.85),
    (-19.822, -3.0, -50.54),
    (-19.773, -3.0, -53.467),
    (-19.594, -3.0, -57.295),
    (-18.58, -3.0, 56.33),
    (-18.264, -3.0, 49.655),
    (-18.264, -3.0, 52.35),
    (-17.555, -3.0, -50.622),
    (-16.832, -3.0, -53.92),
    (-16.459, -3.0, -57.367),
    (-16.273, -3.0, 55.752),
    (-16.263, -3.0, 52.402),
    (-15.928, -3.0, 49.795),
    (-15.55, -6.8, -24.75),
    (-7.495, 13.5, 92.752),
    (-7.31, 13.8, 99.222),
    (-7.025, 13.6, -94.001),
    (-5.0, 13.2, 91.5),
    (-4.721, -2.957, -42.16),
    (-4.228, 12.7, -85.061),
    (-4.126, 13.25, -93.011),
    (-3.85, 13.013, -82.5),
    (-2.55, -2.957, -41.427),
    (-2.359, 12.973, -79.78),
    (-2.019, 12.973, 79.204),
    (-1.583, 12.9, -104.557),
    (-1.25, 13.013, 84.75),
    (-1.0, 13.185, -90.75),
    (-0.891, -2.881, -42.319),
    (-0.7, 13.4, 89.972),
    (-0.425, 12.2, 85.486),
    (0.425, 12.2, -85.986),
    (0.7, 13.4, -90.472),
    (1.0, 13.185, 90.25),
    (1.25, 13.013, -85.25),
    (1.525, -2.881, -41.395),
    (1.583, 12.9, 104.057),
    (2.019, 12.973, -79.704),
    (2.359, 12.973, 79.28),
    (3.85, 13.013, 82.0),
    (4.126, 13.25, 92.511),
    (4.228, 12.7, 84.561),
    (5.0, 13.2, -92.0),
    (5.12, -2.957, -42.811),
    (7.025, 13.6, 93.501),
    (7.31, 13.8, -99.722),
    (7.495, 13.5, -93.252),
    (7.788, -20.0, -30.805),
    (15.515, -3.0, -50.073),
    (15.704, -3.0, -52.871),
    (15.924, -3.0, -55.775),
    (16.894, -3.0, 56.507),
    (16.914, -3.0, 53.05),
    (16.961, -3.0, 50.132),
    (17.997, -3.0, -49.649),
    (18.5, -3.0, -52.746),
    (19.224, -3.0, -56.21),
    (19.498, -3.0, 56.086),
    (19.532, -3.0, 52.707),
    (19.633, -3.0, 50.156),
    (51.505, -19.957, 18.133),
    (54.452, -19.958, 15.841),
    (58.325, -19.958, 16.207),
    (59.445, -19.987, -17.042),
    (62.307, -19.957, 15.799),
    (62.41, -19.957, 17.684),
    (63.376, -19.987, -17.042),
    (64.187, -19.987, -19.426),
    (64.865, -19.955, 16.158),
    (64.869, -19.954, 19.272),
)

# These nine authored Corpus Ship references are hidden only in the 3D viewer
# because current telemetry has not activated them. Preserve their original IDs
# in the Analyzer so viewer curation cannot silently change submitted-log
# alignment behavior.
CORPUS_SHIP_VIEWER_HIDDEN_SPAWN_REFERENCES = {
    "392": [[6.522, -20.0, -31.078]],
    "439": [[-18.608, -6.8, -30.625]],
    "440": [[-13.074, -6.8, -28.641]],
    "482": [[0.0, 2.25, -0.25]],
    "562": [[-49.5, 4.2, 32.1]],
    "566": [[-49.5, 4.2, 27.35]],
    "570": [[49.5, 4.2, -32.65]],
    "574": [[49.5, 4.2, -27.9]],
    "578": [[66.95, 1.15, -6.25]],
}

# GasSpawn02 has five live edge points that are instantiated by the procedural
# defense composition but are absent from the authored WFO overlay. Keep these
# Analyzer-only references separate from the 3D viewer overlay so the approved
# minimap artwork and public tileset data remain unchanged.
ANALYZER_SPAWN_SUPPLEMENTS = {
    "callisto+sinai+io~2": {
        "runtime-edge-1": [[-85.779, -4.0, 77.0831]],
        "runtime-edge-2": [[86.6277, -4.0, 72.0354]],
        "runtime-edge-3": [[-82.779, -4.0, 79.0831]],
        "runtime-edge-4": [[84.0469, -3.978, 75.4819]],
        "runtime-edge-5": [[-78.529, -4.0, 79.5831]],
    },
    "cytherean+xini+gulliver+romula+proteus": {
        **CORPUS_SHIP_VIEWER_HIDDEN_SPAWN_REFERENCES,
        **{
            f"d1-defense-{index:03d}": [[*position]]
            for index, position in enumerate(
                CORPUS_SHIP_D1_SPAWN_SUPPLEMENT_POSITIONS, start=1
            )
        },
    },
}

# The GasSpawn02 composition contains two sparse high-altitude helper bands
# that project as ceiling clutter and two detached chevrons below the playable
# arena. Its runtime connector is assembled procedurally and is therefore not
# part of either static source mesh; draw the reviewed walkable link into the
# Analyzer-only minimap without changing the 3D viewer geometry.
GAS_SPAWN_02_GROUP = "callisto+sinai+io~2"
GAS_SPAWN_02_MAX_MAP_HEIGHT = 10.0
OROKIN_TOWER_DEFENSE_GROUP = "mithra+taranis+belenus"
OROKIN_TOWER_CEILING_BAND_MIN_HEIGHT = 2.0
CORPUS_SHIP_DEFENSE_GROUP = "cytherean+xini+gulliver+romula+proteus"
CORPUS_SHIP_MIN_CONNECTED_AREA = 1000
HYDRON_DEFENSE_GROUP = "hydron+helene+odin"
HYF_DEFENSE_GROUP = "hyf"
# Hyf's ramps make its authored spawn heights nearly continuous, so generic
# height clustering collapses its playable decks into a single -6 m slice.
# Composite the four real floor planes and stop below the roof band near +5 m.
HYF_PLAYABLE_FLOOR_HEIGHTS = (-6.0, -2.0, 0.0, 2.0)
HYF_ADDITIONAL_FLOOR_TOLERANCE = 1.1
# ObjDefense01 stops at the two high side doors, while real Defense layouts
# attach spawn-room pieces beyond them. These clean envelopes are backed by the
# reviewed D1 positions at Y=12.2-13.8; they deliberately omit roof/truss detail
# that is irrelevant to a top-down Analyzer map.
CORPUS_SHIP_RUNTIME_SPAWN_ROOMS = (
    np.asarray([
        [-9.0, 13.0, 74.0], [9.0, 13.0, 74.0],
        [12.0, 13.0, 78.0], [12.0, 13.0, 106.0],
        [9.0, 13.0, 110.0], [-9.0, 13.0, 110.0],
        [-12.0, 13.0, 106.0], [-12.0, 13.0, 78.0],
    ], dtype=np.float32),
    np.asarray([
        [-9.0, 13.0, -74.0], [-12.0, 13.0, -78.0],
        [-12.0, 13.0, -106.0], [-9.0, 13.0, -110.0],
        [9.0, 13.0, -110.0], [12.0, 13.0, -106.0],
        [12.0, 13.0, -78.0], [9.0, 13.0, -74.0],
    ], dtype=np.float32),
)
GAS_SPAWN_02_CONNECTOR = np.asarray([
    [-9.5, -4.0, 5.0],
    [9.5, -4.0, 5.0],
    [9.5, -4.0, 10.0],
    [11.0, -4.0, 12.0],
    [11.0, -4.0, 39.0],
    [15.0, -4.0, 42.0],
    [15.0, -4.0, 45.0],
    [18.0, -4.0, 48.0],
    [18.0, -4.0, 52.0],
    [-18.0, -4.0, 52.0],
    [-18.0, -4.0, 48.0],
    [-15.0, -4.0, 45.0],
    [-15.0, -4.0, 42.0],
    [-11.0, -4.0, 39.0],
    [-11.0, -4.0, 12.0],
    [-9.5, -4.0, 10.0],
], dtype=np.float32)
GAS_SPAWN_02_CONNECTOR_DETAILS = (
    np.asarray([[-7.0, -4.0, 10.0], [-7.0, -4.0, 48.0]], dtype=np.float32),
    np.asarray([[7.0, -4.0, 10.0], [7.0, -4.0, 48.0]], dtype=np.float32),
    np.asarray([[-7.0, -4.0, 25.0], [7.0, -4.0, 25.0]], dtype=np.float32),
)
GAS_SPAWN_02_SPAWN_CLOSETS = (
    np.asarray([
        [71.0, -4.0, 67.0], [89.0, -4.0, 67.0],
        [92.0, -4.0, 70.0], [92.0, -4.0, 83.0],
        [89.0, -4.0, 86.0], [71.0, -4.0, 86.0],
    ], dtype=np.float32),
    np.asarray([
        [-89.0, -4.0, 67.0], [-71.0, -4.0, 67.0],
        [-71.0, -4.0, 86.0], [-89.0, -4.0, 86.0],
        [-92.0, -4.0, 83.0], [-92.0, -4.0, 70.0],
    ], dtype=np.float32),
)


def align4(value: int) -> int:
    return (value + 3) & ~3


def read_wfg(path: Path) -> tuple[np.ndarray, np.ndarray]:
    raw = path.read_bytes()
    if raw[:4] != b"WFG1":
        raise ValueError(f"{path.name} is not WFG1")
    meta_len = struct.unpack_from("<I", raw, 8)[0]
    meta = json.loads(raw[12 : 12 + meta_len])
    payload = align4(12 + meta_len)
    qv_offset, _ = meta["sections"]["qv"]
    idx_offset, _ = meta["sections"]["idx"]
    vertex_count = int(meta["nv"])
    triangle_count = int(meta["nt"])
    quantized = np.frombuffer(
        raw, dtype="<i2", count=vertex_count * 3, offset=payload + qv_offset
    ).reshape((-1, 3))
    positions = quantized.astype(np.float32)
    positions *= float(meta["scale"])
    positions += np.asarray(meta["org"], dtype=np.float32)
    index_dtype = "<u2" if int(meta.get("idxBits", 32)) == 16 else "<u4"
    faces = np.frombuffer(
        raw, dtype=index_dtype, count=triangle_count * 3, offset=payload + idx_offset
    ).reshape((-1, 3))
    return positions, faces


def cluster_heights(values: list[float], gap: float = 3.4) -> list[float]:
    if not values:
        return [0.0]
    groups: list[list[float]] = []
    for value in sorted(values):
        if groups and value - groups[-1][-1] <= gap:
            groups[-1].append(value)
        else:
            groups.append([value])
    return [float(np.median(group)) for group in groups]


def stofler_bottom_cut(overlay: dict) -> float:
    """Derive Stofler's bottom-floor boundary from its authored spawn bands.

    This mirrors the public 3D viewer: the two largest vertical gaps separate
    the three playable floors, and the lower separator bounds the permanent
    wave-7+ arena (including its raised approaches).
    """
    heights = sorted(
        float(item["y"])
        for item in overlay.get("spawns", [])
        if "y" in item and np.isfinite(float(item["y"]))
    )
    gaps = []
    for low, high in zip(heights, heights[1:]):
        size = high - low
        if size > 0.001:
            gaps.append((size, (low + high) * 0.5))
    if len(gaps) < 2:
        raise ValueError("Stofler overlay does not contain three distinct floor bands")
    largest = sorted(gaps, key=lambda item: item[0], reverse=True)[:2]
    return min(cut for _, cut in largest)


def map_bounds(overlay: dict, positions: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    map_spawns = overlay.get("_mapSpawns", overlay.get("spawns")) or []
    map_objective = overlay.get("_mapObjective", overlay.get("objective")) or []
    anchors = [
        [float(item[axis]) for axis in ("x", "z")]
        for item in [*map_spawns, *map_objective]
        if all(axis in item for axis in ("x", "z"))
    ]
    if anchors:
        points = np.asarray(anchors, dtype=np.float32)
        lo = np.percentile(points, 1, axis=0) - 13.0
        hi = np.percentile(points, 99, axis=0) + 13.0
    else:
        lo = np.percentile(positions[:, (0, 2)], 1, axis=0)
        hi = np.percentile(positions[:, (0, 2)], 99, axis=0)
    return lo, hi


def display_overlay(group_id: str, overlay: dict) -> dict:
    """Return the spawn markers that belong on this minimap.

    Stofler is a three-storey arena. A flattened composite is misleading, so
    its Analyzer map deliberately contains only the lowest playable floor and
    the ramps/rooms that descend into it.
    """
    if group_id == CORPUS_SHIP_DEFENSE_GROUP:
        result = dict(overlay)
        # The two now-authored procedural rooms sit above the base arena. Keep
        # their markers in `spawns` for alignment, but do not let that small
        # high band move the core floor slice onto ObjDefense01's roof/trusses.
        result["_mapSpawns"] = [
            item for item in overlay.get("spawns", [])
            if float(item.get("y", 0.0)) < 12.0
        ]
        result["_mapObjective"] = [
            item for item in overlay.get("objective", [])
            if float(item.get("y", 0.0)) < 12.0
        ]
        return result
    if group_id != "stofler":
        return overlay
    result = dict(overlay)
    bottom_cut = stofler_bottom_cut(overlay)
    # Preserve the approved bottom-deck minimap artwork and transform. These
    # private render-only collections do not limit the spawn reference catalog.
    result["_mapSpawns"] = [
        item for item in overlay.get("spawns", [])
        if float(item.get("y", 0.0)) <= STOFLER_BASE_MAP_MAX_Y
    ]
    result["_mapObjective"] = [
        item for item in overlay.get("objective", [])
        if float(item.get("y", 0.0)) <= STOFLER_BASE_MAP_MAX_Y
    ]
    result["spawns"] = [
        item for item in overlay.get("spawns", [])
        if float(item.get("y", 0.0)) < bottom_cut
    ]
    result["objective"] = [
        item for item in overlay.get("objective", [])
        if float(item.get("y", 0.0)) < bottom_cut
    ]
    result["floorFilter"] = {
        "label": "bottom",
        "maxY": round(bottom_cut, 4),
        # Stofler reaches its permanent bottom arena after the two introductory
        # three-wave floors. The browser uses this phase boundary before doing
        # coordinate alignment because procedural compositions can translate
        # the canonical floor height.
        "minWave": 7,
    }
    return result


def merge_spawn_supplements(
    mapped_spawns: dict[str, list[list[float]]],
    supplements: dict[str, list[list[float]]],
    tolerance: float = 0.25,
) -> dict[str, list[list[float]]]:
    """Add reviewed runtime references without duplicating newly authored rooms."""
    result = {key: [list(position) for position in positions]
              for key, positions in mapped_spawns.items()}
    known = [np.asarray(position, dtype=np.float64)
             for positions in result.values() for position in positions]
    for key, positions in supplements.items():
        retained: list[list[float]] = []
        for position in positions:
            candidate = np.asarray(position, dtype=np.float64)
            if any(np.linalg.norm(candidate - reference) <= tolerance for reference in known):
                continue
            retained.append(list(position))
            known.append(candidate)
        if retained:
            result[key] = retained
    return result


def render_map(
    group_id: str,
    positions: np.ndarray,
    faces: np.ndarray,
    overlay: dict,
    output_path: Path,
    size: int = 1000,
) -> dict:
    lo, hi = map_bounds(overlay, positions)
    if group_id == CORPUS_SHIP_DEFENSE_GROUP:
        # Reserve real canvas space for the two procedural side rooms. Do not
        # add their points to _mapSpawns: doing that would also pull unrelated
        # ceiling height bands back into the flattened map.
        room_points = np.concatenate(CORPUS_SHIP_RUNTIME_SPAWN_ROOMS)
        room_xz = room_points[:, (0, 2)]
        lo = np.minimum(lo, room_xz.min(axis=0) - 5.0)
        hi = np.maximum(hi, room_xz.max(axis=0) + 5.0)
    span = np.maximum(hi - lo, 1.0)
    scale = (size - 76) / float(max(span))
    pad = ((size - 76) - span * scale) * 0.5 + 38

    def project(points: np.ndarray) -> np.ndarray:
        result = (points[:, (0, 2)] - lo) * scale + pad
        # Match the in-game minimap handedness: world +X runs toward the left
        # side of the displayed map, while world +Z runs upward.
        result[:, 0] = size - result[:, 0]
        result[:, 1] = size - result[:, 1]
        if group_id == CORPUS_SHIP_DEFENSE_GROUP:
            # This arena reads more naturally in the same clockwise orientation
            # players use for its in-game minimap. Rotate geometry, baked
            # objective markers, and the exported spawn matrix together.
            base = result.copy()
            result[:, 0] = size - base[:, 1]
            result[:, 1] = base[:, 0]
        elif group_id == HYDRON_DEFENSE_GROUP:
            # Keep this reviewed arena in its counterclockwise orientation.
            # Objective positions pass through this projection, while their
            # letters are drawn afterward and therefore remain upright.
            base = result.copy()
            result[:, 0] = base[:, 1]
            result[:, 1] = size - base[:, 0]
        return np.rint(result).astype(np.int32)

    # Transparent RGBA output: the Analyzer card supplies the neutral backdrop.
    # Each height band is unioned into a silhouette before contouring so the
    # source mesh's individual triangle edges never appear as a wire grid.
    image = np.zeros((size, size, 4), dtype=np.uint8)
    map_spawns = overlay.get("_mapSpawns", overlay.get("spawns")) or []
    map_objective = overlay.get("_mapObjective", overlay.get("objective")) or []
    spawn_heights = [float(item.get("y", 0.0)) for item in map_spawns]
    objective_heights = [float(item.get("y", 0.0)) for item in map_objective]
    heights = cluster_heights(spawn_heights + objective_heights)
    if group_id == GAS_SPAWN_02_GROUP:
        heights = [height for height in heights if height < GAS_SPAWN_02_MAX_MAP_HEIGHT]
    elif group_id == HYF_DEFENSE_GROUP:
        heights = list(HYF_PLAYABLE_FLOOR_HEIGHTS)
    chunk_size = 160_000

    for band_index, height in enumerate(heights):
        height_tolerance = (
            HYF_ADDITIONAL_FLOOR_TOLERANCE
            if group_id == HYF_DEFENSE_GROUP and band_index > 0
            else 3.0
        )
        mask = np.zeros((size, size), dtype=np.uint8)
        for start in range(0, len(faces), chunk_size):
            tri = positions[faces[start : start + chunk_size]]
            ab = tri[:, 1] - tri[:, 0]
            ac = tri[:, 2] - tri[:, 0]
            normals = np.cross(ab, ac)
            normal_length = np.linalg.norm(normals, axis=1)
            centroids = tri.mean(axis=1)
            area = normal_length * 0.5
            keep = (
                (normal_length > 1e-5)
                & (np.abs(normals[:, 1]) / np.maximum(normal_length, 1e-9) > 0.58)
                & (np.abs(centroids[:, 1] - height) <= height_tolerance)
                & (area > 0.01)
                & (area < 520.0)
                & (centroids[:, 0] >= lo[0])
                & (centroids[:, 0] <= hi[0])
                & (centroids[:, 2] >= lo[1])
                & (centroids[:, 2] <= hi[1])
            )
            selected = tri[keep]
            if not len(selected):
                continue
            polygons = project(selected.reshape((-1, 3))).reshape((-1, 3, 2))
            cv2.fillPoly(mask, polygons, 255, lineType=cv2.LINE_AA)

        if group_id == GAS_SPAWN_02_GROUP and abs(height + 4.0) <= 3.0:
            connector = project(GAS_SPAWN_02_CONNECTOR).reshape((-1, 1, 2))
            cv2.fillPoly(mask, [connector], 255, lineType=cv2.LINE_AA)
            for closet in GAS_SPAWN_02_SPAWN_CLOSETS:
                floor = project(closet).reshape((-1, 1, 2))
                cv2.fillPoly(mask, [floor], 255, lineType=cv2.LINE_AA)
        if group_id == CORPUS_SHIP_DEFENSE_GROUP and band_index == len(heights) - 1:
            for room in CORPUS_SHIP_RUNTIME_SPAWN_ROOMS:
                floor = project(room).reshape((-1, 1, 2))
                cv2.fillPoly(mask, [floor], 255, lineType=cv2.LINE_AA)
        if group_id == HYF_DEFENSE_GROUP and band_index > 0:
            # Extend the established low-floor silhouette only into blank map
            # space. This restores the upper and lower-middle playable decks
            # without repainting the interior with ceiling/furniture clutter.
            mask[image[:, :, 3] > 0] = 0

        # Close sub-pixel extraction seams without flattening real doorways and
        # holes, then draw only the resulting room/perimeter contours.
        mask = cv2.morphologyEx(
            mask,
            cv2.MORPH_CLOSE,
            cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)),
        )
        contours, _ = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
        level = band_index / max(1, len(heights) - 1)
        fill_gray = int(92 + level * 24)
        fill_alpha = int(66 + level * 24)
        band_layer = np.zeros_like(image)
        band_layer[mask > 0] = (fill_gray, fill_gray + 2, fill_gray + 7, fill_alpha)
        exterior = None
        if (
            group_id == OROKIN_TOWER_DEFENSE_GROUP
            and height >= OROKIN_TOWER_CEILING_BAND_MIN_HEIGHT
        ):
            # OrokinTowerDefense's upper authored band includes the elevated
            # spawn closets plus a dense ceiling/truss layer over the lower
            # playable silhouette. Keep only upper-band geometry that extends
            # into the exterior background; the validated spawn transform and
            # every authored spawn reference remain untouched.
            outside = (image[:, :, 3] == 0).astype(np.uint8) * 255
            cv2.floodFill(outside, None, (0, 0), 128)
            exterior = outside == 128
            band_layer[~exterior] = 0
        if contours:
            shadow = np.zeros_like(image)
            cv2.drawContours(shadow, contours, -1, (0, 0, 0, 135), 7, cv2.LINE_AA)
            cv2.drawContours(band_layer, contours, -1, (178, 181, 188, 220), 3, cv2.LINE_AA)
            if exterior is not None:
                band_layer[~exterior] = 0
                shadow[~exterior] = 0
            shadow_alpha = shadow[:, :, 3:4].astype(np.float32) / 255.0
            image[:, :, :3] = (
                image[:, :, :3].astype(np.float32) * (1.0 - shadow_alpha)
            ).astype(np.uint8)
            image[:, :, 3] = np.maximum(image[:, :, 3], shadow[:, :, 3])

        source_alpha = band_layer[:, :, 3:4].astype(np.float32) / 255.0
        target_alpha = image[:, :, 3:4].astype(np.float32) / 255.0
        out_alpha = source_alpha + target_alpha * (1.0 - source_alpha)
        safe_alpha = np.maximum(out_alpha, 1e-6)
        image[:, :, :3] = (
            (
                band_layer[:, :, :3].astype(np.float32) * source_alpha
                + image[:, :, :3].astype(np.float32) * target_alpha * (1.0 - source_alpha)
            )
            / safe_alpha
        ).astype(np.uint8)
        image[:, :, 3] = np.rint(out_alpha[:, :, 0] * 255.0).astype(np.uint8)

    if group_id == GAS_SPAWN_02_GROUP:
        for detail in GAS_SPAWN_02_CONNECTOR_DETAILS:
            line = project(detail).reshape((-1, 1, 2))
            cv2.polylines(image, [line], False, (153, 156, 163, 210), 3, cv2.LINE_AA)

    if group_id == CORPUS_SHIP_DEFENSE_GROUP:
        # ObjDefense01 contains eight tiny detached ceiling fragments (four
        # two-dot pairs) outside the connected arena. Remove only those isolated
        # components; the reviewed runtime side-room envelopes are large enough
        # to survive independently if a source-mesh doorway has a small seam.
        component_mask = (image[:, :, 3] > 0).astype(np.uint8)
        count, labels, stats, _ = cv2.connectedComponentsWithStats(component_mask, 8)
        for component in range(1, count):
            if int(stats[component, cv2.CC_STAT_AREA]) < CORPUS_SHIP_MIN_CONNECTED_AREA:
                image[labels == component] = 0

    territory = [
        item for item in map_objective
        if item.get("type") == "TerritoryObjectiveMarkerInfo"
    ]
    for index, item in enumerate(territory):
        point = np.asarray([[item["x"], item.get("y", 0.0), item["z"]]], dtype=np.float32)
        x, y = project(point)[0]
        # Keep capture points legible without imitating the in-game badge.
        # The map only needs a clean, neutral positional marker here.
        red = (0, 12, 205, 255)
        center = (int(round(x)), int(round(y)))
        cv2.circle(image, center, 27, (0, 0, 0, 210), -1, cv2.LINE_AA)
        cv2.circle(image, center, 23, (12, 14, 20, 238), -1, cv2.LINE_AA)
        cv2.circle(image, center, 23, red, 5, cv2.LINE_AA)
        label = chr(65 + index)
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = .72
        thickness = 3
        (text_width, text_height), baseline = cv2.getTextSize(label, font, font_scale, thickness)
        cv2.putText(
            image,
            label,
            (
                # OpenCV's Hershey glyph pixels land about one pixel left and
                # four pixels above the center implied by getTextSize(). Apply
                # that measured optical correction to the actual baked label.
                int(round(x - text_width / 2 + 1)),
                int(round(y + (text_height - baseline) / 2 + 4)),
            ),
            font,
            font_scale,
            red,
            thickness,
            cv2.LINE_AA,
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    webp_quality = 100 if group_id == GAS_SPAWN_02_GROUP else 90
    if not cv2.imwrite(str(output_path), image, [cv2.IMWRITE_WEBP_QUALITY, webp_quality]):
        raise RuntimeError(f"could not write {output_path}")
    mapped_spawns: dict[str, list[list[float]]] = {}
    for item in overlay.get("spawns", []):
        match = re.search(r"(\d+)$", str(item.get("path", "")))
        if not match:
            continue
        mapped_spawns.setdefault(match.group(1), []).append([
            round(float(item["x"]), 4),
            round(float(item.get("y", 0.0)), 4),
            round(float(item["z"]), 4),
        ])

    asset_versions = {
        "stofler": "bottom-floor-20260816",
        GAS_SPAWN_02_GROUP: "clean-floor-20260819",
        OROKIN_TOWER_DEFENSE_GROUP: "ceiling-trim-20260820",
        CORPUS_SHIP_DEFENSE_GROUP: "runtime-side-rooms-20260821",
        HYDRON_DEFENSE_GROUP: "counterclockwise-20260821",
        HYF_DEFENSE_GROUP: "multi-floor-20260821",
    }
    asset_version = asset_versions.get(group_id)
    return {
        "src": f"./minimaps/{output_path.name}"
        + (f"?v={asset_version}" if asset_version else ""),
        "width": size,
        "height": size,
        "matrix": (
            [
                0.0, round(scale, 9), round(float(pad[1] - lo[1] * scale), 9),
                round(-scale, 9), 0.0, round(float(size + lo[0] * scale - pad[0]), 9),
            ]
            if group_id == CORPUS_SHIP_DEFENSE_GROUP
            else (
                [
                    0.0, round(-scale, 9),
                    round(float(size + lo[1] * scale - pad[1]), 9),
                    round(scale, 9), 0.0,
                    round(float(pad[0] - lo[0] * scale), 9),
                ]
                if group_id == HYDRON_DEFENSE_GROUP
                else [
                    round(-scale, 9), 0.0,
                    round(float(size + lo[0] * scale - pad[0]), 9),
                    0.0, round(-scale, 9),
                    round(float(size + lo[1] * scale - pad[1]), 9),
                ]
            )
        ),
        "calibrated": True,
        "source": "tile-geometry",
        "interceptionMarkers": len(territory),
        "levelPaths": overlay.get("levelPaths", []),
        "spawnPoints": mapped_spawns,
        **({
            "proceduralSpawnExtras": {
                "minMatchedPoints": 24,
                "minObservedCoverage": 0.9,
            }
        } if group_id == CORPUS_SHIP_DEFENSE_GROUP else {}),
        **({"floorFilter": overlay["floorFilter"]} if overlay.get("floorFilter") else {}),
    }


def main() -> None:
    repo = Path(__file__).resolve().parents[2]
    tileset_repo = repo.parent / "Tileset_3D"
    source_dirs = {
        "preview": tileset_repo / "_wfg2_preview" / "3d_tilesets" / "data",
        "variants": tileset_repo / "_variant_wfg1",
        "requested": tileset_repo / "_requested_fixes_wfg1",
        "umbriel_green": tileset_repo / "_umbriel2_green_wfg1",
    }
    current_dir = repo / "3d_tilesets" / "data"
    output_dir = repo / "analyzer" / "minimaps"
    manifests = {
        name: json.loads((path / "maps.json").read_text(encoding="utf-8"))
        for name, path in source_dirs.items()
    }
    current_manifest = json.loads((current_dir / "maps.json").read_text(encoding="utf-8"))
    catalog: dict[str, dict] = {}
    nodes: dict[str, list[str]] = {}
    for group_id, (source_name, source_group_id) in SOURCE_GROUPS.items():
        source_dir = source_dirs[source_name]
        group = manifests[source_name]["groups"][source_group_id]
        current_group = current_manifest["groups"][group_id]
        overlay = json.loads((current_dir / current_group["overlay"]).read_text(encoding="utf-8"))
        overlay = display_overlay(group_id, overlay)
        positions, faces = read_wfg(source_dir / f"{group['mesh']}.wfg")
        label = " / ".join(node["name"] for node in current_group.get("nodes", []))
        if group_id == CORPUS_SHIP_DEFENSE_GROUP:
            output_name = f"{group_id}-clockwise.webp"
        elif group_id == HYDRON_DEFENSE_GROUP:
            output_name = f"{group_id}-counterclockwise.webp"
        else:
            output_name = f"{group_id}.webp"
        entry = render_map(group_id, positions, faces, overlay, output_dir / output_name)
        entry["spawnPoints"] = merge_spawn_supplements(
            entry["spawnPoints"],
            ANALYZER_SPAWN_SUPPLEMENTS.get(group_id, {}),
        )
        entry["label"] = label
        catalog[group_id] = entry
        base_group_id = group_id.split("~", 1)[0]
        for node_id in GROUP_NODES[base_group_id]:
            nodes.setdefault(node_id, []).append(group_id)
        print(f"{group_id}: {len(positions):,} vertices, {len(faces):,} triangles")

    payload = {"version": 2, "catalog": catalog, "nodes": nodes}
    catalog_js = "globalThis.ArbitrationMinimapCatalog=" + json.dumps(payload, separators=(",", ":")) + ";\n"
    (output_dir / "catalog.js").write_text(catalog_js, encoding="utf-8")
    (output_dir / IMMUTABLE_CATALOG_FILENAME).write_text(catalog_js, encoding="utf-8")


if __name__ == "__main__":
    main()
