// DATA layer — computes nothing new. Every value here comes straight from
// the existing deterministic intelligence/trainingIntelligence engines and
// stored Goal fields; this module's only job is bundling exactly what
// guidanceEngine.js needs into one object, using the real field names those
// engines already report (see client/src/intelligence, client/src/
// trainingIntelligence, client/src/utils/goalAnalytics.js). No metric here
// is invented — anything not already computed elsewhere in the app is
// intentionally left out of Guidance for this phase (e.g. recovery/HRV/
// sleep, and per-exercise overload, which needs a specific exercise picked
// rather than an aggregate signal).
import { getMusclePlateaus } from "../intelligence/plateauEngine";
import { getTrainingBalance } from "../intelligence/balanceEngine";
import { getMusclePriorities } from "../intelligence/musclePriorityEngine";
import { getWeeklyGrade } from "../intelligence/weeklyGradeEngine";
import { getAvailableMuscles } from "../progression/progressionFilters";
import { getGoalAnalytics } from "../utils/goalAnalytics";
import { generateWeeklyCoachReport } from "../trainingIntelligence/generateWeeklyCoachReport";

export function buildGuidanceData(workouts, goals) {
  const availableMuscles = getAvailableMuscles(workouts);

  return {
    plateaus: getMusclePlateaus(workouts, availableMuscles, {}),
    trainingBalance: getTrainingBalance(workouts, {}),
    musclePriorities: getMusclePriorities(workouts),
    weeklyGrade: getWeeklyGrade(workouts),
    weeklyCoachReport: generateWeeklyCoachReport(workouts),
    goals: (goals || []).map((goal) => ({ goal, analytics: getGoalAnalytics(goal) })),
  };
}
