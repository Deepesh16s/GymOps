// Phase 14A — fatigue-accumulation math shared by Module 5 (Fatigue
// Engine) and Module 6 (Deload Detection, which uses "fatigue high" as
// one of its own trigger conditions) and Module 2 (Readiness, which
// treats high fatigue as a readiness drag). Pure math — callers compute
// the real inputs from workoutUtils/strengthUtils first.
import { clampScore, weightedScore } from "./scoringUtils";

const FATIGUE_BANDS = [
  { min: 75, label: "Very High" },
  { min: 50, label: "High" },
  { min: 25, label: "Medium" },
  { min: 0, label: "Low" },
];

// Inputs mirror the phase spec's Module 5 list exactly: weekly volume,
// consecutive sessions, long workouts, PR attempts, "high RPE proxy".
// This app has no logged RPE anywhere in the data model (confirmed: a
// workout set is only `{weight, reps}`) — %1RM-based intensity
// (strengthUtils.calculateRelativeIntensity) is the one real proxy for
// training effort this app's data can actually support, so
// `avgIntensityPct` stands in for "RPE" here rather than a fabricated
// number.
export function computeFatigueScore({
  weeklyVolumeRatio = 1, // this week's volume / the user's OWN recent-average weekly volume — adaptive, not an absolute threshold
  consecutiveTrainingDays = 0,
  longSessionCount = 0, // sessions this week over a "long" duration threshold (caller decides what counts as long)
  recentPrAttempts = 0, // PR-setting sessions in the recent window
  avgIntensityPct = null,
} = {}) {
  const score = weightedScore([
    { value: clampScore((weeklyVolumeRatio - 0.5) * 100), weight: 2 },
    { value: clampScore(consecutiveTrainingDays * 15), weight: 1.5 },
    { value: clampScore(longSessionCount * 25), weight: 1 },
    { value: clampScore(recentPrAttempts * 20), weight: 1 },
    { value: avgIntensityPct != null ? clampScore(avgIntensityPct - 50) : null, weight: 1.5 },
  ]);
  return score ?? 0;
}

export function fatigueScoreToBand(score) {
  const match = FATIGUE_BANDS.find((b) => score >= b.min);
  return match.label;
}
