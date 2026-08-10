import { PLANNED_STATUS } from "../constants/plannedWorkoutTypes";
import { dayKey, isToday, isYesterday, isTomorrow } from "./reminderUtils";

const STARTING_SOON_WINDOW_MINUTES = 60;

function planLabel(plan) {
  return plan.cardioActivityType ? `${plan.title} (${plan.cardioActivityType})` : plan.title;
}

function scheduledDateTime(plan) {
  if (!plan.scheduledTime) return null;
  const [h, m] = plan.scheduledTime.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const d = new Date(plan.scheduledDate);
  d.setHours(h, m, 0, 0);
  return d;
}

export function generateWorkoutReminders(plannedWorkouts) {
  const reminders = [];
  const now = Date.now();

  plannedWorkouts.forEach((plan) => {
    const dateKey = dayKey(plan.scheduledDate);

    if (plan.status === PLANNED_STATUS.PLANNED && isToday(plan.scheduledDate)) {
      const at = scheduledDateTime(plan);

      if (at && at.getTime() < now) {
        reminders.push({
          type: "workoutOverdue",
          category: "reminders",
          icon: "AlertTriangle",
          title: "Workout Overdue",
          subtitle: `${planLabel(plan)} was scheduled for ${plan.scheduledTime}`,
          navigationTarget: `/calendar?date=${dateKey}`,
          action: { page: "/calendar", entityId: dateKey, focus: "date" },
          dedupeKey: `workout:${plan._id}`,
          expiresAt: new Date(new Date(plan.scheduledDate).setHours(23, 59, 59, 999)),
          metadata: { plannedWorkoutId: plan._id },
        });
      } else if (at && at.getTime() - now <= STARTING_SOON_WINDOW_MINUTES * 60000 && at.getTime() - now > 0) {
        reminders.push({
          type: "workoutStartingSoon",
          category: "reminders",
          icon: "Clock",
          title: "Workout Starting Soon",
          subtitle: `${planLabel(plan)} starts at ${plan.scheduledTime}`,
          navigationTarget: `/calendar?date=${dateKey}`,
          action: { page: "/calendar", entityId: dateKey, focus: "date" },
          dedupeKey: `workout:${plan._id}`,
          expiresAt: at,
          metadata: { plannedWorkoutId: plan._id },
        });
      } else {
        reminders.push({
          type: "workoutToday",
          category: "reminders",
          icon: "Dumbbell",
          title: "Workout Today",
          subtitle: planLabel(plan),
          navigationTarget: `/calendar?date=${dateKey}`,
          action: { page: "/calendar", entityId: dateKey, focus: "date" },
          dedupeKey: `workout:${plan._id}`,
          expiresAt: new Date(new Date(plan.scheduledDate).setHours(23, 59, 59, 999)),
          metadata: { plannedWorkoutId: plan._id },
        });
      }
    }

    if (plan.status === PLANNED_STATUS.MISSED && isYesterday(plan.scheduledDate)) {
      reminders.push({
        type: "workoutMissedYesterday",
        category: "reminders",
        icon: "Ban",
        title: "Workout Missed",
        subtitle: `Yesterday's ${planLabel(plan)} was missed`,
        navigationTarget: `/calendar?date=${dateKey}`,
        action: { page: "/calendar", entityId: dateKey, focus: "date" },
        dedupeKey: `workout:${plan._id}`,
        expiresAt: null,
        metadata: { plannedWorkoutId: plan._id },
      });
    }

    if (
      plan.status === PLANNED_STATUS.PLANNED &&
      plan.recurrenceGroupId &&
      isTomorrow(plan.scheduledDate)
    ) {
      reminders.push({
        type: "recurringDueTomorrow",
        category: "reminders",
        icon: "Repeat",
        title: "Tomorrow",
        subtitle: planLabel(plan),
        navigationTarget: `/calendar?date=${dateKey}`,
        action: { page: "/calendar", entityId: dateKey, focus: "date" },
        dedupeKey: `workout:${plan._id}`,
        expiresAt: new Date(new Date(plan.scheduledDate).setHours(23, 59, 59, 999)),
        metadata: { plannedWorkoutId: plan._id },
      });
    }
  });

  return reminders;
}
