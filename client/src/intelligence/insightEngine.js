import { getInsights } from "../progression/progressionInsights";
import { getExerciseProgression } from "../progression/progressionEngine";
import { getAvailableExercises } from "../progression/progressionFilters";
import { prHistory } from "../utils/strengthUtils";
import { filterWorkoutsByExercise } from "../progression/progressionFilters";
import { buildExerciseSessionSeries } from "../progression/progressionEngine";
import { getDeloadRecommendation } from "./deloadEngine";
import { getMusclePriorities } from "./musclePriorityEngine";

const MIN_BUCKETS_FOR_TREND = 4;
const NEAR_PR_THRESHOLD_PCT = 5;
const MAX_EXERCISES_SCANNED = 25;

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
    if (!lastSession?.bestSet || lastSession.isPR) return;

    const gapPct = ((record.weight - lastSession.bestSet.weight) / record.weight) * 100;
    if (gapPct <= 0 || gapPct > NEAR_PR_THRESHOLD_PCT) return;
    if (!closest || gapPct < closest.gapPct) closest = { exercise, gapPct: Math.round(gapPct * 10) / 10, record };
  });

  return closest;
}

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

  const closeToRecord = findExerciseCloseToRecord(workouts);
  if (closeToRecord) {
    insights.push(`You're close to a ${closeToRecord.exercise} PR — within ${closeToRecord.gapPct}%.`);
  }

  const deload = getDeloadRecommendation(workouts);
  if (deload.recommended) {
    insights.push("Next week would be ideal for a deload.");
  }

  const existing = getInsights(workouts);
  if (existing.available) {
    const streak = existing.insights.find((i) => i.key === "longestStreak" && i.available);
    if (streak) insights.push(streak.detail);

    const imbalance = existing.insights.find((i) => i.key === "trainingImbalance" && i.available);
    if (imbalance && imbalance.balanced === false) insights.push(imbalance.detail);
  }

  return insights;
}
