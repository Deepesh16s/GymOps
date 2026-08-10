import { getMusclePriorities, getDeloadRecommendation } from "../intelligence";

export function generatePrioritySummary(workouts) {
  return {
    priorities: getMusclePriorities(workouts),
    deload: getDeloadRecommendation(workouts),
  };
}
