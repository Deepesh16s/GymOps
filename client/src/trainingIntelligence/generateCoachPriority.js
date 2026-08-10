import { getMuscleRecoveryScores, getMusclePlateaus, getFatigueLevel } from "../intelligence";
import { getAvailableMuscles } from "../progression/progressionFilters";
import { generateGoalReminders } from "../reminders/goalReminders";
import { generatePlannerReminders } from "../reminders/plannerReminders";
import { generateStreakReminders } from "../reminders/streakReminders";
import { TYPE_PRIORITY } from "../constants/notificationTypes";

const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };
const CATEGORY_RANK = { recovery: 0, goal: 1, plateau: 2, fatigue: 3, planner: 4, streak: 5 };

function recoverySignal(workouts) {
  const needsRest = getMuscleRecoveryScores(workouts).filter((r) => r.status === "Needs Rest");
  if (!needsRest.length) return null;
  const muscleNames = needsRest.map((r) => r.muscle).sort();
  return {
    category: "recovery",
    severity: needsRest.length >= 2 ? "critical" : "high",
    title: needsRest.length === 1 ? `${muscleNames[0]} needs rest` : `${needsRest.length} muscle groups need rest`,
    detail: "Recovery score below 50 — consider a lighter session or a different muscle group today.",
    navigationTarget: "/analytics",
  };
}

function plateauSignal(workouts) {
  const muscles = getAvailableMuscles(workouts);
  const confirmed = getMusclePlateaus(workouts, muscles).filter((p) => p.plateauLevel === "Confirmed");
  if (!confirmed.length) return null;
  const muscleNames = confirmed.map((p) => p.muscle).sort();
  return {
    category: "plateau",
    severity: "medium",
    title:
      confirmed.length === 1 ? `${muscleNames[0]} has plateaued` : `${confirmed.length} muscle groups have plateaued`,
    detail: "Volume has stalled — consider progressive overload or a deload.",
    navigationTarget: "/analytics",
  };
}

function fatigueSignal(workouts) {
  const fatigue = getFatigueLevel(workouts);
  if (fatigue.band !== "High" && fatigue.band !== "Very High") return null;
  return {
    category: "fatigue",
    severity: fatigue.band === "Very High" ? "critical" : "high",
    title: `${fatigue.band} fatigue`,
    detail: "Recent training load is elevated — consider a lighter session or a rest day.",
    navigationTarget: "/analytics",
  };
}

function reminderSignal(category, reminders, navigationTarget) {
  if (!reminders.length) return null;
  const withPriority = reminders.map((r) => ({ ...r, priority: r.priority || TYPE_PRIORITY[r.type] || "medium" }));
  const top = withPriority.sort((a, b) => SEVERITY_RANK[a.priority] - SEVERITY_RANK[b.priority])[0];
  return {
    category,
    severity: top.priority,
    title: top.title,
    detail: top.subtitle,
    navigationTarget: top.navigationTarget || navigationTarget,
  };
}

export function generateCoachPriority(workouts, { goals = [], plannedWorkouts = [] } = {}) {
  const signals = [
    recoverySignal(workouts),
    reminderSignal("goal", generateGoalReminders(goals), "/goals"),
    plateauSignal(workouts),
    fatigueSignal(workouts),
    reminderSignal("planner", generatePlannerReminders(plannedWorkouts), "/calendar"),
    reminderSignal("streak", generateStreakReminders(workouts), "/dashboard"),
  ].filter(Boolean);

  signals.sort((a, b) => {
    const severityDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category];
  });

  return { top: signals[0] || null, signals };
}
