import { buildProgressionSeries, compareRecentPeriods, getConsistency } from "../progression/progressionEngine";
import { buildSessionSummaries } from "../utils/workoutUtils";
import { prHistory } from "../utils/strengthUtils";
import { getTrainingBalance } from "./balanceEngine";
import { weightedScore, clampScore, scoreToBand } from "../utils/scoringUtils";

const MS_PER_DAY = 86400000;
const CONSISTENCY_WINDOW_DAYS = 28;
const PR_TARGET_PER_WEEK = 1;

const GRADE_THRESHOLDS = [
  { min: 97, label: "A+" },
  { min: 93, label: "A" },
  { min: 90, label: "A-" },
  { min: 87, label: "B+" },
  { min: 83, label: "B" },
  { min: 80, label: "B-" },
  { min: 77, label: "C+" },
  { min: 70, label: "C" },
  { min: 60, label: "D" },
  { min: 0, label: "F" },
];

export function getWeeklyGrade(workouts, { now = new Date() } = {}) {
  const weekStart = new Date(now.getTime() - 7 * MS_PER_DAY);
  const consistencyStart = new Date(now.getTime() - CONSISTENCY_WINDOW_DAYS * MS_PER_DAY);

  const sessions = buildSessionSummaries(workouts).filter(
    (s) => s.stats.exerciseCount > 0 || s.stats.cardioCount > 0
  );
  const consistency = getConsistency(sessions, consistencyStart, now);

  const weeklySeries = buildProgressionSeries(workouts, { granularity: "week" });
  const overloadTrend = compareRecentPeriods(weeklySeries, "volume", 1);

  const thisWeekWorkouts = workouts.filter((w) => new Date(w.date || w.createdAt) >= weekStart);
  const balance = getTrainingBalance(thisWeekWorkouts.length ? thisWeekWorkouts : workouts);
  const pplGap = balance.available ? balance.imbalance.gap : null;

  const recentPrCount = prHistory(workouts).filter(
    (e) => new Date(e.date).getTime() >= weekStart.getTime()
  ).length;

  const factors = [
    {
      key: "consistency",
      label: "Consistency",
      value: consistency && sessions.length ? clampScore(consistency.percent) : null,
    },
    {
      key: "overload",
      label: "Progressive Overload",
      value: overloadTrend ? clampScore(50 + overloadTrend.changePct) : null,
    },
    {
      key: "balance",
      label: "Muscle Balance",
      value: pplGap != null ? clampScore(100 - pplGap) : null,
    },
    {
      key: "prFrequency",
      label: "PR Frequency",
      value: sessions.length ? clampScore((recentPrCount / PR_TARGET_PER_WEEK) * 100) : null,
    },
  ];

  const score = weightedScore(factors.map((f) => ({ value: f.value, weight: 1 })));

  const availableFactors = factors.filter((f) => f.value != null).length;
  const confidence = availableFactors >= 4 ? "High" : availableFactors >= 2 ? "Medium" : "Low";
  const confidenceReason = `${availableFactors} of ${factors.length} scoring factors available`;

  return {
    score,
    grade: score != null ? scoreToBand(score, GRADE_THRESHOLDS) : null,
    factors,
    confidence,
    confidenceReason,
  };
}
