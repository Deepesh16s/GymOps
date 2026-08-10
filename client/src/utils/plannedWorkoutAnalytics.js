const MS_PER_DAY = 86400000;

function startOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMon);
  return d;
}

function weekKey(date) {
  return startOfWeek(new Date(date)).getTime();
}

function computeCurrentPlanningStreak(plannedWorkouts) {
  const completedWeeks = new Set(
    plannedWorkouts
      .filter((p) => p.status === "Completed")
      .map((p) => weekKey(p.scheduledDate))
  );
  if (!completedWeeks.size) return 0;

  let cursor = startOfWeek(new Date()).getTime();
  let streak = 0;
  while (completedWeeks.has(cursor)) {
    streak += 1;
    cursor -= 7 * MS_PER_DAY;
  }
  return streak;
}

export function getPlannerAnalytics(plannedWorkouts) {
  const thisWeekKey = weekKey(new Date());
  const plannedThisWeek = plannedWorkouts.filter(
    (p) => weekKey(p.scheduledDate) === thisWeekKey && p.status !== "Cancelled"
  ).length;

  const completed = plannedWorkouts.filter((p) => p.status === "Completed").length;
  const missed = plannedWorkouts.filter((p) => p.status === "Missed").length;
  const rescheduled = plannedWorkouts.filter((p) => (p.rescheduleCount || 0) > 0).length;

  const decided = completed + missed;
  const completionRate = decided > 0 ? Math.round((completed / decided) * 100) : null;

  return {
    plannedThisWeek,
    completed,
    missed,
    rescheduled,
    completionRate,
    currentStreak: computeCurrentPlanningStreak(plannedWorkouts),
  };
}
