// Phase 14A, Module 5 — Fatigue Engine. Estimates accumulated fatigue
// (Low/Medium/High/Very High) from real logged data: weekly volume,
// consecutive sessions, long workouts, recent PR attempts, and an
// intensity proxy (no RPE exists anywhere in this app's data model — see
// recoveryEngine.js's same disclosure). Also the shared fatigue read
// Module 2 (Readiness) and Module 6 (Deload Detection) both build on.
import {
  getWorkoutVolume,
  isCardioEntry,
  groupWorkoutsIntoSessions,
  computeCurrentStreak,
} from "../utils/workoutUtils";
import { prHistory, calculateRelativeIntensity, bestSet, estimate1RM } from "../utils/strengthUtils";
import { computeFatigueScore, fatigueScoreToBand } from "../utils/fatigueUtils";
import { getConfidence } from "../utils/confidenceUtils";

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

// This week's volume against the user's OWN average of the prior weeks
// — an adaptive ratio (matches Module 8's "not exact scientific
// values—adaptive estimate" ethos), not an absolute cutoff that would
// be meaningless across very different training histories. Returns the
// count of valid prior weeks alongside the ratio so the caller can
// stamp a real confidence figure on the fatigue read (a ratio built off
// 0-1 prior weeks is a much weaker claim than one built off 4).
function computeWeeklyVolumeRatio(workouts) {
  const thisWeek = weeklyVolumeStartingWeeksAgo(workouts, 0);
  const priorWeeks = [];
  for (let i = 1; i <= VOLUME_LOOKBACK_WEEKS; i += 1) {
    priorWeeks.push(weeklyVolumeStartingWeeksAgo(workouts, i));
  }
  const validPrior = priorWeeks.filter((v) => v > 0);
  if (!validPrior.length) return { ratio: 1, weeksConsidered: 0 }; // no baseline yet — assume "typical", not fatigued
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

// Average %1RM across this week's strength sets, each measured against
// its OWN exercise's current best set (strengthUtils.estimate1RM) — the
// same intensity proxy recoveryEngine.js uses for the same reason (no
// RPE exists in this app's data).
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

  // Standardized confidence — the weekly-volume-ratio baseline (the
  // single biggest input to the fatigue score) is only as good as how
  // many real prior weeks it was averaged over.
  const { level: confidence, reason: confidenceReason } = getConfidence(weeksConsidered, "week");

  return {
    fatigueScore,
    band: fatigueScoreToBand(fatigueScore),
    confidence,
    confidenceReason,
    inputs: {
      weeklyVolumeRatio: Math.round(weeklyVolumeRatio * 100) / 100,
      consecutiveTrainingDays,
      longSessionCount,
      recentPrAttempts,
      avgIntensityPct: avgIntensityPct != null ? Math.round(avgIntensityPct) : null,
    },
  };
}
