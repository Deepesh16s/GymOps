import {
  getFatigueLevel,
  getWeeklyGrade,
  getTrainingBalance,
} from "../intelligence";
import { getTodaysBrief } from "../utils/dashboardInsights";
import { MUSCLE_SPLIT_CATEGORY } from "../constants/muscles";

const PLURAL_CATEGORIES = new Set(["Legs"]);

function buildExplanationSections({ recommendationItem, goalItem, fatigue }) {
  const sections = [];
  const isCategoryRecommendation = recommendationItem?.key === "workoutRecommendation";
  const recommendedCategory = isCategoryRecommendation ? recommendationItem.mostOverdueCategory : null;

  if (recommendedCategory) {
    const days = recommendationItem.mostOverdueDays;
    const plural = PLURAL_CATEGORIES.has(recommendedCategory);
    const otherGaps = (recommendationItem.categoryGaps || [])
      .filter((g) => g.category !== recommendedCategory)
      .sort((a, b) => b.daysAgo - a.daysAgo);
    const nextClosest = otherGaps[0] || null;

    const comparison = nextClosest
      ? ` The next-longest gap is ${nextClosest.category} at ${nextClosest.daysAgo} day${
          nextClosest.daysAgo === 1 ? "" : "s"
        }, so ${recommendedCategory} is furthest behind.`
      : "";

    sections.push({
      key: "priority",
      tone: "neutral",
      heading: "Priority",
      sentence: `${recommendedCategory} ${plural ? "haven't" : "hasn't"} been trained for ${days} day${
        days === 1 ? "" : "s"
      } — the longest gap among your tracked muscle groups.${comparison} This is a days-since-trained heuristic; it doesn't account for how much volume ${
        plural ? "they" : "it"
      } typically ${plural ? "get" : "gets"} relative to your other muscle groups.`,
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
        : "Overall fatigue is very high — consider a lighter day.";
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
  const fatigue = getFatigueLevel(workouts);
  const weeklyGrade = getWeeklyGrade(workouts);
  const trainingBalance = getTrainingBalance(workouts);

  const brief = getTodaysBrief(workouts, goals, options);
  const recommendationItem =
    brief.find((item) => item.key === "plannedWorkout" || item.key === "workoutRecommendation") || null;
  const goalItem = brief.find((item) => item.key === "goalFocus") || null;

  const { sections: explanationSections, recommendedCategory } = buildExplanationSections({
    recommendationItem,
    goalItem,
    fatigue,
  });

  return {
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
