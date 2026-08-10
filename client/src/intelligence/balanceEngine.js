import { computeMuscleBreakdown, buildSessionSummaries } from "../utils/workoutUtils";
import { MUSCLE_SPLIT_CATEGORY } from "../constants/muscles";
import { getConfidence } from "../utils/confidenceUtils";

const CATEGORIES = ["Push", "Pull", "Legs", "Core"];

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

const IMBALANCE_GAP_THRESHOLD = 15;

function computePerMusclePct(breakdown, metric) {
  const total = breakdown.reduce((s, e) => s + (metric === "volume" ? e.volume : e.sets), 0) || 1;
  return breakdown
    .map((e) => ({
      muscle: e.muscle,
      pct: Math.round(((metric === "volume" ? e.volume : e.sets) / total) * 100),
    }))
    .sort((a, b) => b.pct - a.pct);
}

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

