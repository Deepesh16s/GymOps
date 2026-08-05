// Phase 14A — Training Intelligence Engine. Single entry point re-
// exporting every module, so a future consumer (Phase 14B's AI coach,
// a Dashboard widget, an Analytics panel) imports from one place
// ("../intelligence") rather than reaching into each engine file
// individually. Mirrors the same barrel-file pattern
// progression/index.js already established for the progression engine.
export { getMuscleRecoveryScores } from "./recoveryEngine";
export { getTodaysReadiness } from "./readinessEngine";
export { getMusclePlateaus, getExercisePlateau, getAllExercisePlateaus } from "./plateauEngine";
export { getOverloadSuggestion } from "./overloadEngine";
export { getFatigueLevel } from "./fatigueEngine";
export { getDeloadRecommendation } from "./deloadEngine";
export {
  computeMuscleGroupSplit,
  summarizeMuscleGroupSplit,
  getTrainingBalance,
  getUpperLowerSplit,
  getStrengthCardioSplit,
} from "./balanceEngine";
export { getVolumeLandmarks, getAllVolumeLandmarks } from "./volumeLandmarkEngine";
export { getExerciseInsights } from "./exerciseIntelligence";
export { getMusclePriorities } from "./musclePriorityEngine";
export { getWeeklyGrade } from "./weeklyGradeEngine";
export { getSmartInsights } from "./insightEngine";
