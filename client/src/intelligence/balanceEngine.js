// Phase 14A, Module 7 — Training Balance. THE single shared Push/Pull/
// Legs/Core split computation for this whole app. Before this file, the
// same sets-based percentage split was computed independently three
// times (components/MuscleBodyMap.jsx's `categoryPct`, pages/Analytics.jsx's
// `lifetimePplPct` AND `overviewPplPct`), plus a fourth, volume-based
// variant in progression/progressionInsights.js's `computeTrainingImbalance`
// — all four reading the same `computeMuscleBreakdown` +
// `MUSCLE_SPLIT_CATEGORY` inputs and doing the exact same
// group-then-percentage arithmetic. Rather than adding a FIFTH copy for
// this phase's own Training Balance module, this file is now the one
// place that math lives; the three pre-existing sets-based call sites
// were refactored to call `computeMuscleGroupSplit` from here (see their
// own diffs), and progressionInsights.js's volume-based one now also
// builds its `totals` from this function.
import { computeMuscleBreakdown, buildSessionSummaries } from "../utils/workoutUtils";
import { MUSCLE_SPLIT_CATEGORY } from "../constants/muscles";
import { getConfidence } from "../utils/confidenceUtils";

const CATEGORIES = ["Push", "Pull", "Legs", "Core"];

// `metric: "sets"` matches MuscleBodyMap/Analytics' pre-existing
// convention; `metric: "volume"` matches progressionInsights.js's. Both
// are legitimate, already-established ways to measure "how much" of a
// category was trained — this makes the choice an explicit parameter
// instead of a silently-duplicated implementation per caller.
//
// Split into a pure summarizer (over an ALREADY-COMPUTED breakdown) and
// a convenience wrapper (computes the breakdown itself) — several
// existing call sites (MuscleBodyMap.jsx, Analytics.jsx) already have a
// `computeMuscleBreakdown` result in scope for other reasons, and
// calling the wrapper there would recompute it a second time for no
// reason on every render.
export function summarizeMuscleGroupSplit(breakdown, { metric = "sets" } = {}) {
  const totals = { Push: 0, Pull: 0, Legs: 0, Core: 0 };

  breakdown.forEach((entry) => {
    const category = MUSCLE_SPLIT_CATEGORY[entry.muscle];
    if (!category) return;
    totals[category] += metric === "volume" ? entry.volume : entry.sets;
  });

  const grandTotal = Object.values(totals).reduce((s, v) => s + v, 0);
  const pct = Object.fromEntries(
    CATEGORIES.map((cat) => [cat, grandTotal ? Math.round((totals[cat] / grandTotal) * 100) : 0])
  );

  return { totals, pct, grandTotal, breakdown };
}

export function computeMuscleGroupSplit(workouts, { metric = "sets" } = {}) {
  return summarizeMuscleGroupSplit(computeMuscleBreakdown(workouts), { metric });
}

// Same 15-percentage-point gap convention progressionInsights.js's
// pre-existing computeTrainingImbalance already established — reused
// here rather than picking a second, different threshold.
const IMBALANCE_GAP_THRESHOLD = 15;

// Per-muscle percentages (not just the 4 categories) — the phase spec's
// second example ("Chest 18% / Back 11% / Rear Delts 2%"). Built from
// the SAME breakdown computeMuscleGroupSplit already fetched, not a
// second pass over workouts.
function computePerMusclePct(breakdown, metric) {
  const total = breakdown.reduce((s, e) => s + (metric === "volume" ? e.volume : e.sets), 0) || 1;
  return breakdown
    .map((e) => ({
      muscle: e.muscle,
      pct: Math.round(((metric === "volume" ? e.volume : e.sets) / total) * 100),
    }))
    .sort((a, b) => b.pct - a.pct);
}

// Module 7's full report: category split + per-muscle split + an
// imbalance warning. Defaults to volume (a session's real training
// stimulus scales with load, not just set count) but any caller wanting
// the sets-based convention can still ask for it explicitly.
export function getTrainingBalance(workouts, { metric = "volume" } = {}) {
  const { pct, breakdown, grandTotal } = computeMuscleGroupSplit(workouts, { metric });
  if (!grandTotal) {
    return { available: false, reason: "Not enough logged training yet to compute a balance split." };
  }

  const entries = Object.entries(pct).map(([cat, p]) => ({ cat, pct: p }));
  entries.sort((a, b) => b.pct - a.pct);
  const most = entries[0];
  const least = entries[entries.length - 1];
  const gap = most.pct - least.pct;

  // Standardized confidence — how many real sessions the split itself
  // was built from (buildSessionSummaries' own session-grouping, not a
  // second definition of "a trained session").
  const sessionCount = buildSessionSummaries(workouts).filter(
    (s) => s.stats.exerciseCount > 0 || s.stats.cardioCount > 0
  ).length;
  const { level: confidence, reason: confidenceReason } = getConfidence(sessionCount, "session");

  return {
    available: true,
    categoryPct: pct,
    musclePct: computePerMusclePct(breakdown, metric),
    imbalance: {
      balanced: gap < IMBALANCE_GAP_THRESHOLD,
      gap: Math.round(gap),
      dominant: most.cat,
      least: least.cat,
    },
    confidence,
    confidenceReason,
  };
}

// Phase 14B, section 11 — "Upper : Lower". A coarser re-aggregation of
// the SAME category totals computeMuscleGroupSplit already produced —
// Push + Pull = Upper, Legs = Lower. Core is excluded from both (same
// convention dashboardInsights.js's computeWorkoutRecommendation already
// established: Core isn't a "day" a user would dedicate a session to the
// way Upper/Lower are), not a new grouping invented for this function.
export function getUpperLowerSplit(workouts, { metric = "volume" } = {}) {
  const { totals } = computeMuscleGroupSplit(workouts, { metric });
  const upper = totals.Push + totals.Pull;
  const lower = totals.Legs;
  const total = upper + lower;

  if (!total) {
    return { available: false, reason: "Not enough logged training yet to compare upper vs. lower body." };
  }

  const sessionCount = buildSessionSummaries(workouts).filter(
    (s) => s.stats.exerciseCount > 0 || s.stats.cardioCount > 0
  ).length;
  const { level: confidence, reason: confidenceReason } = getConfidence(sessionCount, "session");

  return {
    available: true,
    upperPct: Math.round((upper / total) * 100),
    lowerPct: Math.round((lower / total) * 100),
    confidence,
    confidenceReason,
  };
}

// Phase 14B, section 11 — "Strength : Cardio". Session-count based (not
// set/volume-based — a cardio session has no sets) — this is the SAME
// arithmetic pages/dashboard.jsx's own `trainingBalance` already computed
// inline; that call site now calls this instead (see its own diff),
// consolidating a 4th pre-existing duplicate the same way Module 7
// itself consolidated the original 3.
export function getStrengthCardioSplit(workouts) {
  const sessions = buildSessionSummaries(workouts);
  const strengthCount = sessions.filter((s) => s.stats.exerciseCount > 0).length;
  const cardioCount = sessions.filter((s) => s.stats.cardioCount > 0).length;
  const total = strengthCount + cardioCount;

  if (!total) {
    return { available: false, reason: "Log a session to compare strength vs. cardio training." };
  }

  const { level: confidence, reason: confidenceReason } = getConfidence(total, "session");

  return {
    available: true,
    strengthPct: Math.round((strengthCount / total) * 100),
    cardioPct: Math.round((cardioCount / total) * 100),
    confidence,
    confidenceReason,
  };
}

// Phase 14B, section 11 — "Compound : Isolation" is deliberately NOT
// implemented: no exercise anywhere in this app's data model carries a
// compound/isolation classification (confirmed against
// server/models/Exercise.js — an exercise is only {name, muscleGroup,
// isDefault, createdBy}). Inventing a name-matching heuristic
// ("Squat/Deadlift/Bench = compound, everything else = isolation") would
// be fabricated intelligence, which section 13 explicitly rules out.
// A real version of this split needs a schema change (an
// `exercise.category` field) first — flagged as a future recommendation,
// not silently skipped.
