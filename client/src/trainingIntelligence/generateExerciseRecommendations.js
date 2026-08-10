import { getOverloadSuggestion, getExercisePlateau, getExerciseInsights } from "../intelligence";

export function generateExerciseRecommendations(workouts, exerciseName, options = {}) {
  const overload = getOverloadSuggestion(workouts, exerciseName, options);
  const plateau = getExercisePlateau(workouts, exerciseName, options);
  const insights = getExerciseInsights(workouts, exerciseName, options);

  return { exercise: exerciseName, overload, plateau, insights };
}
