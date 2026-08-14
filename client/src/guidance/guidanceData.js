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
