// generateWeeklyCoachReport — the "Weekly Coach Report" component's data
// (section 3): grade, recovery, consistency, volume change, most
// improved / needs attention muscles, suggested focus. Composes
// weeklyGradeEngine (Module 10), recoveryEngine (Module 1),
// musclePriorityEngine (Module 11), and progression/progressionEngine.js's
// existing weekly-bucketed volume trend (the SAME series/comparison
// weeklyGradeEngine.js itself already uses for its own "Progressive
// Overload" factor) — nothing here is a new trend computation.
import { buildProgressionSeries, compareRecentPeriods } from "../progression/progressionEngine";
import { MUSCLE_SPLIT_CATEGORY } from "../constants/muscles";
import { getWeeklyGrade, getMuscleRecoveryScores, getMusclePriorities } from "../intelligence";
import { getConfidence } from "../utils/confidenceUtils";

const MS_PER_DAY = 86400000;

function averageRecoveryScore(recoveryScores) {
  if (!recoveryScores.length) return null;
  return Math.round(recoveryScores.reduce((s, r) => s + r.recoveryScore, 0) / recoveryScores.length);
}

// Distinct trained calendar days in the last 7 — "Consistency: 6 / 7" in
// the spec's own example. A plain day-count, not a re-derivation of
// weeklyGradeEngine's own (differently-scoped, 4-week) consistency
// percentage.
function computeWeekConsistency(workouts) {
  const weekAgo = Date.now() - 7 * MS_PER_DAY;
  const trainedDays = new Set(
    workouts
      .filter((w) => new Date(w.date || w.createdAt).getTime() >= weekAgo)
      .map((w) => new Date(w.date || w.createdAt).toDateString())
  );
  return { trained: trainedDays.size, total: 7 };
}

export function generateWeeklyCoachReport(workouts) {
  const { grade, score, confidence: gradeConfidence, confidenceReason: gradeConfidenceReason } =
    getWeeklyGrade(workouts);
  const recoveryScores = getMuscleRecoveryScores(workouts);
  const recoveryScore = averageRecoveryScore(recoveryScores);
  const recoveryConfidence = getConfidence(recoveryScores.length, "muscle");
  const consistency = computeWeekConsistency(workouts);

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
    recovery: recoveryScore,
    recoveryConfidence: recoveryConfidence.level,
    recoveryConfidenceReason: recoveryConfidence.reason,
    // Full per-muscle breakdown — lets the UI answer "why {recovery}?"
    // without a second getMuscleRecoveryScores call.
    recoveryBreakdown: recoveryScores,
    consistency,
    volumeChangePct: volumeTrend?.changePct ?? null,
    mostImproved,
    needsAttention,
    suggestedFocus,
  };
}
