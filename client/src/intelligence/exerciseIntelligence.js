// Phase 14A, Module 9 — Exercise Intelligence. Per-exercise insight card:
// trend, consistency, best set, total sessions — all read straight off
// progression/progressionEngine.js's getExerciseProgression, not
// re-derived.
import { getExerciseProgression, getConsistency } from "../progression/progressionEngine";
import { filterWorkoutsByExercise } from "../progression/progressionFilters";
import { buildSessionSummaries } from "../utils/workoutUtils";
import { getConfidence } from "../utils/confidenceUtils";

const MS_PER_WEEK = 7 * 24 * 3600000;

function describeTrendLabel(trend) {
  if (!trend) return null;
  if (trend.direction === "up") return "Improving";
  if (trend.direction === "down") return "Declining";
  return "Steady";
}

export function getExerciseInsights(workouts, exerciseName, { rangeKey = "lifetime" } = {}) {
  const progression = getExerciseProgression(workouts, exerciseName, { rangeKey });
  const { stats, trend } = progression;

  if (!stats.totalSessions) {
    return { exercise: exerciseName, available: false, reason: "No sets logged for this exercise yet." };
  }

  // getExerciseProgression doesn't expose its internal sessions array
  // directly — getConsistency needs one, so this rebuilds it via the
  // same two already-exported utilities (filterWorkoutsByExercise +
  // buildSessionSummaries) rather than modifying that function's return
  // shape for one extra consumer.
  const exerciseWorkouts = filterWorkoutsByExercise(workouts, exerciseName);
  const sessions = buildSessionSummaries(exerciseWorkouts).filter((s) => s.stats.exerciseCount > 0);
  const consistency = getConsistency(sessions, stats.firstLoggedDate, stats.lastLoggedDate);
  // Real span from this exercise's first logged set to now — turns the
  // confidence reason into "Based on 8 logged Bench Press sessions over
  // the last 6 weeks" instead of a bare "8 sessions analyzed".
  const weeksOfHistory = stats.firstLoggedDate
    ? Math.max(1, Math.round((Date.now() - new Date(stats.firstLoggedDate).getTime()) / MS_PER_WEEK))
    : null;
  const { level: confidence, reason: confidenceReason } = getConfidence(stats.totalSessions, "session", {
    entity: exerciseName,
    weeks: weeksOfHistory,
  });

  return {
    exercise: exerciseName,
    available: true,
    trend: describeTrendLabel(trend.estOneRM || trend.workingWeight),
    consistency: consistency?.percent ?? null,
    bestSet: stats.bestSet ? { weight: stats.bestSet.weight, reps: stats.bestSet.reps } : null,
    totalSessions: stats.totalSessions,
    confidence,
    confidenceReason,
    // "Average Rest" has no real data behind it anywhere in this app —
    // no per-set timestamp is ever recorded (confirmed against
    // server/models/workout.js: a set is only {weight, reps}). Returning
    // a number here would be fabricated, which this app's own
    // conventions explicitly guard against (see strengthUtils.js's
    // mandatory "Estimated" labeling for estimate1RM). Omitted, not
    // guessed — a future phase could add real per-set timestamps to the
    // schema if this stat is wanted for real.
    averageRest: null,
    averageRestAvailable: false,
  };
}
