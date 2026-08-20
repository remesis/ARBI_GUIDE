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
      let bestIndex = -1;
      let bestDistance = Infinity;
      for (let index = 0; index < reference.length; index += 1) {
        if (used.has(index)) continue;
        const candidateDistance = distance(mapped, reference[index].position);
        if (candidateDistance < bestDistance) {
          bestIndex = index;
          bestDistance = candidateDistance;
        }
      }
      if (bestIndex < 0 || bestDistance > tolerance) return null;
      used.add(bestIndex);
      error += bestDistance;
      matches.push({ point, position: reference[bestIndex].position });
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

  function evaluateSubsetTransform(points, reference, transform, offset, tolerance) {
    const used = new Set();
    const matches = [];
    let error = 0;
    for (const point of points) {
      const [flatX, flatZ] = transform(point);
      const mapped = [flatX + offset[0], point.y + offset[1], flatZ + offset[2]];
      let bestIndex = -1;
      let bestDistance = Infinity;
      for (let index = 0; index < reference.length; index += 1) {
        if (used.has(index)) continue;
        const candidateDistance = distance(mapped, reference[index].position);
        if (candidateDistance < bestDistance) {
          bestIndex = index;
          bestDistance = candidateDistance;
        }
      }
      if (bestIndex < 0 || bestDistance > tolerance) continue;
      used.add(bestIndex);
      error += bestDistance;
      matches.push({ point, position: reference[bestIndex].position });
    }
    return { matches, error };
  }

  function mappedPoints(points, transform, offset) {
    return points.map((point) => {
      const [flatX, flatZ] = transform(point);
      return {
        point,
        position: [flatX + offset[0], point.y + offset[1], flatZ + offset[2]],
      };
    });
  }

  // Some multi-stage Defense maps retain spawn records from earlier arenas in
  // the same run. Find the coordinate-consistent subset for a floor-specific
  // minimap instead of trusting an absolute world height, since procedural
  // compositions may translate the whole tile vertically.
  function matchingSubset(points, config, tolerance = .25) {
    if (!points.length || !config?.spawnPoints) return { mode: "none", matches: [] };
    const reference = referencePoints(config);
    if (!reference.length) return { mode: "none", matches: [] };
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
        .slice(0, 32);
      for (const candidate of candidates) {
        const offset = candidate.sums.map((sum) => sum / candidate.count);
        const result = evaluateSubsetTransform(points, reference, transform, offset, tolerance);
        if (result.matches.length < 4) continue;
        if (!best
          || result.matches.length > best.matches.length
          || (result.matches.length === best.matches.length && result.error < best.error)) {
          best = { ...result, mapped: mappedPoints(points, transform, offset) };
        }
      }
    }
    return best
      ? { mode: "subset", matches: best.matches, mapped: best.mapped }
      : { mode: "none", matches: [], mapped: [] };
  }

  function verifySpawnPositions(points, config, tolerance = .25) {
    if (!points.length || !config?.spawnPoints) return { mode: "none", matches: [] };
    const direct = directMatches(points, config, tolerance);
    if (direct.length === points.length) return { mode: "direct", matches: direct };
    const transformed = transformedMatches(points, config, tolerance);
    if (transformed.length === points.length) return { mode: "transformed", matches: transformed };
    return { mode: "none", matches: [] };
  }

  function verifyDisplayPositions(points, config, tolerance = .25) {
    const exact = verifySpawnPositions(points, config, tolerance);
    if (exact.matches.length === points.length || !config?.proceduralSpawnExtras) return exact;

    const subset = matchingSubset(points, config, tolerance);
    const policy = config.proceduralSpawnExtras;
    const minMatchedPoints = Number(policy.minMatchedPoints || 12);
    const minObservedCoverage = Number(policy.minObservedCoverage || .9);
    const matchedCount = subset.matches.length;
    const observedCoverage = points.length ? matchedCount / points.length : 0;
    if (matchedCount < minMatchedPoints || observedCoverage < minObservedCoverage) {
      return { mode: "none", matches: [] };
    }
    return {
      mode: "mapped-subset",
      matches: subset.mapped,
      matchedCount,
      observedCoverage,
    };
  }

  return { verifySpawnPositions, verifyDisplayPositions, matchingSubset };
});
