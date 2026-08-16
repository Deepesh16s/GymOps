import { getMuscleProgression } from "../progression/progressionEngine";
import { getConfidence } from "../utils/confidenceUtils";
import { EVIDENCE_STRENGTH } from "../constants/evidenceSources";

const MIN_WEEKS_FOR_LANDMARKS = 4;

const VOLUME_RANGE_DISCLAIMER =
  "Personal reference points based on your own logged training volume, not a scientific volume ceiling or floor. Research-established volume guidance is expressed in sets per muscle per week, not the total kg-volume used here.";

function percentile(sortedAscending, p) {
  if (!sortedAscending.length) return 0;
  const idx = (sortedAscending.length - 1) * p;
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sortedAscending[lower];
  const weight = idx - lower;
  return sortedAscending[lower] * (1 - weight) + sortedAscending[upper] * weight;
}

export function getVolumeLandmarks(workouts, muscle, { rangeKey = "lifetime" } = {}) {
  const progression = getMuscleProgression(workouts, muscle, { rangeKey });
  const weeklyVolumes = progression.series
    .filter((p) => p.hasData && p.volume > 0)
    .map((p) => p.volume)
    .sort((a, b) => a - b);

  if (weeklyVolumes.length < MIN_WEEKS_FOR_LANDMARKS) {
    return {
      muscle,
      available: false,
      reason: `Log at least ${MIN_WEEKS_FOR_LANDMARKS} trained weeks for ${muscle} to see your personal volume range.`,
    };
  }

  const { level: confidence, reason: confidenceReason } = getConfidence(weeklyVolumes.length, "week");

  return {
    muscle,
    available: true,
    low: Math.round(percentile(weeklyVolumes, 0.25)),
    typical: Math.round(percentile(weeklyVolumes, 0.5)),
    elevated: Math.round(percentile(weeklyVolumes, 0.7)),
    personalHigh: Math.round(percentile(weeklyVolumes, 0.95)),
    weeksConsidered: weeklyVolumes.length,
    confidence,
    confidenceReason,
    evidenceStrength: EVIDENCE_STRENGTH.INSUFFICIENT,
    evidenceDisclaimer: VOLUME_RANGE_DISCLAIMER,
  };
}

export function getAllVolumeLandmarks(workouts, muscles, { rangeKey = "lifetime" } = {}) {
  return muscles.map((muscle) => getVolumeLandmarks(workouts, muscle, { rangeKey }));
}
