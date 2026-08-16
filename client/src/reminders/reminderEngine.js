import { generateWorkoutReminders } from "./workoutReminders";
import { generateGoalReminders } from "./goalReminders";
import { generateStreakReminders } from "./streakReminders";
import { generateNeglectReminders } from "./neglectReminders";
import { generateCardioReminders } from "./cardioReminders";
import { generatePlannerReminders } from "./plannerReminders";
import { generateAchievementReminders } from "./achievementReminders";
import { generateIntelligenceReminders } from "./intelligenceReminders";
import { isReminderCategoryEnabled } from "./reminderPreferences";
import { TYPE_PRIORITY, getPriorityRank, getReminderPreferenceCategory } from "../constants/notificationTypes";
import { dayKey } from "./reminderUtils";

export function prioritizeReminders(reminders) {
  return [...reminders].sort(
    (a, b) => getPriorityRank(a.priority) - getPriorityRank(b.priority)
  );
}

const GROUPABLE_MIN_COUNT = 3;

export function groupReminders(reminders) {
  const groupable = reminders.filter(
    (r) => r.priority === "low" || r.priority === "medium"
  );
  const rest = reminders.filter((r) => !groupable.includes(r));

  const byCategory = new Map();
  groupable.forEach((r) => {
    if (!byCategory.has(r.category)) byCategory.set(r.category, []);
    byCategory.get(r.category).push(r);
  });

  const result = [...rest];
  byCategory.forEach((items, category) => {
    if (items.length < GROUPABLE_MIN_COUNT) {
      result.push(...items);
      return;
    }
    const keys = items.map((i) => i.dedupeKey).sort();
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    result.push({
      type: "groupedReminder",
      category,
      priority: items.some((i) => i.priority === "medium") ? "medium" : "low",
      icon: "Bell",
      title: `${items.length} ${category} reminders`,
      subtitle: items.map((i) => i.title).join(", "),
      navigationTarget: null,
      dedupeKey: `grouped:${category}:${dayKey(new Date())}`,
      expiresAt: endOfToday,
      metadata: { groupedDedupeKeys: keys },
    });
  });

  return result;
}

export function generateReminders({ workouts = [], goals = [], plannedWorkouts = [] } = {}) {
  const raw = [
    ...generateWorkoutReminders(plannedWorkouts),
    ...generateGoalReminders(goals),
    ...generateStreakReminders(workouts),
    ...generateNeglectReminders(workouts),
    ...generateCardioReminders(workouts),
    ...generatePlannerReminders(plannedWorkouts),
    ...generateAchievementReminders(workouts),
    ...generateIntelligenceReminders(workouts),
  ];

  const withPriority = raw.map((r) => ({
    ...r,
    priority: r.priority || TYPE_PRIORITY[r.type] || "medium",
  }));

  const enabled = withPriority.filter((r) =>
    isReminderCategoryEnabled(getReminderPreferenceCategory(r.type))
  );

  return prioritizeReminders(groupReminders(enabled));
}
