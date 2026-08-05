// generateExerciseRecommendations — per-exercise composite for
// Progression/Exercise Intelligence surfaces (sections 5 & 12): overload
// suggestion, plateau status, and exercise insights (trend/consistency/
// best set). Composes overloadEngine, plateauEngine, exerciseIntelligence
// — no new per-exercise math.
import { getOverloadSuggestion, getExercisePlateau, getExerciseInsights } from "../intelligence";

export function generateExerciseRecommendations(workouts, exerciseName, options = {}) {
  const overload = getOverloadSuggestion(workouts, exerciseName, options);
  const plateau = getExercisePlateau(workouts, exerciseName, options);
  const insights = getExerciseInsights(workouts, exerciseName, options);

  return { exercise: exerciseName, overload, plateau, insights };
}
