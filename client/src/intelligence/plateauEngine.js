import { getMuscleProgression, getExerciseProgression } from "../progression/progressionEngine";
import { classifyPlateau, isVolumeMaskedPlateau } from "../utils/trendUtils";
import { getConfidence } from "../utils/confidenceUtils";

const MIN_BUCKETS_FOR_TREND = 4;

export function getMusclePlateaus(workouts, muscles, { rangeKey = "lifetime" } = {}) {
  return muscles
    .map((muscle) => ({ muscle, progression: getMuscleProgression(workouts, muscle, { rangeKey }) }))
    .filter(
      ({ progression }) =>
        progression.series.length >= MIN_BUCKETS_FOR_TREND &&
        progression.trend.volume &&
        progression.trend.volume.direction !== "up"
    )
    .map(({ muscle, progression }) => {
      const { level: confidence, reason: confidenceReason } = getConfidence(progression.series.length, "week");
      return {
        muscle,
        trend: progression.trend.volume,
        plateauLevel: classifyPlateau(progression.trend.volume, progression.series.length),
        confidence,
        confidenceReason,
      };
    });
}

export function getExercisePlateau(workouts, exerciseName, { rangeKey = "lifetime" } = {}) {
  const progression = getExerciseProgression(workouts, exerciseName, { rangeKey });
  const sessionCount = progression.stats.totalSessions;
  const oneRMTrend = progression.trend.estOneRM;
  const volumeTrend = progression.trend.volume;
  const { level: confidence, reason: confidenceReason } = getConfidence(sessionCount, "session");

  return {
    exercise: exerciseName,
    plateauLevel: classifyPlateau(oneRMTrend, sessionCount),
    sessionCount,
    oneRMTrend,
    volumeTrend,
    maskedByVolume: isVolumeMaskedPlateau(oneRMTrend, volumeTrend),
    confidence,
    confidenceReason,
  };
}

export function getAllExercisePlateaus(workouts, exercises, { rangeKey = "lifetime" } = {}) {
  return exercises
    .map((name) => getExercisePlateau(workouts, name, { rangeKey }))
    .filter((p) => p.plateauLevel !== "None");
}
