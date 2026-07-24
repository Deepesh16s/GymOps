// Phase 13B — pure date-math for recurring planned workouts: which
// concrete calendar dates a recurrence rule expands to, and which
// documents an "only this / future / entire series" edit touches. No
// model/DB access here — PURE module, same discipline
// server/utils/goalMetrics.js already follows.
const { RECURRENCE_HORIZON_DAYS } = require("../constants/plannedWorkoutTypes");

const MS_PER_DAY = 86400000;

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const startOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMon);
  return monday;
};

const atMidnight = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Every concrete calendar date a recurrence rule produces, starting at
// `scheduledDate` (always included, even if recurrence.type is "none")
// and bounded by whichever is sooner: recurrence.endDate or the
// RECURRENCE_HORIZON_DAYS runway from today.
function generateRecurrenceDates(scheduledDate, recurrence) {
  const start = atMidnight(scheduledDate);

  if (!recurrence || recurrence.type === "none") return [start];

  const horizonEnd = atMidnight(addDays(new Date(), RECURRENCE_HORIZON_DAYS));
  const seriesEnd = recurrence.endDate
    ? new Date(Math.min(atMidnight(recurrence.endDate).getTime(), horizonEnd.getTime()))
    : horizonEnd;

  const interval = Math.max(1, Number(recurrence.interval) || 1);
  const dates = [];

  if (recurrence.type === "daily") {
    let cursor = start;
    while (cursor <= seriesEnd) {
      dates.push(cursor);
      cursor = addDays(cursor, interval);
    }
    return dates;
  }

  if (recurrence.type === "weekly" || recurrence.type === "customWeekdays") {
    const weekdays = recurrence.weekdays?.length ? recurrence.weekdays : [start.getDay()];
    const firstWeekStart = startOfWeek(start);
    let cursor = start;
    while (cursor <= seriesEnd) {
      if (weekdays.includes(cursor.getDay())) {
        const weeksSinceStart = Math.round(
          (startOfWeek(cursor).getTime() - firstWeekStart.getTime()) / (7 * MS_PER_DAY)
        );
        if (weeksSinceStart % interval === 0) dates.push(new Date(cursor));
      }
      cursor = addDays(cursor, 1);
    }
    return dates;
  }

  if (recurrence.type === "monthly") {
    const dayOfMonth = start.getDate();
    let cursor = start;
    while (cursor <= seriesEnd) {
      dates.push(cursor);
      const next = new Date(cursor);
      next.setMonth(next.getMonth() + interval, 1);
      // Clamp to the target month's real last day (e.g. "the 31st"
      // recurring into a 30-day month) rather than overflowing into
      // the month after.
      const daysInNextMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(dayOfMonth, daysInNextMonth));
      cursor = next;
    }
    return dates;
  }

  return [start];
}

// Which documents an edit/cancel with the given scope should touch,
// given the FULL set of sibling documents in a recurrence group (already
// fetched by the caller) and the specific instance the user acted on.
function selectEditTargets(scope, targetInstance, allSeriesInstances) {
  if (scope === "only" || !targetInstance.recurrenceGroupId) return [targetInstance];

  if (scope === "future") {
    return allSeriesInstances.filter(
      (doc) => doc.scheduledDate.getTime() >= targetInstance.scheduledDate.getTime()
    );
  }

  // "series"
  return allSeriesInstances;
}

module.exports = {
  generateRecurrenceDates,
  selectEditTargets,
};
