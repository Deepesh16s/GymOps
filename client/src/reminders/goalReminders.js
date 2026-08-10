import { getGoalAnalytics } from "../utils/goalAnalytics";
import { GOAL_PERIODS } from "../constants/goalTypes";

const PROGRESS_REMINDER_THRESHOLD = 50;
const MILESTONE_ALMOST_THRESHOLD = 85;

export function generateGoalReminders(goals) {
  const reminders = [];

  goals.forEach((goal) => {
    if (goal.status === "Completed") return;
    const analytics = getGoalAnalytics(goal);
    if (analytics.remaining <= 0) return;

    const isCardio = goal.type === "Cardio Goal";
    const category = isCardio ? "cardio" : "reminders";
    const action = { page: "/goals", entityId: goal._id, focus: "scrollToGoal" };

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
