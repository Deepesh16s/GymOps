// Phase 13B — Planner Analytics: stats about the PLANNING process itself
// (did you schedule, did you follow through, did you have to move it) —
// deliberately computed only from PlannedWorkout documents, never mixed
// with Workout-based analytics (workoutUtils.js/goalAnalytics.js/
// progressionEngine.js). This lives on the Calendar page, not
// Analytics.jsx, per the same separation.
const MS_PER_DAY = 86400000;

// Monday-start week boundaries, matching the convention already used by
// dashboardInsights.js's weekKey / server startOfWeek.
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

// Consecutive weeks, ending this week, with at least one plan actually
// completed (status === "Completed") — the planning-side sibling of
// dashboardInsights.js's computeConsecutiveTrainedWeeks, but keyed off
// "did a plan get followed through" rather than "was anything logged".
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

// Every figure here is independently derivable from the plannedWorkouts
// array alone (no Workout documents, no other engine) — if the array is
// empty, every count is honestly 0 rather than omitted, since "you
// haven't planned anything yet" is itself the useful signal (see the
// empty-state copy in Calendar.jsx).
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
