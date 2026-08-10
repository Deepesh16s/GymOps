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
      const daysInNextMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(dayOfMonth, daysInNextMonth));
      cursor = next;
    }
    return dates;
  }

  return [start];
}

function selectEditTargets(scope, targetInstance, allSeriesInstances) {
  if (scope === "only" || !targetInstance.recurrenceGroupId) return [targetInstance];

  if (scope === "future") {
    return allSeriesInstances.filter(
      (doc) => doc.scheduledDate.getTime() >= targetInstance.scheduledDate.getTime()
    );
  }

  return allSeriesInstances;
}

module.exports = {
  generateRecurrenceDates,
  selectEditTargets,
};
