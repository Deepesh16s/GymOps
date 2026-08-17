import { computeMuscleBreakdown } from "../utils/workoutUtils";
import { getMuscleProgression } from "../progression/progressionEngine";
import { getAvailableMuscles } from "../progression/progressionFilters";
import { getConfidence } from "../utils/confidenceUtils";
import {
  EVIDENCE_STRENGTH,
  withMuscleEvidenceQualifier,
  getMuscleEvidenceTier,
  MUSCLE_EVIDENCE_TIERS,
} from "../constants/evidenceSources";

const MS_PER_DAY = 86400000;
const RECENT_WINDOW_DAYS = 14;
const MIN_HISTORY_DAYS_FOR_EXPOSURE_READ = 21;
const LOWER_EXPOSURE_RATIO = 0.4;

const EXPOSURE_DISCLAIMER =
  "Repvyn heuristic comparing your recent training volume for this muscle against your own historical pattern — not a scientific determination that a muscle needs more training. When volume is held equal, research does not show training frequency alone driving hypertrophy.";

function daysSince(date) {
  return Math.floor((Date.now() - new Date(date).getTime()) / MS_PER_DAY);
}

export function getMusclePriorities(workouts, { rangeKey = "lifetime" } = {}) {
  const breakdown = computeMuscleBreakdown(workouts).filter((e) => e.lastTrained);
  if (!breakdown.length) {
    return { available: false, reason: "Log at least one workout to see muscle priorities." };
  }

  const recentCutoff = new Date(Date.now() - RECENT_WINDOW_DAYS * MS_PER_DAY);
  const recentByMuscle = new Map(computeMuscleBreakdown(workouts, recentCutoff).map((e) => [e.muscle, e.volume]));

  const withExposure = breakdown.map((e) => {
    const daysAgo = daysSince(e.lastTrained);
    const totalHistoryDays = e.firstTrained ? daysSince(e.firstTrained) : 0;
    const recentVolume = recentByMuscle.get(e.muscle) || 0;
    const priorVolume = Math.max(0, e.volume - recentVolume);
    const priorDays = Math.max(1, totalHistoryDays - RECENT_WINDOW_DAYS);
    const priorWeeklyAvg = (priorVolume / priorDays) * 7;
    const recentWeeklyAvg = (recentVolume / RECENT_WINDOW_DAYS) * 7;
    const hasBaseline = totalHistoryDays >= MIN_HISTORY_DAYS_FOR_EXPOSURE_READ && priorWeeklyAvg > 0;
    const exposureRatio = hasBaseline ? recentWeeklyAvg / priorWeeklyAvg : null;
    return { muscle: e.muscle, daysAgo, exposureRatio };
  });

  const mostOverdue = [...withExposure].sort((a, b) => b.daysAgo - a.daysAgo)[0];

  const lowerRecentExposure = withExposure
    .filter((m) => m.exposureRatio != null && m.exposureRatio < LOWER_EXPOSURE_RATIO)
    .map((m) => m.muscle);

  const muscles = getAvailableMuscles(workouts);
  const growing = muscles
    .map((muscle) => ({ muscle, progression: getMuscleProgression(workouts, muscle, { rangeKey }) }))
    .filter(({ progression }) => progression.trend.volume?.direction === "up")
    .map(({ muscle, progression }) => ({ muscle, changePct: progression.trend.volume.changePct }))
    .sort((a, b) => b.changePct - a.changePct);

  const { level: confidence, reason: confidenceReason } = getConfidence(breakdown.length, "muscle");

  const fastestGrowing = growing[0] || null;
  const highlightedMuscles = [mostOverdue?.muscle, fastestGrowing?.muscle, ...lowerRecentExposure].filter(Boolean);
  const weakestTierMuscle = highlightedMuscles.find(
    (m) => getMuscleEvidenceTier(m) === MUSCLE_EVIDENCE_TIERS.INSUFFICIENT
  );

  return {
    available: true,
    mostOverdue,
    fastestGrowing,
    lowerRecentExposure,
    neglected: lowerRecentExposure,
    confidence,
    confidenceReason,
    evidenceStrength: EVIDENCE_STRENGTH.LIMITED,
    evidenceDisclaimer: weakestTierMuscle
      ? withMuscleEvidenceQualifier(EXPOSURE_DISCLAIMER, weakestTierMuscle)
      : EXPOSURE_DISCLAIMER,
  };
}
