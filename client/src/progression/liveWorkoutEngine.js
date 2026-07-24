// Live Workout Mode intelligence (Phase 11) — previous performance,
// next-set suggestions, real-time PR detection, and finish-summary
// badges. Every function here is pure and built only from primitives
// that already exist in strengthUtils.js/workoutUtils.js — nothing here
// re-derives volume, best-set, or streak math, it only adds the small
// amount of genuinely new comparison logic (rep PR / volume PR / next-
// set suggestion / longest-streak-ever) that has no existing precedent
// elsewhere in the app. Consumers pass in `historicalWorkouts` — the
// same raw Workout documents Dashboard already fetches via
// getWorkouts(500) — so none of this triggers a new network call.
import { bestSet, estimate1RM } from "../utils/strengthUtils";
import { groupWorkoutsIntoSessions, getSessionStats, computeCurrentStreak } from "../utils/workoutUtils";

const WEIGHT_INCREMENT_KG = 2.5;

// Exercise identity/naming can vary slightly (custom exercises), but the
// _id is stable — match on that rather than name. Exported since
// ExerciseHistoryDrawer needs the same per-exercise, most-recent-first
// workout list this module already builds for snapshots.
export function strengthWorkoutsForExercise(historicalWorkouts, exerciseId) {
  if (!exerciseId || !historicalWorkouts?.length) return [];
  return historicalWorkouts
    .filter(
      (w) =>
        w.entryType !== "cardio" &&
        w.exercise &&
        String(w.exercise._id) === String(exerciseId)
    )
    .sort(
      (a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)
    );
}

// Everything a live session needs to know about an exercise's history,
// computed once when the exercise is added to the session (not
// recomputed per keystroke). Returns null when the exercise has never
// been logged before — every consumer treats that as "no history yet".
export function getExerciseHistorySnapshot(historicalWorkouts, exerciseId) {
  const past = strengthWorkoutsForExercise(historicalWorkouts, exerciseId);
  if (!past.length) return null;

  const allSets = past.flatMap((w) => w.workoutSets || []);
  if (!allSets.length) return null;

  const best = bestSet(allSets);
  const bestSingleSetVolume = allSets.reduce(
    (max, s) => Math.max(max, s.weight * s.reps),
    0
  );

  return {
    lastSession: past[0].workoutSets || [],
    lastSessionDate: past[0].date || past[0].createdAt,
    priorSession: past[1]?.workoutSets || null,
    bestSet: best,
    estOneRM: best ? estimate1RM(best.weight, best.reps) : null,
    bestSingleSetVolume,
    // Highest reps ever done at this weight or heavier — the yardstick
    // for a "rep PR" below (matching more weight for fewer reps isn't a
    // rep PR; matching or beating reps at an equal-or-harder weight is).
    maxRepsAtWeightOrHeavier: (weight) =>
      allSets.reduce((max, s) => (s.weight >= weight ? Math.max(max, s.reps) : max), 0),
  };
}

// Simple double-progression heuristic: if the last two sessions' top
// sets held (or grew) at the same weight, suggest stepping the weight up
// at the same rep count; otherwise suggest one more rep at the same
// weight first. With only one prior session on record, a clean 3+ reps
// is treated as "room to add weight" by the same rule.
export function getNextSetSuggestion(snapshot) {
  if (!snapshot?.lastSession?.length) return null;

  const lastBest = bestSet(snapshot.lastSession);
  if (!lastBest) return null;

  const priorBest = snapshot.priorSession?.length
    ? bestSet(snapshot.priorSession)
    : null;

  const readyForMoreWeight = priorBest
    ? lastBest.weight === priorBest.weight && lastBest.reps >= priorBest.reps
    : lastBest.reps >= 3;

  if (readyForMoreWeight) {
    return {
      weight: Math.round((lastBest.weight + WEIGHT_INCREMENT_KG) * 2) / 2,
      reps: lastBest.reps,
      basis: "weight",
    };
  }

  return { weight: lastBest.weight, reps: lastBest.reps + 1, basis: "reps" };
}

// Classifies a just-completed set against exercise history PLUS whatever
// has already been logged for this exercise earlier in the same live
// session (`sessionSetsSoFar`) — without this, a second heavy set in the
// same session would get compared only against last week's numbers and
// wrongly re-flag as a PR against a now-stale baseline. Returns null when
// it's not a PR of any kind (the common case) so callers can skip
// rendering anything. All three flags can be true at once (e.g. a
// heavier set that's also a new best single-set volume).
export function detectSetPRs(snapshot, newSet, sessionSetsSoFar = []) {
  if (!newSet) return null;

  const sessionBest = bestSet(sessionSetsSoFar);
  const priorBest =
    sessionBest &&
    (!snapshot?.bestSet ||
      sessionBest.weight > snapshot.bestSet.weight ||
      (sessionBest.weight === snapshot.bestSet.weight && sessionBest.reps > snapshot.bestSet.reps))
      ? sessionBest
      : snapshot?.bestSet || null;

  const lifetimePR =
    !priorBest ||
    newSet.weight > priorBest.weight ||
    (newSet.weight === priorBest.weight && newSet.reps > priorBest.reps);

  // Real reps ever logged are always >= 1, so a max of 0 unambiguously
  // means "no prior set at this weight or heavier" rather than "beaten
  // by zero" — a brand-new weight nobody has attempted before, which the
  // Lifetime PR badge above already covers. Without this guard, ANY rep
  // count at a never-before-tried weight would trivially "beat" that
  // absent baseline and double up as a misleading second badge.
  const historicalMaxReps = snapshot ? snapshot.maxRepsAtWeightOrHeavier(newSet.weight) : 0;
  const sessionMaxReps = sessionSetsSoFar.reduce(
    (max, s) => (s.weight >= newSet.weight ? Math.max(max, s.reps) : max),
    0
  );
  const priorMaxReps = Math.max(historicalMaxReps, sessionMaxReps);
  const repPR = priorMaxReps > 0 && newSet.reps > priorMaxReps;

  // Same guard for volume: an exercise with no history at all has a
  // synthetic "0 kg" baseline, which any real set would trivially clear.
  const hasVolumeBaseline = !!snapshot || sessionSetsSoFar.length > 0;
  const newVolume = newSet.weight * newSet.reps;
  const historicalBestVolume = snapshot?.bestSingleSetVolume || 0;
  const sessionBestVolume = sessionSetsSoFar.reduce(
    (max, s) => Math.max(max, s.weight * s.reps),
    0
  );
  const volumePR =
    hasVolumeBaseline && newVolume > Math.max(historicalBestVolume, sessionBestVolume);

  if (!lifetimePR && !repPR && !volumePR) return null;

  return {
    lifetimePR,
    repPR,
    volumePR,
    weight: newSet.weight,
    reps: newSet.reps,
    estOneRM: estimate1RM(newSet.weight, newSet.reps),
  };
}

// Rest-timer default: a lightweight name-pattern heuristic (no
// compound/isolation field exists on Exercise), always manually
// overridable in the UI.
const COMPOUND_NAME_PATTERN = /squat|deadlift|bench|press|row|pull.?up|chin.?up/i;

export function getDefaultRestSeconds(exerciseName = "") {
  return COMPOUND_NAME_PATTERN.test(exerciseName) ? 150 : 75;
}

// "Fastest Session" — shorter than every past session that did at least
// as many sets (a genuinely comparable effort), not just the shortest
// session ever regardless of how little was done in it.
export function isFastestSession(historicalWorkouts, durationMinutes, setCount) {
  if (!durationMinutes || !setCount || !historicalWorkouts?.length) return false;

  const comparable = groupWorkoutsIntoSessions(historicalWorkouts)
    .map((session) => ({ session, stats: getSessionStats(session) }))
    .filter(
      ({ session, stats }) =>
        session.sessionDuration != null && stats.setCount >= setCount
    );

  if (!comparable.length) return false;

  return durationMinutes < Math.min(...comparable.map(({ session }) => session.sessionDuration));
}

// Longest-ever consecutive trained-day streak (distinct from
// workoutUtils.computeCurrentStreak, which only measures the run ending
// today) — walks the same trained-date set to find the longest run on
// record, so a Finish Workout summary can say "new longest streak"
// rather than just the current one.
export function getLongestStreakEver(workouts) {
  if (!workouts?.length) return 0;

  const dateStrings = new Set(
    workouts.map((w) => {
      const d = new Date(w.date || w.createdAt);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })
  );

  const sortedDates = [...dateStrings].map((s) => new Date(s)).sort((a, b) => a - b);

  let longest = 0;
  let current = 0;
  let prevDate = null;

  sortedDates.forEach((date) => {
    current = prevDate && date - prevDate === 86400000 ? current + 1 : 1;
    longest = Math.max(longest, current);
    prevDate = date;
  });

  return longest;
}

// Finish Workout summary badges. `historicalWorkouts` should include the
// just-finished session's workouts (the caller appends them before
// calling this, since Dashboard's fetched array predates the session
// that just ended) so streak/fastest-session comparisons account for
// today.
export function getSessionBadges(historicalWorkouts, { durationMinutes, setCount }) {
  const badges = [];

  if (isFastestSession(historicalWorkouts, durationMinutes, setCount)) {
    badges.push({ key: "fastestSession", label: "Fastest Session" });
  }

  const currentStreak = computeCurrentStreak(historicalWorkouts);
  const priorLongestStreak = getLongestStreakEver(historicalWorkouts);
  if (currentStreak > 0 && currentStreak >= priorLongestStreak) {
    badges.push({ key: "longestStreak", label: `Longest Streak · Day ${currentStreak}` });
  }

  return badges;
}
