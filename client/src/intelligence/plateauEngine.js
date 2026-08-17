import { getMuscleProgression, getExerciseProgression, buildExerciseSessionSeries } from "../progression/progressionEngine";
import { filterWorkoutsByExercise } from "../progression/progressionFilters";
import { classifyPlateau, isVolumeMaskedPlateau } from "../utils/trendUtils";
import { getConfidence } from "../utils/confidenceUtils";
import { EVIDENCE_STRENGTH } from "../constants/evidenceSources";

const MIN_BUCKETS_FOR_TREND = 4;

const PLATEAU_DISCLAIMER =
  "Repvyn detection heuristic: flags when a trend has stopped increasing over several recent sessions. A missing PR does not necessarily mean no progress — volume, technique, and proximity-to-failure can still be improving. The specific session-count thresholds used here are a product heuristic, not a scientifically validated plateau definition.";

// Exercise-level (e1RM, per-session) plateau detection. This mirrors
// server/utils/progressionAnalytics.js's detectPlateau() exactly — same
// constants, same period-comparison + volatility logic — so the free and
// premium tiers can no longer disagree about the same exercise's plateau
// state. Keep the two in sync if either changes.
const PLATEAU_COMPARE_WINDOW = 3;
const PLATEAU_RECENT_FREQUENCY_WINDOW_DAYS = 28;
const PLATEAU_MIN_RECENT_SESSIONS = 2;
const PLATEAU_HIGH_CONFIDENCE_SESSIONS = 10;
const PLATEAU_MEDIUM_CONFIDENCE_SESSIONS = 6;
const PLATEAU_FLAT_PCT = 5;
const PLATEAU_VOLATILITY_HIGH_CV = 0.12;
const MS_PER_DAY_PLATEAU = 86400000;

function mean(values) {
  return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
}

function stdDev(values) {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function periodChangeE1RM(recentValues, previousValues) {
  if (!recentValues.length || !previousValues.length) return null;
  const a = mean(previousValues);
  const b = mean(recentValues);
  if (a === 0 && b === 0) return { changePct: 0, direction: "flat" };
  const changePct = a === 0 ? 100 : Math.round(((b - a) / a) * 100);
  const direction = changePct > PLATEAU_FLAT_PCT ? "up" : changePct < -PLATEAU_FLAT_PCT ? "down" : "flat";
  return { changePct, direction };
}

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
        evidenceStrength: EVIDENCE_STRENGTH.LIMITED,
        evidenceDisclaimer: PLATEAU_DISCLAIMER,
      };
    });
}

export function getExercisePlateau(workouts, exerciseName, { rangeKey = "lifetime", now = new Date() } = {}) {
  const progression = getExerciseProgression(workouts, exerciseName, { rangeKey });
  const volumeTrend = progression.trend.volume;

  const exerciseWorkouts = filterWorkoutsByExercise(workouts, exerciseName);
  const series = buildExerciseSessionSeries(exerciseWorkouts).sort((a, b) => a.sortDate - b.sortDate);
  const sessionCount = series.length;

  if (sessionCount < PLATEAU_MEDIUM_CONFIDENCE_SESSIONS) {
    return {
      exercise: exerciseName,
      plateauLevel: "None",
      sessionCount,
      oneRMTrend: null,
      volumeTrend,
      maskedByVolume: false,
      confidence: "Low",
      confidenceReason: `Only ${sessionCount} session${sessionCount === 1 ? "" : "s"} logged`,
      evidenceStrength: EVIDENCE_STRENGTH.LIMITED,
      evidenceDisclaimer: PLATEAU_DISCLAIMER,
    };
  }

  const recentCutoff = new Date(now.getTime() - PLATEAU_RECENT_FREQUENCY_WINDOW_DAYS * MS_PER_DAY_PLATEAU);
  const recentSessions = series.filter((p) => p.sortDate >= recentCutoff);
  if (recentSessions.length < PLATEAU_MIN_RECENT_SESSIONS) {
    const { level: confidence } = getConfidence(sessionCount, "session");
    return {
      exercise: exerciseName,
      plateauLevel: "None",
      sessionCount,
      oneRMTrend: null,
      volumeTrend,
      maskedByVolume: false,
      confidence,
      confidenceReason: `${exerciseName} hasn't been trained enough in the last ${PLATEAU_RECENT_FREQUENCY_WINDOW_DAYS} days to evaluate a current plateau`,
      evidenceStrength: EVIDENCE_STRENGTH.LIMITED,
      evidenceDisclaimer: PLATEAU_DISCLAIMER,
    };
  }

  const compareN = Math.min(PLATEAU_COMPARE_WINDOW, Math.floor(sessionCount / 2));
  const recent = series.slice(-compareN).map((p) => p.estOneRM);
  const previous = series.slice(-compareN * 2, -compareN).map((p) => p.estOneRM);
  const oneRMTrend = periodChangeE1RM(recent, previous);

  const volatilitySample = series.slice(-Math.max(compareN * 2, 4)).map((p) => p.estOneRM);
  const volatilityMean = mean(volatilitySample);
  const coefficientOfVariation = volatilityMean > 0 ? stdDev(volatilitySample) / volatilityMean : 0;
  const highVolatility = coefficientOfVariation > PLATEAU_VOLATILITY_HIGH_CV;

  let plateauLevel = "None";
  if (oneRMTrend && oneRMTrend.direction !== "up") {
    plateauLevel = sessionCount >= PLATEAU_HIGH_CONFIDENCE_SESSIONS ? "Confirmed" : "Possible";
    if (highVolatility) plateauLevel = "Possible";
  }

  const { level: confidence, reason: confidenceReason } = getConfidence(sessionCount, "session");

  return {
    exercise: exerciseName,
    plateauLevel,
    sessionCount,
    oneRMTrend,
    volumeTrend,
    maskedByVolume: isVolumeMaskedPlateau(oneRMTrend, volumeTrend),
    volatility: { coefficientOfVariation: Math.round(coefficientOfVariation * 1000) / 1000, high: highVolatility },
    confidence,
    confidenceReason,
    evidenceStrength: EVIDENCE_STRENGTH.LIMITED,
    evidenceDisclaimer: PLATEAU_DISCLAIMER,
  };
}

export function getAllExercisePlateaus(workouts, exercises, { rangeKey = "lifetime" } = {}) {
  return exercises
    .map((name) => getExercisePlateau(workouts, name, { rangeKey }))
    .filter((p) => p.plateauLevel !== "None");
}
