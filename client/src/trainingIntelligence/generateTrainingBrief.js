// Phase 14B — Training Intelligence Orchestrator. This file (and its
// siblings in this folder) composes Phase 14A's intelligence/ engines
// (and, where already established, utils/dashboardInsights.js) into the
// shapes each UI surface actually needs — it never recomputes a
// recovery score, a trend, or a recommendation itself. Every number here
// traces back to exactly one engine call.
//
// generateTrainingBrief — Dashboard's upgraded "Today's Focus" coaching
// summary (section 2): Recovery Score, Readiness, Recommended Workout,
// Fatigue, Weekly Grade, Training Balance, plus a structured "Why?"
// explanation — reusing dashboardInsights.js's EXISTING getTodaysBrief
// for the recommendation/goal/streak items (never re-derived) and Phase
// 14A's recoveryEngine/readinessEngine/fatigueEngine/musclePriorityEngine/
// weeklyGradeEngine/balanceEngine for everything else. This is the ONE
// call Dashboard makes for its whole "Today's Focus" section — every
// stat tile reads from this single composition, not five separate
// engine calls scattered through the page.
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

// Only "Legs" reads as a plural group among the three categories
// computeWorkoutRecommendation ever recommends (Push/Pull/Legs) — used
// to pick "is/are" and "it/them" so the sentence reads naturally instead
// of a generic, slightly-off "Legs is ready".
const PLURAL_CATEGORIES = new Set(["Legs"]);

// Phase 14B.1 — Premium Recommendation Explanation. Replaces the old
// flat `explanation: string[]` bullet dump with a small set of
// STRUCTURED, optional sections (icon + heading + one coaching sentence
// each) — "why is GymOps recommending this today", not "what variables
// were calculated". Every fact here is read from values already computed
// above or already returned by dashboardInsights.js's own recommendation
// item — nothing is a second, independently-computed number that could
// ever disagree with what the recommendation title/tiles already say
// (the single-source-of-truth rule this phase is built around).
function buildExplanationSections({ recoveryScores, recoveryScore, recommendationItem, goalItem, fatigue }) {
  const sections = [];
  const isCategoryRecommendation = recommendationItem?.key === "workoutRecommendation";
  const recommendedCategory = isCategoryRecommendation ? recommendationItem.mostOverdueCategory : null;

  // RECOVERY — about the SPECIFIC muscle group being recommended when a
  // category-based recommendation is active (what the reader is actually
  // being told to train), so it never reads as a disconnected, generic
  // status. Falls back to the overall average when there's no active
  // category recommendation (e.g. a planned workout already exists).
  // Either way, this reuses recoveryScores/recoveryScore computed above —
  // never a second recovery computation.
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

  // PRIORITY — ONLY rendered for the category-based recommendation, and
  // built EXCLUSIVELY from that SAME item's own mostOverdueCategory/
  // mostOverdueDays (dashboardInsights.js's computeWorkoutRecommendation)
  // — never musclePriorityEngine's independently-computed per-muscle
  // overdue read, which groups by individual muscle rather than category
  // and could legitimately name a different muscle or day count. This is
  // what guarantees the header ("Train {category} today") and this
  // sentence can never disagree.
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

  // GOAL IMPACT — only when a real nearest active goal exists (already
  // selected by getTodaysBrief's own goalFocus item — never re-picked
  // here). Only claims the workout "supports" the goal when there's a
  // REAL, verifiable link (the goal's own linked exercise's muscle group
  // falls in the recommended category) — otherwise this stays an honest,
  // uncorrelated mention rather than a fabricated causal claim.
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

  // FATIGUE — always whole-body (fatigueEngine has no per-muscle
  // concept, matching its own scope), shown whenever a band is available.
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

  // recommendedCategory is returned alongside sections (not just used
  // internally) so the UI can build a specific heading ("Why GymOps
  // recommends Legs today") from the SAME value the sections themselves
  // were built from, rather than re-deriving or string-parsing it from
  // the recommendation title.
  return { sections, recommendedCategory };
}

export function generateTrainingBrief(workouts, goals, options = {}) {
  const recoveryScores = getMuscleRecoveryScores(workouts);
  const recoveryScore = averageRecoveryScore(recoveryScores);
  const readiness = getTodaysReadiness(workouts);
  const fatigue = getFatigueLevel(workouts);
  const weeklyGrade = getWeeklyGrade(workouts);
  const trainingBalance = getTrainingBalance(workouts);

  // Reuses getTodaysBrief EXACTLY as Dashboard's hero already does —
  // this orchestrator doesn't decide "what to train today" a second
  // time, it just reads whichever item that function already produced
  // as the "Recommended Workout" line.
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

  // Recovery Score confidence scales with how many muscles fed the
  // average — a distinct (but equally standardized) sample-size basis
  // from each individual muscle's own confidence (which Analytics'
  // Recovery section shows per-row); more muscles averaged together is
  // a more robust claim about "recovery" overall.
  const recoveryConfidence = getConfidence(recoveryScores.length, "muscle");

  return {
    recoveryScore,
    recoveryConfidence: recoveryConfidence.level,
    recoveryConfidenceReason: recoveryConfidence.reason,
    // Full per-muscle breakdown — lets the UI answer "why 82?" without a
    // second getMuscleRecoveryScores call.
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
    // User feedback — "recommendations aren't static": the real moment
    // this composition ran, not a stored/cached value — every engine
    // call above is live on every render, so this timestamp is always
    // genuinely "now".
    generatedAt: new Date(),
    // The raw Today's Brief items — still available for the hero list
    // itself, so Dashboard doesn't have to call getTodaysBrief a second
    // time alongside this orchestrator.
    brief,
  };
}
