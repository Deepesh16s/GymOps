// generateRecoverySummary — the "Recovery Dashboard" data (section 10):
// an overall recovery percentage plus muscles bucketed by status.
// Reuses recoveryEngine's getMuscleRecoveryScores exclusively (the
// same per-muscle scores/status Module 1 already computes) — this file
// only buckets and averages, never re-scores a muscle.
import { getMuscleRecoveryScores } from "../intelligence";

export function generateRecoverySummary(workouts) {
  const scores = getMuscleRecoveryScores(workouts);
  if (!scores.length) {
    return { available: false, reason: "Log a workout to see recovery status." };
  }

  const overallScore = Math.round(scores.reduce((s, r) => s + r.recoveryScore, 0) / scores.length);

  return {
    available: true,
    overallScore,
    recovered: scores.filter((s) => s.status === "Recovered").map((s) => s.muscle),
    recovering: scores.filter((s) => s.status === "Recovering").map((s) => s.muscle),
    needsRest: scores.filter((s) => s.status === "Needs Rest").map((s) => s.muscle),
    scores,
  };
}
