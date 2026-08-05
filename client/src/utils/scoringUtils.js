// Phase 14A — generic 0-100 scoring primitives shared by every
// intelligence/ module (Recovery, Readiness, Fatigue, Weekly Grade all
// need "turn a handful of real numbers into one score"). Deliberately
// domain-agnostic: nothing here knows what a muscle, a set, or a
// workout is — that mapping happens in each engine, which decides WHAT
// goes into these functions. Keeping the arithmetic in one place means
// every score in this app rounds/clamps/weights the same way.

export const clampScore = (n) => Math.max(0, Math.min(100, Math.round(n)));

// Weighted average of `{ value, weight }` parts — the one aggregation
// every composite score (Readiness, Weekly Grade, Deload confidence)
// uses. Parts with a null value are excluded entirely (both from the
// numerator AND the weight total) rather than treated as 0, so a
// not-yet-available input (e.g. "sleep" in Readiness, which the phase's
// own spec marks "future") doesn't drag the score down — it's simply
// left out, same "omit rather than guess" rule this codebase already
// follows everywhere else. Returns null only when NOTHING is available.
export function weightedScore(parts) {
  const available = parts.filter((p) => p.value != null && p.weight > 0);
  if (!available.length) return null;
  const totalWeight = available.reduce((s, p) => s + p.weight, 0);
  const sum = available.reduce((s, p) => s + p.value * p.weight, 0);
  return clampScore(sum / totalWeight);
}

// Buckets a score into a label via a descending-order thresholds list:
// `[{ min: 85, label: "Excellent" }, { min: 70, label: "Good" }, ...]`.
// The last entry is the catch-all floor. Mirrors the exact bucketing
// Analytics.jsx's pre-existing Training Score already uses (85/70/50 ->
// Excellent/Good/Fair/Needs Work) — every NEW score in this app should
// bucket the same way, not invent its own cutoffs ad hoc.
export function scoreToBand(score, thresholds) {
  if (score == null) return null;
  const match = thresholds.find((t) => score >= t.min);
  return match ? match.label : thresholds[thresholds.length - 1].label;
}

// Linearly maps a real value in [min, max] onto 0-100, clamped outside
// that range. `invert: true` for metrics where LOWER is better (e.g.
// days-until-recovered — closer to 0 hours remaining should score
// higher, not lower).
export function linearScore(value, min, max, { invert = false } = {}) {
  if (value == null) return null;
  if (max === min) return 100;
  let pct = ((value - min) / (max - min)) * 100;
  if (invert) pct = 100 - pct;
  return clampScore(pct);
}

// Half-life decay: 100 right at `hoursElapsed = 0`, decaying toward 0 as
// time passes, reaching exactly 50 at `halfLifeHours`. This is the
// standard "how much of X is still true" curve — recoveryUtils.js uses
// it for "how recovered is this muscle by now", fatigueUtils.js for
// "how much of that hard session's fatigue still lingers".
export function decayScore(hoursElapsed, halfLifeHours) {
  if (hoursElapsed == null || !halfLifeHours || halfLifeHours <= 0) return null;
  return clampScore(100 * 2 ** (-hoursElapsed / halfLifeHours));
}
