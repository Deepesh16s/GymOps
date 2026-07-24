// Single source of truth for Workout History's Duration filter. Mirrors
// the pattern of constants/dateRanges.js: one shared list of keys/labels
// consumed by both the filter dropdown (WorkoutHistory.jsx) and the
// filtering logic (workoutUtils.js), so they can never drift.

export const DURATION_RANGE_ALL = "Any Duration";
export const DURATION_RANGE_UNDER_30 = "Under 30 min";
export const DURATION_RANGE_30_TO_60 = "30–60 min";
export const DURATION_RANGE_60_TO_90 = "60–90 min";
export const DURATION_RANGE_OVER_90 = "Over 90 min";

// Order here is the order rendered in the <select>.
export const DURATION_RANGE_OPTIONS = [
  DURATION_RANGE_ALL,
  DURATION_RANGE_UNDER_30,
  DURATION_RANGE_30_TO_60,
  DURATION_RANGE_60_TO_90,
  DURATION_RANGE_OVER_90,
];
