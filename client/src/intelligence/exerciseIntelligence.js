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

  const exerciseWorkouts = filterWorkoutsByExercise(workouts, exerciseName);
  const sessions = buildSessionSummaries(exerciseWorkouts).filter((s) => s.stats.exerciseCount > 0);
  const consistency = getConsistency(sessions, stats.firstLoggedDate, stats.lastLoggedDate);
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
    averageRest: null,
    averageRestAvailable: false,
  };
}
