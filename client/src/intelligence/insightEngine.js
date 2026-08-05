// Phase 14A, Module 12 — Smart Insights Engine. The composition layer:
// every insight here is either a plain-language wrapper around an
// EXISTING engine's already-computed output (progressionInsights.getInsights,
// recoveryEngine, plateauEngine, deloadEngine, musclePriorityEngine), or
// a small new cross-reference BETWEEN two existing engines (e.g.
// "recovery is limiting X progression" = a muscle that's simultaneously
// Needs-Rest AND plateaued — neither engine knows about the other, this
// is the one place that connects them). No AI, no new raw computation —
// every sentence traces back to a real, already-computed number.
import { getInsights } from "../progression/progressionInsights";
import { getExerciseProgression } from "../progression/progressionEngine";
import { getAvailableExercises } from "../progression/progressionFilters";
import { prHistory } from "../utils/strengthUtils";
import { filterWorkoutsByExercise } from "../progression/progressionFilters";
import { buildExerciseSessionSeries } from "../progression/progressionEngine";
import { getMuscleRecoveryScores } from "./recoveryEngine";
import { getMusclePlateaus } from "./plateauEngine";
import { getDeloadRecommendation } from "./deloadEngine";
import { getMusclePriorities } from "./musclePriorityEngine";

const MIN_BUCKETS_FOR_TREND = 4; // matches plateauEngine.js's own floor
const NEAR_PR_THRESHOLD_PCT = 5;
const MAX_EXERCISES_SCANNED = 25; // bound cost on very large exercise libraries, same cap progressionInsights.js's own scans already use

// "Your {exercise} volume increased X%" — the spec's own example is
// volume-based and per-EXERCISE; progressionInsights.js's existing
// insights are either per-MUSCLE volume or per-exercise 1RM, neither an
// exact match, so this composes the same two already-exported utilities
// (getAvailableExercises + getExerciseProgression) with the one
// different, still-existing field (`trend.volume` instead of
// `trend.estOneRM`) — not a new trend computation.
function findFastestVolumeGrowthExercise(workouts) {
  const exercises = getAvailableExercises(workouts).slice(0, MAX_EXERCISES_SCANNED);
  let best = null;
  exercises.forEach((exercise) => {
    const progression = getExerciseProgression(workouts, exercise);
    if (progression.series.length < MIN_BUCKETS_FOR_TREND) return;
    const trend = progression.trend.volume;
    if (!trend || trend.direction !== "up") return;
    if (!best || trend.changePct > best.changePct) best = { exercise, changePct: trend.changePct };
  });
  return best;
}

// "You are close to a PR" — the last logged session's best set for an
// exercise, compared against that same exercise's current all-time
// record (strengthUtils.prHistory). Only ever surfaces the SINGLE
// closest exercise across the user's history, not one line per exercise
// — avoiding the exact spam problem the Reminder Engine's own grouping
// (Phase 13C) already guards against elsewhere in this app.
function findExerciseCloseToRecord(workouts) {
  const exercises = getAvailableExercises(workouts).slice(0, MAX_EXERCISES_SCANNED);
  const records = prHistory(workouts);
  const recordByExercise = new Map();
  records.forEach((r) => recordByExercise.set(r.exercise, r));

  let closest = null;
  exercises.forEach((exercise) => {
    const record = recordByExercise.get(exercise);
    if (!record) return;
    const exerciseWorkouts = filterWorkoutsByExercise(workouts, exercise);
    const sessionSeries = buildExerciseSessionSeries(exerciseWorkouts);
    const lastSession = sessionSeries[sessionSeries.length - 1];
    if (!lastSession?.bestSet || lastSession.isPR) return; // isPR sessions are already a NEW record, not "close to one"

    const gapPct = ((record.weight - lastSession.bestSet.weight) / record.weight) * 100;
    if (gapPct <= 0 || gapPct > NEAR_PR_THRESHOLD_PCT) return;
    if (!closest || gapPct < closest.gapPct) closest = { exercise, gapPct: Math.round(gapPct * 10) / 10, record };
  });

  return closest;
}

// "Recovery is limiting {muscle} progression" — a real cross-reference
// between Module 1 (recovery) and Module 3 (plateau): a muscle that's
// BOTH showing poor recovery AND plateaued is a much stronger, more
// specific claim than either signal alone. Neither engine knows about
// the other; this is the one place that connects them.
function findRecoveryLimitedMuscle(workouts) {
  const recoveryScores = getMuscleRecoveryScores(workouts);
  const poorRecoveryMuscles = new Set(
    recoveryScores.filter((r) => r.status === "Needs Rest").map((r) => r.muscle)
  );
  if (!poorRecoveryMuscles.size) return null;

  const plateaus = getMusclePlateaus(workouts, [...poorRecoveryMuscles]);
  const plateaued = plateaus.find((p) => p.plateauLevel !== "None");
  return plateaued ? plateaued.muscle : null;
}

// The Module 12 entry point — returns an array of plain-language
// strings, each independently optional (an insight with nothing real to
// say is simply omitted, the same "no fabricated content" rule every
// insight generator in this app already follows).
export function getSmartInsights(workouts) {
  const insights = [];

  const volumeGrowth = findFastestVolumeGrowthExercise(workouts);
  if (volumeGrowth) {
    insights.push(`Your ${volumeGrowth.exercise} volume increased ${volumeGrowth.changePct}%.`);
  }

  const priorities = getMusclePriorities(workouts);
  if (priorities.available && priorities.mostOverdue && priorities.mostOverdue.daysAgo >= 10) {
    insights.push(
      `You haven't trained ${priorities.mostOverdue.muscle} in ${priorities.mostOverdue.daysAgo} days.`
    );
  }

  const recoveryLimited = findRecoveryLimitedMuscle(workouts);
  if (recoveryLimited) {
    insights.push(`Recovery is limiting ${recoveryLimited} progression.`);
  }

  const closeToRecord = findExerciseCloseToRecord(workouts);
  if (closeToRecord) {
    insights.push(`You're close to a ${closeToRecord.exercise} PR — within ${closeToRecord.gapPct}%.`);
  }

  const deload = getDeloadRecommendation(workouts);
  if (deload.recommended) {
    insights.push("Next week would be ideal for a deload.");
  }

  // Composes progressionInsights.js's existing, already-shipped insights
  // wholesale (their own `detail` prose) rather than re-deriving
  // consistency/streak/balance insight text a second time.
  const existing = getInsights(workouts);
  if (existing.available) {
    const streak = existing.insights.find((i) => i.key === "longestStreak" && i.available);
    if (streak) insights.push(streak.detail);

    const imbalance = existing.insights.find((i) => i.key === "trainingImbalance" && i.available);
    if (imbalance && imbalance.balanced === false) insights.push(imbalance.detail);
  }

  return insights;
}
