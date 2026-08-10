
export const clampScore = (n) => Math.max(0, Math.min(100, Math.round(n)));

export function weightedScore(parts) {
  const available = parts.filter((p) => p.value != null && p.weight > 0);
  if (!available.length) return null;
  const totalWeight = available.reduce((s, p) => s + p.weight, 0);
  const sum = available.reduce((s, p) => s + p.value * p.weight, 0);
  return clampScore(sum / totalWeight);
}

export function scoreToBand(score, thresholds) {
  if (score == null) return null;
  const match = thresholds.find((t) => score >= t.min);
  return match ? match.label : thresholds[thresholds.length - 1].label;
}

export function linearScore(value, min, max, { invert = false } = {}) {
  if (value == null) return null;
  if (max === min) return 100;
  let pct = ((value - min) / (max - min)) * 100;
  if (invert) pct = 100 - pct;
  return clampScore(pct);
}

export function decayScore(hoursElapsed, halfLifeHours) {
  if (hoursElapsed == null || !halfLifeHours || halfLifeHours <= 0) return null;
  return clampScore(100 * 2 ** (-hoursElapsed / halfLifeHours));
}
