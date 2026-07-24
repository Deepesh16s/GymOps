const { CARDIO_ACTIVITY_TYPES, CARDIO_METRICS } = require("./cardioMetadata");

const GOAL_TYPES = {
  STRENGTH_PR: "Strength PR",
  WEEKLY_WORKOUT_SESSIONS: "Weekly Workout Sessions",
  MONTHLY_WORKOUT_SESSIONS: "Monthly Workout Sessions",
  WEEKLY_VOLUME: "Weekly Volume Goal",
  MONTHLY_VOLUME: "Monthly Volume Goal",
  SESSION_EXERCISE: "Session Exercise Goal",
  SESSION_VOLUME: "Session Volume Goal",
  SESSION_DURATION: "Session Duration Goal",
  CARDIO: "Cardio Goal",
  CURRENT_STREAK: "Current Streak",
  WEIGHT: "Weight Goal",
};

// Manual types have no backing data source — the user supplies `current`
// directly via create/edit (see goalController). Cardio Goal is included
// here for backward compatibility: a Cardio Goal created before Phase 8B
// (or created/edited without activityType+metric+period) has no
// configuration to compute from and stays a plain manual goal. See
// isAutoCardioGoal below for the actual per-instance determination used
// everywhere it matters (Goal.js, updateGoals.js, goalController.js) —
// this array alone does NOT tell you whether a given Cardio Goal is
// manual or automatic.
const MANUAL_GOAL_TYPES = [GOAL_TYPES.CARDIO, GOAL_TYPES.WEIGHT];

// All backend-calculated types (mirrors Goal.js's updateType logic).
// Cardio Goal is deliberately NOT in this list — whether a given Cardio
// Goal is AUTO or MANUAL depends on its own activityType/metric/period,
// not on its type alone. See isAutoCardioGoal.
const AUTO_GOAL_TYPES = [
  GOAL_TYPES.STRENGTH_PR,
  GOAL_TYPES.WEEKLY_WORKOUT_SESSIONS,
  GOAL_TYPES.MONTHLY_WORKOUT_SESSIONS,
  GOAL_TYPES.WEEKLY_VOLUME,
  GOAL_TYPES.MONTHLY_VOLUME,
  GOAL_TYPES.SESSION_EXERCISE,
  GOAL_TYPES.SESSION_VOLUME,
  GOAL_TYPES.SESSION_DURATION,
  GOAL_TYPES.CURRENT_STREAK,
];

// Auto types handled by the *global* recalculation pass
// (updateGoals.js's recalculateGlobalAutoGoals). Strength PR is excluded
// here because it's recalculated per-exercise instead (see
// updateGoals.js / recalculateGoals.js).
//
// Cardio Goal IS included here (Phase 8B) so the global pass's single
// Goal.find() fetches every Cardio Goal up front — configured (auto) and
// unconfigured (legacy manual) alike, in the same query as everything
// else, per "reuse the existing workout fetch and update pipeline."
// recalculateGlobalAutoGoals then uses isAutoCardioGoal() per goal to
// decide which ones actually get recomputed; unconfigured ones are
// fetched but simply skipped, left exactly as the user last set them.
const GLOBAL_AUTO_GOAL_TYPES = AUTO_GOAL_TYPES.filter(
  (t) => t !== GOAL_TYPES.STRENGTH_PR
).concat(GOAL_TYPES.CARDIO);

// Phase 8B — reusable period enum. Use these values instead of the
// string literals "weekly"/"monthly"/"milestone" anywhere a Cardio
// Goal's period is read, compared, or validated.
//
// Phase 12: added MILESTONE for one-time achievement goals ("First 5K",
// "Marathon") — these have no recurring window to reset each week/month,
// so computeCardioGoalMetric treats this value as "lifetime max single
// entry" rather than "sum since period start" (see that function). A
// milestone goal can therefore never regress once achieved.
//
// Post-Phase-12: added three DAILY_* values and NEXT_SESSION. These are
// still just `period` values — the Goal Creation UI never shows all
// seven as one flat list (see Goals.jsx: Goal Style -> Track Over
// composes/decomposes into one of these under the hood), but the data
// model and every computation in goalMetrics.js stays a flat enum, same
// as before.
//
// DAILY_WEEKLY / DAILY_MONTHLY: "consistency" goals — current = how many
// days in the window (so far) hit goal.dailyTarget; target is
// auto-computed (days in the window), never user-entered. See
// getAutoDailyTargetDays below and computeCardioGoalMetric's daily
// branch.
//
// DAILY_LIFETIME: a "streak" goal — current = the longest all-time
// consecutive-day streak of hitting goal.dailyTarget (recomputed fresh
// from full history every time, so it can only stay the same or grow,
// same non-regressing property MILESTONE has). target is user-entered
// (the streak length to reach, e.g. 30).
//
// NEXT_SESSION: a one-shot challenge — current is 0 until the first
// matching cardio session logged AFTER the goal's createdAt exists, then
// current is that single session's value, permanently (does not
// re-target on later sessions).
const GOAL_PERIODS = {
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  MILESTONE: "milestone",
  DAILY_WEEKLY: "daily-weekly",
  DAILY_MONTHLY: "daily-monthly",
  DAILY_LIFETIME: "daily-lifetime",
  NEXT_SESSION: "next-session",
};

// The three periods whose `current` is a day-count or streak-length
// rather than a raw metric sum — goalController uses this to know when
// dailyTarget is required and when unit/target should be auto-derived
// instead of taken from the request body.
const DAILY_PERIODS = [
  GOAL_PERIODS.DAILY_WEEKLY,
  GOAL_PERIODS.DAILY_MONTHLY,
  GOAL_PERIODS.DAILY_LIFETIME,
];

// Auto-computed `target` for the two windowed daily periods — "days in
// the window", not user-entered. DAILY_LIFETIME has no window (its
// target is the user's chosen streak length) so it's not handled here.
const getAutoDailyTargetDays = (period, now = new Date()) => {
  if (period === GOAL_PERIODS.DAILY_WEEKLY) return 7;
  if (period === GOAL_PERIODS.DAILY_MONTHLY) {
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  }
  return null;
};

// Pseudo-metric: not a real cardio.data.* field, but a natural fit for
// the same {activityType, metric, period} shape — "how many cardio
// sessions of this activity did I complete this period". Computed via
// session-grouping (countDistinctSessions), not by summing a data field.
// See goalMetrics.computeCardioGoalMetric.
const CARDIO_SESSION_METRIC = "sessions";

// Every value a Cardio Goal's `metric` field may hold: any real cardio
// metric key from cardioMetadata.js (duration, distance, calories, ...)
// plus the "sessions" pseudo-metric above. Driven entirely by
// cardioMetadata.js — no hardcoded metric list here, so new cardio
// metrics added there become valid Cardio Goal metrics automatically.
const CARDIO_GOAL_METRICS = [
  ...Object.keys(CARDIO_METRICS),
  CARDIO_SESSION_METRIC,
];

// A Cardio Goal is only "automatic" when it carries a complete, valid
// configuration. Missing or invalid activityType/metric/period means the
// goal stays manual (its `current` is user-edited directly, exactly like
// before Phase 8B) — this is what lets pre-Phase-8B Cardio Goals keep
// working unchanged, with no migration required. This is the single
// place that rule lives; Goal.js (updateType), updateGoals.js (global
// recalculation dispatch), and goalController.js (create/update
// validation + immediate recompute) all call this instead of
// re-deriving the same check.
const isAutoCardioGoal = (goal) => {
  if (!goal || goal.type !== GOAL_TYPES.CARDIO) return false;

  return (
    !!goal.activityType &&
    CARDIO_ACTIVITY_TYPES.includes(goal.activityType) &&
    !!goal.metric &&
    CARDIO_GOAL_METRICS.includes(goal.metric) &&
    !!goal.period &&
    Object.values(GOAL_PERIODS).includes(goal.period)
  );
};

module.exports = {
  GOAL_TYPES,
  MANUAL_GOAL_TYPES,
  AUTO_GOAL_TYPES,
  GLOBAL_AUTO_GOAL_TYPES,
  GOAL_PERIODS,
  DAILY_PERIODS,
  getAutoDailyTargetDays,
  CARDIO_SESSION_METRIC,
  CARDIO_GOAL_METRICS,
  isAutoCardioGoal,
};