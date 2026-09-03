// Exact combinatorial calculations under the stated positives-first model.
import {isCombinedTrait} from './catalog.mjs';

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

export function evaluate(pool, target, assumptions) {
  const {positives, negatives, hasNegative, heldNegative} = target;
  const combined = positives.filter(isCombinedTrait);
  const retainedPositiveSet = new Set([...(target.retainedPositives || []), ...combined]);
  const retainedNegativeSet = new Set(target.retainedNegatives || []);
  const retainedPositives = positives.filter(id => retainedPositiveSet.has(id));
  const ordinary = positives.filter(id => !retainedPositiveSet.has(id));
  const heldPositive = target.heldPositive ?? combined[0] ?? positives[0];
  const k = positives.length;
  const p = pool.positive.size, n = pool.negative.size;
  const r = positives.filter(id => pool.negative.has(id)).length;
  const d = n - r;
  const compatible = [...pool.negative].filter(id => !positives.includes(id));
  const a = new Set(negatives.filter(id => compatible.includes(id))).size;
  const delta = pool.positive.has(heldNegative) ? 1 : 0;
  const validTarget = [2, 3].includes(k) && new Set(positives).size === k && ordinary.every(id => pool.positive.has(id));
  const validPositive = validTarget && !retainedPositives.length;
  const validPositiveLock = validTarget && positives.includes(heldPositive) && (retainedPositives.length === 1
    ? heldPositive === retainedPositives[0] : !retainedPositives.length && pool.positive.has(heldPositive));
  const positiveCandidates = p - (retainedPositiveSet.has(heldPositive) ? 0 : pool.positive.has(heldPositive) ? 1 : 0);
  const validNegative = hasNegative && negatives.includes(heldNegative) && !positives.includes(heldNegative)
    && (compatible.includes(heldNegative) || retainedNegativeSet.has(heldNegative));
  const negativeFactor = hasNegative ? (d > 0 ? a / d : 0) : 1;
  const q0 = validPositive ? assumptions.unlockedLayoutWeight / choose(p, k) * negativeFactor : 0;
  const qPositive = validPositiveLock ? assumptions.positiveLockLayoutWeight / choose(positiveCandidates, k - 1) * negativeFactor : 0;
  const qNegative = validPositive && validNegative ? assumptions.negativeLockLayoutWeight / choose(p - delta, k) : 0;
  const threshold = validPositive && validNegative
    ? assumptions.negativeLockLayoutWeight / assumptions.positiveLockLayoutWeight * d * choose(p - 1, k - 1) / choose(p - delta, k)
    : null;
  return {p, n, k, r, d, a, delta, compatible, heldPositive, positiveCandidates, combinedCount: combined.length,
    retainedPositiveCount: retainedPositives.length, retainedNegative: retainedNegativeSet.has(heldNegative), q0, qPositive, qNegative, threshold,
    winsFrom: threshold === null ? null : Math.floor(threshold + 1e-10) + 1};
}

export function bounds(values) {
  const valid = values.filter(value => value !== null && !Number.isNaN(value));
  return valid.length ? {min: Math.min(...valid), max: Math.max(...valid)} : null;
}

export function reduction(baseProbability, lockedProbability, surcharge = 1.5) {
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
