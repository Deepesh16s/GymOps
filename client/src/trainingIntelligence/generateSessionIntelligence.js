// Phase 14B, section 6 — Session Intelligence: a compact, per-session
// coaching summary for Workout History. Every value below is derived
// from real logged data via existing utilities/engines — this composes,
// it never recomputes recovery or volume math itself.
//
// "Goal Contribution" (the spec's own third bullet) is deliberately NOT
// included here: a Goal document's `current` is a running total
// recalculated server-side (server/utils/goalMetrics.js) from that
// goal's own period/activityType/metric rules. There is no client-
// exposed way to attribute how much of that total one specific past
// session contributed without re-deriving that same period/metric
// logic client-side — which would duplicate business logic, exactly
// what this phase forbids. Omitted, not guessed.
import { computeMuscleBreakdown, getWorkoutVolume, isCardioEntry } from "../utils/workoutUtils";
import { getMuscleRecoveryScores } from "../intelligence";

const MS_PER_DAY = 86400000;

export function generateSessionIntelligence(workouts, session) {
  const muscles = session.stats?.muscles || [];
  if (!muscles.length) {
    return { available: false, reason: "No strength muscles logged in this session." };
  }

  // Highest Fatigue Contributor — the muscle THIS session put the most
  // volume into, from a breakdown scoped to only this session's own
  // workouts (never the full history).
  const sessionBreakdown = computeMuscleBreakdown(session.workouts).sort((a, b) => b.volume - a.volume);
  const highestFatigueContributor = sessionBreakdown[0] || null;

  // Recovery Impact — the current recovery read for whichever of this
  // session's muscles is LEAST recovered right now. getMuscleRecoveryScores
  // already sorts least-recovered first; this just filters that same
  // output down to the muscles this session actually touched.
  const recoveryScores = getMuscleRecoveryScores(workouts);
  const recoveryImpact = recoveryScores.find((r) => muscles.includes(r.muscle)) || null;

  // Weekly Volume Contribution — this session's own strength volume
  // against the total strength volume logged in the calendar week
  // (Sun-Sat) containing it.
  const sessionDate = new Date(session.date);
  const weekStart = new Date(sessionDate);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekEnd = new Date(weekStart.getTime() + 7 * MS_PER_DAY);
  const weekVolume = workouts
    .filter((w) => !isCardioEntry(w))
    .filter((w) => {
      const t = new Date(w.date || w.createdAt);
      return t >= weekStart && t < weekEnd;
    })
    .reduce((s, w) => s + getWorkoutVolume(w), 0);
  const sessionVolume = session.stats?.volume || 0;
  const weeklyVolumeContributionPct = weekVolume > 0 ? Math.round((sessionVolume / weekVolume) * 100) : null;

  return {
    available: true,
    highestFatigueContributor: highestFatigueContributor
      ? { muscle: highestFatigueContributor.muscle, volume: Math.round(highestFatigueContributor.volume) }
      : null,
    recoveryImpact: recoveryImpact
      ? {
          muscle: recoveryImpact.muscle,
          status: recoveryImpact.status,
          hoursUntilRecovered: recoveryImpact.hoursUntilRecovered,
        }
      : null,
    weeklyVolumeContributionPct,
    // Suggested Recovery Window — reads the SAME recovery score used for
    // Recovery Impact above, never a second computation.
    suggestedRecoveryHours:
      recoveryImpact?.hoursUntilRecovered > 0 ? Math.round(recoveryImpact.hoursUntilRecovered) : null,
  };
}
