import { computeStreakNudge } from "../utils/dashboardInsights";
import { isCardioEntry } from "../utils/workoutUtils";

export function generateStreakReminders(workouts) {
  const reminders = [];

  const overall = computeStreakNudge(workouts);
  if (overall) {
    reminders.push({
      type: "streakProtection",
      category: "reminders",
      icon: "Flame",
      title: `${overall.title} at risk`,
      subtitle: "Train today to keep it alive",
      navigationTarget: "/dashboard",
      action: { page: "/dashboard", entityId: null, focus: null },
      dedupeKey: "streak-protection",
      expiresAt: new Date(new Date().setHours(23, 59, 59, 999)),
      metadata: null,
    });
  }

  const cardio = computeStreakNudge(workouts.filter(isCardioEntry));
  if (cardio) {
    reminders.push({
      type: "cardioStreakExpiring",
      category: "cardio",
      icon: "Flame",
      title: "Cardio streak expires today",
      subtitle: `${cardio.title.replace("-day streak", "-day cardio streak")}`,
      navigationTarget: "/dashboard",
      action: { page: "/dashboard", entityId: null, focus: null },
      dedupeKey: "cardio-streak-protection",
      expiresAt: new Date(new Date().setHours(23, 59, 59, 999)),
      metadata: null,
    });
  }

  return reminders;
}
