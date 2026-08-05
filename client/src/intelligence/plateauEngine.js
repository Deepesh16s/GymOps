// Phase 14A, Module 3 — Plateau Detection. pages/Analytics.jsx already
// had an inline "Plateau Detection" panel (muscle-volume trend via
// progression/progressionEngine.js's getMuscleProgression, flagged
// whenever the trend direction wasn't "up") — this file extracts that
// EXACT algorithm into a reusable engine (so it's no longer locked
// inside one page component) and extends it with what didn't exist
// before: exercise-level plateau detection using estimated-1RM (not
// just volume), a None/Possible/Confirmed severity level, and the
// spec's own "Volume increasing / Weight stagnant" masked-plateau case.
import { getMuscleProgression, getExerciseProgression } from "../progression/progressionEngine";
import { classifyPlateau, isVolumeMaskedPlateau } from "../utils/trendUtils";
import { getConfidence } from "../utils/confidenceUtils";

// Matches Analytics.jsx's pre-existing MIN_BUCKETS_FOR_TREND exactly —
// same bar for "enough history to trust a trend at all", reused rather
// than a second, different threshold.
const MIN_BUCKETS_FOR_TREND = 4;

// Muscle-level plateau detection — byte-for-byte the same check
// Analytics.jsx's own `plateauedMuscles` used to compute inline; see
// that file's diff for how it now calls this instead.
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
      // Standardized confidence — how many trained WEEKLY buckets the
      // trend itself rests on (series.length, the same figure already
      // used to classify the plateau's own severity above) — "week" is
      // the accurate unit here, not "session": getMuscleProgression
      // buckets by week, it doesn't return one point per raw session.
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

// Exercise-level plateau detection — genuinely new (no pre-existing
// version). Uses the estimated-1RM trend as the PRIMARY signal (a real
// strength plateau, not just a volume one), with the spec's own
// "Lat Pulldown — Volume increasing / Weight stagnant" case surfaced
// separately via `maskedByVolume` — a real plateau that a volume-only
// check would otherwise miss because sets/reps are still climbing.
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

// Scans every given exercise, returns only the ones with a real plateau
// (Possible or Confirmed) — the per-exercise sibling of
// getMusclePlateaus above.
export function getAllExercisePlateaus(workouts, exercises, { rangeKey = "lifetime" } = {}) {
  return exercises
    .map((name) => getExercisePlateau(workouts, name, { rangeKey }))
    .filter((p) => p.plateauLevel !== "None");
}
