import { getExerciseProgression, buildExerciseSessionSeries } from "../progression/progressionEngine";
import { filterWorkoutsByExercise } from "../progression/progressionFilters";
import { suggestNextTarget } from "../utils/progressionUtils";

export function getOverloadSuggestion(workouts, exerciseName, { rangeKey = "lifetime" } = {}) {
  const progression = getExerciseProgression(workouts, exerciseName, { rangeKey });

  const exerciseWorkouts = filterWorkoutsByExercise(workouts, exerciseName);
  const sessionSeries = buildExerciseSessionSeries(exerciseWorkouts);
  const lastSession = sessionSeries[sessionSeries.length - 1];
  const lastSet = lastSession?.bestSet || null;

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
