// Single source of truth for Workout History's Date Range filter.
// Mirrors the pattern of src/constants/sessionTypes.js: one shared list
// of keys/labels consumed by both the filter dropdown (WorkoutHistory.jsx)
// and the filtering logic (workoutUtils.js), so they can never drift.

export const DATE_RANGE_ALL = "All";
export const DATE_RANGE_TODAY = "Today";
export const DATE_RANGE_LAST_7_DAYS = "Last 7 Days";
export const DATE_RANGE_LAST_30_DAYS = "Last 30 Days";
export const DATE_RANGE_THIS_MONTH = "This Month";
export const DATE_RANGE_THIS_YEAR = "This Year";
export const DATE_RANGE_CUSTOM = "Custom Range";

// Order here is the order rendered in the <select>.
export const DATE_RANGE_OPTIONS = [
  DATE_RANGE_ALL,
  DATE_RANGE_TODAY,
  DATE_RANGE_LAST_7_DAYS,
  DATE_RANGE_LAST_30_DAYS,
  DATE_RANGE_THIS_MONTH,
  DATE_RANGE_THIS_YEAR,
  DATE_RANGE_CUSTOM,
];