// Phase 14A, Module 11 — Muscle Priority Engine: most overdue muscle,
// fastest-growing muscle, and which muscles are neglected. Reuses
// workoutUtils.computeMuscleBreakdown for lastTrained gaps and
// progression/progressionEngine.js's getMuscleProgression for volume
// growth trends — no new per-muscle computation invented.
import { computeMuscleBreakdown } from "../utils/workoutUtils";
import { getMuscleProgression } from "../progression/progressionEngine";
import { getAvailableMuscles } from "../progression/progressionFilters";
import { getConfidence } from "../utils/confidenceUtils";

const MS_PER_DAY = 86400000;

// Reuses reminders/neglectReminders.js's own "warning" tier (18+ days)
// for what counts as "Neglected" here — the same severity vocabulary
// the Notification Center's neglect reminders already established,
// rather than picking a second, different cutoff for this module.
const NEGLECTED_THRESHOLD_DAYS = 18;

function daysSince(date) {
  return Math.floor((Date.now() - new Date(date).getTime()) / MS_PER_DAY);
}

export function getMusclePriorities(workouts, { rangeKey = "lifetime" } = {}) {
  const breakdown = computeMuscleBreakdown(workouts).filter((e) => e.lastTrained);
  if (!breakdown.length) {
    return { available: false, reason: "Log at least one workout to see muscle priorities." };
  }

  const withGaps = breakdown.map((e) => ({ muscle: e.muscle, daysAgo: daysSince(e.lastTrained) }));
  const mostOverdue = [...withGaps].sort((a, b) => b.daysAgo - a.daysAgo)[0];
  const neglected = withGaps.filter((m) => m.daysAgo >= NEGLECTED_THRESHOLD_DAYS).map((m) => m.muscle);

  const muscles = getAvailableMuscles(workouts);
  const growing = muscles
    .map((muscle) => ({ muscle, progression: getMuscleProgression(workouts, muscle, { rangeKey }) }))
    .filter(({ progression }) => progression.trend.volume?.direction === "up")
    .map(({ muscle, progression }) => ({ muscle, changePct: progression.trend.volume.changePct }))
    .sort((a, b) => b.changePct - a.changePct);

  // Standardized confidence — how many distinct muscles the read is
  // actually spanning (breakdown.length, the same set already used to
  // find mostOverdue/neglected above). A read over 2 muscles is a
  // weaker claim about "priorities" than one spanning 8+.
  const { level: confidence, reason: confidenceReason } = getConfidence(breakdown.length, "muscle");

  return {
    available: true,
    mostOverdue,
    fastestGrowing: growing[0] || null,
    neglected,
    confidence,
    confidenceReason,
  };
}
