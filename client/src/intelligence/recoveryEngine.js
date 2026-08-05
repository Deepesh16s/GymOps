// Phase 14A, Module 1 (Flagship) — Recovery Score. Every muscle the
// user has ever trained gets a 0-100 recovery score, a status label, and
// an hours-until-recovered countdown — all derived from real logged
// data via workoutUtils.computeMuscleBreakdown, never fabricated.
import { computeMuscleBreakdown, isCardioEntry, computeCurrentStreak } from "../utils/workoutUtils";
import { calculateRelativeIntensity, bestSet, estimate1RM } from "../utils/strengthUtils";
import {
  computeRecoveryWindowHours,
  computeRecoveryScore,
  hoursUntilRecovered as computeHoursUntilRecovered,
  recoveryScoreToStatus,
} from "../utils/recoveryUtils";
import { MUSCLE_SPLIT_CATEGORY } from "../constants/muscles";
import { getConfidence } from "../utils/confidenceUtils";

const MS_PER_HOUR = 3600000;
const MS_PER_WEEK = 7 * 24 * MS_PER_HOUR;
// How far back "overlapping muscles trained recently" and "cardio
// fatigue ratio" look — a week is long enough to catch a real recent
// pattern without reaching back into training that's no longer relevant
// to today's recovery state.
const RECENT_WINDOW_DAYS = 7;
const RECENT_WINDOW_HOURS = RECENT_WINDOW_DAYS * 24;

function hoursSince(date) {
  return (Date.now() - new Date(date).getTime()) / MS_PER_HOUR;
}

// Muscles in the SAME Push/Pull/Legs/Core category as `muscle`, trained
// within the recent window — reuses MUSCLE_SPLIT_CATEGORY, the same
// grouping every other "which muscles are related" question in this app
// already answers with (Module 7's Training Balance, dashboardInsights'
// workout recommendation). No new agonist/antagonist taxonomy invented;
// a systemic-fatigue proxy at the same granularity this app already
// treats as meaningful.
function countOverlappingMusclesTrainedRecently(muscle, breakdown) {
  const category = MUSCLE_SPLIT_CATEGORY[muscle];
  if (!category) return 0;
  return breakdown.filter(
    (entry) =>
      entry.muscle !== muscle &&
      entry.lastTrained &&
      MUSCLE_SPLIT_CATEGORY[entry.muscle] === category &&
      hoursSince(entry.lastTrained) <= RECENT_WINDOW_HOURS
  ).length;
}

// The raw sets from this muscle's most recent trained SESSION (same
// calendar day as `lastTrained`) — computeMuscleBreakdown only gives
// aggregate volume/sets, not the specific sets that made up the last
// session, so this re-filters the same `workouts` array the breakdown
// was already built from (not a re-derivation of what a "session" is,
// just picking out one day's sets).
function getLastSessionSets(muscle, workouts, lastTrained) {
  if (!lastTrained) return [];
  const lastTrainedKey = new Date(lastTrained).toDateString();
  return workouts
    .filter(
      (w) =>
        !isCardioEntry(w) &&
        w.exercise?.muscleGroup === muscle &&
        new Date(w.date || w.createdAt).toDateString() === lastTrainedKey
    )
    .flatMap((w) => w.workoutSets || []);
}

// Average %1RM across a session's sets, relative to that session's OWN
// best set (strengthUtils.estimate1RM) — the only real intensity proxy
// this app's data supports (no RPE is ever logged). Null when there's
// nothing to compute from.
function computeAvgIntensity(sets) {
  if (!sets.length) return null;
  const best = bestSet(sets);
  const oneRM = best ? estimate1RM(best.weight, best.reps) : 0;
  if (!oneRM) return null;
  const intensities = sets
    .map((s) => calculateRelativeIntensity(s.weight, oneRM))
    .filter((v) => v != null);
  if (!intensities.length) return null;
  return intensities.reduce((s, v) => s + v, 0) / intensities.length;
}

// Cardio's share of recent (last 7 days) TRAINING SESSIONS, by day —
// simple session-count ratio rather than a duration-weighted one, since
// strength sessions don't reliably record duration for every workout
// (sessionDuration is optional). A defensible, real proxy for "how much
// of your recent training has been cardio", not an invented figure.
function computeCardioFatigueRatio(workouts) {
  const recentDays = new Set();
  const recentCardioDays = new Set();

  workouts.forEach((w) => {
    if (hoursSince(w.date || w.createdAt) > RECENT_WINDOW_HOURS) return;
    const dayKey = new Date(w.date || w.createdAt).toDateString();
    recentDays.add(dayKey);
    if (isCardioEntry(w)) recentCardioDays.add(dayKey);
  });

  if (!recentDays.size) return 0;
  return recentCardioDays.size / recentDays.size;
}

// Explanation bullets — every line states a real, already-computed
// fact (never a fabricated reason), matching this app's existing
// "Reminder Explanation" precedent (reminders/*.js's `explanation`
// arrays).
function buildExplanation({ daysAgo, volume, overlapping, consecutiveDays, cardioRatio }) {
  const lines = [];
  lines.push(daysAgo === 0 ? "Trained today" : `Last trained ${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`);
  if (volume > 0) lines.push(`${Math.round(volume).toLocaleString()} kg logged last session`);
  if (overlapping > 0) {
    lines.push(`${overlapping} related muscle${overlapping === 1 ? "" : "s"} trained recently too`);
  }
  if (consecutiveDays >= 3) lines.push(`${consecutiveDays}-day training streak adding fatigue`);
  if (cardioRatio >= 0.4) lines.push("Recent cardio load is adding to overall fatigue");
  return lines;
}

// The Module 1 entry point — one entry per muscle the user has EVER
// logged a set for (computeMuscleBreakdown's own scope; a never-trained
// muscle has nothing to recover from and isn't included, same "omit
// rather than guess" rule this app follows everywhere else).
export function getMuscleRecoveryScores(workouts) {
  const breakdown = computeMuscleBreakdown(workouts);
  const consecutiveTrainingDays = computeCurrentStreak(workouts);
  const cardioFatigueRatio = computeCardioFatigueRatio(workouts);

  return breakdown
    .filter((entry) => entry.lastTrained)
    .map((entry) => {
      const sessionSets = getLastSessionSets(entry.muscle, workouts, entry.lastTrained);
      const avgIntensity = computeAvgIntensity(sessionSets);
      const overlapping = countOverlappingMusclesTrainedRecently(entry.muscle, breakdown);
      const hoursSinceTrained = hoursSince(entry.lastTrained);

      const recoveryWindowHours = computeRecoveryWindowHours({
        volume: entry.volume,
        avgIntensity,
        overlappingMusclesTrainedRecently: overlapping,
        consecutiveTrainingDays,
        cardioFatigueRatio,
      });

      const recoveryScore = computeRecoveryScore(hoursSinceTrained, recoveryWindowHours);
      // Standardized confidence (see utils/confidenceUtils.js) — the
      // recovery WINDOW estimate for this muscle rests on how many real
      // sessions computeMuscleBreakdown has actually seen for it
      // (entry.sessionCount), same "more real history = more confident"
      // basis every other retrofitted engine below uses too. `weeks` (the
      // real span from this muscle's first-ever logged set to now,
      // entry.firstTrained — added to computeMuscleBreakdown alongside
      // lastTrained) turns the reason into "Based on 8 logged Shoulder
      // workouts over the last 6 weeks" instead of a bare "8 workouts
      // analyzed" — user feedback's "confidence reason should be
      // actionable" ask.
      const weeksOfHistory = entry.firstTrained
        ? Math.max(1, Math.round((Date.now() - entry.firstTrained.getTime()) / MS_PER_WEEK))
        : null;
      const { level: confidence, reason: confidenceReason } = getConfidence(entry.sessionCount, "workout", {
        entity: entry.muscle,
        weeks: weeksOfHistory,
      });

      return {
        muscle: entry.muscle,
        recoveryScore,
        status: recoveryScoreToStatus(recoveryScore),
        hoursUntilRecovered: computeHoursUntilRecovered(hoursSinceTrained, recoveryWindowHours),
        confidence,
        confidenceReason,
        explanation: buildExplanation({
          daysAgo: Math.floor(hoursSinceTrained / 24),
          volume: entry.volume,
          overlapping,
          consecutiveDays: consecutiveTrainingDays,
          cardioRatio: cardioFatigueRatio,
        }),
      };
    })
    .sort((a, b) => a.recoveryScore - b.recoveryScore); // least-recovered first — the most actionable read
}
