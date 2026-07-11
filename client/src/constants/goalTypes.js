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

// Category configuration — single source of truth for grouping + the
// Add/Edit Goal modal's category & type dropdowns.
export const GOAL_CATEGORIES = [
  {
    key: "strength",
    label: "🏋 Strength Goals",
    shortLabel: "Strength",
    types: [GOAL_TYPES.STRENGTH_PR],
  },
  {
    key: "activity",
    label: "🎯 Activity Goals",
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
    label: "🔥 Consistency Goals",
    shortLabel: "Consistency",
    types: [GOAL_TYPES.CURRENT_STREAK],
  },
  {
    key: "body",
    label: "⚖ Body Goals",
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

// Fixed units auto-assigned for types where the form doesn't show a unit
// picker. Strength PR and Cardio Goal are the only types with a visible
// unit dropdown.
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