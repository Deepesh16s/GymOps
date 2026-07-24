// Phase 13C, section 8 — Achievement Notifications. Most of these (New
// Lifetime PR, Goal Completed, Milestone/Streak unlocked, Longest
// Workout, First Workout After Break) are already generated
// SERVER-SIDE at write time (server/utils/notificationTriggers.js) — see
// that file's header comment; nothing here re-detects them. This file
// only covers the one achievement that's inherently about the PASSAGE OF
// TIME rather than a specific write — "Highest weekly volume" — which
// supersedes utils/notificationRules.js's buildWeeklyVolumeCandidate
// (folded in here, not duplicated alongside it).
import { getWorkoutVolume, isCardioEntry } from "../utils/workoutUtils";
import { startOfWeek } from "./reminderUtils";

export function generateAchievementReminders(workouts) {
  const now = new Date();
  const thisWeekStart = startOfWeek(now);
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  let thisWeekVolume = 0;
  let lastWeekVolume = 0;
  workouts.forEach((w) => {
    if (isCardioEntry(w)) return;
    const d = new Date(w.date || w.createdAt);
    if (d >= thisWeekStart) thisWeekVolume += getWorkoutVolume(w);
    else if (d >= lastWeekStart && d < thisWeekStart) lastWeekVolume += getWorkoutVolume(w);
  });

  if (lastWeekVolume <= 0 || thisWeekVolume <= lastWeekVolume) return [];
  const changePct = Math.round(((thisWeekVolume - lastWeekVolume) / lastWeekVolume) * 100);
  if (changePct <= 0) return [];

  return [
    {
      type: "weeklyVolumeIncreased",
      category: "insights",
      icon: "TrendingUp",
      title: "Weekly Volume Increased",
      subtitle: `Up ${changePct}% vs last week`,
      navigationTarget: "/analytics",
      action: { page: "/analytics", entityId: null, focus: null },
      // 13C.1 — stable, no week suffix: next week's genuinely different
      // % change is itself a content change that bypasses the cooldown
      // (see notificationService.js), so a rolling key isn't needed to
      // make this refresh weekly — it happens naturally.
      dedupeKey: "weekly-volume-increased",
      expiresAt: null,
      metadata: null,
    },
  ];
}
