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
// directly via create/edit (see goalController).
const MANUAL_GOAL_TYPES = [GOAL_TYPES.CARDIO, GOAL_TYPES.WEIGHT];

// All backend-calculated types (mirrors Goal.js's updateType logic).
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

// Auto types handled by the *global* recalculation pass. Strength PR is
// excluded here because it's recalculated per-exercise (see
// updateGoals.js / recalculateGoals.js), not as part of the global batch.
const GLOBAL_AUTO_GOAL_TYPES = AUTO_GOAL_TYPES.filter(
  (t) => t !== GOAL_TYPES.STRENGTH_PR
);

module.exports = {
  GOAL_TYPES,
  MANUAL_GOAL_TYPES,
  AUTO_GOAL_TYPES,
  GLOBAL_AUTO_GOAL_TYPES,
};