(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ArbitrationSpawnAlignment = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const PLANAR_TRANSFORMS = [
    (point) => [point.x, point.z],
    (point) => [point.x, -point.z],
    (point) => [-point.x, point.z],
    (point) => [-point.x, -point.z],
    (point) => [point.z, point.x],
    (point) => [point.z, -point.x],
    (point) => [-point.z, point.x],
    (point) => [-point.z, -point.x],
  ];

  function pointNumber(point) {
    return (String(point.ident || point.key).match(/(\d+)(?!.*\d)/) || [, "?"])[1];
  }

  function distance(left, right) {
    return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
  }

  function referencePoints(config) {
    return Object.entries(config.spawnPoints || {}).flatMap(([id, positions]) =>
      positions.map((position, index) => ({ id, index, position })),
    );
  }

  function directMatches(points, config, tolerance) {
    const matches = points.map((point) => {
      const candidates = config.spawnPoints?.[pointNumber(point)] || [];
      const match = candidates
        .map((position) => ({ position, distance: distance([point.x, point.y, point.z], position) }))
        .sort((left, right) => left.distance - right.distance)[0];
      return match && match.distance <= tolerance ? { point, position: match.position } : null;
    });
    return matches.every(Boolean) ? matches : [];
  }

  function evaluateTransform(points, reference, transform, offset, tolerance) {
    const used = new Set();
    const matches = [];
    let error = 0;
    for (const point of points) {
      const [flatX, flatZ] = transform(point);
      const mapped = [flatX + offset[0], point.y + offset[1], flatZ + offset[2]];
      const match = reference
        .filter((candidate) => !used.has(`${candidate.id}:${candidate.index}`))
        .map((candidate) => ({ candidate, distance: distance(mapped, candidate.position) }))
        .sort((left, right) => left.distance - right.distance)[0];
      if (!match || match.distance > tolerance) return null;
      used.add(`${match.candidate.id}:${match.candidate.index}`);
      error += match.distance;
      matches.push({ point, position: match.candidate.position });
    }
    return { matches, error };
  }

  function transformedMatches(points, config, tolerance) {
    if (points.length < 4) return [];
    const reference = referencePoints(config);
    if (reference.length < points.length) return [];
    let best = null;
    const binSize = .05;

    for (const transform of PLANAR_TRANSFORMS) {
      const bins = new Map();
      for (const point of points) {
        const [flatX, flatZ] = transform(point);
        for (const candidate of reference) {
          const offset = [
            candidate.position[0] - flatX,
            candidate.position[1] - point.y,
            candidate.position[2] - flatZ,
          ];
          const key = offset.map((value) => Math.round(value / binSize)).join(",");
          const bin = bins.get(key) || { count: 0, sums: [0, 0, 0] };
          bin.count += 1;
          bin.sums[0] += offset[0];
          bin.sums[1] += offset[1];
          bin.sums[2] += offset[2];
          bins.set(key, bin);
        }
      }

      const candidates = [...bins.values()]
        .sort((left, right) => right.count - left.count)
        .slice(0, 24);
      for (const candidate of candidates) {
        const offset = candidate.sums.map((sum) => sum / candidate.count);
        const result = evaluateTransform(points, reference, transform, offset, tolerance);
        if (result && (!best || result.error < best.error)) best = result;
      }
    }
    return best?.matches || [];
  }

  function verifySpawnPositions(points, config, tolerance = .25) {
    if (!points.length || !config?.spawnPoints) return { mode: "none", matches: [] };
    const direct = directMatches(points, config, tolerance);
    if (direct.length === points.length) return { mode: "direct", matches: direct };
    const transformed = transformedMatches(points, config, tolerance);
    if (transformed.length === points.length) return { mode: "transformed", matches: transformed };
    return { mode: "none", matches: [] };
  }

  return { verifySpawnPositions };
});
