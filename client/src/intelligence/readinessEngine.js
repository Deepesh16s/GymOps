// Phase 14A, Module 2 — Readiness Score. A single "how ready am I to
// train today" number, built by aggregating Module 1's per-muscle
// recovery scores with Module 5's fatigue read, consecutive-day load,
// last session's relative difficulty, and recent PR attempts. "Sleep"
// is explicitly listed in the phase spec as a FUTURE input — this app
// has no sleep data anywhere, so it is simply never one of the
// weightedScore parts below, the same "omit rather than guess" rule
// every score in this app already follows (see scoringUtils.js's
// weightedScore, which drops any part whose value is null rather than
// treating it as 0).
import { groupWorkoutsIntoSessions, computeCurrentStreak } from "../utils/workoutUtils";
import { prHistory } from "../utils/strengthUtils";
import { weightedScore, clampScore } from "../utils/scoringUtils";
import { getMuscleRecoveryScores } from "./recoveryEngine";
import { getFatigueLevel } from "./fatigueEngine";

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

// The most recent session's duration relative to the average of the
// last few before it — the only real "how hard was last time" signal
// this app's data supports (no RPE, no per-set timestamps). Returns
// null (not a guess) when there isn't a real duration to compare, or
// not enough session history yet.
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

// Module 2's entry point. Every input already comes from an existing
// engine (Module 1, Module 5) or an existing primitive
// (workoutUtils.computeCurrentStreak, strengthUtils.prHistory) — this
// file is purely an aggregation layer, not a new source of raw
// computation.
export function getTodaysReadiness(workouts) {
  const recoveryScores = getMuscleRecoveryScores(workouts);
  const avgRecovery = recoveryScores.length
    ? recoveryScores.reduce((s, r) => s + r.recoveryScore, 0) / recoveryScores.length
    : null;

  const fatigue = getFatigueLevel(workouts);
  const consecutiveTrainingDays = computeCurrentStreak(workouts);
  const recentPrAttempts = countRecentPrAttempts(workouts);
  const difficultyRatio = computePreviousSessionDifficultyRatio(workouts);

  const parts = [
    { value: avgRecovery, weight: 3 },
    { value: fatigue.fatigueScore != null ? 100 - fatigue.fatigueScore : null, weight: 2.5 },
    // Rest days score highest; every additional consecutive training
    // day nudges readiness down, capped so a long streak doesn't read
    // as "zero readiness" outright.
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
  // Confidence tracks how many of the REAL inputs were actually
  // available, not a fabricated certainty — a readiness number built
  // from all 5 signals is a stronger claim than one built from just
  // recovery scores alone.
  const confidence = availableInputCount >= 4 ? "High" : availableInputCount >= 2 ? "Medium" : "Low";
  const confidenceReason = `${availableInputCount} of ${parts.length} readiness signals available`;

  const recommendation = READINESS_BANDS.find((b) => readiness != null && readiness >= b.min)?.label ?? null;

  return { readiness, confidence, confidenceReason, recommendation };
}
