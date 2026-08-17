import { getAvailableMuscles } from "../progression/progressionFilters";
import { getMusclePlateaus } from "./plateauEngine";
import { getFatigueLevel } from "./fatigueEngine";
import { EVIDENCE_STRENGTH } from "../constants/evidenceSources";

const FATIGUE_TRIGGER_BANDS = new Set(["High", "Very High"]);
const EXTREME_VOLUME_RATIO_TRIGGER = 1.6;
const MIN_TRIGGERS_FOR_RECOMMENDATION = 2;

const DELOAD_DISCLAIMER =
  "Repvyn heuristic: fires when at least 2 of 3 training-history signals line up (plateau, elevated fatigue trend, high recent volume). Controlled research on planned deloads for resistance training is limited, and genuine overtraining from resistance training alone appears uncommon over the timeframes typical recreational lifters train. This is a suggestion worth considering, not a signal that your body physiologically needs reduced training.";

export function getDeloadRecommendation(workouts, { rangeKey = "lifetime" } = {}) {
  const muscles = getAvailableMuscles(workouts);
  const confirmedPlateaus = getMusclePlateaus(workouts, muscles, { rangeKey }).filter(
    (p) => p.plateauLevel === "Confirmed"
  );

  const fatigue = getFatigueLevel(workouts);

  const reasons = [];
  if (confirmedPlateaus.length > 0) {
    reasons.push(`Plateau confirmed in ${confirmedPlateaus.map((p) => p.muscle).join(", ")}`);
  }
  if (FATIGUE_TRIGGER_BANDS.has(fatigue.band)) {
    reasons.push(`Fatigue is ${fatigue.band.toLowerCase()}`);
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
      weeklyVolumeRatio: fatigue.inputs.weeklyVolumeRatio,
    },
    evidenceStrength: EVIDENCE_STRENGTH.LIMITED,
    evidenceDisclaimer: DELOAD_DISCLAIMER,
  };
}
