// generatePrioritySummary — what deserves attention right now (used by
// Planner's conflict warnings and any "what should I prioritize" UI).
// Composes musclePriorityEngine (Module 11) and deloadEngine (Module 6)
// — both already self-contained aggregations over the other engines.
import { getMusclePriorities, getDeloadRecommendation } from "../intelligence";

export function generatePrioritySummary(workouts) {
  return {
    priorities: getMusclePriorities(workouts),
    deload: getDeloadRecommendation(workouts),
  };
}
