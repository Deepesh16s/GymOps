// Phase 14A, Module 8 — Volume Landmark Engine. Estimates Maintenance/
// MEV/MAV/MRV per muscle as PERCENTILES of the user's OWN historical
// weekly volume for that muscle — explicitly "not exact scientific
// values" per the phase spec, just an adaptive read of what this
// specific person's own training history actually looks like. Reuses
// progression/progressionEngine.js's getMuscleProgression for the
// weekly-bucketed volume series rather than re-deriving what "a
// trained week" means.
import { getMuscleProgression } from "../progression/progressionEngine";
import { getConfidence } from "../utils/confidenceUtils";

// Fewer than this many real trained weeks and a percentile estimate
// would just be reading noise — same spirit as this app's other
// "not enough history yet" floors (MIN_BUCKETS_FOR_TREND, etc.).
const MIN_WEEKS_FOR_LANDMARKS = 4;

function percentile(sortedAscending, p) {
  if (!sortedAscending.length) return 0;
  const idx = (sortedAscending.length - 1) * p;
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sortedAscending[lower];
  const weight = idx - lower;
  return sortedAscending[lower] * (1 - weight) + sortedAscending[upper] * weight;
}

// Percentile bands, low to high — Maintenance (the least you've done in
// a real trained week), MEV (a modest step up), MAV (near your
// higher-volume weeks), MRV (close to your heaviest sustained week,
// deliberately not the single highest week to avoid one outlier
// defining "maximum recoverable").
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
      reason: `Log at least ${MIN_WEEKS_FOR_LANDMARKS} trained weeks for ${muscle} to estimate volume landmarks.`,
    };
  }

  const { level: confidence, reason: confidenceReason } = getConfidence(weeklyVolumes.length, "week");

  return {
    muscle,
    available: true,
    maintenance: Math.round(percentile(weeklyVolumes, 0.25)),
    mev: Math.round(percentile(weeklyVolumes, 0.4)),
    mav: Math.round(percentile(weeklyVolumes, 0.7)),
    mrv: Math.round(percentile(weeklyVolumes, 0.95)),
    weeksConsidered: weeklyVolumes.length,
    confidence,
    confidenceReason,
  };
}

export function getAllVolumeLandmarks(workouts, muscles, { rangeKey = "lifetime" } = {}) {
  return muscles.map((muscle) => getVolumeLandmarks(workouts, muscle, { rangeKey }));
}
