import {escapeHTML as esc, number, oddsText, intervalText} from './format.mjs';
import {isCombinedTrait, splicedTraitsFor} from './catalog.mjs?v=20260923-grade-selectors';

export function renderMath({catalog, research, target, variant, format, nameOf}) {
  const single = research.scenarios.length === 1, row = research.scenarios[0];
  const positives = target.positives.map(nameOf).map(esc).join(', ');
  const negatives = target.negatives.map(nameOf).map(esc).join(', ');
  const combined = target.positives.filter(isCombinedTrait);
  const retainedPositives = [...new Set(target.retainedPositives || [])].filter(id => !isCombinedTrait(id));
  const spliced = combined.length === 1;
  const recipes = splicedTraitsFor(variant.definition || catalog.weapons.find(w => w.variants.some(v => v.id === variant.id))?.kind || 'Rifle');
  const vintageNegatives = target.retainedNegatives || [];
  const chance = probability => (retainedPositives.length || vintageNegatives.length) && probability.max <= 0 ? 'Not possible by cycling' : oddsText(probability);
  return `
  <h3>1. Scope and assumptions</h3>
  <p>The final-roll comparison models <strong>trait identities</strong>, not numerical grades, mastery rank, polarity, or the cost of obtaining a starting Riven. A target is one exact unordered set of two or three positive traits, with either no negative or one negative from a set of acceptable alternatives. The separate setup sections estimate S-grade splice ingredients and acquiring the selected manual-lock stat at a chosen grade or better, using the additional assumptions in section 8.</p>
  <div class="math-callout"><strong>Working model: positives first.</strong> Positives are sampled uniformly without replacement. The negative is then sampled uniformly from its compatible pool. This is a modeling assumption, not a published probability guarantee. Different sampling weights or a different generation procedure would require different formulas.</div>
  <p>Without a manual lock or retained splice, each of 2P0N, 3P0N, 2P1N, and 3P1N is assigned probability 1/4. Locking either sign preserves the starting format, so the target-format probability is 1 when that starting format matches the target, and 0 otherwise. Locked estimates start with a Riven already in the selected format; the cost of obtaining it is excluded. For a negative lock, its positive counterpart is excluded if that counterpart belongs to the positive pool.</p>
  <p>One trait may be manually locked at double Kuva cost. A spliced trait is automatically retained at no extra cost and does not use this manual lock. There is a limit of one spliced trait per Riven. All retained traits are assumed to be available before the modeled cycling begins. No trait may appear as both a positive and a negative in the same target.</p>
  <p><strong>Splicing</strong> creates a positive trait from an announced recipe. An S-grade positive ingredient can use a positive or negative partner wherever eligible. The splice retains the higher grade on future cycles; the ordinary replacement takes the other consumed ingredient’s polarity and can be either ingredient again if eligible. The layout is preserved. A retained splice then preserves that format on every cycle, even with no manual lock. The final-roll comparison starts with this splice already made; the separate setup section estimates reaching the ingredient pair. Splicing launches later with Glacial Defiance.</p>
  <details><summary>Spliced traits and recipes for this weapon type</summary><table><thead><tr><th>Spliced trait</th><th>Recipe</th></tr></thead><tbody>${recipes.map(t => `<tr><td>${esc(t.name)}</td><td>${esc(t.recipe)}</td></tr>`).join('')}</tbody></table><p>Normal ingredient eligibility still applies. Companion weapons use their ranged or melee weapon type. The splice is not an ordinary cycling candidate.</p></details>
  <p><strong>Vintage or no-longer-rollable traits can exist in either positive or negative slots.</strong> Select an existing vintage line in its original slot and retain it with the matching manual lock. It stays outside the current cycling pool for that sign; locking does not make it newly rollable or change its sign. Obtaining that vintage line is outside these estimates.</p>

  <h3>2. Notation</h3>
  <dl>
    <dt>P, p</dt><dd>The currently eligible ordinary positive-trait set and its size, p = |P|. Spliced and vintage positive traits are not members of P.</dd>
    <dt>N, n</dt><dd>The eligible negative-trait set and its size, n = |N|. Vintage negative traits are not members of N.</dd>
    <dt>S, k</dt><dd>The desired positive set and its size, k = 2 or 3.</dd>
    <dt>m</dt><dd>The non-spliced positive count: m = k − 1 with a splice, otherwise m = k.</dd>
    <dt>r</dt><dd>The number of desired positives that also belong to N: r = |S ∩ N|. This is about eligibility as a separate negative, not a locked positive changing sign.</dd>
    <dt>d</dt><dd>The negatives remaining after choosing S: d = n − r.</dd>
    <dt>T, a</dt><dd>The acceptable negative set and the number currently rollable after choosing S: a = |T ∩ (N ∖ S)|. A selected vintage negative belongs to T but not N.</dd>
    <dt>L, v</dt><dd>The pre-existing positive line L ∈ S, or compatible negative line v ∈ T, chosen for locking. Either line may be vintage.</dd>
    <dt>δ</dt><dd>1 if the locked negative's trait also belongs to P, otherwise 0. A genuinely negative-only trait does not remove a positive candidate.</dd>
    <dt>w</dt><dd>The unlocked target-format probability, assumed to be 1/4. Either lock preserves an already-correct format with probability 1; it cannot reach a different format.</dd>
  </dl>
  <p>C(b, c) counts the unordered ways to select c distinct items from b:</p>
  <div class="formula">C(b, c) = b! / [c! (b − c)!]</div>
  <p>Pool sizes are weapon-specific. Disposition changes the stat ranges, not these trait-selection probabilities. Primary and Secondary Kitguns are separate entries for their different ranges and dispositions.</p>

  <h3>3. Deriving the per-roll odds</h3>
  <p>The first formulas below apply without a splice, when every desired positive belongs to P. Spliced and vintage targets use the separate treatments below.</p>
  <h4>No lock, kP1N</h4>
  <p>There are C(p, k) equally likely positive sets. Once S is selected, exactly d compatible negatives remain, of which a are acceptable. Multiply the target-layout probability by those two conditional probabilities:</p>
  <div class="formula">q₀ = w × 1 / C(p, k) × a / d</div>
  <h4>Positive lock, kP1N</h4>
  <p>The locked positive already satisfies one member of S. The remaining k − 1 positives are chosen from p − 1 candidates. After completing the positive set, the compatible negative pool is still N ∖ S:</p>
  <div class="formula">q₊ = 1 / C(p − 1, k − 1) × a / d</div>
  <p>Every ordinary eligible positive in an ordinary target has the same lock probability in this model. Locking a basic element is not intrinsically better or worse than locking another selected ordinary positive. What matters for the final negative step is the entire completed positive set.</p>
  <h4>Negative lock, kP1N</h4>
  <p>The required negative is already retained. Exclude its positive counterpart if eligible, leaving p − δ candidates for the k positives. There is no additional factor a/d because the negative is not drawn again:</p>
  <div class="formula">q₋ = 1 / C(p − δ, k)</div>
  <p>This formula also applies when v is a vintage negative that is not in N. The vintage line is retained rather than redrawn. Without that negative lock, the vintage line contributes nothing to a or to the no-lock chance.</p>
  <p>Accepting more negative alternatives improves the no-lock and positive-lock chances, but does not improve the chance while keeping one particular negative locked.</p>
  <h4>Targets with no negative</h4>
  <div class="formula">q₀ = w / C(p, k) &nbsp;;&nbsp; q₊ = 1 / C(p − 1, k − 1) &nbsp;;&nbsp; q₋ = 0</div>
  <p>A negative lock cannot produce a 0N target. An invalid trait, a repeated positive, or a positive/negative conflict makes that exact target impossible rather than changing the size of a valid target's denominator.</p>
  <h4>One spliced trait, automatically retained for free</h4>
  <p>The splice supplies one positive, so m = k − 1 non-spliced positives remain. Its format is fixed even with no manual lock. It removes no ordinary candidate, and its original ingredients remain eligible on future cycles.</p>
  <p><strong>Ingredients stay in the pool.</strong> Locking Blast leaves Heat and Cold available. Locking Weakpoint Damage leaves Damage and Multishot available. Locking Status Damage leaves Damage and Status Chance available. Separately selecting an ingredient as an ordinary positive excludes its matching negative where applicable.</p>
  <div class="formula">qˢ₀ = 1 / C(p, m) × a / d<br>qˢ₊ = 1 / C(p − 1, m − 1) × a / d<br>qˢ₋ = 1 / C(p − δ, m)</div>
  <p>qˢ₀ is splice only, at normal Kuva cost. qˢ₊ adds a manual lock on an ordinary positive, and qˢ₋ adds a manual lock on the chosen negative, each at double cost. For 0N omit a/d and disallow a negative lock. There is no 1/4 format penalty in any spliced case. The splice cannot be selected as the extra manual lock.</p>
  <p>A 2P0N target with its splice and only other positive both retained already meets the trait-identity target. Every subsequent cycle would preserve it, but no further reroll is necessary.</p>
  <h4>Vintage positives and negatives require the manual lock</h4>
  <p>A vintage line can occupy a positive or negative slot. Unlike a splice, neither sign is automatically retained for free; use the matching manual lock. For a vintage positive L, which is not in P, choose the remaining m − 1 positives from all p candidates:</p>
  <div class="formula">qᵛ₊ = 1 / C(p, m − 1) × a / d</div>
  <p>Use m = k without a splice or m = k − 1 alongside a splice; omit a/d for 0N. Include the vintage line in r if its negative counterpart is currently rollable. A vintage negative uses q₋ = 1 / C(p − δ, m), with or without the free splice. Without its matching manual lock, a vintage line cannot be regenerated.</p>
  <p>One splice and one manually locked vintage line may coexist. Two spliced traits are not allowed; multiple vintage lines cannot all be retained by the single manual lock. Vintage-only acquisition costs and splicing setup are excluded, and recipes do not enlarge either ordinary trait pool.</p>

  <h3>4. Why the positive set matters</h3>
  <p>A positive trait that cannot be a negative, such as an element in the applicable pool, removes no candidate from N. Under positives-first sampling, two targets with equal positive-set probability can therefore have different chances of a <em>particular</em> negative. A larger remaining negative pool means a lower chance for that one negative. It does not make the positive element itself less likely.</p>
  <p>If every compatible negative is accepted, a = d and the final negative factor cancels. Counting all valid final combinations and assigning them equal probability is a different model and is not used here.</p>
  <p>For an ordinary target with nonzero q₀:</p>
  <div class="formula">q₊ / q₀ = 4 × C(p, k) / C(p − 1, k − 1) = 4p / k</div>

  <h3>5. When is a positive lock better?</h3>
  <p>The ordinary crossover below uses k positives. With one free splice, replace k by m = k − 1 throughout. A vintage line still requires its matching manual lock; ordinary crossover comparisons do not apply to retaining that vintage line.</p>
  <p>Both locked strategies use the same per-roll Kuva cost, so the one with the larger success probability also has the lower expected Kuva cost. Solve q₊ &gt; q₋:</p>
  <div class="formula">a &gt; d × C(p − 1, k − 1) / C(p − δ, k)</div>
  <p>With a positive counterpart for the locked negative (δ = 1), this simplifies to:</p>
  <div class="formula">a &gt; k(n − r) / (p − k)</div>
  <p>For a negative-only trait (δ = 0), it becomes:</p>
  <div class="formula">a &gt; k(n − r) / p</div>
  <p>With a splice the thresholds are a &gt; m(n − r)/(p − m) for δ = 1, or a &gt; m(n − r)/p for δ = 0. The free splice remains retained under either manual-lock choice.</p>
  <p>The first winning integer is the floor of the threshold plus one. Equality is a tie. If the threshold exceeds the number of compatible negative alternatives, a positive lock cannot win within that target. Changing the desired positives can change the threshold.</p>

  <h3>6. Your current selection</h3>
  <p><strong>${esc(variant.name)}</strong> · ${format.toUpperCase()} · disposition ${variant.disposition.toFixed(2)}<br>Positives: ${positives}.<br>${target.hasNegative ? `Acceptable negatives: ${negatives || 'none selected'}. Negative-lock comparison: ${esc(nameOf(target.heldNegative) || 'none')}.` : 'No negative requested.'}</p>
  <p>p = ${intervalText(research.p)}, n = ${intervalText(research.n)}, k = ${target.positives.length}, m = ${row.m}.${single ? ` r = ${row.r}, d = ${row.d}, a = ${row.a}, δ = ${row.delta}.` : ' Unresolved eligibility produces multiple possible pools. Bounds cover those possibilities without assigning probabilities to them.'}</p>
  ${spliced ? `<p>Free spliced trait: ${combined.map(nameOf).map(esc).join(', ')}. It stays fixed under all three strategies; the positive-lock comparison refers to a different, non-spliced line.</p>` : ''}
  ${retainedPositives.length ? `<p>Retained positive lines: ${retainedPositives.map(nameOf).map(esc).join(', ')}. Positive-lock comparison: ${esc(nameOf(row.heldPositive))}. Pool sizes above still count currently rollable ordinary traits only.</p>` : ''}
  ${vintageNegatives.length ? `<p>Selected vintage negatives: ${vintageNegatives.map(nameOf).map(esc).join(', ')}. Negative-lock comparison: ${esc(nameOf(target.heldNegative))}.</p>` : ''}
  <table><thead><tr><th>Strategy</th><th>Current target odds</th></tr></thead><tbody><tr><td>${spliced ? 'Splice only' : 'No lock'}</td><td>${esc(chance(research.results.none.probability))}</td></tr><tr><td>Positive lock</td><td>${esc(chance(research.results.positive.probability))}</td></tr><tr><td>Negative lock</td><td>${target.hasNegative ? esc(chance(research.results.negative.probability)) : 'Not applicable'}</td></tr></tbody></table>
  ${single && row.q0 > 0 ? `<div class="formula selection-formula">q₀ = ${target.hasNegative ? row.a : 1} / [${spliced ? '' : '4 × '}C(${row.p}, ${row.m})${target.hasNegative ? ` × ${row.d}` : ''}]</div>` : ''}
  ${single && row.qPositive > 0 ? `<div class="formula selection-formula">q₊ = ${target.hasNegative ? row.a : 1} / [C(${row.positiveCandidates}, ${row.positiveDraws})${target.hasNegative ? ` × ${row.d}` : ''}]</div>` : ''}
  ${single && row.qNegative > 0 ? `<div class="formula selection-formula">q₋ = 1 / C(${row.p - row.delta}, ${row.m})</div>` : ''}

  <h3>7. Kuva reduction and planning</h3>
  <p>At the capped cost, an unlocked roll costs c₀ = ${number(catalog.assumptions.kuvaPerRoll)} Kuva. A manual lock doubles this cost, giving cᴸ = ${number(catalog.assumptions.kuvaPerRoll * catalog.assumptions.lockedKuvaMultiplier)} for a locked roll. Expected attempts are 1/q, so:</p>
  <div class="formula">E[K₀] = c₀ / q₀ &nbsp;;&nbsp; E[Kᴸ] = cᴸ / qᴸ</div>
  <div class="formula">Kuva reduction = 1 − E[Kᴸ] / E[K₀] = 1 − 2 q₀ / qᴸ</div>
  <p>The comparison always uses the <em>same</em> desired positive set and acceptable negative set on both sides. A negative percentage means more expected Kuva, not a saving. For an ordinary positive target the positive-lock reduction simplifies to 1 − k/(2p), with an unlocked format weight of 1/4 and a preserved locked format.</p>
  <p>For spliced targets, the baseline is the same already-spliced Riven with no extra manual lock, at normal Kuva cost. The positive-lock saving is 1 − 2m/p for an ordinary manually held positive. A target requiring a vintage line has no attainable baseline without its manual lock; its saving is Not applicable, not 100%. All estimates exclude acquiring the starting lines and the correct format.</p>
  <p>These totals exclude obtaining the first suitable trait, setup costs, and changes to strategy along the way. Early rolls below the Kuva cap follow a different price schedule. Farming time also depends on acquisition rate and is not calculated here.</p>
  <h4>Cumulative success</h4>
  <p>For independent attempts with fixed probability q, all m attempts fail with probability (1 − q)ᵐ. Therefore:</p>
  <div class="formula">Pr(at least one success in m rolls) = 1 − (1 − q)ᵐ</div>
  <div class="formula">mᶜ = ⌈ln(1 − c) / ln(1 − q)⌉</div>
  <p>The page evaluates c = 50% and 95%. A 1 / X chance is not a promise to succeed within X rolls. For rare outcomes, success by the mean waiting time is about 63.2%.</p>
  <p>For q = 0 no finite number of cycles succeeds; for q = 1 success is certain per cycle. If a 2P0N Riven already retains its splice and its other positive under a manual lock, the trait-identity target is already complete, so no further reroll is needed.</p>

  <h3>8. Stat ranges</h3>
  <p>Ranges use each category's trait coefficient, the selected variant's disposition D, and the target's positive/negative layout. They are shown at rank 8 with the 0.9 to 1.1 variation band. Rounding follows each trait's display precision; a game's last displayed digit can differ at floating-point endpoints.</p>
  <div class="formula">value = b × (rank + 1) × 10 × D × F × z, &nbsp; z ∈ [0.9, 1.1]</div>
  <p>b is the category-specific coefficient, before percentage conversion. F includes the 1.5 specific-fit factor and the layout factors:</p>
  <table><thead><tr><th>Layout</th><th>Positive F</th><th>Negative magnitude F</th></tr></thead><tbody><tr><td>2P0N</td><td>0.9900</td><td>None</td></tr><tr><td>3P0N</td><td>0.7500</td><td>None</td></tr><tr><td>2P1N</td><td>1.2375</td><td>0.4950</td></tr><tr><td>3P1N</td><td>0.9375</td><td>0.7500</td></tr></tbody></table>
  <p>Percentage traits multiply this result by 100. Faction damage is displayed as a multiplier around 1. Range and Punch Through use meters; Combo Duration uses seconds. Positive and negative refer to beneficial traits and curses, not the literal sign: beneficial Weapon Recoil has a minus sign.</p>
  <p>Red ranges are reference values for vintage or otherwise unrollable traits. Vintage lines can be positive or negative: select the matching slot to model retaining an existing line, without adding it to the current cycling pool for that sign. Other unrollable entries remain unavailable. Amber ranges are conditional on unresolved eligibility. Reference values do not establish when a historical Riven was generated. Dispositions are shown to two decimals without snapping to 0.05 steps.</p>
  <p>The sidebar lists ordinary trait ranges. Spliced-trait options do not inherit an ordinary cycling coefficient, and no unconfirmed numerical ranges are supplied for them.</p>
  <p>Requiring numerical values or grades is a different target. If g is the conditional probability of satisfying all remaining value requirements after obtaining the desired trait identities, then q(full target) = q(trait identities) × g. That identity does not assume the values are independent.</p>

  <h4>Getting the selected manual-lock stat</h4>
  <p>This separate acquisition table searches for just the selected ordinary positive or negative stat before applying its manual lock. Other ordinary target traits are unrestricted. A selected splice is assumed to exist already and stay retained for free; its ingredient acquisition is separate. Without a splice, no lock is held and the requested layout must also roll. This is a stated search route, not an optimization over other temporary locks.</p>
  <p>Let m = k − s be the number of ordinary positive slots, with s = 1 for an existing splice and 0 otherwise. Let L = 1 with a splice or the assumed unlocked layout weight 1/4 without one. Average over all m-element subsets U of the positive pool P. Any negative is drawn uniformly from N ∖ U, so its eligibility and denominator depend on those positives.</p>
  <div class="formula">q(stat x+) = L × m / |P|<br>q(stat x−) = L / C(|P|,m) × Σ<sub>U⊆P, |U|=m, x∉U</sub> 1 / |N ∖ U|</div>
  <p>The positive formula assumes the selected trait is eligible and every sampled positive set can receive its required negative. Sets with no compatible negative contribute zero. A missing, vintage or spliced-only cycling trait has no acquisition probability; a negative also requires a 1N format. The negative sum is zero when x is not in N and is not generally equal to 1/|N|. Unresolved pool scenarios are evaluated separately, preserving zero-probability cases.</p>
  <p>The displayed grade bands are S: +9.5 to +10; A+: +7.5 to +9.5; A: +5.5 to +7.5; A−: +3.5 to +5.5; B+: +1.5 to +3.5; B: −1.5 to +1.5; B−: −3.5 to −1.5; C+: −5.5 to −3.5; C: −7.5 to −5.5; C−: −9.5 to −7.5; F: −10 to −9.5, in percent relative to the mean. A shared exact boundary belongs to the higher grade. Positive grades reward a stronger benefit; negative grades reverse this scale to reward a smaller penalty. Reverse-sign traits and faction multipliers retain their usual display conventions.</p>
  <div class="formula">g(grade or better) = (10 − lower grade threshold) / 20<br>q(selected stat at grade or better) = q(stat) × g</div>
  <p>This uses the independent uniform ±10% grade assumption. Numerical ranges show each individual grade band at rank 8, not the whole cumulative interval; the odds column is cumulative. Ranges are calculated from the unrounded mean for the variant and layout, then rounded for display, so adjacent displayed endpoints can overlap. No numerical baselines are invented for spliced traits. This acquisition table does not alter the final-target comparison.</p>

  <h4>S-grade splice setup: a separate two-stage estimate</h4>
  <p>S means a positive grade of at least +9.5% relative to its mean. Assuming independent uniform grades across the ±10% band gives g = (10 − 9.5)/20 = 0.025. This grade distribution and independence are modeling assumptions, not disclosed RNG guarantees. Disposition changes displayed values, not this relative-grade chance.</p>
  <p>Start with an unspliced Riven in the selected kP0N or kP1N format, an ordinary manual lock already available, and no S-grade ingredient yet. Compare every eligible positive starting lock and, for 1N, every eligible negative starting lock. Retain that lock until the first usable positive S ingredient appears. If a valid partner is already present, splice immediately. Otherwise move the lock to the S positive and roll for any valid partner in either eligible polarity. If multiple S ingredients appear, choose an immediately complete pair first, otherwise the shortest expected partner search. Other selected target traits, including vintage lines, are not retained by this route.</p>
  <p>For an S positive x, let B(x) be the set of its recipe partners. For each uniformly drawn (k − 1)-positive subset U of P ∖ {x}, let Sₓ = U ∪ {x}. Its partner-success weight is 1 if U intersects B(x); otherwise it is |B(x) ∩ (N ∖ Sₓ)| / |N ∖ Sₓ| for 1N, or 0 for 0N. Averaging these weights gives hₓ. The conditional mean search is 1/hₓ. Thus positive and negative partners are counted without double-counting or assuming all draws use the same pool.</p>
  <div class="formula">qᴸ = Σ Pr(o,H) &nbsp;;&nbsp; E₁ᴸ = 1/qᴸ<br>E₂ᴸ = Σ Pr(o,H) V(o,H) / qᴸ<br>Eᴸ = E₁ᴸ + E₂ᴸ</div>
  <p>The sums run over complete roll outcomes o and nonempty sets H of usable newly rolled S-positive ingredients. Their grade weight is g^|H|(1 − g)^(j − |H|), where j is the number of usable rolled ingredients. V is 0 if any S ingredient already has a partner, otherwise min(1/hₓ) over x in H. This conditions the shortcut on finding an S-grade, not on an arbitrary roll. E₂ already includes zero-roll shortcuts. The displayed “rolls if missing” divides E₂ by the conditional probability the partner is still missing, and can be a weighted mean across different S ingredients.</p>
  <p>The recommended starting lock minimizes Eᴸ among these first-S, fixed-format, two-stage routes. This is not a global acquisition or farming optimum: starting format/lock acquisition, existing high-grade inventory, variable early-roll costs, abandoning S finds and retaining unrelated traits are excluded. Both stages manually lock a trait, so capped setup Kuva is 7,000 × Eᴸ. Unresolved pools are computed separately; bounds are shown only when one starting lock is optimal in every scenario. Otherwise no single optimal route is claimed.</p>
  <p>Example: with 22 positives and 17 negatives, a 3P1N Blast search holding an unrelated negative with a positive counterpart has 21 positive candidates. The S-find probability is [2C(19,2)g + 19(2g − g²)]/C(21,3), giving 140.175 rolls on average. The partner is already present on 9.887% of S finds. After switching to the S-positive lock, the old negative is no longer excluded and the other element appears with probability 2/21. The second stage adds (1 − 0.0988736) × 10.5 = 9.462 rolls, for 149.637 total. The grade is retained after splicing, and neither ingredient is removed from future eligible pools.</p>

  <h3>9. Sources and research status</h3>
  <p><strong>Implementation and pricing source.</strong> <a href="https://forums.warframe.com/topic/1523869-riven-expansion-trait-locking-riven-splicing/" target="_blank" rel="noopener noreferrer">Digital Extremes, Riven Expansion: Trait Locking &amp; Riven Splicing</a>, reviewed 22 September 2026. A manual lock doubles the current cycling cost and preserves the format. A spliced trait is automatically retained without that surcharge and leaves one manual lock available. Splicing also preserves the format and launches later with Glacial Defiance. This workshop supersedes the earlier pricing estimate; its details remain subject to change before release.</p>
  <p><strong>Format clarification.</strong> <a href="https://x.com/Rottangor/status/2102222698952659303" target="_blank" rel="noopener noreferrer">Pablo (@PabloMakes), replying to Creed (@Rottangor) on X</a>, screenshot reviewed 22 September 2026. The workshop now states format preservation explicitly. Uniform trait sampling and the unlocked 1/4 format weights remain modeling assumptions, not disclosed RNG guarantees.</p>
  <p><strong>Trait-pool background.</strong> <a href="https://wiki.warframe.com/w/Riven_Mods" target="_blank" rel="noopener noreferrer">Warframe Wiki, Riven Mods</a>, a community-maintained reference. Check individual weapon eligibility before substituting a pool into the formulas.</p>
  <p><strong>Mathematical results.</strong> Counts, probabilities, crossover thresholds and expected values are derived here from the stated assumptions. Numerical stat requirements, acquisition strategy and full farming-time optimization need additional inputs.</p>
  <p>Not affiliated with or endorsed by Digital Extremes.</p>`;
}
