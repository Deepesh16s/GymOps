import { getAvailableMuscles } from "../progression/progressionFilters";
import { getMusclePlateaus } from "./plateauEngine";
import { getFatigueLevel } from "./fatigueEngine";
import { getMuscleRecoveryScores } from "./recoveryEngine";

const FATIGUE_TRIGGER_BANDS = new Set(["High", "Very High"]);
const POOR_RECOVERY_THRESHOLD = 40;
const POOR_RECOVERY_MUSCLE_COUNT_TRIGGER = 2;
const EXTREME_VOLUME_RATIO_TRIGGER = 1.6;
const MIN_TRIGGERS_FOR_RECOMMENDATION = 2;

export function getDeloadRecommendation(workouts, { rangeKey = "lifetime" } = {}) {
  const muscles = getAvailableMuscles(workouts);
  const confirmedPlateaus = getMusclePlateaus(workouts, muscles, { rangeKey }).filter(
    (p) => p.plateauLevel === "Confirmed"
  );

  const fatigue = getFatigueLevel(workouts);
  const poorRecoveryMuscles = getMuscleRecoveryScores(workouts).filter(
    (r) => r.recoveryScore < POOR_RECOVERY_THRESHOLD
  );

  const reasons = [];
  if (confirmedPlateaus.length > 0) {
    reasons.push(`Plateau confirmed in ${confirmedPlateaus.map((p) => p.muscle).join(", ")}`);
  }
  if (FATIGUE_TRIGGER_BANDS.has(fatigue.band)) {
    reasons.push(`Fatigue is ${fatigue.band.toLowerCase()}`);
  }
  if (poorRecoveryMuscles.length >= POOR_RECOVERY_MUSCLE_COUNT_TRIGGER) {
    reasons.push(`${poorRecoveryMuscles.length} muscle groups are showing poor recovery`);
  }
  if (fatigue.inputs.weeklyVolumeRatio >= EXTREME_VOLUME_RATIO_TRIGGER) {
    reasons.push(
      `Weekly volume is ${Math.round(fatigue.inputs.weeklyVolumeRatio * 100)}% of your recent average`
    );
  }

  return {
    recommended: reasons.length >= MIN_TRIGGERS_FOR_RECOMMENDATION,
    reasons,
    signals: {
      plateauedMuscleCount: confirmedPlateaus.length,
      fatigueBand: fatigue.band,
      poorRecoveryMuscleCount: poorRecoveryMuscles.length,
      weeklyVolumeRatio: fatigue.inputs.weeklyVolumeRatio,
    },
  };
}
