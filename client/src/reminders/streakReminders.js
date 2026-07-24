// Phase 13C, section 4 — Streak Protection. Reuses
// dashboardInsights.computeStreakNudge EXCLUSIVELY for the "at risk"
// walk (anchored at yesterday so an ongoing streak isn't mistaken for
// already-broken the instant today hasn't been logged yet) — the exact
// same function backing Today's Brief's own streak line. Cardio gets the
// same walk over cardio-only entries, not a second streak algorithm.
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
      // 13C.1 — stable, no date: this condition is only ever true for a
      // single calendar day by construction (computeStreakNudge itself
      // stops returning a value the day after, once "yesterday" falls
      // outside the streak) — see notificationService.js's cooldown for
      // why a stable key here doesn't cause any cross-day bleed.
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
