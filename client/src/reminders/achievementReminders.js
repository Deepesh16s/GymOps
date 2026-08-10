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
      dedupeKey: "weekly-volume-increased",
      expiresAt: null,
      metadata: null,
    },
  ];
}
