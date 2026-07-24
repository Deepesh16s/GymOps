// Phase 13C, section 2 — Goal Progress Reminders. Reuses
// utils/goalAnalytics.js's getGoalAnalytics EXCLUSIVELY for every number
// here (remaining/percent/daysRemaining/health) — nothing in this file
// re-derives a goal's progress. Distinct from dashboardInsights.js's
// computeGoalFocusItem: that picks the single NEAREST goal for Today's
// Brief's one-line hero slot; this generates one reminder per goal
// that's actually worth surfacing, since the Notification Center (unlike
// the hero) can hold several at once.
import { getGoalAnalytics } from "../utils/goalAnalytics";
import { GOAL_PERIODS } from "../constants/goalTypes";

// A goal below this progress is routine, ongoing work — not yet worth a
// dedicated reminder. Above it, a nudge is genuinely useful ("almost
// there").
const PROGRESS_REMINDER_THRESHOLD = 50;
const MILESTONE_ALMOST_THRESHOLD = 85;

// 13C.1 — one stable identity per GOAL, shared by all three states
// below (progress / expiring-today / milestone-almost). Since the
// subtitle carries the real remaining amount, a genuine change in
// progress changes the content and bypasses the regeneration cooldown
// immediately (section "Goal reminder: only regenerate after meaningful
// progress changed") — this file never has to track "did the value
// change" itself; notificationService.js's content comparison does that
// generically for every reminder type.
export function generateGoalReminders(goals) {
  const reminders = [];

  goals.forEach((goal) => {
    if (goal.status === "Completed") return;
    const analytics = getGoalAnalytics(goal);
    if (analytics.remaining <= 0) return;

    const isCardio = goal.type === "Cardio Goal";
    const category = isCardio ? "cardio" : "reminders";
    const action = { page: "/goals", entityId: goal._id, focus: "scrollToGoal" };

    // Phase 13D, Part A.4 — Reminder Explanation: the phase's own
    // "Cardio Reminder -> Why? -> 2 km remaining / Weekly goal ends
    // tomorrow" example, built from the SAME analytics fields the
    // subtitle above already reads (remaining, hasDeadline,
    // daysRemaining) — nothing new computed, just itemized.
    const explanation = [`${analytics.remaining.toLocaleString()} ${goal.unit} remaining`];
    if (analytics.hasDeadline && analytics.daysRemaining != null && analytics.daysRemaining <= 1) {
      explanation.push(
        analytics.daysRemaining === 0 ? `${goal.title} goal ends today` : `${goal.title} goal ends tomorrow`
      );
    }

    if (goal.period === GOAL_PERIODS.MILESTONE && analytics.percent >= MILESTONE_ALMOST_THRESHOLD) {
      reminders.push({
        type: "milestoneAlmostComplete",
        category,
        icon: "Trophy",
        title: goal.title,
        subtitle: "One more session should complete this milestone",
        navigationTarget: "/goals",
        action,
        dedupeKey: `goal:${goal._id}`,
        expiresAt: null,
        metadata: { goalId: goal._id, explanation },
      });
      return;
    }

    if (analytics.hasDeadline && analytics.daysRemaining === 0) {
      reminders.push({
        type: "goalExpiringToday",
        category,
        icon: "AlertTriangle",
        title: `${goal.title} expires today`,
        subtitle: `${analytics.remaining.toLocaleString()} ${goal.unit} remaining`,
        navigationTarget: "/goals",
        action,
        dedupeKey: `goal:${goal._id}`,
        expiresAt: new Date(new Date().setHours(23, 59, 59, 999)),
        metadata: { goalId: goal._id, explanation },
      });
      return;
    }

    if (analytics.percent >= PROGRESS_REMINDER_THRESHOLD) {
      reminders.push({
        type: "goalProgressReminder",
        category,
        icon: "Target",
        title: goal.title,
        subtitle: `${analytics.remaining.toLocaleString()} ${goal.unit} remaining`,
        navigationTarget: "/goals",
        action,
        dedupeKey: `goal:${goal._id}`,
        expiresAt: null,
        metadata: { goalId: goal._id, explanation },
      });
    }
  });

  return reminders;
}
