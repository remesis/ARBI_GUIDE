import {SearchCombo} from './combobox.mjs';
import {unpackCatalog, COMBINED_TRAITS, isCombinedTrait, splicedTraitsFor, spliceRecipes} from './catalog.mjs?v=20260923-compact-grades';
import {enumeratePools, analyze, bounds, choose, attemptsFor, optimalSpliceSetup, selectedLockChance} from './odds.mjs?v=20260923-compact-grades';
import {FORMATS, GRADES, traitRange, traitGradeRange, formatRange} from './ranges.mjs?v=20260923-compact-grades';
import {escapeHTML as esc, number, same, oddsText, percentText, magnitude, intervalText} from './format.mjs';

const $ = selector => document.querySelector(selector);
const CATEGORIES = ['Primary', 'Secondary', 'Melee', 'Sentinel', 'Hound', 'Archgun'];
const CC = 'critical-chance', CD = 'critical-damage', MS = 'multishot';
const aliases = {[CC]: 'cc crit', [CD]: 'cd crit', [MS]: 'ms', 'melee-damage': 'dmg damage', 'damage': 'dmg', 'projectile-speed': 'pfs flight speed', 'puncture': 'ips puncture', 'impact': 'ips', 'slash': 'ips'};
const state = {category: 'Primary', weapon: null, variant: null, positives: [CC, CD, MS], negatives: ['weapon-recoil'], hasNegative: true, heldNegative: 'weapon-recoil', lock: null};
let catalog, weapon, variant, family, definitions, pools, research;
const combos = {}, poolCache = new Map(), spliceSetupCache = new Map();
const selectionStorageKey = 'riven-selection-v1';
function saveSelection() {
  try { window.localStorage.setItem(selectionStorageKey, JSON.stringify({version: 1, ...state})); } catch {}
}
function restoreSelection() {
  let saved;
  try {
    const raw = window.localStorage.getItem(selectionStorageKey);
    if (!raw || raw.length > 10000) return false;
    saved = JSON.parse(raw);
  } catch { return false; }
  const validId = value => typeof value === 'string' && value.length > 0 && value.length < 100;
  if (!saved || saved.version !== 1 || !validId(saved.weapon)
    || !Array.isArray(saved.positives) || saved.positives.length !== 3
    || !saved.positives.every((id, i) => validId(id) || i === 2 && id === null)
    || !Array.isArray(saved.negatives) || saved.negatives.length > 100 || !saved.negatives.every(validId)
    || typeof saved.hasNegative !== 'boolean') return false;
  const selectedWeapon = catalog.weapons.find(row => row.id === saved.weapon && row.category === saved.category);
  if (!selectedWeapon) return false;
  let hasSplice = false;
  const positives = saved.positives.map(id => {
    if (!isCombinedTrait(id)) return id;
    if (hasSplice) return ''; // Normalize an invalid extra splice into an ordinary stat.
    hasSplice = true; return id;
  });
  Object.assign(state, {category: selectedWeapon.category, weapon: selectedWeapon.id,
    variant: selectedWeapon.variants.some(row => row.id === saved.variant) ? saved.variant : null,
    positives, negatives: saved.hasNegative ? saved.negatives : [], hasNegative: saved.hasNegative,
    heldNegative: validId(saved.heldNegative) ? saved.heldNegative : null,
    lock: [null, 'negative', '0', '1', '2'].includes(saved.lock) ? saved.lock : null});
  selectWeapon(selectedWeapon.id, {selectBest: false, autoNegative: false});
  return true;
}
const infoPreferences = new Map();
const sectionPreferences = new Map();
const gradePreferences = new Map();
function setupGrade(key) {
  if (!gradePreferences.has(key)) {
    let saved;
    try { saved = window.localStorage.getItem(`riven-grade-${key}`); } catch {}
    gradePreferences.set(key, GRADES.find(grade => grade.name === saved) || GRADES[0]);
  }
  return gradePreferences.get(key);
}
function saveSetupGrade(key, grade) {
  gradePreferences.set(key, grade);
  try { window.localStorage.setItem(`riven-grade-${key}`, grade.name); } catch {}
}
function gradeSelector(key, label) {
  const selected = setupGrade(key);
  return `<select id="setupGrade-${key}" class="setup-grade-select" data-riven-grade="${key}" aria-label="${esc(label)}">${GRADES.map(grade => `<option value="${esc(grade.name)}"${grade === selected ? ' selected' : ''}>${esc(grade.name)}</option>`).join('')}</select>`;
}
function rememberSection(key, expanded) {
  if (sectionPreferences.get(key) === expanded) return;
  sectionPreferences.set(key, expanded);
  try { window.localStorage.setItem(`riven-section-${key}`, expanded ? 'open' : 'closed'); } catch {}
}
function sectionExpanded(key, section) {
  const details = section.querySelector('[data-riven-section]');
  // Capture the current state before replacing or hiding a section, even before its toggle event fires.
  if (details) rememberSection(key, details.hasAttribute('open'));
  if (!sectionPreferences.has(key)) {
    let expanded = true;
    try { expanded = window.localStorage.getItem(`riven-section-${key}`) !== 'closed'; } catch {}
    sectionPreferences.set(key, expanded);
  }
  return sectionPreferences.get(key);
}
function setupInfo(key, body) {
  if (!infoPreferences.has(key)) {
    let expanded = true;
    try { expanded = window.localStorage.getItem(`riven-info-${key}`) !== 'closed'; } catch {}
    infoPreferences.set(key, expanded);
  }
  return `<details class="setup-info" data-riven-info="${key}"${infoPreferences.get(key) ? ' open' : ''}><summary>Info &amp; assumptions</summary>${body}</details>`;
}
const format = () => `${state.positives[2] ? 3 : 2}p${state.hasNegative ? 1 : 0}n`;
const nameOf = id => definitions.find(t => t.id === id)?.name || COMBINED_TRAITS.find(t => t.id === id)?.name || '';
const combinedTargets = () => state.positives.filter(isCombinedTrait);
const isVintage = (id, polarity) => Boolean(family.traits[id]?.vintage && family.traits[id][polarity] === 'excluded');
const retainedPositiveTargets = () => state.positives.filter(id => isVintage(id, 'positive'));
const retainedNegativeTargets = () => state.negatives.filter(id => isVintage(id, 'negative'));
const firstManualPositive = () => state.positives.find(id => id && !isCombinedTrait(id));
const positiveForComparison = () => state.lock !== null && state.lock !== 'negative' ? state.positives[Number(state.lock)] : retainedPositiveTargets()[0] || firstManualPositive();
const target = () => ({positives: state.positives.filter(Boolean), negatives: state.negatives, hasNegative: state.hasNegative, heldNegative: state.heldNegative,
  heldPositive: positiveForComparison(), retainedPositives: retainedPositiveTargets(), retainedNegatives: retainedNegativeTargets()});
const allowed = (id, polarity) => isCombinedTrait(id) ? polarity === 'positive' && splicedTraitsFor(family.definition).some(t => t.id === id) : family.traits[id] && family.traits[id][polarity] !== 'excluded';
const selectable = (id, polarity) => allowed(id, polarity) || isVintage(id, polarity);
const compatibleNegatives = () => definitions.filter(t => allowed(t.id, 'negative') && !state.positives.includes(t.id));

function normalize(autoNegative = false) {
  const preferred = [CC, CD, MS, 'melee-damage', 'damage', 'status-chance', 'fire-rate-attack-speed'];
  const candidates = [...new Set([...preferred, ...definitions.map(t => t.id)])].filter(id => allowed(id, 'positive'));
  for (let i = 0; i < 3; i++) {
    if (i === 2 && state.positives[i] === null) continue;
    if (!selectable(state.positives[i], 'positive') || state.positives.indexOf(state.positives[i]) < i)
      state.positives[i] = candidates.find(id => !state.positives.includes(id)) || null;
  }
  state.negatives = [...new Set(state.negatives)].filter(id => selectable(id, 'negative') && !state.positives.includes(id));
  if (autoNegative && state.hasNegative && !state.negatives.length) {
    const order = ['zoom', 'weapon-recoil', 'damage-to-corpus', 'damage-to-corpus', ...compatibleNegatives().map(t => t.id)];
    const next = order.find(id => allowed(id, 'negative') && !state.positives.includes(id));
    if (next) state.negatives = [next];
  }
  if (!state.negatives.includes(state.heldNegative)) state.heldNegative = state.negatives[0] || null;
  if (state.lock === 'negative' && (!state.hasNegative || !state.negatives.length)) state.lock = null;
  if (state.lock !== null && state.lock !== 'negative' && (!state.positives[Number(state.lock)] || isCombinedTrait(state.positives[Number(state.lock)]))) state.lock = null;
}

function selectWeapon(id, {selectBest = true, autoNegative = true} = {}) {
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
  normalize(autoNegative);
  $('#rangeList').scrollTop = 0;
  render({selectBest});
}

function selectCategory(category) {
  state.category = category;
  const defaults = {Primary: 'Sobek', Secondary: 'Lex', Melee: 'Amanata', Sentinel: 'Verglas', Hound: 'Akaten', Archgun: 'Imperator'};
  const choices = catalog.weapons.filter(w => w.category === category);
  selectWeapon((choices.find(w => w.name === defaults[category]) || choices[0]).id);
}

function statOptions(polarity, row = null) {
  const result = definitions.filter(t => t[polarity]).map(trait => {
    const status = family.traits[trait.id];
    const conflict = polarity === 'positive' ? state.positives.some((id, i) => id === trait.id && i !== row) : state.positives.includes(trait.id);
    const excluded = status[polarity] === 'excluded', vintage = excluded && status.vintage;
    return {value: trait.id, label: trait.name, search: aliases[trait.id], disabled: !vintage && excluded || polarity === 'negative' && conflict,
      uncertain: status[polarity] === 'unresolved', vintage,
      description: vintage ? `Vintage ${polarity} stat: select only when this line already exists and will be locked`
        : conflict ? 'Selected in another positive slot: choosing it swaps the two stats'
        : excluded ? 'Not rollable on this weapon' : status[polarity] === 'unresolved' ? 'Eligibility under research' : ''};
  });
  if (polarity === 'positive') result.push(...splicedTraitsFor(family.definition).map(trait => {
    const conflict = state.positives.some((id, i) => id === trait.id && i !== row);
    const secondSplice = state.positives.some((id, i) => i !== row && isCombinedTrait(id) && id !== trait.id);
    return {value: trait.id, label: trait.name, search: `${trait.recipe} spliced fused`, disabled: secondSplice,
      description: secondSplice ? 'Only one spliced trait per Riven: replace the existing splice first'
        : conflict ? 'Selected in another positive slot: choosing it swaps the two stats'
        : `Spliced trait · ${trait.recipe} · Automatically retained for free`};
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
  if (value && (!selectable(value, 'positive') || isCombinedTrait(value) && state.positives.some((other, i) => i !== row && isCombinedTrait(other) && other !== value))) return;
  if (state.positives[row] === value) return;
  const previous = state.positives[row], existing = value === null ? -1 : state.positives.findIndex((selected, index) => index !== row && selected === value);
  if (existing >= 0) state.positives[existing] = previous;
  state.positives[row] = value;
  normalize(); render({selectBest: true});
}

function selectNegative(id) {
  const before = JSON.stringify(target());
  if (id === '_none') { state.hasNegative = false; state.negatives = []; }
  else if (id === '_all') { state.hasNegative = true; state.negatives = compatibleNegatives().map(t => t.id); }
  else {
    state.hasNegative = true;
    const adding = !state.negatives.includes(id);
    state.negatives = adding ? [...state.negatives, id] : state.negatives.filter(value => value !== id);
    if (adding && isVintage(id, 'negative')) state.heldNegative = id;
  }
  normalize(); render({selectBest: before !== JSON.stringify(target())});
}

function selectBestLock() {
  const retained = retainedPositiveTargets();
  if (retained.length) {
    state.lock = retained.length === 1 && (!state.hasNegative || state.negatives.length)
      ? String(state.positives.indexOf(retained[0])) : null;
    return;
  }
  if (!(research.results.positive.probability.max > 0 || research.results.negative.probability.max > 0)) { state.lock = null; return; }
  if (research.winningLock === 'negative') state.lock = 'negative';
  else if (research.winningLock === 'positive' || research.winningLock === 'tie' && state.lock === null) {
    if (state.lock === null || state.lock === 'negative') state.lock = String(state.positives.indexOf(firstManualPositive()));
  }
  // Preserve a valid lock on ties or when eligibility does not establish a winner.
}

function connectControls() {
  document.addEventListener('change', event => {
    const key = event.target.dataset?.rivenGrade;
    if (!['splice', 'selected-lock'].includes(key)) return;
    const grade = GRADES.find(row => row.name === event.target.value);
    if (!grade) return;
    saveSetupGrade(key, grade);
    if (key === 'splice') renderSpliceSetup(); else renderSelectedLockSetup();
    numberSections();
    $(`[data-riven-grade="${key}"]`)?.focus({preventScroll: true});
    $('#rivenStatus').textContent = `${key === 'splice' ? 'Splice setup' : 'Selected lock'} estimates updated for ${grade.name} or better.`;
    document.dispatchEvent(new window.Event('riven:render'));
  });
  document.addEventListener('toggle', event => {
    const details = event.target, key = details.dataset?.rivenInfo;
    if (!details.isConnected) return;
    const expanded = details.hasAttribute('open');
    const sectionKey = details.dataset?.rivenSection;
    if (['splice', 'selected-lock'].includes(sectionKey)) rememberSection(sectionKey, expanded);
    if (!['splice', 'selected-lock'].includes(key)) return;
    infoPreferences.set(key, expanded);
    try { window.localStorage.setItem(`riven-info-${key}`, expanded ? 'open' : 'closed'); } catch {}
  }, true);
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
  document.querySelectorAll('[data-lock]').forEach(button => button.addEventListener('click', () => {
    if (button.disabled || button.dataset.lock !== 'negative' && isCombinedTrait(state.positives[Number(button.dataset.lock)])) return;
    state.lock = state.lock === button.dataset.lock ? null : button.dataset.lock; render();
  }));
  $('#rangeSearch').addEventListener('input', renderRanges);
  $('#heldNegative').addEventListener('change', event => { state.heldNegative = event.target.value; render(); });
  $('#strategyRows').addEventListener('click', event => {
    const row = event.target.closest('[data-strategy-row]');
    const button = row?.querySelector('[data-strategy]'), strategy = button?.dataset.strategy;
    if (!strategy || button.disabled) return;
    const retained = retainedPositiveTargets();
    state.lock = strategy === 'none' ? null : strategy === 'positive'
      ? retained.length === 1 ? String(state.positives.indexOf(retained[0])) : state.lock !== null && state.lock !== 'negative' ? state.lock : String(state.positives.indexOf(firstManualPositive()))
      : 'negative';
    render();
    $('#strategyRows').querySelector(`[data-strategy="${strategy}"]`).focus({preventScroll: true});
  });
  $('#resetTarget').addEventListener('click', () => {
    for (const key of ['splice', 'selected-lock']) saveSetupGrade(key, GRADES[0]);
    Object.assign(state, {positives: [CC, CD, MS], negatives: ['weapon-recoil'], hasNegative: true, heldNegative: 'weapon-recoil', lock: null, variant: null});
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
    const row = button.dataset.lock, automatic = row !== 'negative' && isCombinedTrait(state.positives[Number(row)]), locked = automatic || state.lock === row;
    const valid = row === 'negative' ? state.hasNegative && state.negatives.length > 0 : Boolean(state.positives[Number(row)]);
    button.disabled = !valid || automatic; button.setAttribute('aria-pressed', String(locked));
    const statName = row === 'negative' ? nameOf(state.heldNegative) : nameOf(state.positives[Number(row)]);
    button.setAttribute('aria-label', automatic ? `${statName}: automatically retained, no extra Kuva` : `${locked ? 'Unlock' : 'Lock'} ${statName || 'stat'}`);
    button.title = automatic ? 'Spliced trait: always retained for free. You may manually lock one other stat.' : valid ? `${locked ? 'Unlock' : 'Lock'} ${statName}` : 'Choose a stat first';
    button.querySelector('use').setAttribute('href', locked ? '#r-lock' : '#r-unlock');
    button.closest('.stat-row').classList.toggle('is-locked', locked);
    button.closest('.stat-row').classList.toggle('is-spliced', automatic);
    button.closest('.stat-row').classList.toggle('is-vintage', row === 'negative'
      ? retainedNegativeTargets().includes(state.heldNegative) : isVintage(state.positives[Number(row)], 'positive'));
  });
  $('#negativeLockChoice').hidden = !state.hasNegative || state.negatives.length < 2;
  $('#negativeLockChoice label').textContent = state.lock === 'negative' ? 'Negative to keep locked' : 'Negative used for lock comparison';
  $('#heldNegative').innerHTML = state.negatives.map(id => `<option value="${esc(id)}"${id === state.heldNegative ? ' selected' : ''}>${esc(nameOf(id))}</option>`).join('');
  renderRanges(); renderSpliceSetup(); renderSelectedLockSetup(); renderResults(); renderCrossovers(); numberSections();
  if ($('#fullMath').open) renderDerivation();
  $('#rivenStatus').textContent = `${variant.name}. ${FORMATS[format()].name}. ${combinedTargets().length ? 'Spliced trait retained for free. ' : ''}${state.lock === null ? 'No manual lock' : state.lock === 'negative' ? 'Negative locked' : 'Positive locked'}.`;
  saveSelection();
  document.dispatchEvent(new window.Event('riven:render'));
}

function numberSections() {
  let step = 0;
  for (const [section, heading, title] of [
    ['#spliceSetup', '#spliceSetupTitle', 'Getting Optimal Splice'],
    ['#selectedLockSetup', '#selectedLockTitle', 'Getting Selected Lock Stat'],
    ['.results-section', '#resultsTitle', 'Final Target Roll Odds'],
  ]) {
    if (!$(section).hidden) $(heading).textContent = `${++step}. ${title}`;
  }
}

function renderSpliceSetup() {
  const section = $('#spliceSetup'), [splice] = combinedTargets();
  const expanded = sectionExpanded('splice', section);
  section.hidden = !splice;
  if (!splice) { section.replaceChildren(); return; }
  const recipes = spliceRecipes(splice, family.definition).filter(pair => pools.some(pool =>
    pair.every(id => pool.positive.has(id) || state.hasNegative && pool.negative.has(id))));
  const grade = setupGrade('splice');
  const gradeName = grade.name === 'S' ? 'S-grade' : `${grade.name} or better`;
  const findsLabel = grade.name === 'S' ? 'S-grade' : `${grade.name}-or-better`;
  const heldLabel = grade.name === 'S' ? 'S-grade' : 'qualifying';
  const key = `${family.id}:${splice}:${format()}:${grade.name}`;
  if (!spliceSetupCache.has(key)) spliceSetupCache.set(key, optimalSpliceSetup(pools, recipes, target().positives.length, state.hasNegative, grade.atLeastChance));
  const result = spliceSetupCache.get(key);
  const recipeText = recipes.map(pair => pair.map(nameOf).join(' + ')).join('; or ');
  const heading = `<details class="math-details splice-disclosure" data-riven-section="splice"${expanded ? ' open' : ''}><summary class="section-heading"><h2 id="spliceSetupTitle">Getting Optimal Splice</h2><svg class="splice-toggle" width="20" height="20" aria-hidden="true"><use href="#r-chevron"/></svg></summary><div class="splice-body"><div class="splice-recipe-row">${gradeSelector('splice', 'Splice minimum grade')}<p class="splice-recipe">${esc(nameOf(splice))} · ${format()}${recipeText ? ` (${esc(recipeText)})` : ''}</p></div>`;
  if (!result.available) {
    section.innerHTML = heading + `<p class="research-notice">${result.uncertain ? 'Unresolved ingredient eligibility changes which setup route is possible or best. No single optimal route is shown until that pool is confirmed.' : 'No complete recipe can be rolled in this weapon’s eligible pools and selected format. Existing vintage ingredients are outside this setup estimate.'}</p></div></details>`;
    return;
  }
  const rolls = value => intervalText(value, n => number(n, 1));
  const kuva = {min: result.total.min * catalog.assumptions.kuvaPerRoll * catalog.assumptions.lockedKuvaMultiplier, max: result.total.max * catalog.assumptions.kuvaPerRoll * catalog.assumptions.lockedKuvaMultiplier};
  const alternatives = result.equivalentLocks, ingredients = new Set(recipes.flat());
  const completeClass = (polarity, predicate) => alternatives.length > 1 && pools.length === 1
    && alternatives.every(lock => lock.polarity === polarity && predicate(lock.id))
    && [...pools[0][polarity]].filter(predicate).length === alternatives.length;
  let lockInstruction;
  if (completeClass('negative', id => pools[0].positive.has(id) && !ingredients.has(id))) {
    const excluded = [...ingredients].filter(id => pools[0].negative.has(id) && pools[0].positive.has(id)).map(nameOf);
    lockInstruction = 'a negative stat that can also roll as a positive';
    if (excluded.length) lockInstruction += `, excluding ${excluded.join(', ')}`;
  } else if (completeClass('positive', id => !ingredients.has(id))) {
    lockInstruction = `a positive stat that is not an ingredient for ${nameOf(splice)}`;
  } else {
    lockInstruction = alternatives.length > 1 ? 'one of the equally optimal starting traits listed below'
      : `${nameOf(result.lock.id)} as a ${result.lock.polarity}`;
  }
  const partnerPools = pools.map(pool => {
    const positive = new Set(), negative = new Set();
    for (const [a, b] of recipes) for (const [held, partner] of [[a, b], [b, a]]) {
      if (!pool.positive.has(held)) continue;
      if (pool.positive.has(partner)) positive.add(partner);
      if (state.hasNegative && pool.negative.has(partner)) negative.add(partner);
    }
    return {positive, negative};
  });
  const signature = pool => JSON.stringify(['positive', 'negative'].map(sign => [...pool[sign]].sort()));
  const partnerEligibilityUnresolved = partnerPools.some(pool => signature(pool) !== signature(partnerPools[0]));
  const hasPositivePartner = partnerPools.some(pool => pool.positive.size);
  const hasNegativePartner = partnerPools.some(pool => pool.negative.size);
  let partnerInstruction;
  if (partnerEligibilityUnresolved) {
    partnerInstruction = 'in this weapon’s eligible pool; some partner eligibility is unresolved.';
  } else if (!hasNegativePartner) {
    partnerInstruction = `as a positive. ${state.hasNegative ? 'These recipe partners cannot roll as negatives on this weapon.' : `${format()} has no negative slot.`}`;
  } else if (!hasPositivePartner) {
    partnerInstruction = 'as a negative.';
  } else if ([...partnerPools[0].positive].every(id => partnerPools[0].negative.has(id))
    && partnerPools[0].positive.size === partnerPools[0].negative.size) {
    partnerInstruction = 'as either a positive or a negative.';
  } else {
    const negatives = [...partnerPools[0].negative].map(nameOf);
    partnerInstruction = `in an eligible positive or negative slot. Eligible negative partners: ${negatives.join(', ')}.`;
  }
  const replacementSlot = hasPositivePartner && hasNegativePartner ? 'positive or negative' : hasNegativePartner ? 'negative' : 'positive';
  const choices = alternatives.length > 1 ? `<details class="splice-lock-choices"><summary>${alternatives.length} equally optimal starting locks</summary>${['negative', 'positive'].map(polarity => {
    const names = alternatives.filter(lock => lock.polarity === polarity).map(lock => nameOf(lock.id)).sort((a, b) => a.localeCompare(b));
    return names.length ? `<p><strong>${polarity === 'negative' ? 'Negative' : 'Positive'}:</strong> ${esc(names.join(', '))}.</p>` : '';
  }).join('')}</details>` : '';
  section.innerHTML = heading + `
    <div class="splice-steps">
      <div><h3>1a. Find ${grade.name === 'S' ? 'an S-grade ingredient' : `an ingredient at ${esc(gradeName)}`}</h3><strong>${rolls(result.first)} <small>rolls on average</small></strong><p>Start with a ${format()} Riven and manually lock ${esc(lockInstruction)}. Locking preserves ${format()}. Keep rolling until a usable positive ingredient is ${esc(gradeName)}.</p>${choices}</div>
      <div><h3>1b. Lock the ${grade.name === 'S' ? 'S-grade' : 'qualifying ingredient'}, find its partner</h3><strong>${rolls(result.ifMissing)} <small>rolls if missing</small></strong><p>Already together on ${percentText(result.ready)} of ${esc(findsLabel)} finds. If not, move the lock to the ${heldLabel} positive. ${rolls(result.additional)} extra rolls on average to find its matching partner ${esc(partnerInstruction)}</p>
        <p class="splice-total"><span>Splice ready: <strong>${rolls(result.total)} rolls on average</strong></span><span>Average setup Kuva: <strong>${intervalText(kuva, magnitude)}</strong></span></p>
      </div>
    </div>
    ${setupInfo('splice', `<p class="cost-caption">${esc(gradeName)} here means ${grade.min >= 0 ? '+' : '−'}${number(Math.abs(grade.min), 1)}% or better relative to the stat’s mean, modeled as a ${number(grade.atLeastChance * 100, 1)}% independent chance across the uniform ±10% band. Best two-stage route among existing ordinary locks in ${format()}; assumes no qualifying positive ingredient yet. Both steps use ${number(catalog.assumptions.kuvaPerRoll * catalog.assumptions.lockedKuvaMultiplier)} Kuva per roll at the cap. ${result.uncertain ? 'Ranges reflect unresolved pool eligibility. ' : ''}Excludes the starting Riven, splicer acquisition and the final target below. Other target traits, including vintage lines, are not preserved during setup.</p>
    <p class="cost-caption">Splice the pair to keep the higher grade permanently as a positive. The replacement uses the other ingredient’s ${replacementSlot} slot, and either ingredient can appear again if eligible. The final-roll odds below start after this step.</p>`)}
    </div></details>`;
}

function renderSelectedLockSetup() {
  const section = $('#selectedLockSetup');
  const expanded = sectionExpanded('selected-lock', section);
  section.hidden = state.lock === null;
  if (section.hidden) { section.replaceChildren(); return; }
  const heading = `<details class="math-details splice-disclosure" data-riven-section="selected-lock"${expanded ? ' open' : ''}><summary class="section-heading"><h2 id="selectedLockTitle">Getting Selected Lock Stat</h2><svg class="splice-toggle" width="20" height="20" aria-hidden="true"><use href="#r-chevron"/></svg></summary><div class="selected-lock-body">`;
  const polarity = state.lock === 'negative' ? 'negative' : 'positive';
  const id = polarity === 'negative' ? state.heldNegative : state.positives[Number(state.lock)];
  const trait = definitions.find(row => row.id === id), [splice] = combinedTargets();
  const vintage = isVintage(id, polarity);
  const probability = bounds(pools.map(pool => selectedLockChance(pool, {id, polarity,
    positives: target().positives.length, hasNegative: state.hasNegative, hasSplice: Boolean(splice)}, catalog.assumptions)));
  const acquisition = splice
    ? `${nameOf(splice)} stays retained for free, preserving ${format()}.`
    : `No manual lock is held while searching; odds include rolling the selected ${format()} format.`;
  const grade = setupGrade('selected-lock');
  const range = formatRange(traitGradeRange(trait, variant.disposition, format(), polarity, catalog.rangeModel, grade));
  const chance = {min: probability.min * grade.atLeastChance, max: probability.max * grade.atLeastChance};
  const rows = `<tr><th scope="row">${gradeSelector('selected-lock', 'Selected lock minimum grade')}</th><td>${esc(range || 'Baseline not confirmed')}</td><td>${vintage ? 'Not rollable' : esc(oddsText(chance))}</td></tr>`;
  section.innerHTML = heading + `
    <p class="splice-recipe">${esc(nameOf(id))} · ${polarity === 'positive' ? 'Positive' : 'Negative'} · ${esc(variant.name)} · ${format()}</p>
    <p class="lock-grade-intro">${vintage ? 'This vintage stat cannot roll anew. The ranges below are reference values for an existing line, not acquisition opportunities.' : `Find this stat before applying its manual lock. ${esc(acquisition)} Other selected ordinary traits are not required.`}</p>
    <div class="lock-grade-scroll"><table class="lock-grade-table"><thead><tr><th scope="col">Grade</th><th scope="col">Stat range for grade</th><th scope="col" title="Per-roll odds of this stat at this grade or better">Odds (grade or better)</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${setupInfo('selected-lock', `<p class="cost-caption">Rank 8. Ranges show each grade’s band; odds include finding this stat at that grade or better. ${polarity === 'negative' ? 'Higher negative grades mean a smaller penalty.' : 'Higher positive grades mean a stronger benefit.'} Rounded display ranges can overlap at grade boundaries.</p>
    <p class="cost-caption">Uses uniform grades across the ±10% band, independent of trait selection, under the positives-first model. ${pools.length > 1 ? 'Odds are bounds across unresolved eligible pools. ' : ''}${splice ? 'Spliced traits retain their grade; their numerical baselines are not yet confirmed. ' : ''}This step does not require the rest of the final target.</p>`)}
    </div></details>`;
}

function renderResults() {
  const active = state.lock === null ? 'none' : state.lock === 'negative' ? 'negative' : 'positive';
  const spliced = combinedTargets().length === 1;
  const labels = {none: spliced ? 'Splice only' : 'No lock', positive: spliced ? 'Splice + positive lock' : 'Lock positive', negative: spliced ? 'Splice + negative lock' : 'Lock negative'};
  const retained = retainedPositiveTargets(), retainedNegative = retainedNegativeTargets();
  const combiningOnly = retained.length > 1, retainedPositive = retained.length === 1 ? retained[0] : null;
  const incomplete = state.hasNegative && !state.negatives.length, rec = $('#strategyRecommendation');
  rec.classList.toggle('is-uncertain', incomplete || combiningOnly || !retained.length && research.winningLock === 'uncertain');
  const bestText = incomplete ? 'Choose an acceptable negative' : combiningOnly ? 'More than one retained line' : retainedPositive ? `Lock ${nameOf(retainedPositive)}` : !state.hasNegative ? 'Lock a positive' : research.winningLock === 'tie' ? 'Both locks have equal odds' : research.winningLock === 'uncertain' ? 'The best lock depends on eligibility' : `Lock a ${research.winningLock}`;
  const description = incomplete ? 'Select at least one alternative, or choose No negative.'
    : combiningOnly ? 'One manual lock cannot retain multiple vintage lines through cycling. A splice is retained separately for free.'
    : retainedPositive ? 'This vintage line is not currently rollable. These odds start with it already present and manually locked; obtaining it is excluded.'
    : spliced ? `The splice is automatically retained for free, with its ingredients still eligible. ${research.winningLock === 'negative' ? `Add a manual lock on ${nameOf(state.heldNegative)}.` : 'Add a manual lock on another selected positive.'}`
    : !state.hasNegative ? 'A locked negative cannot produce a 0N target.'
    : research.winningLock === 'negative' ? `Keep ${nameOf(state.heldNegative)}${retainedNegative.includes(state.heldNegative) ? ', a vintage line,' : ''} while rolling the ${target().positives.length} positives.`
    : research.winningLock === 'positive' ? 'Keep any selected positive and accept the chosen negative alternatives.' : 'Compare the probability ranges below. Both locked strategies use the same Kuva cost.';
  rec.innerHTML = `<span class="recommendation-label">${incomplete ? 'COMPLETE YOUR TARGET' : combiningOnly ? 'OUTSIDE THE CYCLING MODEL' : 'BEST LOCK FOR THIS TARGET'}</span><strong>${esc(bestText)}</strong><p>${esc(description)}</p>`;
  $('#strategyRows').innerHTML = ['none', 'positive', 'negative'].map(strategy => {
    const result = research.results[strategy], unavailable = strategy === 'negative' && (!state.hasNegative || !state.negatives.length);
    const reductionClass = !result.kuvaReduction ? 'muted' : result.kuvaReduction.min >= 0 ? 'positive-text' : 'negative-text';
    const rowClasses = research.winningLock === strategy && !unavailable ? 'best-row' : '';
    const caption = retained.length ? strategy === 'positive' ? combiningOnly ? 'Only one manual lock is available' : `Keep ${nameOf(positiveForComparison())}` : 'Cannot reroll a vintage line'
      : strategy === 'none' ? spliced ? 'No extra Kuva; format preserved' : 'Previous odds' : strategy === 'negative' ? nameOf(state.heldNegative) || 'Choose a negative' : spliced ? 'Any selected non-spliced positive' : 'Any selected positive';
    const noCyclingChance = (retained.length || retainedNegative.length) && result.probability.max <= 0;
    const chance = noCyclingChance ? 'Not possible by cycling' : oddsText(result.probability);
    return `<tr class="${rowClasses}" data-strategy-row="${strategy}"${unavailable ? ' aria-disabled="true"' : ''}><th scope="row"><div class="strategy-label"><span class="strategy-check" data-checked="${active === strategy}" aria-hidden="true"></span><div class="strategy-copy"><button class="strategy-pick${strategy === 'negative' ? ' negative-text' : ''}" type="button" data-strategy="${strategy}" aria-pressed="${active === strategy}"${unavailable ? ' disabled' : ''}>${labels[strategy]}</button><small>${esc(caption)}</small></div></div></th><td${!same(result.probability) || noCyclingChance ? ' class="has-probability-range"' : ''}>${unavailable ? '<span class="muted">Not applicable</span>' : esc(chance)}</td><td class="${strategy === 'none' || unavailable ? 'muted' : reductionClass}">${unavailable ? 'Not applicable' : percentText(result.kuvaReduction)}</td></tr>`;
  }).join('');
  const probability = research.results[active].probability;
  const noCyclingChance = (retained.length || retainedNegative.length) && probability.max <= 0;
  const selectedName = retained.length && active === 'positive' ? `LOCK ${nameOf(positiveForComparison()).toUpperCase()}` : labels[active].toUpperCase();
  const alreadyComplete = spliced && active === 'positive' && !state.hasNegative && research.scenarios.every(row => row.positiveDraws === 0 && row.qPositive === 1);
  const note = noCyclingChance ? 'This strategy cannot retain every selected vintage line. Additional acquisition steps are outside this estimate.' : alreadyComplete ? 'Both target traits are already retained. No further reroll is needed for this trait-identity target.' : `${pools.length > 1 ? 'Conditional on eligibility. ' : ''}A 1 / X chance means X rolls on average, not a guarantee.`;
  $('#activeStrategy').innerHTML = `<span>SELECTED STRATEGY · ${esc(selectedName)}</span><strong${!same(probability) || noCyclingChance ? ' class="active-range"' : ''}>${esc(noCyclingChance ? 'No cycling outcome' : oddsText(probability))}</strong><p>${esc(note)}</p>`;
  if (noCyclingChance) {
    $('#planningStats').innerHTML = ['Average Kuva', '50% success', '95% success'].map(label => `<div><span>${label}</span><strong>Not applicable</strong></div>`).join('');
    return;
  }
  if (alreadyComplete) {
    $('#planningStats').innerHTML = '<div><span>Average Kuva</span><strong>0</strong></div><div><span>50% success</span><strong>0 rolls</strong></div><div><span>95% success</span><strong>0 rolls</strong></div>';
    return;
  }
  const cost = catalog.assumptions.kuvaPerRoll * (active === 'none' ? 1 : catalog.assumptions.lockedKuvaMultiplier);
  const meanCost = {min: cost / probability.max, max: cost / probability.min};
  const rolls = confidence => ({min: attemptsFor(probability.max, confidence), max: attemptsFor(probability.min, confidence)});
  $('#planningStats').innerHTML = `<div><span>Average Kuva</span><strong>${intervalText(meanCost, magnitude)}</strong></div><div><span>50% success</span><strong>${intervalText(rolls(.5))} rolls</strong></div><div><span>95% success</span><strong>${intervalText(rolls(.95))} rolls</strong></div>`;
}

function renderCrossovers() {
  const section = $('.crossover-section'); section.hidden = !state.hasNegative || !state.negatives.length || retainedPositiveTargets().length > 0 || retainedNegativeTargets().length > 0;
  if (section.hidden) return;
  const max = Math.max(...research.scenarios.map(row => row.d)), threshold = research.threshold;
  $('#crossoverSummary').textContent = !threshold ? 'Choose an eligible negative for this comparison.' : threshold.min > max ? 'No attainable number of negatives makes a positive lock better for this target.' : same(threshold) ? `For this ${format().toUpperCase()} target, a positive lock wins from ${number(threshold.min)} compatible negatives.` : `For this ${format().toUpperCase()} target, the crossover is ${intervalText(threshold)} compatible negatives, depending on eligibility.`;
  const rows = [];
  // Limit the comparison display, not the pool or the selected target.
  for (let a = 1; a <= Math.min(max, 6); a++) {
    const cases = research.scenarios.filter(row => row.d >= a && row.q0 > 0).map(row => ({positive: catalog.assumptions.positiveLockLayoutWeight * a / (choose(row.p - 1, row.m - 1) * row.d), negative: row.qNegative}));
    if (!cases.length) continue;
    const qPositive = bounds(cases.map(row => row.positive)), qNegative = bounds(cases.map(row => row.negative));
    const outcomes = new Set(cases.map(row => Math.abs(row.positive - row.negative) < 1e-15 ? 'Equal' : row.positive > row.negative ? 'Positive' : 'Negative'));
    const better = outcomes.size === 1 ? [...outcomes][0] : 'Depends on pool';
    rows.push(`<tr${a === state.negatives.length ? ' class="selected-count"' : ''}><td>${a}${a === state.negatives.length ? ' · selected' : ''}</td><td class="${better === 'Positive' ? 'wins' : ''}">${esc(oddsText(qPositive))}</td><td class="${better === 'Negative' ? 'wins' : ''}">${esc(oddsText(qNegative))}</td><td class="${better === 'Positive' ? 'wins' : better === 'Negative' ? 'loses' : ''}">${better}</td></tr>`);
  }
  $('#crossoverRows').innerHTML = rows.join('');
}

async function renderDerivation() {
  const {renderMath} = await import('./math.mjs?v=20260923-compact-grades');
  $('#mathContent').innerHTML = renderMath({catalog, research, target: target(), variant, format: format(), nameOf});
  document.dispatchEvent(new window.Event('riven:render'));
}

try {
  const response = await fetch('./data.json?v=20260923-compact-grades');
  if (!response.ok) throw new Error(`Catalog request failed (${response.status}).`);
  catalog = unpackCatalog(await response.json());
  connectControls(); if (!restoreSelection()) selectCategory('Primary');
} catch (error) {
  $('#loadError').hidden = false;
  $('#loadError').textContent = 'The Riven data could not load. Refresh the page to try again.';
  $('#strategyRows').replaceChildren(); $('#activeStrategy').textContent = 'Calculator unavailable'; $('#planningStats').replaceChildren();
  $('#strategyRecommendation').textContent = 'Unable to calculate odds until the catalog loads.';
  document.querySelectorAll('.combo-trigger, .lock-button, #resetTarget').forEach(button => button.disabled = true);
  console.error('Riven calculator:', error);
}
