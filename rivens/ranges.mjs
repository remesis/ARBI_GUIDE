export const FORMATS = {
  '2p0n': {positives: 2, negative: false, name: '2 positives, no negative'},
  '3p0n': {positives: 3, negative: false, name: '3 positives, no negative'},
  '2p1n': {positives: 2, negative: true, name: '2 positives, 1 negative'},
  '3p1n': {positives: 3, negative: true, name: '3 positives, 1 negative'},
};

export function traitRange(trait, disposition, format, polarity, model, rank = 8) {
  const layout = FORMATS[format];
  if (!layout || !['positive', 'negative'].includes(polarity)) throw new RangeError('Invalid Riven layout or polarity.');
  if (!Number.isFinite(disposition) || disposition <= 0 || !Number.isInteger(rank) || rank < 0 || rank > model.maxRank) throw new RangeError('Invalid disposition or rank.');
  if (!trait[polarity] || polarity === 'negative' && !layout.negative) return null;
  const isNegative = polarity === 'negative';
  const attenuation = isNegative
    ? model.curseByBuffCount[layout.positives]
    : model.buffAttenuation[layout.positives] * (layout.negative ? model.curseBoost : 1);
  const unitFactor = trait.unit === '%' ? 100 : 1;
  const polarityFactor = (isNegative ? -1 : 1) * (trait.reverse ? -1 : 1);
  const mean = trait.value * model.strength * (rank + 1) * disposition * model.specificFit * attenuation * unitFactor * polarityFactor;
  const shift = trait.unit === 'x' ? 1 : 0;
  const step = trait.roundTo || 0.1;
  const precision = Math.max(0, -Math.round(Math.log10(step)));
  const round = value => {
    const scaled = value / step;
    const rounded = trait.rounding === 'RM_FLOOR' ? Math.floor(scaled + 1e-8) : Math.sign(scaled) * Math.floor(Math.abs(scaled) + 0.5 + 1e-8);
    return Number((rounded * step).toFixed(precision));
  };
  return {low: round(shift + mean * model.variation[0]), high: round(shift + mean * model.variation[1]), mean: shift + mean, unit: trait.unit, precision};
}

export function formatRange(range) {
  if (!range) return null;
  const value = n => range.unit === 'x' ? n.toFixed(range.precision) : `${n < 0 ? '−' : '+'}${Math.abs(n).toFixed(range.precision)}`;
  const unit = range.unit === 'x' ? '×' : range.unit === '%' ? '%' : range.unit ? ` ${range.unit}` : '';
  return `${value(range.low)} to ${value(range.high)}${unit}`;
}
