import {SearchCombo} from './combobox.mjs';
import {unpackCatalog, COMBINED_TRAITS, isCombinedTrait} from './catalog.mjs';
import {enumeratePools, analyze, bounds, choose, attemptsFor} from './odds.mjs';
import {FORMATS, traitRange, formatRange} from './ranges.mjs';
import {escapeHTML as esc, number, same, oddsText, percentText, magnitude, intervalText} from './format.mjs';

const $ = selector => document.querySelector(selector);
const CATEGORIES = ['Primary', 'Secondary', 'Melee', 'Sentinel', 'Hound', 'Archgun'];
const CC = 'critical-chance', CD = 'critical-damage', MS = 'multishot';
const aliases = {[CC]: 'cc crit', [CD]: 'cd crit', [MS]: 'ms', 'melee-damage': 'dmg damage', 'damage': 'dmg', 'projectile-speed': 'pfs flight speed', 'puncture': 'ips puncture', 'impact': 'ips', 'slash': 'ips'};
const state = {category: 'Primary', weapon: null, variant: null, positives: [CC, CD, MS], negatives: ['zoom'], hasNegative: true, heldNegative: 'zoom', lock: null};
let catalog, weapon, variant, family, definitions, pools, research;
const combos = {}, poolCache = new Map();
const format = () => `${state.positives[2] ? 3 : 2}p${state.hasNegative ? 1 : 0}n`;
const nameOf = id => definitions.find(t => t.id === id)?.name || COMBINED_TRAITS.find(t => t.id === id)?.name || '';
const combinedTargets = () => state.positives.filter(isCombinedTrait);
const positiveForComparison = () => state.lock !== null && state.lock !== 'negative' ? state.positives[Number(state.lock)] : combinedTargets()[0] || state.positives[0];
const target = () => ({positives: state.positives.filter(Boolean), negatives: state.negatives, hasNegative: state.hasNegative, heldNegative: state.heldNegative, heldPositive: positiveForComparison()});
const allowed = (id, polarity) => isCombinedTrait(id) ? polarity === 'positive' : family.traits[id] && family.traits[id][polarity] !== 'excluded';
const compatibleNegatives = () => definitions.filter(t => allowed(t.id, 'negative') && !state.positives.includes(t.id));

function normalize(autoNegative = false) {
  const preferred = [CC, CD, MS, 'melee-damage', 'damage', 'status-chance', 'fire-rate-attack-speed'];
  const candidates = [...new Set([...preferred, ...definitions.map(t => t.id)])].filter(id => allowed(id, 'positive'));
  for (let i = 0; i < 3; i++) {
    if (i === 2 && state.positives[i] === null) continue;
    if (!allowed(state.positives[i], 'positive') || state.positives.indexOf(state.positives[i]) < i)
      state.positives[i] = candidates.find(id => !state.positives.includes(id)) || null;
  }
  state.negatives = [...new Set(state.negatives)].filter(id => allowed(id, 'negative') && !state.positives.includes(id));
  if (autoNegative && state.hasNegative && !state.negatives.length) {
    const order = ['zoom', 'weapon-recoil', 'damage-to-corpus', 'damage-to-corpus', ...compatibleNegatives().map(t => t.id)];
    const next = order.find(id => allowed(id, 'negative') && !state.positives.includes(id));
    if (next) state.negatives = [next];
  }
  if (!state.negatives.includes(state.heldNegative)) state.heldNegative = state.negatives[0] || null;
  if (state.lock === 'negative' && (!state.hasNegative || !state.negatives.length)) state.lock = null;
  if (state.lock !== null && state.lock !== 'negative' && !state.positives[Number(state.lock)]) state.lock = null;
}

function selectWeapon(id) {
  weapon = catalog.weapons.find(w => w.id === id);
  if (!weapon) throw new Error('Unknown weapon selection.');
  state.weapon = id;
  state.category = weapon.category;
  family = catalog.families.find(f => f.id === weapon.family);
  definitions = catalog.definitions[family.definition];
  variant = weapon.variants.find(v => v.id === state.variant) || weapon.variants[0];
  state.variant = variant.id;
  if (!poolCache.has(family.id)) poolCache.set(family.id, enumeratePools(family));
  pools = poolCache.get(family.id);
  normalize(true);
  $('#rangeList').scrollTop = 0;
  render({selectBest: true});
}

function selectCategory(category) {
  state.category = category;
  const defaults = {Primary: 'Soma', Secondary: 'Lex', Melee: 'Amanata', Sentinel: 'Verglas', Hound: 'Akaten', Archgun: 'Imperator'};
  const choices = catalog.weapons.filter(w => w.category === category);
  selectWeapon((choices.find(w => w.name === defaults[category]) || choices[0]).id);
}

function statOptions(polarity, row = null) {
  const result = definitions.filter(t => t[polarity]).map(trait => {
    const status = family.traits[trait.id];
    const conflict = polarity === 'positive' ? state.positives.some((id, i) => id === trait.id && i !== row) : state.positives.includes(trait.id);
    const excluded = status[polarity] === 'excluded';
    return {value: trait.id, label: trait.name, search: aliases[trait.id], disabled: excluded || conflict, uncertain: status[polarity] === 'unresolved',
      description: conflict ? 'Already selected as a positive' : excluded ? status.vintage ? 'Vintage stat: not currently rollable' : 'Not rollable on this weapon' : status[polarity] === 'unresolved' ? 'Eligibility under research' : ''};
  });
  if (polarity === 'positive') result.push(...COMBINED_TRAITS.map(trait => {
    const conflict = state.positives.some((id, i) => id === trait.id && i !== row);
    return {value: trait.id, label: trait.name, search: trait.recipe, disabled: conflict,
      description: conflict ? 'Already selected as a positive' : `Combined stat${trait.recipe ? ` · ${trait.recipe}` : ' · Created by combining traits'}`};
  }));
  result.sort((a, b) => Number(a.disabled) - Number(b.disabled) || a.label.localeCompare(b.label));
  if (polarity === 'positive' && row === 2) result.unshift({value: '_none', label: 'No third positive', description: 'Target a 2-positive Riven'});
  if (polarity === 'negative') result.unshift(
    {value: '_none', label: 'No negative', description: 'Target 2P0N or 3P0N', action: true},
    {value: '_all', label: 'Any compatible negative', description: 'Accept every possible negative for this target', action: true});
  return result;
}

function selectPositive(row, id) {
  const value = id === '_none' ? null : id;
  if (state.positives[row] === value) return;
  state.positives[row] = value;
  normalize(); render({selectBest: true});
}

function selectNegative(id) {
  const before = JSON.stringify(target());
  if (id === '_none') { state.hasNegative = false; state.negatives = []; }
  else if (id === '_all') { state.hasNegative = true; state.negatives = compatibleNegatives().map(t => t.id); }
  else { state.hasNegative = true; state.negatives = state.negatives.includes(id) ? state.negatives.filter(value => value !== id) : [...state.negatives, id]; }
  normalize(); render({selectBest: before !== JSON.stringify(target())});
}

function selectBestLock() {
  const combined = combinedTargets();
  if (combined.length) {
    state.lock = combined.length === 1 && (!state.hasNegative || state.negatives.length)
      ? String(state.positives.indexOf(combined[0])) : null;
    return;
  }
  if (!(research.results.positive.probability.max > 0)) { state.lock = null; return; }
  if (research.winningLock === 'negative') state.lock = 'negative';
  else if (research.winningLock === 'positive' || research.winningLock === 'tie' && state.lock === null) {
    if (state.lock === null || state.lock === 'negative') state.lock = '0';
  }
  // Preserve a valid lock on ties or when eligibility does not establish a winner.
}

function connectControls() {
  const bind = (name, options) => combos[name] = new SearchCombo($(`[data-combo="${name}"]`), options);
  bind('category', {label: 'Category', placeholder: 'Search categories...', selected: () => state.category,
    options: () => CATEGORIES.map(category => ({value: category, label: category, description: `${catalog.weapons.filter(w => w.category === category).length} weapons`})), onChange: selectCategory});
  bind('weapon', {label: 'Weapon', placeholder: 'Search weapons...', selected: () => state.weapon,
    options: () => catalog.weapons.filter(w => w.category === state.category).map(w => ({value: w.id, label: w.name, search: w.variants.map(v => v.name).join(' '), description: `${w.kind === 'Kitgun' ? `${w.category} Kitgun` : w.kind} · ${w.variants.length} variant${w.variants.length === 1 ? '' : 's'}`})), onChange: selectWeapon});
  bind('variant', {label: 'Variant', placeholder: 'Search variants...', selected: () => state.variant,
    options: () => weapon.variants.map(v => ({value: v.id, label: v.label, search: v.name, description: `${v.name} · ${v.disposition.toFixed(2)}`})),
    onChange: id => { state.variant = id; variant = weapon.variants.find(v => v.id === id); render(); }});
  for (let row = 0; row < 3; row++) bind(`positive${row}`, {label: `Positive stat ${row + 1}`, placeholder: 'Search positive stats...', selected: () => state.positives[row] || '_none', options: () => statOptions('positive', row), onChange: id => selectPositive(row, id)});
  bind('negative', {label: 'Acceptable negative stats', placeholder: 'Search negative stats...', multiple: true, selected: () => state.hasNegative ? state.negatives : ['_none'], options: () => statOptions('negative'), onChange: selectNegative, footer: () => `${state.negatives.length} acceptable negative${state.negatives.length === 1 ? '' : 's'}`});
  document.querySelectorAll('[data-lock]').forEach(button => button.addEventListener('click', () => { state.lock = state.lock === button.dataset.lock ? null : button.dataset.lock; render(); }));
  $('#rangeSearch').addEventListener('input', renderRanges);
  $('#heldNegative').addEventListener('change', event => { state.heldNegative = event.target.value; render(); });
  $('#strategyRows').addEventListener('click', event => {
    const row = event.target.closest('[data-strategy-row]');
    const button = row?.querySelector('[data-strategy]'), strategy = button?.dataset.strategy;
    if (!strategy || button.disabled) return;
    const combined = combinedTargets();
    state.lock = strategy === 'none' ? null : strategy === 'positive'
      ? combined.length === 1 ? String(state.positives.indexOf(combined[0])) : state.lock !== null && state.lock !== 'negative' ? state.lock : '0'
      : 'negative';
    render();
    $('#strategyRows').querySelector(`[data-strategy="${strategy}"]`).focus({preventScroll: true});
  });
  $('#resetTarget').addEventListener('click', () => {
    Object.assign(state, {positives: [CC, CD, MS], negatives: ['zoom'], hasNegative: true, heldNegative: 'zoom', lock: null, variant: null});
    $('#rangeSearch').value = ''; selectCategory('Primary');
  });
  $('#fullMath').addEventListener('toggle', () => { if ($('#fullMath').open) renderDerivation(); });
}

function renderRanges() {
  const query = $('#rangeSearch').value.trim().toLowerCase(), rows = [];
  for (const polarity of ['positive', 'negative']) {
    const candidates = definitions.filter(t => t[polarity] && `${t.name} ${aliases[t.id] || ''}`.toLowerCase().includes(query));
    if (!candidates.length) continue;
    const count = candidates.filter(t => family.traits[t.id][polarity] === 'allowed').length;
    rows.push(`<section class="range-section" aria-label="${polarity} stat ranges"><h3>${polarity === 'positive' ? 'Positive stats' : 'Negative stats'}<span>${count} eligible</span></h3>`);
    if (polarity === 'negative' && !state.hasNegative) rows.push('<p class="range-empty">This target has no negative. Choose a negative on the card to view its ranges.</p>');
    else for (const trait of candidates) {
      const status = family.traits[trait.id], excluded = status[polarity] === 'excluded', uncertain = status[polarity] === 'unresolved';
      const kind = excluded ? 'unrollable' : uncertain ? 'unverified' : '';
      const flag = excluded ? status.vintage ? 'Vintage' : 'Not rollable' : uncertain ? 'Under research' : '';
      const title = excluded ? 'Not currently rollable. Range is a reference value for this format and disposition.' : uncertain ? 'Range is conditional on this trait being eligible.' : '';
      const range = formatRange(traitRange(trait, variant.disposition, format(), polarity, catalog.rangeModel));
      rows.push(`<div class="range-row ${kind}"${title ? ` title="${esc(title)}"` : ''}><span>${esc(trait.name)}${flag ? `<small class="range-flag">${flag}</small>` : ''}</span><div class="${kind || `range-${polarity}`}">${esc(range || 'Not available')}</div></div>`);
    }
    rows.push('</section>');
  }
  $('#rangeList').innerHTML = rows.length ? rows.join('') : '<p class="range-empty">No stats match your search.</p>';
}

function render({selectBest = false} = {}) {
  research = analyze(pools, target(), catalog.assumptions);
  if (selectBest) { selectBestLock(); research = analyze(pools, target(), catalog.assumptions); }
  const hasUncertainty = pools.length > 1;
  combos.category.update(state.category); combos.weapon.update(weapon.name); combos.variant.update(variant.label);
  state.positives.forEach((id, i) => combos[`positive${i}`].update(id ? nameOf(id) : 'No third positive'));
  const negLabel = !state.hasNegative ? 'No negative' : !state.negatives.length ? 'Choose a negative' : state.negatives.length === 1 ? nameOf(state.negatives[0]) : `${state.negatives.length} acceptable negatives`;
  combos.negative.update(negLabel);
  $('#dispositionValue').textContent = variant.disposition.toFixed(2);
  const dots = variant.disposition < .7 ? 1 : variant.disposition < .9 ? 2 : variant.disposition < 1.11 ? 3 : variant.disposition < 1.31 ? 4 : 5;
  $('#dispositionDots').innerHTML = Array.from({length: 5}, (_, i) => `<i${i >= dots ? ' class="dim"' : ''}></i>`).join('');
  $('#poolSummary').textContent = `${intervalText(research.p)} ${combinedTargets().length ? 'ordinary ' : ''}positive traits · ${intervalText(research.n)} negative traits`;
  $('#poolNotice').hidden = !hasUncertainty;
  $('#poolNotice').textContent = 'Some trait eligibility for this weapon is still being researched. Amber entries are not confirmed exclusions. Odds are conservative ranges across possible pools, not a claim that all those pools are equally likely.';
  $('#rangeWeapon').textContent = variant.name;
  $('#rangeSubtitle').textContent = format();
  $('#dataDate').textContent = `Last updated: ${catalog.snapshot.date}`;
  $('#cardWeapon').textContent = variant.name; $('#cardWeapon').title = variant.name;
  $('#acceptableCount').textContent = state.hasNegative ? `${state.negatives.length} acceptable negative${state.negatives.length === 1 ? '' : 's'}` : 'No negative';
  document.querySelectorAll('[data-lock]').forEach(button => {
    const row = button.dataset.lock, locked = state.lock === row;
    const valid = row === 'negative' ? state.hasNegative && state.negatives.length > 0 : Boolean(state.positives[Number(row)]);
    button.disabled = !valid; button.setAttribute('aria-pressed', String(locked));
    const statName = row === 'negative' ? nameOf(state.heldNegative) : nameOf(state.positives[Number(row)]);
    button.setAttribute('aria-label', `${locked ? 'Unlock' : 'Lock'} ${statName || 'stat'}`);
    button.title = valid ? `${locked ? 'Unlock' : 'Lock'} ${statName}` : 'Choose a stat first';
    button.querySelector('use').setAttribute('href', locked ? '#r-lock' : '#r-unlock');
    button.closest('.stat-row').classList.toggle('is-locked', locked);
  });
  $('#negativeLockChoice').hidden = !state.hasNegative || state.negatives.length < 2;
  $('#negativeLockChoice label').textContent = state.lock === 'negative' ? 'Negative to keep locked' : 'Negative used for lock comparison';
  $('#heldNegative').innerHTML = state.negatives.map(id => `<option value="${esc(id)}"${id === state.heldNegative ? ' selected' : ''}>${esc(nameOf(id))}</option>`).join('');
  renderRanges(); renderResults(); renderCrossovers();
  if ($('#fullMath').open) renderDerivation();
  $('#rivenStatus').textContent = `${variant.name}. ${FORMATS[format()].name}. ${state.lock === null ? 'No lock' : state.lock === 'negative' ? 'Negative locked' : 'Positive locked'}.`;
  document.dispatchEvent(new window.Event('riven:render'));
}

function renderResults() {
  const active = state.lock === null ? 'none' : state.lock === 'negative' ? 'negative' : 'positive';
  const labels = {none: 'No lock', positive: 'Lock positive', negative: 'Lock negative'};
  const combined = combinedTargets(), combiningOnly = combined.length > 1;
  const incomplete = state.hasNegative && !state.negatives.length, rec = $('#strategyRecommendation');
  rec.classList.toggle('is-uncertain', incomplete || combiningOnly || !combined.length && research.winningLock === 'uncertain');
  const bestText = incomplete ? 'Choose an acceptable negative' : combiningOnly ? 'Combining route required' : combined.length ? `Lock ${nameOf(combined[0])}` : !state.hasNegative ? 'Lock a positive' : research.winningLock === 'tie' ? 'Both locks have equal odds' : research.winningLock === 'uncertain' ? 'The best lock depends on eligibility' : `Lock a ${research.winningLock}`;
  const description = incomplete ? 'Select at least one alternative, or choose No negative.' : combiningOnly ? 'One lock cannot retain multiple combined lines through cycling. This calculator does not estimate further combining steps.' : combined.length ? 'Combined stats cannot appear through ordinary rerolling. Their ingredients stay in the ordinary pool. These odds start with that combined line already created and locked; its creation cost is excluded.' : !state.hasNegative ? 'A locked negative cannot produce a 0N target.' : research.winningLock === 'negative' ? `Keep ${nameOf(state.heldNegative)} while rolling the ${target().positives.length} positives.` : research.winningLock === 'positive' ? 'Keep any selected positive and accept the chosen negative alternatives.' : 'Compare the probability ranges below. Both locked strategies use the same Kuva cost.';
  rec.innerHTML = `<span class="recommendation-label">${incomplete ? 'COMPLETE YOUR TARGET' : combiningOnly ? 'OUTSIDE THE CYCLING MODEL' : 'BEST LOCK FOR THIS TARGET'}</span><strong>${esc(bestText)}</strong><p>${esc(description)}</p>`;
  $('#strategyRows').innerHTML = ['none', 'positive', 'negative'].map(strategy => {
    const result = research.results[strategy], unavailable = strategy === 'negative' && (!state.hasNegative || !state.negatives.length);
    const reductionClass = !result.kuvaReduction ? 'muted' : result.kuvaReduction.min >= 0 ? 'positive-text' : 'negative-text';
    const rowClasses = research.winningLock === strategy && !unavailable ? 'best-row' : '';
    const caption = combined.length ? strategy === 'positive' ? combiningOnly ? 'Only one line can be locked' : `Keep ${nameOf(positiveForComparison())}` : 'Cannot reroll combined stats' : strategy === 'none' ? 'Previous odds' : strategy === 'negative' ? nameOf(state.heldNegative) || 'Choose a negative' : 'Any selected positive';
    const noCyclingChance = combined.length && result.probability.max <= 0;
    const chance = noCyclingChance ? 'Not possible by cycling' : oddsText(result.probability);
    return `<tr class="${rowClasses}" data-strategy-row="${strategy}"${unavailable ? ' aria-disabled="true"' : ''}><th scope="row"><div class="strategy-label"><span class="strategy-check" data-checked="${active === strategy}" aria-hidden="true"></span><div class="strategy-copy"><button class="strategy-pick${strategy === 'negative' ? ' negative-text' : ''}" type="button" data-strategy="${strategy}" aria-pressed="${active === strategy}"${unavailable ? ' disabled' : ''}>${labels[strategy]}</button><small>${esc(caption)}</small></div></div></th><td${!same(result.probability) || noCyclingChance ? ' class="has-probability-range"' : ''}>${unavailable ? '<span class="muted">Not applicable</span>' : esc(chance)}</td><td class="${strategy === 'none' || unavailable ? 'muted' : reductionClass}">${unavailable ? 'Not applicable' : percentText(result.kuvaReduction)}</td></tr>`;
  }).join('');
  const probability = research.results[active].probability;
  const noCyclingChance = combined.length && probability.max <= 0;
  const selectedName = combined.length && active === 'positive' ? `LOCK ${nameOf(positiveForComparison()).toUpperCase()}` : labels[active].toUpperCase();
  const note = noCyclingChance ? 'This lock cannot retain every selected combined stat. Further combining steps are outside this estimate.' : `${pools.length > 1 ? 'Conditional on eligibility. ' : ''}A 1 / X chance means X rolls on average, not a guarantee.`;
  $('#activeStrategy').innerHTML = `<span>SELECTED STRATEGY · ${esc(selectedName)}</span><strong${!same(probability) || noCyclingChance ? ' class="active-range"' : ''}>${esc(noCyclingChance ? 'No cycling outcome' : oddsText(probability))}</strong><p>${esc(note)}</p>`;
  if (noCyclingChance) {
    $('#planningStats').innerHTML = ['Average Kuva', '50% success', '95% success'].map(label => `<div><span>${label}</span><strong>Not applicable</strong></div>`).join('');
    return;
  }
  const cost = catalog.assumptions.kuvaPerRoll * (active === 'none' ? 1 : catalog.assumptions.lockedKuvaMultiplier);
  const meanCost = {min: cost / probability.max, max: cost / probability.min};
  const rolls = confidence => ({min: attemptsFor(probability.max, confidence), max: attemptsFor(probability.min, confidence)});
  $('#planningStats').innerHTML = `<div><span>Average Kuva</span><strong>${intervalText(meanCost, magnitude)}</strong></div><div><span>50% success</span><strong>${intervalText(rolls(.5))} rolls</strong></div><div><span>95% success</span><strong>${intervalText(rolls(.95))} rolls</strong></div>`;
}

function renderCrossovers() {
  const section = $('.crossover-section'); section.hidden = !state.hasNegative || !state.negatives.length || combinedTargets().length > 0;
  if (section.hidden) return;
  const max = Math.max(...research.scenarios.map(row => row.d)), threshold = research.threshold;
  $('#crossoverSummary').textContent = !threshold ? 'Choose an eligible negative for this comparison.' : threshold.min > max ? 'No attainable number of negatives makes a positive lock better for this target.' : same(threshold) ? `For this ${format().toUpperCase()} target, a positive lock wins from ${number(threshold.min)} compatible negatives.` : `For this ${format().toUpperCase()} target, the crossover is ${intervalText(threshold)} compatible negatives, depending on eligibility.`;
  const rows = [];
  // Limit the comparison display, not the pool or the selected target.
  for (let a = 1; a <= Math.min(max, 6); a++) {
    const cases = research.scenarios.filter(row => row.d >= a && row.q0 > 0).map(row => ({positive: catalog.assumptions.positiveLockLayoutWeight * a / (choose(row.p - 1, row.k - 1) * row.d), negative: row.qNegative}));
    if (!cases.length) continue;
    const qPositive = bounds(cases.map(row => row.positive)), qNegative = bounds(cases.map(row => row.negative));
    const outcomes = new Set(cases.map(row => Math.abs(row.positive - row.negative) < 1e-15 ? 'Equal' : row.positive > row.negative ? 'Positive' : 'Negative'));
    const better = outcomes.size === 1 ? [...outcomes][0] : 'Depends on pool';
    rows.push(`<tr${a === state.negatives.length ? ' class="selected-count"' : ''}><td>${a}${a === state.negatives.length ? ' · selected' : ''}</td><td class="${better === 'Positive' ? 'wins' : ''}">${esc(oddsText(qPositive))}</td><td class="${better === 'Negative' ? 'wins' : ''}">${esc(oddsText(qNegative))}</td><td class="${better === 'Positive' ? 'wins' : better === 'Negative' ? 'loses' : ''}">${better}</td></tr>`);
  }
  $('#crossoverRows').innerHTML = rows.join('');
}

async function renderDerivation() {
  const {renderMath} = await import('./math.mjs');
  $('#mathContent').innerHTML = renderMath({catalog, research, target: target(), variant, format: format(), nameOf});
  document.dispatchEvent(new window.Event('riven:render'));
}

try {
  const response = await fetch('./data.json');
  if (!response.ok) throw new Error(`Catalog request failed (${response.status}).`);
  catalog = unpackCatalog(await response.json());
  connectControls(); selectCategory('Primary');
} catch (error) {
  $('#loadError').hidden = false;
  $('#loadError').textContent = 'The Riven data could not load. Refresh the page to try again.';
  $('#strategyRows').replaceChildren(); $('#activeStrategy').textContent = 'Calculator unavailable'; $('#planningStats').replaceChildren();
  $('#strategyRecommendation').textContent = 'Unable to calculate odds until the catalog loads.';
  document.querySelectorAll('.combo-trigger, .lock-button, #resetTarget').forEach(button => button.disabled = true);
  console.error('Riven calculator:', error);
}
