const { estimate1RM, bestSet } = require("./strengthMetrics");
const { groupWorkoutsIntoSessions, isCardioEntry, startOfWeek } = require("./workoutSessions");
const { MUSCLES } = require("../constants/muscles");

const DAY_MS = 86400000;
const WEEK_MS = 7 * DAY_MS;

const TOP_EXERCISES_LIMIT = 6;

const PLATEAU_MIN_TOTAL_SESSIONS = 6;
const PLATEAU_COMPARE_WINDOW = 3;
const PLATEAU_RECENT_FREQUENCY_WINDOW_DAYS = 28;
const PLATEAU_MIN_RECENT_SESSIONS = 2;
const PLATEAU_HIGH_CONFIDENCE_SESSIONS = 10;
const PLATEAU_MEDIUM_CONFIDENCE_SESSIONS = 6;
// Kept in sync with client/src/intelligence/plateauEngine.js's PLATEAU_FLAT_PCT.
// 5%, not 3% — 1RM test-retest reliability research reports a median CV around
// 4.2% (range 0.5-12.1%), so a 3% flat-band risked classifying pure measurement
// noise as a declining trend.
const PLATEAU_FLAT_PCT = 5;
const PLATEAU_VOLATILITY_HIGH_CV = 0.12;

const STRENGTH_TREND_MIN_SESSIONS = 4;
const STRENGTH_TREND_COMPARE_WINDOW = 3;
const STALE_LAST_SESSION_DAYS = 90;

const COMPARISON_WINDOWS_DAYS = [30, 60, 90];
const COMPARISON_MIN_SESSIONS = 3;

const VOLUME_MIN_TRAINED_WEEKS = 4;
const VOLUME_RECENT_WEEKS = 4;
const VOLUME_MUSCLE_MIN_WEEKS = 3;
const VOLUME_HIGH_RATIO = 1.5;
const VOLUME_LOW_RATIO = 0.5;

const MUSCLE_BALANCE_MIN_SESSIONS = 6;
const MUSCLE_BALANCE_MIN_MUSCLES = 2;
const MUSCLE_BALANCE_RECENT_WINDOW_DAYS = 28;
const MUSCLE_BALANCE_IMBALANCE_GAP_PCT = 40;

function mean(values) {
  return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
}

function stdDev(values) {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function periodChange(recentValues, previousValues, flatPct = PLATEAU_FLAT_PCT) {
  if (!recentValues.length || !previousValues.length) return null;
  const a = mean(previousValues);
  const b = mean(recentValues);
  if (a === 0 && b === 0) return { changePct: 0, direction: "flat" };
  const changePct = a === 0 ? 100 : Math.round(((b - a) / a) * 100);
  const direction = changePct > flatPct ? "up" : changePct < -flatPct ? "down" : "flat";
  return { changePct, direction };
}

function confidenceFromSampleSize(sampleSize, highThreshold, mediumThreshold) {
  if (sampleSize >= highThreshold) return "high";
  if (sampleSize >= mediumThreshold) return "medium";
  return "low";
}

function entryDate(workout) {
  return new Date(workout.date || workout.createdAt);
}

function buildExerciseSeries(strengthWorkouts, exerciseName) {
  const filtered = strengthWorkouts.filter((w) => w.exercise?.name === exerciseName);
  const sessions = groupWorkoutsIntoSessions(filtered).sort((a, b) => new Date(a.date) - new Date(b.date));

  return sessions
    .map((session) => {
      const sets = session.workouts.flatMap((w) => w.workoutSets || []);
      const best = bestSet(sets);
      if (!best) return null;
      return {
        date: session.date,
        e1RM: estimate1RM(best.weight, best.reps),
        bestWeight: best.weight,
        bestReps: best.reps,
        volume: sets.reduce((sum, s) => sum + s.reps * s.weight, 0),
      };
    })
    .filter(Boolean);
}

function valueAsOf(series, cutoffDate, key) {
  const eligible = series.filter((p) => new Date(p.date) <= cutoffDate);
  if (!eligible.length) return null;
  return eligible[eligible.length - 1][key];
}

function pctChange(from, to) {
  if (from == null || to == null) return null;
  if (from === 0) return to === 0 ? 0 : null;
  return Math.round(((to - from) / from) * 100);
}

function getTopExercises(strengthWorkouts, limit = TOP_EXERCISES_LIMIT) {
  const sessionCounts = new Map();
  groupWorkoutsIntoSessions(strengthWorkouts).forEach((session) => {
    const names = new Set(session.workouts.map((w) => w.exercise?.name).filter(Boolean));
    names.forEach((name) => sessionCounts.set(name, (sessionCounts.get(name) || 0) + 1));
  });

  return [...sessionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([exercise]) => exercise);
}

function detectPlateau(series, exerciseName, now) {
  if (series.length < PLATEAU_MIN_TOTAL_SESSIONS) {
    return {
      exercise: exerciseName,
      status: "insufficient_data",
      sessionCount: series.length,
      message: `Log at least ${PLATEAU_MIN_TOTAL_SESSIONS} sessions of ${exerciseName} to evaluate a plateau (${series.length} so far).`,
    };
  }

  const recentCutoff = new Date(now.getTime() - PLATEAU_RECENT_FREQUENCY_WINDOW_DAYS * DAY_MS);
  const recentSessions = series.filter((p) => new Date(p.date) >= recentCutoff);
  const recentFrequencyPerWeek = recentSessions.length / (PLATEAU_RECENT_FREQUENCY_WINDOW_DAYS / 7);

  if (recentSessions.length < PLATEAU_MIN_RECENT_SESSIONS) {
    return {
      exercise: exerciseName,
      status: "insufficient_recent_data",
      sessionCount: series.length,
      recentSessionCount: recentSessions.length,
      recentFrequencyPerWeek: Math.round(recentFrequencyPerWeek * 10) / 10,
      message: `${exerciseName} hasn't been trained enough in the last ${PLATEAU_RECENT_FREQUENCY_WINDOW_DAYS} days to evaluate a current plateau.`,
    };
  }

  const compareN = Math.min(PLATEAU_COMPARE_WINDOW, Math.floor(series.length / 2));
  const recent = series.slice(-compareN).map((p) => p.e1RM);
  const previous = series.slice(-compareN * 2, -compareN).map((p) => p.e1RM);
  const trend = periodChange(recent, previous);

  const volatilitySample = series.slice(-Math.max(compareN * 2, 4)).map((p) => p.e1RM);
  const volatilityMean = mean(volatilitySample);
  const coefficientOfVariation = volatilityMean > 0 ? stdDev(volatilitySample) / volatilityMean : 0;
  const highVolatility = coefficientOfVariation > PLATEAU_VOLATILITY_HIGH_CV;

  const confidence = confidenceFromSampleSize(
    series.length,
    PLATEAU_HIGH_CONFIDENCE_SESSIONS,
    PLATEAU_MEDIUM_CONFIDENCE_SESSIONS
  );

  let status = "none";
  if (trend && trend.direction !== "up") {
    status = series.length >= PLATEAU_HIGH_CONFIDENCE_SESSIONS ? "confirmed" : "possible";
    if (highVolatility) status = "possible";
  }

  return {
    exercise: exerciseName,
    status,
    sessionCount: series.length,
    recentSessionCount: recentSessions.length,
    recentFrequencyPerWeek: Math.round(recentFrequencyPerWeek * 10) / 10,
    trend,
    volatility: {
      coefficientOfVariation: Math.round(coefficientOfVariation * 1000) / 1000,
      high: highVolatility,
    },
    confidence,
    evidenceStrength: "LIMITED",
    evidenceDisclaimer:
      "Repvyn detection heuristic based on e1RM trend, volatility, and recent training frequency — the specific session-count thresholds are a product heuristic, not a scientifically validated plateau definition. A flat or declining e1RM trend does not necessarily mean no progress; volume and technique can still be improving.",
  };
}

function computeStrengthTrend(series, exerciseName, now) {
  if (series.length < STRENGTH_TREND_MIN_SESSIONS) {
    return {
      exercise: exerciseName,
      status: "insufficient_data",
      sessionCount: series.length,
      message: `Log at least ${STRENGTH_TREND_MIN_SESSIONS} sessions of ${exerciseName} to see an estimated-1RM trend (${series.length} so far).`,
    };
  }

  const compareN = Math.min(STRENGTH_TREND_COMPARE_WINDOW, Math.floor(series.length / 2));
  const recent = series.slice(-compareN);
  const previous = series.slice(-compareN * 2, -compareN);
  const lastSession = recent[recent.length - 1];
  const currentE1RM = lastSession.e1RM;
  const trend = periodChange(
    recent.map((p) => p.e1RM),
    previous.map((p) => p.e1RM)
  );

  let best = series[0];
  series.forEach((p) => {
    if (p.e1RM > best.e1RM) best = p;
  });

  const daysSinceLastSession = Math.floor((now.getTime() - new Date(lastSession.date).getTime()) / DAY_MS);

  return {
    exercise: exerciseName,
    status: "ok",
    sessionCount: series.length,
    currentE1RM,
    lastSessionDate: lastSession.date,
    stale: daysSinceLastSession > STALE_LAST_SESSION_DAYS,
    previousPeriodE1RM: previous.length ? Math.round(mean(previous.map((p) => p.e1RM))) : null,
    trend,
    bestHistoricalE1RM: best.e1RM,
    bestHistoricalDate: best.date,
  };
}

function computeExerciseComparison(series, exerciseName, now) {
  if (series.length < COMPARISON_MIN_SESSIONS) {
    return {
      exercise: exerciseName,
      status: "insufficient_data",
      sessionCount: series.length,
      message: `Log at least ${COMPARISON_MIN_SESSIONS} sessions of ${exerciseName} to compare periods (${series.length} so far).`,
    };
  }

  const current = series[series.length - 1];
  const daysSinceLastSession = Math.floor((now.getTime() - new Date(current.date).getTime()) / DAY_MS);
  const windows = COMPARISON_WINDOWS_DAYS.map((days) => {
    const cutoff = new Date(now.getTime() - days * DAY_MS);
    const refE1RM = valueAsOf(series, cutoff, "e1RM");
    const refWeight = valueAsOf(series, cutoff, "bestWeight");
    const refVolume = valueAsOf(series, cutoff, "volume");

    if (refE1RM == null) {
      return { days, available: false };
    }

    return {
      days,
      available: true,
      e1RMChangePct: pctChange(refE1RM, current.e1RM),
      bestSetChangeKg: Math.round((current.bestWeight - refWeight) * 10) / 10,
      volumeChangePct: pctChange(refVolume, current.volume),
    };
  });

  return {
    exercise: exerciseName,
    status: "ok",
    sessionCount: series.length,
    currentE1RM: current.e1RM,
    lastSessionDate: current.date,
    stale: daysSinceLastSession > STALE_LAST_SESSION_DAYS,
    windows,
  };
}

function bucketByWeek(strengthWorkouts) {
  const weeks = new Map();
  strengthWorkouts.forEach((w) => {
    const key = startOfWeek(entryDate(w)).getTime();
    const volume = (w.workoutSets || []).reduce((sum, s) => sum + s.reps * s.weight, 0);
    weeks.set(key, (weeks.get(key) || 0) + volume);
  });
  return [...weeks.entries()]
    .map(([weekStart, volume]) => ({ weekStart: new Date(weekStart), volume: Math.round(volume) }))
    .sort((a, b) => a.weekStart - b.weekStart);
}

function computeVolumeLandmarks(strengthWorkouts, now) {
  const weeks = bucketByWeek(strengthWorkouts);
  if (weeks.length < VOLUME_MIN_TRAINED_WEEKS) {
    return {
      status: "insufficient_data",
      trainedWeekCount: weeks.length,
      message: `Log training across at least ${VOLUME_MIN_TRAINED_WEEKS} distinct weeks to see volume trends (${weeks.length} so far).`,
      muscles: [],
    };
  }

  const recentCutoff = new Date(now.getTime() - VOLUME_RECENT_WEEKS * WEEK_MS);
  const recentWeeks = weeks.filter((w) => w.weekStart >= recentCutoff);
  const baselineWeeks = weeks.filter((w) => w.weekStart < recentCutoff);

  const averageWeeklyVolume = Math.round(mean(weeks.map((w) => w.volume)));
  const recentAvgVolume = recentWeeks.length ? Math.round(mean(recentWeeks.map((w) => w.volume))) : null;
  const baselineAvgVolume = baselineWeeks.length ? Math.round(mean(baselineWeeks.map((w) => w.volume))) : null;

  const trend =
    recentWeeks.length && baselineWeeks.length
      ? periodChange(
          recentWeeks.map((w) => w.volume),
          baselineWeeks.map((w) => w.volume)
        )
      : null;

  let flag = "normal";
  if (baselineAvgVolume && recentAvgVolume != null) {
    const ratio = baselineAvgVolume === 0 ? null : recentAvgVolume / baselineAvgVolume;
    if (ratio != null) {
      if (ratio >= VOLUME_HIGH_RATIO) flag = "unusually_high";
      else if (ratio <= VOLUME_LOW_RATIO) flag = "unusually_low";
    }
  }

  const muscles = MUSCLES.map((muscle) => {
    const muscleWorkouts = strengthWorkouts.filter((w) => w.exercise?.muscleGroup === muscle);
    const muscleWeeks = bucketByWeek(muscleWorkouts);
    if (muscleWeeks.length < VOLUME_MUSCLE_MIN_WEEKS) return null;

    const muscleRecent = muscleWeeks.filter((w) => w.weekStart >= recentCutoff);
    const muscleBaseline = muscleWeeks.filter((w) => w.weekStart < recentCutoff);
    const muscleTrend =
      muscleRecent.length && muscleBaseline.length
        ? periodChange(
            muscleRecent.map((w) => w.volume),
            muscleBaseline.map((w) => w.volume)
          )
        : null;

    return {
      muscle,
      trainedWeekCount: muscleWeeks.length,
      averageWeeklyVolume: Math.round(mean(muscleWeeks.map((w) => w.volume))),
      trend: muscleTrend,
    };
  }).filter(Boolean);

  return {
    status: "ok",
    trainedWeekCount: weeks.length,
    averageWeeklyVolume,
    recentAvgVolume,
    baselineAvgVolume,
    trend,
    flag,
    muscles,
    evaluatedMuscleCount: muscles.length,
  };
}

function computeMuscleBalance(strengthWorkouts, now) {
  const recentCutoff = new Date(now.getTime() - MUSCLE_BALANCE_RECENT_WINDOW_DAYS * DAY_MS);

  const volumeByMuscle = (workouts) => {
    const totals = new Map();
    workouts.forEach((w) => {
      const muscle = w.exercise?.muscleGroup;
      if (!muscle) return;
      const volume = (w.workoutSets || []).reduce((sum, s) => sum + s.reps * s.weight, 0);
      totals.set(muscle, (totals.get(muscle) || 0) + volume);
    });
    return totals;
  };

  const totalSessionCount = groupWorkoutsIntoSessions(strengthWorkouts).length;
  const historicalTotals = volumeByMuscle(strengthWorkouts);
  const trainedMuscles = [...historicalTotals.keys()];

  if (totalSessionCount < MUSCLE_BALANCE_MIN_SESSIONS || trainedMuscles.length < MUSCLE_BALANCE_MIN_MUSCLES) {
    return {
      status: "insufficient_data",
      trainedMuscleCount: trainedMuscles.length,
      message: `Log sets across at least ${MUSCLE_BALANCE_MIN_MUSCLES} muscle groups over ${MUSCLE_BALANCE_MIN_SESSIONS} sessions to see muscle balance.`,
      distribution: [],
    };
  }

  const toDistribution = (totals) => {
    const grandTotal = [...totals.values()].reduce((s, v) => s + v, 0) || 1;
    return [...totals.entries()]
      .map(([muscle, volume]) => ({ muscle, pct: Math.round((volume / grandTotal) * 1000) / 10 }))
      .sort((a, b) => b.pct - a.pct);
  };

  const historicalDistribution = toDistribution(historicalTotals);
  const recentWorkouts = strengthWorkouts.filter((w) => entryDate(w) >= recentCutoff);
  const recentTotals = volumeByMuscle(recentWorkouts);
  const recentDistribution = recentTotals.size ? toDistribution(recentTotals) : [];

  const dominant = historicalDistribution[0] || null;
  const neglected = historicalDistribution[historicalDistribution.length - 1] || null;
  const gap = dominant && neglected ? Math.round((dominant.pct - neglected.pct) * 10) / 10 : 0;

  return {
    status: "ok",
    trainedMuscleCount: trainedMuscles.length,
    historicalDistribution,
    recentDistribution,
    dominant: dominant ? dominant.muscle : null,
    neglected: neglected ? neglected.muscle : null,
    imbalanceGapPct: gap,
    imbalanceWarning: gap >= MUSCLE_BALANCE_IMBALANCE_GAP_PCT,
  };
}

function getAdvancedProgressionAnalytics(workouts, { now = new Date() } = {}) {
  const strengthWorkouts = (workouts || []).filter((w) => !isCardioEntry(w) && w.exercise?.name);
  const topExercises = getTopExercises(strengthWorkouts);

  const seriesByExercise = new Map(topExercises.map((name) => [name, buildExerciseSeries(strengthWorkouts, name)]));

  const plateau = topExercises.map((name) => detectPlateau(seriesByExercise.get(name), name, now));
  const strengthTrends = topExercises.map((name) => computeStrengthTrend(seriesByExercise.get(name), name, now));
  const exerciseComparisons = topExercises.map((name) =>
    computeExerciseComparison(seriesByExercise.get(name), name, now)
  );

  return {
    plateau,
    strengthTrends,
    volumeTrends: computeVolumeLandmarks(strengthWorkouts, now),
    muscleBalance: computeMuscleBalance(strengthWorkouts, now),
    exerciseComparisons,
  };
}

module.exports = {
  getAdvancedProgressionAnalytics,
  buildExerciseSeries,
  detectPlateau,
  computeStrengthTrend,
  computeExerciseComparison,
  computeVolumeLandmarks,
  computeMuscleBalance,
  getTopExercises,
};
