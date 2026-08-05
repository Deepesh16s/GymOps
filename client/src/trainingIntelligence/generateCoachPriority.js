// User feedback ⭐2 — "Coach Priority": Recovery/Goal/Plateau/Fatigue/
// Planner/Streak can all have something to say at once, with no single
// consistent rule for which one matters most right now. This is that
// ONE ranking — every consumer (Dashboard's leading banner today; any
// future surface) reads from here rather than picking its own order.
//
// Recovery/Plateau/Fatigue are read DIRECTLY off their own Phase 14A
// engines — no existing reminder type covers "still fatigued/plateaued/
// under-recovered right now" the way this needs. Goal/Planner/Streak
// instead reuse the EXISTING reminder generators
// (reminders/goalReminders.js, plannerReminders.js, streakReminders.js)
// — their trigger logic is already correct; re-deriving it here would be
// exactly the duplicated business logic Phase 14B forbids.
import { getMuscleRecoveryScores, getMusclePlateaus, getFatigueLevel } from "../intelligence";
import { getAvailableMuscles } from "../progression/progressionFilters";
import { generateGoalReminders } from "../reminders/goalReminders";
import { generatePlannerReminders } from "../reminders/plannerReminders";
import { generateStreakReminders } from "../reminders/streakReminders";
import { TYPE_PRIORITY } from "../constants/notificationTypes";

const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };
// Category tiebreak when severities are equal — matches the order the
// feedback's own example ladder listed (Recovery, Goal, ..., Planner),
// with Plateau/Fatigue/Streak filling the remaining "Insight" tier.
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
    // Points to Analytics' Training Intelligence tab (the full per-muscle
    // Recovery breakdown), not "/dashboard" — this banner IS the
    // dashboard, so that target would be a dead click (navigating to the
    // page already being viewed).
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

// Resolves each reminder candidate's priority the SAME way
// reminders/reminderEngine.js's own generateReminders does
// (r.priority || TYPE_PRIORITY[r.type] || "medium") — these generators
// are called directly here, bypassing that orchestrator, so this
// mirrors its one resolution step rather than skipping it.
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

// The orchestrator: composes all 6 signals (omitting any with nothing
// to say right now), ranks them severity-first then by the fixed
// category order, and returns the FULL ranked list — `top` is "the one
// thing the coach would tell you right now", but every consumer can see
// the whole ordering, not just the winner.
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
