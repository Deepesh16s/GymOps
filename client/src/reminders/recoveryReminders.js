// Phase 13C, section 3 — Recovery Reminders. Reuses
// workoutUtils.computeMuscleBreakdown EXCLUSIVELY (the same function
// dashboardInsights.js's workout recommendation and MuscleBodyMap both
// already read lastTrained from) — no recovery math is re-derived here.
// Supersedes utils/notificationRules.js's buildRecoveryCompleteCandidates
// (folded into the reminder engine, not duplicated alongside it), and
// adds section 10's grouping: multiple muscles recovering the same day
// collapse into ONE reminder instead of one per muscle.
import { computeMuscleBreakdown } from "../utils/workoutUtils";
import { daysAgo } from "./reminderUtils";

// A muscle trained recently enough to have caused real fatigue (within
// the window this app already treats as meaningful — mirrors the prior
// notificationRules.js threshold) that has now rested exactly 2 full
// days — fires once per real training-then-rest cycle.
const RECOVERY_WINDOW_DAYS = 2;

export function generateRecoveryReminders(workouts) {
  const breakdown = computeMuscleBreakdown(workouts);

  const recovered = breakdown.filter(
    (entry) => entry.lastTrained && daysAgo(entry.lastTrained) === RECOVERY_WINDOW_DAYS
  );
  if (!recovered.length) return [];

  const muscleNames = recovered.map((e) => e.muscle).sort();
  // 13C.1 — stable per muscle-set, no date baked in: identity is "this
  // exact grouping of muscles recovering together", regeneration timing
  // is the cooldown window (or an immediate bypass if the grouping's
  // content differs from what was last shown — see notificationService.js).
  const groupKey = muscleNames.join("-").toLowerCase();

  const subtitle =
    recovered.length === 1
      ? `${muscleNames[0]} is ready to train again`
      : `${recovered.length} muscle groups are fully recovered`;

  // Section 12: "expires after next session" — there's no future date to
  // point at yet (no scheduler), so this approximates it with a fixed
  // grace window past the recovery date, long enough to be seen and
  // short enough not to linger once genuinely stale. Documented as a
  // known limitation rather than true "next session" expiry.
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
