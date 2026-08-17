import {
  getWorkoutVolume,
  isCardioEntry,
  groupWorkoutsIntoSessions,
  computeCurrentStreak,
} from "../utils/workoutUtils";
import { prHistory, calculateRelativeIntensity, bestSet, estimate1RM } from "../utils/strengthUtils";
import { computeFatigueScore, fatigueScoreToBand } from "../utils/fatigueUtils";
import { getConfidence } from "../utils/confidenceUtils";
import { EVIDENCE_STRENGTH } from "../constants/evidenceSources";

const FATIGUE_DISCLAIMER =
  "Describes how this week's training volume compares to your own recent baseline — not an injury or overtraining prediction. This type of load ratio (borrowed from team-sport injury research) has been criticized on methodological grounds: the acute and chronic windows share overlapping data, which can produce a statistical association independent of any real injury relationship. Treat this as a load-trend signal only, not a validated risk score.";

const MS_PER_DAY = 86400000;
const LONG_SESSION_MINUTES = 75;
const RECENT_WINDOW_DAYS = 7;
const VOLUME_LOOKBACK_WEEKS = 4;

function weeklyVolumeStartingWeeksAgo(workouts, weeksAgo) {
  const end = Date.now() - weeksAgo * 7 * MS_PER_DAY;
  const start = end - 7 * MS_PER_DAY;
  return workouts
    .filter((w) => !isCardioEntry(w))
    .filter((w) => {
      const t = new Date(w.date || w.createdAt).getTime();
      return t >= start && t < end;
    })
    .reduce((s, w) => s + getWorkoutVolume(w), 0);
}

function computeWeeklyVolumeRatio(workouts) {
  const thisWeek = weeklyVolumeStartingWeeksAgo(workouts, 0);
  const priorWeeks = [];
  for (let i = 1; i <= VOLUME_LOOKBACK_WEEKS; i += 1) {
    priorWeeks.push(weeklyVolumeStartingWeeksAgo(workouts, i));
  }
  const validPrior = priorWeeks.filter((v) => v > 0);
  if (!validPrior.length) return { ratio: 1, weeksConsidered: 0 };
  const avgPrior = validPrior.reduce((s, v) => s + v, 0) / validPrior.length;
  return { ratio: avgPrior ? thisWeek / avgPrior : 1, weeksConsidered: validPrior.length };
}

function countLongSessionsThisWeek(workouts) {
  const cutoff = Date.now() - RECENT_WINDOW_DAYS * MS_PER_DAY;
  return groupWorkoutsIntoSessions(workouts).filter(
    (s) => new Date(s.date).getTime() >= cutoff && (s.sessionDuration || 0) >= LONG_SESSION_MINUTES
  ).length;
}

function countRecentPrAttempts(workouts) {
  const cutoff = Date.now() - RECENT_WINDOW_DAYS * MS_PER_DAY;
  return prHistory(workouts).filter((e) => new Date(e.date).getTime() >= cutoff).length;
}

function computeRecentAvgIntensity(workouts) {
  const cutoff = Date.now() - RECENT_WINDOW_DAYS * MS_PER_DAY;
  const recentByExercise = new Map();

  workouts.forEach((w) => {
    if (isCardioEntry(w) || !w.exercise?.name) return;
    if (new Date(w.date || w.createdAt).getTime() < cutoff) return;
    const name = w.exercise.name;
    if (!recentByExercise.has(name)) recentByExercise.set(name, []);
    recentByExercise.get(name).push(...(w.workoutSets || []));
  });

  const intensities = [];
  recentByExercise.forEach((sets) => {
    const best = bestSet(sets);
    const oneRM = best ? estimate1RM(best.weight, best.reps) : 0;
    if (!oneRM) return;
    sets.forEach((s) => {
      const pct = calculateRelativeIntensity(s.weight, oneRM);
      if (pct != null) intensities.push(pct);
    });
  });

  if (!intensities.length) return null;
  return intensities.reduce((s, v) => s + v, 0) / intensities.length;
}

export function getFatigueLevel(workouts) {
  const { ratio: weeklyVolumeRatio, weeksConsidered } = computeWeeklyVolumeRatio(workouts);
  const consecutiveTrainingDays = computeCurrentStreak(workouts);
  const longSessionCount = countLongSessionsThisWeek(workouts);
  const recentPrAttempts = countRecentPrAttempts(workouts);
  const avgIntensityPct = computeRecentAvgIntensity(workouts);

  const fatigueScore = computeFatigueScore({
    weeklyVolumeRatio,
    consecutiveTrainingDays,
    longSessionCount,
    recentPrAttempts,
    avgIntensityPct,
  });

  const { level: confidence, reason: confidenceReason } = getConfidence(weeksConsidered, "week");

  return {
    fatigueScore,
    band: fatigueScoreToBand(fatigueScore),
    confidence,
    confidenceReason,
    evidenceStrength: EVIDENCE_STRENGTH.LIMITED,
    evidenceDisclaimer: FATIGUE_DISCLAIMER,
    inputs: {
      weeklyVolumeRatio: Math.round(weeklyVolumeRatio * 100) / 100,
      consecutiveTrainingDays,
      longSessionCount,
      recentPrAttempts,
      avgIntensityPct: avgIntensityPct != null ? Math.round(avgIntensityPct) : null,
    },
  };
}
