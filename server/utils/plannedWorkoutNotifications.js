const { NOTIFICATION_TYPES, NOTIFICATION_CATEGORIES } = require("../constants/notificationTypes");

const formatScheduledDate = (date) =>
  new Date(date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

function buildWorkoutScheduledPayload(plannedWorkout) {
  return {
    type: NOTIFICATION_TYPES.WORKOUT_SCHEDULED,
    category: NOTIFICATION_CATEGORIES.REMINDERS,
    priority: "low",
    icon: "CalendarPlus",
    title: "Workout Scheduled",
    subtitle: `${plannedWorkout.title} — ${formatScheduledDate(plannedWorkout.scheduledDate)}`,
    navigationTarget: `/calendar?date=${new Date(plannedWorkout.scheduledDate).toISOString().slice(0, 10)}`,
    dedupeKey: `workoutScheduled:${plannedWorkout._id}:${Date.now()}`,
  };
}

function buildRecurringScheduleCreatedPayload(firstInstance, count) {
  return {
    type: NOTIFICATION_TYPES.RECURRING_SCHEDULE_CREATED,
    category: NOTIFICATION_CATEGORIES.REMINDERS,
    priority: "low",
    icon: "Repeat",
    title: "Recurring Schedule Created",
    subtitle: `${firstInstance.title} — ${count} sessions planned`,
    navigationTarget: `/calendar?date=${new Date(firstInstance.scheduledDate).toISOString().slice(0, 10)}`,
    dedupeKey: `recurringScheduleCreated:${firstInstance.recurrenceGroupId}:${Date.now()}`,
  };
}

function buildWorkoutRescheduledPayload(plannedWorkout) {
  return {
    type: NOTIFICATION_TYPES.WORKOUT_RESCHEDULED,
    category: NOTIFICATION_CATEGORIES.REMINDERS,
    priority: "low",
    icon: "CalendarClock",
    title: "Workout Rescheduled",
    subtitle: `${plannedWorkout.title} — now ${formatScheduledDate(plannedWorkout.scheduledDate)}`,
    navigationTarget: `/calendar?date=${new Date(plannedWorkout.scheduledDate).toISOString().slice(0, 10)}`,
    dedupeKey: `workoutRescheduled:${plannedWorkout._id}:${Date.now()}`,
  };
}

function buildWorkoutCancelledPayload(plannedWorkout) {
  return {
    type: NOTIFICATION_TYPES.WORKOUT_CANCELLED,
    category: NOTIFICATION_CATEGORIES.REMINDERS,
    priority: "low",
    icon: "CalendarX",
    title: "Workout Cancelled",
    subtitle: `${plannedWorkout.title} — ${formatScheduledDate(plannedWorkout.scheduledDate)}`,
    navigationTarget: "/calendar",
    dedupeKey: `workoutCancelled:${plannedWorkout._id}:${Date.now()}`,
  };
}

module.exports = {
  buildWorkoutScheduledPayload,
  buildRecurringScheduleCreatedPayload,
  buildWorkoutRescheduledPayload,
  buildWorkoutCancelledPayload,
};
