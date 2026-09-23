// Exact combinatorial calculations under the stated positives-first model.
import {isCombinedTrait} from './catalog.mjs?v=20260923-lock-grades';

export const S_GRADE_CHANCE = .025;

function* subsets(items, count, start = 0, prefix = []) {
  if (!count) { yield prefix; return; }
  for (let i = start; i <= items.length - count; i++) yield* subsets(items, count - 1, i + 1, [...prefix, items[i]]);
}

// Uniform positive sets first; any negative is drawn from the completed set's
// compatible pool. A held negative instead excludes its positive counterpart.
function* setupOutcomes(pool, k, hasNegative, lock) {
  const positiveLock = lock.polarity === 'positive';
  if (!pool[lock.polarity].has(lock.id) || !positiveLock && !hasNegative) return;
  const candidates = [...pool.positive].filter(id => id !== lock.id);
  const draws = k - Number(positiveLock), denominator = choose(candidates.length, draws);
  if (!denominator) return;
  for (const rolled of subsets(candidates, draws)) {
    const positives = positiveLock ? [lock.id, ...rolled] : rolled;
    const negatives = !hasNegative ? [null] : !positiveLock ? [lock.id] : [...pool.negative].filter(id => !positives.includes(id));
    for (const negative of negatives) yield {rolled, positives, negative, weight: 1 / denominator / negatives.length};
  }
}

/** Positive S line held, any recipe partner accepted in either eligible sign. */
export function splicePartnerChance(pool, recipes, k, hasNegative, held) {
  const partners = new Set(recipes.flatMap(([a, b]) => a === held ? [b] : b === held ? [a] : []));
  let chance = 0;
  for (const outcome of setupOutcomes(pool, k, hasNegative, {id: held, polarity: 'positive'})) {
    if (outcome.rolled.some(id => partners.has(id)) || partners.has(outcome.negative)) chance += outcome.weight;
  }
  return Math.min(1, chance);
}

/** Two-stage route: stop on the first usable positive S, then retain it.
 * The starting lock exists already and is not itself assumed S-grade.
 * Multiple S lines: splice immediately if possible, otherwise keep the line
 * with the shortest partner search. Grades are independent uniform draws.
 */
export function spliceSetupRoute(pool, recipes, k, hasNegative, lock, gradeChance = S_GRADE_CHANCE, partnerChances) {
  if (![2, 3].includes(k) || !(gradeChance > 0 && gradeChance <= 1)) return null;
  const ingredients = [...new Set(recipes.flat())].filter(id => pool.positive.has(id));
  const qPartner = partnerChances || new Map(ingredients.map(id => [id, splicePartnerChance(pool, recipes, k, hasNegative, id)]));
  const partners = new Map(ingredients.map(id => [id, new Set(recipes.flatMap(([a,b]) => a === id ? [b] : b === id ? [a] : []))]));
  let q = 0, weightedExtra = 0, needsPartner = 0;
  for (const outcome of setupOutcomes(pool, k, hasNegative, lock)) {
    const eligible = outcome.rolled.filter(id => qPartner.get(id) > 0);
    for (let mask = 1; mask < 2 ** eligible.length; mask++) {
      let gradeWeight = 1, extra = Infinity;
      eligible.forEach((id, bit) => {
        const isS = Boolean(mask & (1 << bit));
        gradeWeight *= isS ? gradeChance : 1 - gradeChance;
        if (isS) {
          const ready = outcome.positives.some(trait => partners.get(id).has(trait)) || partners.get(id).has(outcome.negative);
          extra = Math.min(extra, ready ? 0 : 1 / qPartner.get(id));
        }
      });
      const weight = outcome.weight * gradeWeight;
      q += weight;
      weightedExtra += weight * extra;
      if (extra > 0) needsPartner += weight;
    }
  }
  if (!q) return null;
  const first = 1 / q, additional = weightedExtra / q;
  return {lock, chance: q, first, additional, total: first + additional,
    ready: 1 - needsPartner / q, ifMissing: needsPartner ? weightedExtra / needsPartner : 0};
}

/** Compare existing ordinary starting locks, within the selected format.
 * Unresolved pools stay separate. Do not invent a single optimal route when
 * different eligibility scenarios prefer different starting locks.
 */
export function optimalSpliceSetup(pools, recipes, k, hasNegative) {
  const recipeIds = [...new Set(recipes.flat())];
  const routeCache = new Map(), partnerCache = new Map();
  const scenarios = pools.map(pool => {
    // Non-ingredients with the same polarity eligibility are interchangeable.
    // Reuse only exact pool signatures, without averaging uncertain scenarios.
    const membership = id => Number(pool.positive.has(id)) + 2 * Number(pool.negative.has(id));
    const signature = [pool.positive.size, pool.negative.size, [...pool.positive].filter(id => pool.negative.has(id)).length,
      ...recipeIds.map(membership)].join(':');
    if (!partnerCache.has(signature)) partnerCache.set(signature, new Map(recipeIds.filter(id => pool.positive.has(id))
      .map(id => [id, splicePartnerChance(pool, recipes, k, hasNegative, id)])));
    const partnerChances = partnerCache.get(signature);
    const locks = [ ...(hasNegative ? [...pool.negative].map(id => ({id, polarity: 'negative'})) : []),
      ...[...pool.positive].map(id => ({id, polarity: 'positive'})) ];
    const routes = locks.map(lock => {
      const key = `${signature}:${lock.polarity}:${recipeIds.includes(lock.id) ? lock.id : membership(lock.id)}`;
      if (!routeCache.has(key)) routeCache.set(key, spliceSetupRoute(pool, recipes, k, hasNegative, lock, S_GRADE_CHANCE, partnerChances));
      const route = routeCache.get(key);
      return route && {...route, lock};
    }).filter(Boolean);
    const min = Math.min(...routes.map(route => route.total));
    return routes.filter(route => Math.abs(route.total - min) < 1e-8);
  });
  if (scenarios.some(routes => !routes.length)) return {available: false, uncertain: pools.length > 1};
  const commonRoutes = scenarios[0].filter(route => scenarios.every(routes => routes.some(other => other.lock.id === route.lock.id && other.lock.polarity === route.lock.polarity)));
  const [common] = commonRoutes;
  if (!common) return {available: false, uncertain: true};
  const routes = scenarios.map(rows => rows.find(route => route.lock.id === common.lock.id && route.lock.polarity === common.lock.polarity));
  const metrics = ['chance', 'first', 'additional', 'total', 'ready', 'ifMissing'];
  // Alternatives must match every displayed stage, not merely tie on total rolls.
  // For uncertain pools, they must do so separately in every scenario.
  const equivalentLocks = commonRoutes.filter(candidate => scenarios.every((rows, i) => {
    const alternative = rows.find(row => row.lock.id === candidate.lock.id && row.lock.polarity === candidate.lock.polarity);
    return metrics.every(key => Math.abs(alternative[key] - routes[i][key]) < 1e-8);
  })).map(route => route.lock);
  return {available: true, uncertain: pools.length > 1, lock: common.lock, equivalentLocks,
    ...Object.fromEntries(metrics.map(key => [key, bounds(routes.map(route => route[key]))]))};
}

export function choose(n, k) {
  if (!Number.isInteger(n) || !Number.isInteger(k) || n < 0 || k < 0 || k > n) return 0;
  let value = 1;
  for (let i = 1; i <= Math.min(k, n - k); i++) value = value * (n - i + 1) / i;
  return Math.round(value);
}

export function enumeratePools(family) {
  const base = {positive: new Set(), negative: new Set()};
  const uncertain = [];
  for (const [id, entry] of Object.entries(family.traits)) {
    for (const polarity of ['positive', 'negative']) {
      if (entry[polarity] === 'allowed') base[polarity].add(id);
      if (entry[polarity] === 'unresolved') uncertain.push([id, polarity]);
    }
  }
  if (uncertain.length > 12) throw new Error('Pool uncertainty requires a larger research model.');
  const scenarios = [];
  for (let mask = 0; mask < 2 ** uncertain.length; mask++) {
    const pool = {positive: new Set(base.positive), negative: new Set(base.negative)};
    uncertain.forEach(([id, polarity], i) => { if (mask & (1 << i)) pool[polarity].add(id); });
    scenarios.push(pool);
  }
  return scenarios;
}

/** Acquire one ordinary trait before applying its manual lock. A pre-existing
 * splice occupies one positive slot and fixes the format; otherwise cycling
 * is unlocked and must also produce the requested format. Other traits are free.
 */
export function selectedLockChance(pool, {id, polarity, positives, hasNegative, hasSplice = false}, assumptions) {
  if (![2, 3].includes(positives) || !['positive', 'negative'].includes(polarity)
    || isCombinedTrait(id) || !pool[polarity].has(id) || polarity === 'negative' && !hasNegative) return 0;
  const p = pool.positive.size, n = pool.negative.size, draws = positives - Number(hasSplice);
  const denominator = choose(p, draws);
  if (!denominator) return 0;
  const shared = [...pool.positive].filter(trait => pool.negative.has(trait)).length;
  let probability = 0;
  if (polarity === 'positive') {
    if (!hasNegative) probability = choose(p - 1, draws - 1) / denominator;
    else {
      const delta = Number(pool.negative.has(id)), remainingShared = shared - delta;
      for (let j = 0; j <= draws - 1; j++) {
        if (n - delta - j > 0) probability += choose(remainingShared, j) * choose(p - 1 - remainingShared, draws - 1 - j) / denominator;
      }
    }
  } else {
    // The target negative must not occur among the positives. Marginalize the
    // compatible negative pool for every possible overlap count, not 1 / n.
    const delta = Number(pool.positive.has(id)), remainingShared = shared - delta;
    for (let j = 0; j <= draws; j++) {
      if (n > j) probability += choose(remainingShared, j) * choose(p - delta - remainingShared, draws - j) / denominator / (n - j);
    }
  }
  return Math.min(1, probability * (hasSplice ? 1 : assumptions.unlockedLayoutWeight));
}

export function evaluate(pool, target, assumptions) {
  const {positives, negatives, hasNegative, heldNegative} = target;
  const combined = positives.filter(isCombinedTrait);
  const retainedPositiveSet = new Set((target.retainedPositives || []).filter(id => !isCombinedTrait(id)));
  const retainedNegativeSet = new Set(target.retainedNegatives || []);
  const retainedPositives = positives.filter(id => retainedPositiveSet.has(id));
  const manualCandidates = positives.filter(id => !isCombinedTrait(id));
  const ordinary = manualCandidates.filter(id => !retainedPositiveSet.has(id));
  const heldPositive = target.heldPositive ?? retainedPositives[0] ?? manualCandidates[0];
  const k = positives.length;
  const m = k - combined.length;
  const p = pool.positive.size, n = pool.negative.size;
  const r = positives.filter(id => pool.negative.has(id)).length;
  const d = n - r;
  const compatible = [...pool.negative].filter(id => !positives.includes(id));
  const a = new Set(negatives.filter(id => compatible.includes(id))).size;
  const delta = pool.positive.has(heldNegative) ? 1 : 0;
  const validTarget = [2, 3].includes(k) && combined.length <= 1 && new Set(positives).size === k && ordinary.every(id => pool.positive.has(id));
  const validPositive = validTarget && !retainedPositives.length;
  const validPositiveLock = validTarget && manualCandidates.includes(heldPositive) && (retainedPositives.length === 1
    ? heldPositive === retainedPositives[0] : !retainedPositives.length && pool.positive.has(heldPositive));
  const positiveCandidates = p - (retainedPositiveSet.has(heldPositive) ? 0 : pool.positive.has(heldPositive) ? 1 : 0);
  const validNegative = hasNegative && negatives.includes(heldNegative) && !positives.includes(heldNegative)
    && (compatible.includes(heldNegative) || retainedNegativeSet.has(heldNegative));
  const negativeFactor = hasNegative ? (d > 0 ? a / d : 0) : 1;
  const inverseChoose = (count, draws) => { const ways = choose(count, draws); return ways ? 1 / ways : 0; };
  const q0 = validPositive ? (combined.length ? 1 : assumptions.unlockedLayoutWeight) * inverseChoose(p, m) * negativeFactor : 0;
  const qPositive = validPositiveLock ? assumptions.positiveLockLayoutWeight * inverseChoose(positiveCandidates, m - 1) * negativeFactor : 0;
  const qNegative = validPositive && validNegative ? assumptions.negativeLockLayoutWeight * inverseChoose(p - delta, m) : 0;
  const threshold = validPositive && validNegative
    ? assumptions.negativeLockLayoutWeight / assumptions.positiveLockLayoutWeight * d * choose(p - 1, m - 1) / choose(p - delta, m)
    : null;
  return {p, n, k, m, r, d, a, delta, compatible, heldPositive, positiveCandidates, positiveDraws: m - 1, combinedCount: combined.length,
    retainedPositiveCount: retainedPositives.length, retainedNegative: retainedNegativeSet.has(heldNegative), q0, qPositive, qNegative, threshold,
    winsFrom: threshold === null ? null : Math.floor(threshold + 1e-10) + 1};
}

export function bounds(values) {
  const valid = values.filter(value => value !== null && !Number.isNaN(value));
  return valid.length ? {min: Math.min(...valid), max: Math.max(...valid)} : null;
}

export function reduction(baseProbability, lockedProbability, surcharge = 2) {
  if (!(baseProbability > 0)) return null;
  if (!(lockedProbability > 0)) return -Infinity;
  return 1 - surcharge * baseProbability / lockedProbability;
}

export function analyze(pools, target, assumptions) {
  const scenarios = pools.map(pool => evaluate(pool, target, assumptions));
  const results = {};
  for (const [strategy, field] of [['none', 'q0'], ['positive', 'qPositive'], ['negative', 'qNegative']]) {
    const probability = bounds(scenarios.map(row => row[field]));
    results[strategy] = {
      probability,
      kuvaReduction: strategy === 'none' ? probability.max > 0 ? {min: 0, max: 0} : null
        : bounds(scenarios.map(row => reduction(row.q0, row[field], assumptions.lockedKuvaMultiplier))),
    };
  }
  const winningLocks = new Set(scenarios.filter(row => row.qPositive > 0 || row.qNegative > 0).map(row =>
    Math.abs(row.qPositive - row.qNegative) < 1e-15 ? 'tie' : row.qPositive > row.qNegative ? 'positive' : 'negative'));
  return {scenarios, results, winningLock: winningLocks.size === 1 ? [...winningLocks][0] : 'uncertain',
    p: bounds(scenarios.map(row => row.p)), n: bounds(scenarios.map(row => row.n)),
    threshold: bounds(scenarios.map(row => row.winsFrom)),
  };
}

export function attemptsFor(probability, confidence) {
  if (!(confidence > 0 && confidence < 1)) throw new RangeError('Confidence must be between zero and one.');
  if (!(probability > 0)) return Infinity;
  if (probability >= 1) return 1;
  return Math.ceil(Math.log1p(-confidence) / Math.log1p(-probability));
}

export function cumulativeSuccess(probability, attempts) {
  if (attempts <= 0) return 0;
  if (probability >= 1) return 1;
  if (probability <= 0) return 0;
  return -Math.expm1(attempts * Math.log1p(-probability));
}
