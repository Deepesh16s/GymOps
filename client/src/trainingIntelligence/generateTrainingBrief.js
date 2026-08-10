import {
  getMuscleRecoveryScores,
  getTodaysReadiness,
  getFatigueLevel,
  getWeeklyGrade,
  getTrainingBalance,
} from "../intelligence";
import { getTodaysBrief } from "../utils/dashboardInsights";
import { getConfidence } from "../utils/confidenceUtils";
import { MUSCLE_SPLIT_CATEGORY } from "../constants/muscles";

function averageRecoveryScore(recoveryScores) {
  if (!recoveryScores.length) return null;
  return Math.round(recoveryScores.reduce((s, r) => s + r.recoveryScore, 0) / recoveryScores.length);
}

function describeRecoveryStatus(score) {
  if (score >= 85) return "fully recovered";
  if (score >= 50) return "partially recovered";
  return "still recovering";
}

const PLURAL_CATEGORIES = new Set(["Legs"]);

function buildExplanationSections({ recoveryScores, recoveryScore, recommendationItem, goalItem, fatigue }) {
  const sections = [];
  const isCategoryRecommendation = recommendationItem?.key === "workoutRecommendation";
  const recommendedCategory = isCategoryRecommendation ? recommendationItem.mostOverdueCategory : null;

  if (recommendedCategory) {
    const inCategory = recoveryScores.filter((r) => MUSCLE_SPLIT_CATEGORY[r.muscle] === recommendedCategory);
    if (inCategory.length) {
      const avg = Math.round(inCategory.reduce((s, r) => s + r.recoveryScore, 0) / inCategory.length);
      const plural = PLURAL_CATEGORIES.has(recommendedCategory);
      const status = describeRecoveryStatus(avg);
      sections.push({
        key: "recovery",
        tone: avg >= 85 ? "success" : avg >= 50 ? "neutral" : "warning",
        heading: "Recovery",
        sentence:
          avg >= 50
            ? `${recommendedCategory} ${plural ? "are" : "is"} ${status} and ready to train.`
            : `${recommendedCategory} ${plural ? "are" : "is"} ${status} — a lighter session may be worth considering.`,
      });
    }
  } else if (recoveryScore != null) {
    sections.push({
      key: "recovery",
      tone: recoveryScore >= 85 ? "success" : recoveryScore >= 50 ? "neutral" : "warning",
      heading: "Recovery",
      sentence: `Your overall recovery is ${describeRecoveryStatus(recoveryScore)}.`,
    });
  }

  if (recommendedCategory) {
    const days = recommendationItem.mostOverdueDays;
    const plural = PLURAL_CATEGORIES.has(recommendedCategory);
    sections.push({
      key: "priority",
      tone: "neutral",
      heading: "Priority",
      sentence: `${recommendedCategory} ${plural ? "haven't" : "hasn't"} been trained for ${days} day${
        days === 1 ? "" : "s"
      }, making ${plural ? "them" : "it"} your highest-priority muscle group today.`,
    });
  }

  if (goalItem) {
    const goalCategory = goalItem.muscleGroup ? MUSCLE_SPLIT_CATEGORY[goalItem.muscleGroup] : null;
    const isRelated = recommendedCategory && goalCategory && goalCategory === recommendedCategory;
    sections.push({
      key: "goal",
      tone: "neutral",
      heading: "Goal Impact",
      sentence: isRelated
        ? `Today's ${recommendedCategory} session supports your ${goalItem.title} goal — ${goalItem.detail.toLowerCase()}.`
        : `You also have an active ${goalItem.title} goal — ${goalItem.detail.toLowerCase()}.`,
    });
  }

  if (fatigue.band) {
    const phrase =
      fatigue.band === "Low"
        ? "Overall fatigue is low, making today a good day for a demanding workout."
        : fatigue.band === "Medium"
        ? "Overall fatigue is moderate — a normal training day."
        : fatigue.band === "High"
        ? "Overall fatigue is elevated — consider an easier session today."
        : "Overall fatigue is very high — consider a rest day or active recovery.";
    sections.push({
      key: "fatigue",
      tone: fatigue.band === "Low" ? "success" : fatigue.band === "Medium" ? "neutral" : "warning",
      heading: "Fatigue",
      sentence: phrase,
    });
  }

  return { sections, recommendedCategory };
}

export function generateTrainingBrief(workouts, goals, options = {}) {
  const recoveryScores = getMuscleRecoveryScores(workouts);
  const recoveryScore = averageRecoveryScore(recoveryScores);
  const readiness = getTodaysReadiness(workouts);
  const fatigue = getFatigueLevel(workouts);
  const weeklyGrade = getWeeklyGrade(workouts);
  const trainingBalance = getTrainingBalance(workouts);

  const brief = getTodaysBrief(workouts, goals, options);
  const recommendationItem =
    brief.find((item) => item.key === "plannedWorkout" || item.key === "workoutRecommendation") || null;
  const goalItem = brief.find((item) => item.key === "goalFocus") || null;

  const { sections: explanationSections, recommendedCategory } = buildExplanationSections({
    recoveryScores,
    recoveryScore,
    recommendationItem,
    goalItem,
    fatigue,
  });

  const recoveryConfidence = getConfidence(recoveryScores.length, "muscle");

  return {
    recoveryScore,
    recoveryConfidence: recoveryConfidence.level,
    recoveryConfidenceReason: recoveryConfidence.reason,
    recoveryBreakdown: recoveryScores,
    readiness: readiness.readiness,
    readinessConfidence: readiness.confidence,
    readinessConfidenceReason: readiness.confidenceReason,
    readinessLabel: readiness.recommendation,
    recommendedWorkout: recommendationItem?.title || null,
    fatigueBand: fatigue.band,
    fatigueConfidence: fatigue.confidence,
    fatigueConfidenceReason: fatigue.confidenceReason,
    weeklyGrade: weeklyGrade.grade,
    weeklyGradeConfidence: weeklyGrade.confidence,
    weeklyGradeConfidenceReason: weeklyGrade.confidenceReason,
    trainingBalance,
    explanationSections,
    recommendedCategory,
    generatedAt: new Date(),
    brief,
  };
}
