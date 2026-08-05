// Phase 14A, Module 4 — Progressive Overload Engine. Suggests exactly
// what to do next workout for a given exercise: a small weight bump when
// the trend genuinely supports it, a rep bump when weight has stalled
// but the lifter is still completing sets cleanly, or "hold steady" when
// there isn't enough real trend data yet. All math lives in
// utils/progressionUtils.js — this file's job is just assembling the
// real inputs (last logged set, trend, session count) from the existing
// progression engine.
import { getExerciseProgression, buildExerciseSessionSeries } from "../progression/progressionEngine";
import { filterWorkoutsByExercise } from "../progression/progressionFilters";
import { suggestNextTarget } from "../utils/progressionUtils";

export function getOverloadSuggestion(workouts, exerciseName, { rangeKey = "lifetime" } = {}) {
  const progression = getExerciseProgression(workouts, exerciseName, { rangeKey });

  // "Last" means the most recently LOGGED set (the spec's own example:
  // "Bench Press — Last: 80 x 8"), not the lifetime-best PR — those can
  // differ if the lifter hasn't set a new record in a while.
  // buildExerciseSessionSeries expects workouts already scoped to one
  // exercise (see its own header comment), hence the filter here.
  const exerciseWorkouts = filterWorkoutsByExercise(workouts, exerciseName);
  const sessionSeries = buildExerciseSessionSeries(exerciseWorkouts);
  const lastSession = sessionSeries[sessionSeries.length - 1];
  const lastSet = lastSession?.bestSet || null;

  // Prefer the estimated-1RM trend (a true strength signal) over plain
  // working-weight when it's available; both come from the same
  // describeTrend computation getExerciseProgression already did.
  const weightTrend = progression.trend.estOneRM || progression.trend.workingWeight;

  const suggestion = suggestNextTarget({
    lastSet,
    weightTrend,
    sessionCount: progression.stats.totalSessions,
  });

  if (!suggestion) {
    return { exercise: exerciseName, available: false, reason: "No sets logged for this exercise yet." };
  }

  return { exercise: exerciseName, available: true, ...suggestion };
}
