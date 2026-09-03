// Expand the small, shared pool profiles into the calculator's working model.
const states = ['excluded', 'allowed', 'unresolved'];
const slug = text => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Combination-only targets are separate from every ordinary cycling pool.
export const COMBINED_TRAITS = Object.freeze([
  {id: 'blast', name: 'Blast', recipe: 'Cold + Heat'},
  {id: 'corrosive', name: 'Corrosive', recipe: 'Electricity + Toxin'},
  {id: 'gas', name: 'Gas', recipe: 'Heat + Toxin'},
  {id: 'magnetic', name: 'Magnetic', recipe: 'Cold + Electricity'},
  {id: 'radiation', name: 'Radiation', recipe: 'Heat + Electricity'},
  {id: 'viral', name: 'Viral', recipe: 'Cold + Toxin'},
  {id: 'weakpoint-damage', name: 'Weakpoint Damage'},
  {id: 'status-damage', name: 'Status Damage'},
].map(Object.freeze));
const combinedIds = new Set(COMBINED_TRAITS.map(trait => trait.id));
export const isCombinedTrait = id => combinedIds.has(id);

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
