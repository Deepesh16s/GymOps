import { computeMuscleBreakdown } from "../utils/workoutUtils";
import { getMuscleProgression } from "../progression/progressionEngine";
import { getAvailableMuscles } from "../progression/progressionFilters";
import { getConfidence } from "../utils/confidenceUtils";

const MS_PER_DAY = 86400000;

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
