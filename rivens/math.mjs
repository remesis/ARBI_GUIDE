import {escapeHTML as esc, number, oddsText, intervalText} from './format.mjs';

export function renderMath({catalog, research, target, variant, format, nameOf}) {
  const single = research.scenarios.length === 1, row = research.scenarios[0];
  const positives = target.positives.map(nameOf).map(esc).join(', ');
  const negatives = target.negatives.map(nameOf).map(esc).join(', ');
  return `
  <h3>1. Scope and assumptions</h3>
  <p>This reference models <strong>trait identities</strong>, not numerical grades, mastery rank, polarity, or the cost of obtaining a starting Riven. A target is one exact unordered set of two or three positive traits, with either no negative or one negative from a set of acceptable alternatives.</p>
  <div class="math-callout"><strong>Working model: positives first.</strong> Positives are sampled uniformly without replacement. The negative is then sampled uniformly from its compatible pool. This is a modeling assumption, not a published probability guarantee. Different sampling weights or a different generation procedure would require different formulas.</div>
  <p>Without a lock, and with a positive locked, each of 2P0N, 3P0N, 2P1N, and 3P1N is assigned probability 1/4. A positive lock retains that positive line; it does not force the Riven to keep the same layout. A negative lock retains a negative line, excludes both 0N layouts, and assigns probability 1/2 to each of 2P1N and 3P1N. Its positive counterpart is excluded if that counterpart belongs to the positive pool.</p>
  <p>Only one line may be locked. The locked line is assumed to be available before the modeled rolling begins. No trait may appear as both a positive and a negative in the same target.</p>

  <h3>2. Notation</h3>
  <dl>
    <dt>P, p</dt><dd>The eligible positive-trait set and its size, p = |P|.</dd>
    <dt>N, n</dt><dd>The eligible negative-trait set and its size, n = |N|.</dd>
    <dt>S, k</dt><dd>The desired positive set and its size, k = 2 or 3.</dd>
    <dt>r</dt><dd>The number of desired positives that also belong to N: r = |S ∩ N|. This is about eligibility as a separate negative, not a locked positive changing sign.</dd>
    <dt>d</dt><dd>The negatives remaining after choosing S: d = n − r.</dd>
    <dt>T, a</dt><dd>The acceptable negative set and the number still compatible with S: a = |T ∩ (N ∖ S)|.</dd>
    <dt>L, v</dt><dd>The pre-existing positive line L ∈ S, or negative line v ∈ T ∩ (N ∖ S), chosen for locking.</dd>
    <dt>δ</dt><dd>1 if the locked negative's trait also belongs to P, otherwise 0. A genuinely negative-only trait does not remove a positive candidate.</dd>
    <dt>w, u</dt><dd>The target-layout probabilities: w = 1/4 without a lock or with a positive lock; u = 1/2 with a negative lock.</dd>
  </dl>
  <p>C(b, c) counts the unordered ways to select c distinct items from b:</p>
  <div class="formula">C(b, c) = b! / [c! (b − c)!]</div>
  <p>Pool sizes are weapon-specific. Disposition changes the stat ranges, not these trait-selection probabilities. Primary and Secondary Kitguns are separate entries for their different ranges and dispositions.</p>

  <h3>3. Deriving the per-roll odds</h3>
  <h4>No lock, kP1N</h4>
  <p>There are C(p, k) equally likely positive sets. Once S is selected, exactly d compatible negatives remain, of which a are acceptable. Multiply the target-layout probability by those two conditional probabilities:</p>
  <div class="formula">q₀ = w × 1 / C(p, k) × a / d</div>
  <h4>Positive lock, kP1N</h4>
  <p>The locked positive already satisfies one member of S. The remaining k − 1 positives are chosen from p − 1 candidates. After completing the positive set, the compatible negative pool is still N ∖ S:</p>
  <div class="formula">q₊ = w × 1 / C(p − 1, k − 1) × a / d</div>
  <p>Every eligible positive in the same target has the same lock probability in this model. Locking an element is not intrinsically better or worse than locking another selected positive. What matters for the final negative step is the entire completed positive set.</p>
  <h4>Negative lock, kP1N</h4>
  <p>The required negative is already retained. Exclude its positive counterpart if eligible, leaving p − δ candidates for the k positives. There is no additional factor a/d because the negative is not drawn again:</p>
  <div class="formula">q₋ = u × 1 / C(p − δ, k)</div>
  <p>Accepting more negative alternatives improves the no-lock and positive-lock chances, but does not improve the chance while keeping one particular negative locked.</p>
  <h4>Targets with no negative</h4>
  <div class="formula">q₀ = w / C(p, k) &nbsp;;&nbsp; q₊ = w / C(p − 1, k − 1) &nbsp;;&nbsp; q₋ = 0</div>
  <p>A negative lock cannot produce a 0N target. An invalid trait, a repeated positive, or a positive/negative conflict makes that exact target impossible rather than changing the size of a valid target's denominator.</p>

  <h3>4. Why the positive set matters</h3>
  <p>A positive trait that cannot be a negative, such as an element in the applicable pool, removes no candidate from N. Under positives-first sampling, two targets with equal positive-set probability can therefore have different chances of a <em>particular</em> negative. A larger remaining negative pool means a lower chance for that one negative. It does not make the positive element itself less likely.</p>
  <p>If every compatible negative is accepted, a = d and the final negative factor cancels. Counting all valid final combinations and assigning them equal probability is a different model and is not used here.</p>
  <div class="formula">q₊ / q₀ = C(p, k) / C(p − 1, k − 1) = p / k</div>

  <h3>5. When is a positive lock better?</h3>
  <p>Both locked strategies use the same per-roll Kuva cost, so the one with the larger success probability also has the lower expected Kuva cost. Solve q₊ &gt; q₋:</p>
  <div class="formula">a &gt; (u / w) × d × C(p − 1, k − 1) / C(p − δ, k)</div>
  <p>With a positive counterpart for the locked negative (δ = 1), this simplifies to:</p>
  <div class="formula">a &gt; 2k(n − r) / (p − k)</div>
  <p>For a negative-only trait (δ = 0), it becomes:</p>
  <div class="formula">a &gt; 2k(n − r) / p</div>
  <p>The first winning integer is the floor of the threshold plus one. Equality is a tie. If the threshold exceeds the number of compatible negative alternatives, a positive lock cannot win within that target. Changing the desired positives can change the threshold.</p>

  <h3>6. Your current selection</h3>
  <p><strong>${esc(variant.name)}</strong> · ${format.toUpperCase()} · disposition ${variant.disposition.toFixed(2)}<br>Positives: ${positives}.<br>${target.hasNegative ? `Acceptable negatives: ${negatives || 'none selected'}. Negative-lock comparison: ${esc(nameOf(target.heldNegative) || 'none')}.` : 'No negative requested.'}</p>
  <p>p = ${intervalText(research.p)}, n = ${intervalText(research.n)}, k = ${target.positives.length}.${single ? ` r = ${row.r}, d = ${row.d}, a = ${row.a}, δ = ${row.delta}.` : ' Unresolved eligibility produces multiple possible pools. Bounds cover those possibilities without assigning probabilities to them.'}</p>
  <table><thead><tr><th>Strategy</th><th>Current target odds</th></tr></thead><tbody><tr><td>No lock</td><td>${esc(oddsText(research.results.none.probability))}</td></tr><tr><td>Positive lock</td><td>${esc(oddsText(research.results.positive.probability))}</td></tr><tr><td>Negative lock</td><td>${target.hasNegative ? esc(oddsText(research.results.negative.probability)) : 'Not applicable'}</td></tr></tbody></table>
  ${single && target.hasNegative && row.a > 0 && row.qNegative > 0 ? `<div class="formula selection-formula">q₀ = ${row.a} / [4 × C(${row.p}, ${row.k}) × ${row.d}]<br>q₊ = ${row.a} / [4 × C(${row.p - 1}, ${row.k - 1}) × ${row.d}]<br>q₋ = 1 / [2 × C(${row.p - row.delta}, ${row.k})]</div>` : ''}

  <h3>7. Kuva reduction and planning</h3>
  <p>At the capped cost, an unlocked roll costs c₀ = ${number(catalog.assumptions.kuvaPerRoll)} Kuva. The stated 50% surcharge gives cᴸ = ${number(catalog.assumptions.kuvaPerRoll * catalog.assumptions.lockedKuvaMultiplier)} for a locked roll. Expected attempts are 1/q, so:</p>
  <div class="formula">E[K₀] = c₀ / q₀ &nbsp;;&nbsp; E[Kᴸ] = cᴸ / qᴸ</div>
  <div class="formula">Kuva reduction = 1 − E[Kᴸ] / E[K₀] = 1 − 1.5 q₀ / qᴸ</div>
  <p>The comparison always uses the <em>same</em> desired positive set and acceptable negative set on both sides. A negative percentage means more expected Kuva, not a saving. For a positive lock the reduction simplifies to 1 − 1.5k/p under the same layout weights.</p>
  <p>These totals exclude obtaining the first suitable trait, setup costs, and changes to strategy along the way. Early rolls below the Kuva cap follow a different price schedule. Farming time also depends on acquisition rate and is not calculated here.</p>
  <h4>Cumulative success</h4>
  <p>For independent attempts with fixed probability q, all m attempts fail with probability (1 − q)ᵐ. Therefore:</p>
  <div class="formula">Pr(at least one success in m rolls) = 1 − (1 − q)ᵐ</div>
  <div class="formula">mᶜ = ⌈ln(1 − c) / ln(1 − q)⌉</div>
  <p>The page evaluates c = 50% and 95%. A 1 / X chance is not a promise to succeed within X rolls. For rare outcomes, success by the mean waiting time is about 63.2%.</p>

  <h3>8. Stat ranges</h3>
  <p>Ranges use each category's trait coefficient, the selected variant's disposition D, and the target's positive/negative layout. They are shown at rank 8 with the 0.9 to 1.1 variation band. Rounding follows each trait's display precision; a game's last displayed digit can differ at floating-point endpoints.</p>
  <div class="formula">value = b × (rank + 1) × 10 × D × F × z, &nbsp; z ∈ [0.9, 1.1]</div>
  <p>b is the category-specific coefficient, before percentage conversion. F includes the 1.5 specific-fit factor and the layout factors:</p>
  <table><thead><tr><th>Layout</th><th>Positive F</th><th>Negative magnitude F</th></tr></thead><tbody><tr><td>2P0N</td><td>0.9900</td><td>None</td></tr><tr><td>3P0N</td><td>0.7500</td><td>None</td></tr><tr><td>2P1N</td><td>1.2375</td><td>0.4950</td></tr><tr><td>3P1N</td><td>0.9375</td><td>0.7500</td></tr></tbody></table>
  <p>Percentage traits multiply this result by 100. Faction damage is displayed as a multiplier around 1. Range and Punch Through use meters; Combo Duration uses seconds. Positive and negative refer to beneficial traits and curses, not the literal sign: beneficial Weapon Recoil has a minus sign.</p>
  <p>Red ranges are reference values for vintage or otherwise unrollable traits. Their display does not add them to the selectable current pool. Amber ranges are conditional on unresolved eligibility. Reference values do not establish when a historical Riven was generated. Dispositions are shown to two decimals without snapping to 0.05 steps.</p>
  <p>Requiring numerical values or grades is a different target. If g is the conditional probability of satisfying all remaining value requirements after obtaining the desired trait identities, then q(full target) = q(trait identities) × g. That identity does not assume the values are independent.</p>

  <h3>9. Sources and research status</h3>
  <p><strong>Implementation source.</strong> <a href="https://forums.warframe.com/topic/1521438-devshorts-115-116-a-look-at-riven-changes/" target="_blank" rel="noopener noreferrer">Digital Extremes, Devshorts #115 &amp; #116: A look at Riven Changes</a>, including the 31 August 2026 follow-up. Reviewed 2 September 2026. The announcement describes retaining one locked trait and the change to Kuva, while leaving details subject to change. It is not a probability disclosure.</p>
  <p><strong>Pricing basis.</strong> <a href="https://www.youtube.com/live/6QjnVIj3gr0?t=681s" target="_blank" rel="noopener noreferrer">Devshorts #115 (11:21 to 11:35)</a> discusses a 50% locking charge in the original resource. <a href="https://www.youtube.com/watch?v=4CA3pSWhDmg&amp;t=568s" target="_blank" rel="noopener noreferrer">Devshorts #116 (9:28 to 10:09)</a> replaces that resource with Kuva. This reference carries the quoted ratio into the revised currency, using cᴸ = 1.5c₀; confirm the final rate at release.</p>
  <p><strong>Trait-pool background.</strong> <a href="https://wiki.warframe.com/w/Riven_Mods" target="_blank" rel="noopener noreferrer">Warframe Wiki, Riven Mods</a>, a community-maintained reference. Check individual weapon eligibility before substituting a pool into the formulas.</p>
  <p><strong>Mathematical results.</strong> Counts, probabilities, crossover thresholds and expected values are derived here from the stated assumptions. Numerical stat requirements, acquisition strategy and full farming-time optimization need additional inputs.</p>
  <p>Not affiliated with or endorsed by Digital Extremes.</p>`;
}
