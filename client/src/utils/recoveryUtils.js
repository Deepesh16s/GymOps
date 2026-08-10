import { clampScore } from "./scoringUtils";

export const BASELINE_RECOVERY_HOURS = 48;

const VOLUME_REFERENCE = 3000;
const MAX_VOLUME_MULTIPLIER = 1.5;
const INTENSITY_REFERENCE = 80;
const MAX_INTENSITY_MULTIPLIER = 1.4;
const OVERLAP_MULTIPLIER_PER_MUSCLE = 0.15;
const MAX_OVERLAP_MULTIPLIER = 1.6;
const CONSECUTIVE_DAY_MULTIPLIER_PER_DAY = 0.1;
const MAX_CONSECUTIVE_DAY_MULTIPLIER = 1.5;
const MAX_CARDIO_FATIGUE_MULTIPLIER = 1.2;

export function computeRecoveryWindowHours({
  volume = 0,
  avgIntensity = null,
  overlappingMusclesTrainedRecently = 0,
  consecutiveTrainingDays = 0,
  cardioFatigueRatio = 0,
} = {}) {
  let hours = BASELINE_RECOVERY_HOURS;

  hours *= 1 + Math.min(MAX_VOLUME_MULTIPLIER - 1, (volume / VOLUME_REFERENCE) * 0.5);

  if (avgIntensity != null) {
    hours *=
      1 +
      Math.max(0, Math.min(MAX_INTENSITY_MULTIPLIER - 1, (avgIntensity - INTENSITY_REFERENCE) / 100));
  }

  hours *= Math.min(
    MAX_OVERLAP_MULTIPLIER,
    1 + overlappingMusclesTrainedRecently * OVERLAP_MULTIPLIER_PER_MUSCLE
  );
  hours *= Math.min(
    MAX_CONSECUTIVE_DAY_MULTIPLIER,
    1 + consecutiveTrainingDays * CONSECUTIVE_DAY_MULTIPLIER_PER_DAY
  );
  hours *= Math.min(MAX_CARDIO_FATIGUE_MULTIPLIER, 1 + cardioFatigueRatio * 0.2);

  return Math.round(hours);
}

export function computeRecoveryScore(hoursSinceTrained, recoveryWindowHours) {
  if (hoursSinceTrained == null) return 100;
  if (hoursSinceTrained >= recoveryWindowHours) return 100;
  const hoursRemaining = recoveryWindowHours - hoursSinceTrained;
  return clampScore(100 * (1 - hoursRemaining / recoveryWindowHours));
}

export function hoursUntilRecovered(hoursSinceTrained, recoveryWindowHours) {
  if (hoursSinceTrained == null) return 0;
  return Math.max(0, Math.round(recoveryWindowHours - hoursSinceTrained));
}

export function recoveryScoreToStatus(score) {
  if (score >= 85) return "Recovered";
  if (score >= 50) return "Recovering";
  return "Needs Rest";
}
