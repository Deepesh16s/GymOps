import { clampScore, weightedScore } from "./scoringUtils";

const FATIGUE_BANDS = [
  { min: 75, label: "Very High" },
  { min: 50, label: "High" },
  { min: 25, label: "Medium" },
  { min: 0, label: "Low" },
];

export function computeFatigueScore({
  weeklyVolumeRatio = 1,
  consecutiveTrainingDays = 0,
  longSessionCount = 0,
  recentPrAttempts = 0,
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
