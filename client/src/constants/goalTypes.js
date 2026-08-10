import { CARDIO_METRICS } from "./cardioMetadata";

export const GOAL_TYPES = {
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

export const MANUAL_GOAL_TYPES = [GOAL_TYPES.CARDIO, GOAL_TYPES.WEIGHT];

export const GOAL_CATEGORIES = [
  {
    key: "strength",
    label: "Strength Goals",
    shortLabel: "Strength",
    types: [GOAL_TYPES.STRENGTH_PR],
  },
  {
    key: "activity",
    label: "Activity Goals",
    shortLabel: "Activity",
    types: [
      GOAL_TYPES.WEEKLY_WORKOUT_SESSIONS,
      GOAL_TYPES.MONTHLY_WORKOUT_SESSIONS,
      GOAL_TYPES.WEEKLY_VOLUME,
      GOAL_TYPES.MONTHLY_VOLUME,
      GOAL_TYPES.SESSION_EXERCISE,
      GOAL_TYPES.SESSION_VOLUME,
      GOAL_TYPES.SESSION_DURATION,
      GOAL_TYPES.CARDIO,
    ],
  },
  {
    key: "consistency",
    label: "Consistency Goals",
    shortLabel: "Consistency",
    types: [GOAL_TYPES.CURRENT_STREAK],
  },
  {
    key: "body",
    label: "Body Goals",
    shortLabel: "Body",
    types: [GOAL_TYPES.WEIGHT],
  },
];

export const TYPE_LABELS = {
  [GOAL_TYPES.STRENGTH_PR]: "Strength PR Goal",
  [GOAL_TYPES.WEEKLY_WORKOUT_SESSIONS]: "Weekly Workout Sessions",
  [GOAL_TYPES.MONTHLY_WORKOUT_SESSIONS]: "Monthly Workout Sessions",
  [GOAL_TYPES.WEEKLY_VOLUME]: "Weekly Volume Goal",
  [GOAL_TYPES.MONTHLY_VOLUME]: "Monthly Volume Goal",
  [GOAL_TYPES.SESSION_EXERCISE]: "Session Exercise Goal",
  [GOAL_TYPES.SESSION_VOLUME]: "Session Volume Goal",
  [GOAL_TYPES.SESSION_DURATION]: "Session Duration Goal",
  [GOAL_TYPES.CARDIO]: "Cardio Goal",
  [GOAL_TYPES.CURRENT_STREAK]: "Current Streak Goal",
  [GOAL_TYPES.WEIGHT]: "Weight Goal",
};

export const TARGET_LABEL = {
  [GOAL_TYPES.STRENGTH_PR]: "Target Weight",
  [GOAL_TYPES.WEEKLY_WORKOUT_SESSIONS]: "Target Sessions",
  [GOAL_TYPES.MONTHLY_WORKOUT_SESSIONS]: "Target Sessions",
  [GOAL_TYPES.WEEKLY_VOLUME]: "Target Volume (kg)",
  [GOAL_TYPES.MONTHLY_VOLUME]: "Target Volume (kg)",
  [GOAL_TYPES.SESSION_EXERCISE]: "Target Exercises",
  [GOAL_TYPES.SESSION_VOLUME]: "Target Volume (kg)",
  [GOAL_TYPES.SESSION_DURATION]: "Target Minutes",
  [GOAL_TYPES.CARDIO]: "Target",
  [GOAL_TYPES.CURRENT_STREAK]: "Target Days",
  [GOAL_TYPES.WEIGHT]: "Target Weight (kg)",
};

export const FIXED_UNIT = {
  [GOAL_TYPES.WEEKLY_WORKOUT_SESSIONS]: "sessions",
  [GOAL_TYPES.MONTHLY_WORKOUT_SESSIONS]: "sessions",
  [GOAL_TYPES.WEEKLY_VOLUME]: "kg",
  [GOAL_TYPES.MONTHLY_VOLUME]: "kg",
  [GOAL_TYPES.SESSION_EXERCISE]: "exercises",
  [GOAL_TYPES.SESSION_VOLUME]: "kg",
  [GOAL_TYPES.SESSION_DURATION]: "minutes",
  [GOAL_TYPES.CURRENT_STREAK]: "days",
  [GOAL_TYPES.WEIGHT]: "kg",
};

export const CARDIO_UNITS = ["Minutes", "Kilometers", "Runs"];
export const WEIGHT_UNITS = ["kg", "lb"];

export const GOAL_PERIODS = {
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  MILESTONE: "milestone",
  DAILY_WEEKLY: "daily-weekly",
  DAILY_MONTHLY: "daily-monthly",
  DAILY_LIFETIME: "daily-lifetime",
  NEXT_SESSION: "next-session",
};

export const DAILY_PERIODS = [
  GOAL_PERIODS.DAILY_WEEKLY,
  GOAL_PERIODS.DAILY_MONTHLY,
  GOAL_PERIODS.DAILY_LIFETIME,
];

export const CARDIO_PERIOD_LABELS = {
  [GOAL_PERIODS.WEEKLY]: "Weekly",
  [GOAL_PERIODS.MONTHLY]: "Monthly",
  [GOAL_PERIODS.MILESTONE]: "Milestone (one-time)",
  [GOAL_PERIODS.DAILY_WEEKLY]: "Daily, tracked over a week",
  [GOAL_PERIODS.DAILY_MONTHLY]: "Daily, tracked over a month",
  [GOAL_PERIODS.DAILY_LIFETIME]: "Daily, lifetime streak",
  [GOAL_PERIODS.NEXT_SESSION]: "Next Session",
};

export const GOAL_STYLES = {
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  DAILY: "daily",
  MILESTONE: "milestone",
  NEXT_SESSION: "next-session",
};

export const GOAL_STYLE_OPTIONS = [
  { value: GOAL_STYLES.WEEKLY, label: "Weekly" },
  { value: GOAL_STYLES.MONTHLY, label: "Monthly" },
  { value: GOAL_STYLES.DAILY, label: "Daily" },
  { value: GOAL_STYLES.MILESTONE, label: "Milestone" },
  { value: GOAL_STYLES.NEXT_SESSION, label: "Next Session" },
];

export const DAILY_TRACK_OVER = {
  WEEK: "week",
  MONTH: "month",
  LIFETIME: "lifetime",
};

export const DAILY_TRACK_OVER_OPTIONS = [
  { value: DAILY_TRACK_OVER.WEEK, label: "Week" },
  { value: DAILY_TRACK_OVER.MONTH, label: "Month" },
  { value: DAILY_TRACK_OVER.LIFETIME, label: "Lifetime" },
];

export const composePeriod = (style, trackOver) => {
  if (style === GOAL_STYLES.DAILY) {
    if (trackOver === DAILY_TRACK_OVER.MONTH) return GOAL_PERIODS.DAILY_MONTHLY;
    if (trackOver === DAILY_TRACK_OVER.LIFETIME) return GOAL_PERIODS.DAILY_LIFETIME;
    return GOAL_PERIODS.DAILY_WEEKLY;
  }
  if (style === GOAL_STYLES.MILESTONE) return GOAL_PERIODS.MILESTONE;
  if (style === GOAL_STYLES.NEXT_SESSION) return GOAL_PERIODS.NEXT_SESSION;
  if (style === GOAL_STYLES.MONTHLY) return GOAL_PERIODS.MONTHLY;
  return GOAL_PERIODS.WEEKLY;
};

export const decomposePeriod = (period) => {
  switch (period) {
    case GOAL_PERIODS.DAILY_WEEKLY:
      return { style: GOAL_STYLES.DAILY, trackOver: DAILY_TRACK_OVER.WEEK };
    case GOAL_PERIODS.DAILY_MONTHLY:
      return { style: GOAL_STYLES.DAILY, trackOver: DAILY_TRACK_OVER.MONTH };
    case GOAL_PERIODS.DAILY_LIFETIME:
      return { style: GOAL_STYLES.DAILY, trackOver: DAILY_TRACK_OVER.LIFETIME };
    case GOAL_PERIODS.MILESTONE:
      return { style: GOAL_STYLES.MILESTONE, trackOver: null };
    case GOAL_PERIODS.NEXT_SESSION:
      return { style: GOAL_STYLES.NEXT_SESSION, trackOver: null };
    case GOAL_PERIODS.MONTHLY:
      return { style: GOAL_STYLES.MONTHLY, trackOver: null };
    default:
      return { style: GOAL_STYLES.WEEKLY, trackOver: null };
  }
};

export const CARDIO_SESSION_METRIC = "sessions";

export const CARDIO_GOAL_METRICS = [
  ...Object.keys(CARDIO_METRICS),
  CARDIO_SESSION_METRIC,
];

export const CARDIO_GOAL_METRIC_LABELS = {
  ...Object.fromEntries(Object.entries(CARDIO_METRICS).map(([k, v]) => [k, v.label])),
  [CARDIO_SESSION_METRIC]: "Sessions",
};

export const CARDIO_GOAL_METRIC_UNITS = {
  ...Object.fromEntries(Object.entries(CARDIO_METRICS).map(([k, v]) => [k, v.unit])),
  [CARDIO_SESSION_METRIC]: "sessions",
};

export const CARDIO_MILESTONE_PRESETS = [
  { label: "First 5K", activityType: "Running", metric: "distance", target: 5 },
  { label: "First 10K", activityType: "Running", metric: "distance", target: 10 },
  { label: "Half Marathon", activityType: "Running", metric: "distance", target: 21.1 },
  { label: "Marathon", activityType: "Running", metric: "distance", target: 42.2 },
];