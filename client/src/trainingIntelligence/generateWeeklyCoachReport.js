import { buildProgressionSeries, compareRecentPeriods } from "../progression/progressionEngine";
import { MUSCLE_SPLIT_CATEGORY } from "../constants/muscles";
import { getWeeklyGrade, getMusclePriorities } from "../intelligence";
import { getWorkoutVolume, isCardioEntry, groupWorkoutsIntoSessions } from "../utils/workoutUtils";
import { prHistory } from "../utils/strengthUtils";

const MS_PER_DAY = 86400000;

function weekWorkouts(workouts) {
  const weekAgo = Date.now() - 7 * MS_PER_DAY;
  return workouts.filter((w) => new Date(w.date || w.createdAt).getTime() >= weekAgo);
}

function computeWeekConsistency(workouts) {
  const trainedDays = new Set(weekWorkouts(workouts).map((w) => new Date(w.date || w.createdAt).toDateString()));
  return { trained: trainedDays.size, total: 7 };
}

function computeWeekTotalVolume(workouts) {
  return Math.round(
    weekWorkouts(workouts)
      .filter((w) => !isCardioEntry(w))
      .reduce((sum, w) => sum + getWorkoutVolume(w), 0)
  );
}

function computeWeekSessionCount(workouts) {
  return groupWorkoutsIntoSessions(weekWorkouts(workouts)).length;
}

function computeWeekPrCount(workouts) {
  const weekAgo = Date.now() - 7 * MS_PER_DAY;
  return prHistory(workouts).filter((e) => new Date(e.date).getTime() >= weekAgo).length;
}

export function generateWeeklyCoachReport(workouts) {
  const { grade, score, confidence: gradeConfidence, confidenceReason: gradeConfidenceReason } =
    getWeeklyGrade(workouts);
  const consistency = computeWeekConsistency(workouts);
  const totalVolume = computeWeekTotalVolume(workouts);
  const sessionCount = computeWeekSessionCount(workouts);
  const prCount = computeWeekPrCount(workouts);

  const weeklySeries = buildProgressionSeries(workouts, { granularity: "week" });
  const volumeTrend = compareRecentPeriods(weeklySeries, "volume", 1);

  const priorities = getMusclePriorities(workouts);
  const mostImproved = priorities.available ? priorities.fastestGrowing?.muscle || null : null;
  const needsAttention = priorities.available ? priorities.mostOverdue?.muscle || null : null;
  const suggestedFocus =
    priorities.available && priorities.mostOverdue
      ? `${MUSCLE_SPLIT_CATEGORY[priorities.mostOverdue.muscle] || priorities.mostOverdue.muscle} Day`
      : null;

  return {
    available: grade != null,
    grade,
    score,
    gradeConfidence,
    gradeConfidenceReason,
    consistency,
    totalVolume,
    sessionCount,
    prCount,
    volumeChangePct: volumeTrend?.changePct ?? null,
    mostImproved,
    needsAttention,
    suggestedFocus,
  };
}
