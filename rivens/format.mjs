export const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
export const number = (value, decimals = 0) => Number.isFinite(value) ? value.toLocaleString('en-US', {maximumFractionDigits: decimals}) : '∞';
export const same = interval => interval && Math.abs(interval.max - interval.min) <= Math.max(1e-15, Math.abs(interval.max) * 1e-10);

export function oddsText(interval) {
  if (!interval || interval.max <= 0) return 'Not possible';
  const reciprocal = p => `1 / ${number(1 / p, 1)}`;
  if (same(interval)) return reciprocal(interval.max);
  if (interval.min <= 0) return `Up to ${reciprocal(interval.max)}`;
  return `${reciprocal(interval.min)} to ${reciprocal(interval.max)}`;
}

export function percentText(interval) {
  if (!interval) return 'Not applicable';
  const formatted = value => Number.isFinite(value) ? `${number(value * 100, 2)}%` : 'No finite saving';
  if (same(interval) || interval.min === interval.max) return formatted(interval.min);
  return `${formatted(interval.min)} to ${formatted(interval.max)}`;
}

export function magnitude(value) {
  if (!Number.isFinite(value)) return '∞';
  if (value >= 1e9) return `${number(value / 1e9, 2)}B`;
  if (value >= 1e6) return `${number(value / 1e6, 2)}M`;
  if (value >= 1e4) return `${number(value / 1e3, 1)}K`;
  return number(value);
}

export function intervalText(interval, format = number) {
  if (!interval) return 'Not applicable';
  return same(interval) || interval.min === interval.max ? format(interval.min) : `${format(interval.min)} to ${format(interval.max)}`;
}
