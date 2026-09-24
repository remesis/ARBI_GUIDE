// Expand the small, shared pool profiles into the calculator's working model.
const states = ['excluded', 'allowed', 'unresolved'];
const slug = text => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Spliced targets are separate from every ordinary cycling pool.
export const COMBINED_TRAITS = Object.freeze([
  {id: 'blast', name: 'Blast', group: 'all', recipe: 'Cold + Heat'},
  {id: 'corrosive', name: 'Corrosive', group: 'all', recipe: 'Electricity + Toxin'},
  {id: 'gas', name: 'Gas', group: 'all', recipe: 'Heat + Toxin'},
  {id: 'magnetic', name: 'Magnetic', group: 'all', recipe: 'Cold + Electricity'},
  {id: 'radiation', name: 'Radiation', group: 'all', recipe: 'Heat + Electricity'},
  {id: 'viral', name: 'Viral', group: 'all', recipe: 'Cold + Toxin'},
  {id: 'damage-to-orokin', name: 'Damage to Orokin', group: 'all', recipe: 'Damage to Corpus + Damage to Grineer'},
  {id: 'damage-to-techrot', name: 'Damage to Techrot', group: 'all', recipe: 'Damage to Corpus + Damage to Infested'},
  {id: 'damage-to-scaldra', name: 'Damage to Scaldra', group: 'all', recipe: 'Damage to Infested + Damage to Grineer'},
  {id: 'weakpoint-damage', name: 'Weakpoint Damage', group: 'ranged', recipe: 'Damage + Zoom; or Damage + Multishot'},
  {id: 'weakpoint-critical-chance', name: 'Weakpoint Critical Chance', group: 'ranged', recipe: 'Critical Chance + Zoom; or Critical Chance + Multishot'},
  {id: 'ammo-efficiency', name: 'Ammo Efficiency', group: 'ranged', recipe: 'Magazine Capacity + Reload Speed; or Weapon Recoil + Ammo Maximum'},
  {id: 'magazine-reload-while-holstered', name: 'Magazine Reload While Holstered', group: 'ranged', recipe: 'Ammo Maximum + Reload Speed; or Ammo Maximum + Magazine Capacity'},
  {id: 'status-damage', name: 'Status Damage', group: 'all', recipe: 'Damage + Status Chance'},
  {id: 'heavy-attack-damage', name: 'Heavy Attack Damage', group: 'melee', recipe: 'Heavy Attack Efficiency + Additional Combo Count'},
  {id: 'heavy-attack-windup-speed', name: 'Heavy Attack Windup Speed', group: 'melee', recipe: 'Heavy Attack Efficiency + Combo Duration'},
  {id: 'parry-angle', name: 'Parry Angle', group: 'melee', recipe: 'Attack Speed + Range'},
  {id: 'slam-damage', name: 'Slam Damage', group: 'melee', recipe: 'Damage + Attack Speed'},
].map(Object.freeze));
const combinedIds = new Set(COMBINED_TRAITS.map(trait => trait.id));
export const isCombinedTrait = id => combinedIds.has(id);
export const splicedTraitsFor = definition => COMBINED_TRAITS.filter(trait => trait.group === 'all'
  || trait.group === (['Melee', 'Zaw'].includes(definition) ? 'melee' : 'ranged'));

export const SPLICE_BASELINE_SOURCE = Object.freeze({
  url: 'https://wiki.warframe.com/w/Riven_Mods#Spliced_Values',
  date: '2026-09-24',
  status: 'provisional',
});
// Temporary fallback only when the wiki lacks a value: use the selected weapon
// definition's ordinary ingredient coefficient, unit and rounding.
const sharedRangeSplices = new Set(['blast', 'corrosive', 'gas', 'magnetic', 'radiation', 'viral',
  'damage-to-orokin', 'damage-to-techrot', 'damage-to-scaldra']);
// Public base values take priority over the shared-range fallback.
// Columns follow the wiki: Rifle, Shotgun, Pistol, Archgun, Melee / Zaw.
// Empty cells and unclear units remain unknown; they are not zero or ineligible.
const spliceBaseValues = Object.freeze(Object.fromEntries(Object.entries({
  blast: [90, 90, 90, 90, null],
  corrosive: [90, 90, 90, 90, null],
  gas: [90, 90, 90, 90, null],
  magnetic: [90, 90, 90, 90, null],
  radiation: [90, 90, 90, 90, null],
  viral: [90, 90, 90, 90, null],
  'damage-to-orokin': [.45, .45, .45, .45, null],
  'damage-to-techrot': [.45, .45, .45, .45, null],
  'damage-to-scaldra': [.45, .45, .45, .45, null],
  'weakpoint-damage': [225, 225, 90, 225, null],
  'weakpoint-critical-chance': [247.5, 247.5, 90, 247.5, null],
  'ammo-efficiency': [9, 9, 9, 9, null],
  'magazine-reload-while-holstered': [90, 90, 90, null, null],
  'status-damage': [90, 90, 90, 90, null],
  'heavy-attack-damage': [null, null, null, null, 119.7],
  'heavy-attack-windup-speed': [null, null, null, null, 119.7],
  'slam-damage': [null, null, null, null, 119.7],
}).map(([id, values]) => [id, Object.freeze(values)])));

// Resolve separately from ordinary definitions so splice ranges cannot enlarge
// the positive/negative cycling pools or alter trait-identity odds.
export function splicedTrait(id, definition, ordinaryTraits = []) {
  const trait = splicedTraitsFor(definition).find(row => row.id === id);
  if (!trait) return null;
  const column = ['Rifle', 'Shotgun', 'Pistol', 'Archgun', 'Melee'].indexOf(definition === 'Zaw' ? 'Melee' : definition);
  const unit = id.startsWith('damage-to-') ? 'x' : '%';
  const wikiBaseValue = spliceBaseValues[id]?.[column];
  const reference = !Number.isFinite(wikiBaseValue) && sharedRangeSplices.has(id) ? spliceRecipes(id, definition).flat()
    .map(ingredient => ordinaryTraits.find(row => row.id === ingredient))
    .find(row => row?.positive && row.unit === unit && Number.isFinite(row.value)) : null;
  const baseValue = reference ? reference.value * 90 * (unit === '%' ? 100 : 1) : wikiBaseValue;
  const known = Number.isFinite(baseValue);
  return {...trait, positive: true, negative: false, reverse: reference?.reverse ?? false, unit,
    baseValue: known ? baseValue : null,
    // Existing range coefficients are per rank step at strength 10. The public
    // base is rank 8 (9 steps); faction values are bonuses before adding 1x.
    value: reference ? reference.value : known ? baseValue / (90 * (unit === '%' ? 100 : 1)) : null,
    roundTo: reference ? reference.roundTo : unit === 'x' ? .01 : .1,
    rounding: reference ? reference.rounding : 'RM_ROUND',
    baselineStatus: reference ? 'assumed' : known ? SPLICE_BASELINE_SOURCE.status : 'unknown',
    baselineReference: reference?.id ?? null,
    baselineSource: reference ? null : SPLICE_BASELINE_SOURCE.url,
  };
}

// Ordinary trait identities, not additional entries in either cycling pool.
const splicePairs = {
  blast: [['cold', 'heat']], corrosive: [['electricity', 'toxin']], gas: [['heat', 'toxin']],
  magnetic: [['cold', 'electricity']], radiation: [['heat', 'electricity']], viral: [['cold', 'toxin']],
  'damage-to-orokin': [['damage-to-corpus', 'damage-to-grineer']],
  'damage-to-techrot': [['damage-to-corpus', 'damage-to-infested']],
  'damage-to-scaldra': [['damage-to-infested', 'damage-to-grineer']],
  'weakpoint-damage': [['damage', 'zoom'], ['damage', 'multishot']],
  'weakpoint-critical-chance': [['critical-chance', 'zoom'], ['critical-chance', 'multishot']],
  'ammo-efficiency': [['magazine-capacity', 'reload-speed'], ['weapon-recoil', 'ammo-maximum']],
  'magazine-reload-while-holstered': [['ammo-maximum', 'reload-speed'], ['ammo-maximum', 'magazine-capacity']],
  'status-damage': [['damage', 'status-chance']],
  'heavy-attack-damage': [['heavy-attack-efficiency', 'additional-combo-count-chance']],
  'heavy-attack-windup-speed': [['heavy-attack-efficiency', 'combo-duration']],
  'parry-angle': [['fire-rate-attack-speed', 'range']],
  'slam-damage': [['damage', 'fire-rate-attack-speed']],
};
export function spliceRecipes(id, definition) {
  if (!splicedTraitsFor(definition).some(trait => trait.id === id)) return [];
  return (splicePairs[id] || []).map(pair => pair.map(trait =>
    trait === 'damage' && ['Melee', 'Zaw'].includes(definition) ? 'melee-damage' : trait));
}

export function unpackCatalog(data) {
  if (data.schemaVersion !== 2 || !data.weapons?.length) throw new Error('Unsupported Riven catalog.');
  const families = data.families.map(([name, definition, profile]) => {
    const traits = {};
    const codes = data.pools[profile];
    if (codes?.length !== data.definitions[definition]?.length) throw new Error('Invalid trait pool.');
    data.definitions[definition].forEach((trait, index) => {
      const code = Number.parseInt(codes[index], 18);
      if (!Number.isInteger(code) || code < 0 || code > 17) throw new Error('Invalid trait eligibility.');
      traits[trait.id] = {positive: states[code % 3], negative: states[Math.floor(code / 3) % 3]};
      if (code >= 9) traits[trait.id].vintage = true;
    });
    return {id: `${slug(name)}-${definition.toLowerCase()}`, name, definition, traits,
      hasOpenQuestions: Object.values(traits).some(t => t.positive === 'unresolved' || t.negative === 'unresolved')};
  });
  const weapons = data.weapons.map(([familyIndex, category, variants]) => {
    const family = families[familyIndex];
    if (!family) throw new Error('Invalid weapon family.');
    return {id: `${family.id}-${category.toLowerCase()}`, name: family.name, category, family: family.id, kind: family.definition,
      variants: variants.map(([name, label, disposition]) => ({id: slug(name), name, label, disposition}))};
  });
  return {...data, families, weapons};
}
