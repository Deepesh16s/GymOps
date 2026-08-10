import { PLANNED_STATUS } from "../constants/plannedWorkoutTypes";
import { dayKey } from "./reminderUtils";

const RESCHEDULE_WARNING_THRESHOLD = 3;
const SERIES_ENDING_SOON_DAYS = 7;

function formatEndDate(date) {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function generatePlannerReminders(plannedWorkouts) {
  const reminders = [];
  const now = new Date();

  const activePlans = plannedWorkouts.filter((p) => p.status === PLANNED_STATUS.PLANNED);

  activePlans.forEach((plan) => {
    if ((plan.rescheduleCount || 0) < RESCHEDULE_WARNING_THRESHOLD) return;
    reminders.push({
      type: "plannerRescheduleWarning",
      category: "reminders",
      icon: "CalendarClock",
      title: "Frequently Rescheduled",
      subtitle: `${plan.title} has been rescheduled ${plan.rescheduleCount} times`,
      navigationTarget: `/calendar?date=${dayKey(plan.scheduledDate)}`,
      action: { page: "/calendar", entityId: dayKey(plan.scheduledDate), focus: "date" },
      dedupeKey: `planner-reschedule-${plan._id}`,
      expiresAt: null,
      metadata: { plannedWorkoutId: plan._id },
    });
  });

  const byDate = new Map();
  activePlans.forEach((plan) => {
    const key = dayKey(plan.scheduledDate);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(plan);
  });
  byDate.forEach((plans, dateKey) => {
    if (plans.length < 2) return;
    const ids = plans.map((p) => p._id).sort().join("-");
    reminders.push({
      type: "plannerOverlap",
      category: "reminders",
      icon: "Layers",
      title: "Overlapping Plans",
      subtitle: `${plans.length} workouts are planned for the same day`,
      navigationTarget: `/calendar?date=${dateKey}`,
      action: { page: "/calendar", entityId: dateKey, focus: "date" },
      dedupeKey: `planner-overlap-${ids}`,
      expiresAt: new Date(new Date(plans[0].scheduledDate).setHours(23, 59, 59, 999)),
      metadata: { plannedWorkoutIds: plans.map((p) => p._id) },
    });
  });

  const seenSeries = new Set();
  activePlans.forEach((plan) => {
    if (!plan.recurrenceGroupId || !plan.recurrence?.endDate) return;
    if (seenSeries.has(plan.recurrenceGroupId)) return;

    const endDate = new Date(plan.recurrence.endDate);
    const daysUntilEnd = Math.floor((endDate.getTime() - now.getTime()) / 86400000);
    if (daysUntilEnd < 0 || daysUntilEnd > SERIES_ENDING_SOON_DAYS) return;

    seenSeries.add(plan.recurrenceGroupId);
    reminders.push({
      type: "plannerSeriesEndingSoon",
      category: "reminders",
      icon: "CalendarClock",
      title: "Series Ending Soon",
      subtitle: `${plan.title}'s recurring series ends ${formatEndDate(endDate)}`,
      navigationTarget: `/calendar?date=${dayKey(plan.scheduledDate)}`,
      action: { page: "/calendar", entityId: dayKey(plan.scheduledDate), focus: "date" },
      dedupeKey: `planner-series-end-${plan.recurrenceGroupId}`,
      expiresAt: endDate,
      metadata: { recurrenceGroupId: plan.recurrenceGroupId },
    });
  });

  return reminders;
}
