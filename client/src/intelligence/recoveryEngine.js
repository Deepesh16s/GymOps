import { computeMuscleBreakdown, isCardioEntry, computeCurrentStreak } from "../utils/workoutUtils";
import { calculateRelativeIntensity, bestSet, estimate1RM } from "../utils/strengthUtils";
import {
  computeRecoveryWindowHours,
  computeRecoveryScore,
  hoursUntilRecovered as computeHoursUntilRecovered,
  recoveryScoreToStatus,
} from "../utils/recoveryUtils";
import { MUSCLE_SPLIT_CATEGORY } from "../constants/muscles";
import { getConfidence } from "../utils/confidenceUtils";

const MS_PER_HOUR = 3600000;
const MS_PER_WEEK = 7 * 24 * MS_PER_HOUR;
const RECENT_WINDOW_DAYS = 7;
const RECENT_WINDOW_HOURS = RECENT_WINDOW_DAYS * 24;

function hoursSince(date) {
  return (Date.now() - new Date(date).getTime()) / MS_PER_HOUR;
}

function countOverlappingMusclesTrainedRecently(muscle, breakdown) {
  const category = MUSCLE_SPLIT_CATEGORY[muscle];
  if (!category) return 0;
  return breakdown.filter(
    (entry) =>
      entry.muscle !== muscle &&
      entry.lastTrained &&
      MUSCLE_SPLIT_CATEGORY[entry.muscle] === category &&
      hoursSince(entry.lastTrained) <= RECENT_WINDOW_HOURS
  ).length;
}

function getLastSessionSets(muscle, workouts, lastTrained) {
  if (!lastTrained) return [];
  const lastTrainedKey = new Date(lastTrained).toDateString();
  return workouts
    .filter(
      (w) =>
        !isCardioEntry(w) &&
        w.exercise?.muscleGroup === muscle &&
        new Date(w.date || w.createdAt).toDateString() === lastTrainedKey
    )
    .flatMap((w) => w.workoutSets || []);
}

function computeAvgIntensity(sets) {
  if (!sets.length) return null;
  const best = bestSet(sets);
  const oneRM = best ? estimate1RM(best.weight, best.reps) : 0;
  if (!oneRM) return null;
  const intensities = sets
    .map((s) => calculateRelativeIntensity(s.weight, oneRM))
    .filter((v) => v != null);
  if (!intensities.length) return null;
  return intensities.reduce((s, v) => s + v, 0) / intensities.length;
}

function computeCardioFatigueRatio(workouts) {
  const recentDays = new Set();
  const recentCardioDays = new Set();

  workouts.forEach((w) => {
    if (hoursSince(w.date || w.createdAt) > RECENT_WINDOW_HOURS) return;
    const dayKey = new Date(w.date || w.createdAt).toDateString();
    recentDays.add(dayKey);
    if (isCardioEntry(w)) recentCardioDays.add(dayKey);
  });

  if (!recentDays.size) return 0;
  return recentCardioDays.size / recentDays.size;
}

function buildExplanation({ daysAgo, volume, overlapping, consecutiveDays, cardioRatio }) {
  const lines = [];
  lines.push(daysAgo === 0 ? "Trained today" : `Last trained ${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`);
  if (volume > 0) lines.push(`${Math.round(volume).toLocaleString()} kg logged last session`);
  if (overlapping > 0) {
    lines.push(`${overlapping} related muscle${overlapping === 1 ? "" : "s"} trained recently too`);
  }
  if (consecutiveDays >= 3) lines.push(`${consecutiveDays}-day training streak adding fatigue`);
  if (cardioRatio >= 0.4) lines.push("Recent cardio load is adding to overall fatigue");
  return lines;
}

export function getMuscleRecoveryScores(workouts) {
  const breakdown = computeMuscleBreakdown(workouts);
  const consecutiveTrainingDays = computeCurrentStreak(workouts);
  const cardioFatigueRatio = computeCardioFatigueRatio(workouts);

  return breakdown
    .filter((entry) => entry.lastTrained)
    .map((entry) => {
      const sessionSets = getLastSessionSets(entry.muscle, workouts, entry.lastTrained);
      const avgIntensity = computeAvgIntensity(sessionSets);
      const overlapping = countOverlappingMusclesTrainedRecently(entry.muscle, breakdown);
      const hoursSinceTrained = hoursSince(entry.lastTrained);

      const recoveryWindowHours = computeRecoveryWindowHours({
        volume: entry.volume,
        avgIntensity,
        overlappingMusclesTrainedRecently: overlapping,
        consecutiveTrainingDays,
        cardioFatigueRatio,
      });

      const recoveryScore = computeRecoveryScore(hoursSinceTrained, recoveryWindowHours);
      const weeksOfHistory = entry.firstTrained
        ? Math.max(1, Math.round((Date.now() - entry.firstTrained.getTime()) / MS_PER_WEEK))
        : null;
      const { level: confidence, reason: confidenceReason } = getConfidence(entry.sessionCount, "workout", {
        entity: entry.muscle,
        weeks: weeksOfHistory,
      });

      return {
        muscle: entry.muscle,
        recoveryScore,
        status: recoveryScoreToStatus(recoveryScore),
        hoursUntilRecovered: computeHoursUntilRecovered(hoursSinceTrained, recoveryWindowHours),
        confidence,
        confidenceReason,
        explanation: buildExplanation({
          daysAgo: Math.floor(hoursSinceTrained / 24),
          volume: entry.volume,
          overlapping,
          consecutiveDays: consecutiveTrainingDays,
          cardioRatio: cardioFatigueRatio,
        }),
      };
    })
    .sort((a, b) => a.recoveryScore - b.recoveryScore);
}
