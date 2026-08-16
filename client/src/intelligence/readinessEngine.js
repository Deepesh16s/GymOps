import { groupWorkoutsIntoSessions, computeCurrentStreak } from "../utils/workoutUtils";
import { prHistory } from "../utils/strengthUtils";
import { weightedScore, clampScore } from "../utils/scoringUtils";
import { getFatigueLevel } from "./fatigueEngine";
import { EVIDENCE_STRENGTH } from "../constants/evidenceSources";

const READINESS_DISCLAIMER =
  "Repvyn heuristic combining training-load trend, streak length, and recent session difficulty into a single score — not a validated readiness or performance-prediction instrument.";

const MS_PER_DAY = 86400000;
const RECENT_PR_WINDOW_DAYS = 7;
const SESSION_LOOKBACK_FOR_DIFFICULTY = 5;

const READINESS_BANDS = [
  { min: 85, label: "Ready for Heavy Training" },
  { min: 65, label: "Ready for Moderate Training" },
  { min: 40, label: "Light Training Recommended" },
  { min: 0, label: "Rest Recommended" },
];

function countRecentPrAttempts(workouts) {
  const cutoff = Date.now() - RECENT_PR_WINDOW_DAYS * MS_PER_DAY;
  return prHistory(workouts).filter((e) => new Date(e.date).getTime() >= cutoff).length;
}

function computePreviousSessionDifficultyRatio(workouts) {
  const sessionsWithDuration = groupWorkoutsIntoSessions(workouts)
    .filter((s) => s.sessionDuration)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  if (sessionsWithDuration.length < 2) return null;

  const [latest, ...rest] = sessionsWithDuration;
  const comparisonWindow = rest.slice(0, SESSION_LOOKBACK_FOR_DIFFICULTY);
  const avgOthers = comparisonWindow.reduce((s, x) => s + x.sessionDuration, 0) / comparisonWindow.length;
  return avgOthers ? latest.sessionDuration / avgOthers : null;
}

export function getTodaysReadiness(workouts) {
  const fatigue = getFatigueLevel(workouts);
  const consecutiveTrainingDays = computeCurrentStreak(workouts);
  const recentPrAttempts = countRecentPrAttempts(workouts);
  const difficultyRatio = computePreviousSessionDifficultyRatio(workouts);

  const parts = [
    { value: fatigue.fatigueScore != null ? 100 - fatigue.fatigueScore : null, weight: 2.5 },
    {
      value: consecutiveTrainingDays > 0 ? clampScore(100 - consecutiveTrainingDays * 8) : 100,
      weight: 1,
    },
    {
      value: difficultyRatio != null ? clampScore(100 - (difficultyRatio - 1) * 60) : null,
      weight: 1,
    },
    {
      value: recentPrAttempts > 0 ? clampScore(100 - recentPrAttempts * 12) : null,
      weight: 0.5,
    },
  ];

  const readiness = weightedScore(parts);
  const availableInputCount = parts.filter((p) => p.value != null).length;
  const confidence = availableInputCount >= 4 ? "High" : availableInputCount >= 2 ? "Medium" : "Low";
  const confidenceReason = `${availableInputCount} of ${parts.length} readiness signals available`;

  const recommendation = READINESS_BANDS.find((b) => readiness != null && readiness >= b.min)?.label ?? null;

  return {
    readiness,
    confidence,
    confidenceReason,
    recommendation,
    evidenceStrength: EVIDENCE_STRENGTH.INSUFFICIENT,
    evidenceDisclaimer: READINESS_DISCLAIMER,
  };
}
