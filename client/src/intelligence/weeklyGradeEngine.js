// Phase 14A, Module 10 — Weekly Training Grade. pages/Analytics.jsx
// already had an inline, LIFETIME-scoped "Training Score" (0-100,
// 4-factor composite: consistency, progressive overload, muscle
// balance, PR frequency). This reuses that exact same 4-factor formula,
// re-scoped to the trailing week (Module 10's own ask), and converts the
// score into a letter grade instead of a bare number — genuinely new
// output shape, but the SAME underlying inputs and weighting Analytics'
// own score already established, not a competing scoring philosophy.
import { buildProgressionSeries, compareRecentPeriods, getConsistency } from "../progression/progressionEngine";
import { buildSessionSummaries } from "../utils/workoutUtils";
import { prHistory } from "../utils/strengthUtils";
import { getTrainingBalance } from "./balanceEngine";
import { weightedScore, clampScore, scoreToBand } from "../utils/scoringUtils";

const MS_PER_DAY = 86400000;
// Consistency needs a real multi-week span to mean anything (getConsistency
// itself requires >= 2 weeks) — a trailing 4-week window, same as
// Analytics.jsx's own "recent" framing, rather than a single week that
// couldn't produce a meaningful percentage on its own.
const CONSISTENCY_WINDOW_DAYS = 28;
// Same normalization Analytics.jsx's own PR-Frequency factor already
// used (recordsThisMonth / 3 ≈ 1 PR/week is "full marks"), just re-scoped
// to a single week's count instead of a month's.
const PR_TARGET_PER_WEEK = 1;

// Extends Analytics.jsx's existing 85/70/50 -> Excellent/Good/Fair/Needs
// Work bucketing into a finer letter-grade scale for this module's own
// "A+/A/B+/B/C" ask — same scoreToBand mechanism, just more bands.
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

// `now` defaults to the real current time for every existing caller
// (Analytics.jsx, generateWeeklyCoachReport.js) — the optional override
// exists solely so reminders/intelligenceReminders.js can ask "what was
// the grade as of a week ago" for a real (not fabricated) week-over-week
// comparison, by re-running this SAME function with an earlier anchor
// instead of a second scoring implementation.
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
      value: consistency ? clampScore(consistency.percent) : null,
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
      value: clampScore((recentPrCount / PR_TARGET_PER_WEEK) * 100),
    },
  ];

  const score = weightedScore(factors.map((f) => ({ value: f.value, weight: 1 })));

  // Confidence here tracks how many of the 4 real scoring factors were
  // actually available — same "input count, not a fabricated certainty"
  // basis readinessEngine.js's own confidence already uses, rather than
  // the session-count utility (a 4-factor count never reaches its
  // 8-session "High" threshold, so it doesn't fit this shape).
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
