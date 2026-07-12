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
// string literals "weekly"/"monthly" anywhere a Cardio Goal's period is
// read, compared, or validated.
const GOAL_PERIODS = {
  WEEKLY: "weekly",
  MONTHLY: "monthly",
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
  CARDIO_SESSION_METRIC,
  CARDIO_GOAL_METRICS,
  isAutoCardioGoal,
};