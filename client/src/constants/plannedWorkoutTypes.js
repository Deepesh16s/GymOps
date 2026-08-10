
export const PLANNED_STATUS = {
  PLANNED: "Planned",
  COMPLETED: "Completed",
  MISSED: "Missed",
  CANCELLED: "Cancelled",
};

export const PRIORITY_OPTIONS = ["Low", "Medium", "High"];

export const RECURRENCE_TYPES = {
  NONE: "none",
  DAILY: "daily",
  WEEKLY: "weekly",
  CUSTOM_WEEKDAYS: "customWeekdays",
  MONTHLY: "monthly",
};

export const RECURRENCE_TYPE_OPTIONS = [
  { value: RECURRENCE_TYPES.NONE, label: "Does not repeat" },
  { value: RECURRENCE_TYPES.DAILY, label: "Daily" },
  { value: RECURRENCE_TYPES.WEEKLY, label: "Weekly" },
  { value: RECURRENCE_TYPES.CUSTOM_WEEKDAYS, label: "Custom days" },
  { value: RECURRENCE_TYPES.MONTHLY, label: "Monthly" },
];

export const WEEKDAY_OPTIONS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

export const EDIT_SCOPE_OPTIONS = [
  { value: "only", label: "This workout only" },
  { value: "future", label: "This and future workouts" },
  { value: "series", label: "Entire series" },
];

export const BUILT_IN_TEMPLATES = [
  { key: "push", label: "Push", workoutType: "Push", cardioActivityType: null, estimatedDuration: 60 },
  { key: "pull", label: "Pull", workoutType: "Pull", cardioActivityType: null, estimatedDuration: 60 },
  { key: "legs", label: "Legs", workoutType: "Legs", cardioActivityType: null, estimatedDuration: 65 },
  { key: "upper", label: "Upper", workoutType: "Upper", cardioActivityType: null, estimatedDuration: 60 },
  { key: "lower", label: "Lower", workoutType: "Lower", cardioActivityType: null, estimatedDuration: 60 },
  { key: "fullBody", label: "Full Body", workoutType: "Full Body", cardioActivityType: null, estimatedDuration: 70 },
  { key: "running", label: "Running", workoutType: "Cardio", cardioActivityType: "Running", estimatedDuration: 30 },
  { key: "cycling", label: "Cycling", workoutType: "Cardio", cardioActivityType: "Cycling", estimatedDuration: 45 },
  { key: "walking", label: "Walking", workoutType: "Cardio", cardioActivityType: "Walking", estimatedDuration: 30 },
];

export const STATUS_BADGE_CLASS = {
  [PLANNED_STATUS.PLANNED]: "planned-badge--outlined",
  [PLANNED_STATUS.COMPLETED]: "planned-badge--filled",
  [PLANNED_STATUS.MISSED]: "planned-badge--warning",
  [PLANNED_STATUS.CANCELLED]: "planned-badge--muted",
};
