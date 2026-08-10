import { computeMuscleBreakdown } from "../utils/workoutUtils";
import { daysAgo } from "./reminderUtils";

const RECOVERY_WINDOW_DAYS = 2;

export function generateRecoveryReminders(workouts) {
  const breakdown = computeMuscleBreakdown(workouts);

  const recovered = breakdown.filter(
    (entry) => entry.lastTrained && daysAgo(entry.lastTrained) === RECOVERY_WINDOW_DAYS
  );
  if (!recovered.length) return [];

  const muscleNames = recovered.map((e) => e.muscle).sort();
  const groupKey = muscleNames.join("-").toLowerCase();

  const subtitle =
    recovered.length === 1
      ? `${muscleNames[0]} is ready to train again`
      : `${recovered.length} muscle groups are fully recovered`;

  const expiresAt = new Date(recovered[0].lastTrained);
  expiresAt.setDate(expiresAt.getDate() + 5);
  expiresAt.setHours(23, 59, 59, 999);

  return [
    {
      type: "recoveryComplete",
      category: "progress",
      icon: "HeartPulse",
      title: recovered.length === 1 ? "Recovery Complete" : "Recovered & Ready",
      subtitle,
      navigationTarget: "/dashboard",
      action: { page: "/dashboard", entityId: null, focus: null },
      dedupeKey: `recovery-${groupKey}`,
      expiresAt,
      metadata: { muscles: muscleNames },
    },
  ];
}
