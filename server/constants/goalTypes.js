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

const MANUAL_GOAL_TYPES = [GOAL_TYPES.CARDIO, GOAL_TYPES.WEIGHT];

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

const GLOBAL_AUTO_GOAL_TYPES = AUTO_GOAL_TYPES.filter(
  (t) => t !== GOAL_TYPES.STRENGTH_PR
).concat(GOAL_TYPES.CARDIO);

const GOAL_PERIODS = {
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  MILESTONE: "milestone",
  DAILY_WEEKLY: "daily-weekly",
  DAILY_MONTHLY: "daily-monthly",
  DAILY_LIFETIME: "daily-lifetime",
  NEXT_SESSION: "next-session",
};

const DAILY_PERIODS = [
  GOAL_PERIODS.DAILY_WEEKLY,
  GOAL_PERIODS.DAILY_MONTHLY,
  GOAL_PERIODS.DAILY_LIFETIME,
];

const getAutoDailyTargetDays = (period, now = new Date()) => {
  if (period === GOAL_PERIODS.DAILY_WEEKLY) return 7;
  if (period === GOAL_PERIODS.DAILY_MONTHLY) {
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  }
  return null;
};

const CARDIO_SESSION_METRIC = "sessions";

const CARDIO_GOAL_METRICS = [
  ...Object.keys(CARDIO_METRICS),
  CARDIO_SESSION_METRIC,
];

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