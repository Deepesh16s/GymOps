import { buildProgressionSeries, compareRecentPeriods } from "../progression/progressionEngine";
import { MUSCLE_SPLIT_CATEGORY } from "../constants/muscles";
import { getWeeklyGrade, getMuscleRecoveryScores, getMusclePriorities } from "../intelligence";
import { getConfidence } from "../utils/confidenceUtils";

const MS_PER_DAY = 86400000;

function averageRecoveryScore(recoveryScores) {
  if (!recoveryScores.length) return null;
  return Math.round(recoveryScores.reduce((s, r) => s + r.recoveryScore, 0) / recoveryScores.length);
}

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
    recoveryBreakdown: recoveryScores,
    consistency,
    volumeChangePct: volumeTrend?.changePct ?? null,
    mostImproved,
    needsAttention,
    suggestedFocus,
  };
}
