// Phase 13B — Workout Planner. Backend half of a deliberately UNSHARED,
// mirrored pair; see client/src/constants/plannedWorkoutTypes.js for the
// frontend counterpart (same separation cardioMetadata.js/
// notificationTypes.js already established).

const PLANNED_WORKOUT_STATUSES = ["Planned", "Completed", "Missed", "Cancelled"];

const PLANNED_WORKOUT_PRIORITIES = ["Low", "Medium", "High"];

const RECURRENCE_TYPES = ["none", "daily", "weekly", "customWeekdays", "monthly"];

// Editing/cancelling a recurring instance can apply to just that one
// document, this-and-later instances in the same series, or the whole
// series — see utils/plannedWorkoutRecurrence.js's applyEditScope.
const EDIT_SCOPES = ["only", "future", "series"];

// How far ahead concrete instances get generated for a recurring
// schedule, capped rather than unbounded (Phase 13B explicitly has no
// background scheduler to extend a series later) — see
// utils/plannedWorkoutRecurrence.js's generateRecurrenceDates. A
// six-month runway is generous for "every Monday: Push"-style planning
// without ever generating years of documents up front.
const RECURRENCE_HORIZON_DAYS = 180;

module.exports = {
  PLANNED_WORKOUT_STATUSES,
  PLANNED_WORKOUT_PRIORITIES,
  RECURRENCE_TYPES,
  EDIT_SCOPES,
  RECURRENCE_HORIZON_DAYS,
};
