// Single source of truth for every metric goalController.js and
// updateGoals.js/recalculateGoals.js need to derive from Workout data.
// PURE MODULE: no Workout, Goal, mongoose, or controller imports — only
// receives arrays and returns computed values, so callers fetch once and
// reuse this everywhere. (constants/goalTypes.js is a plain constants
// module, not one of the above, so it's safe to depend on here.)
//
// Phase 9: also reused by dashboardController.js for session-summary
// aggregates (totalSessions, sessionsLogged, lastSession, average volume
// of recent sessions, average duration of recent sessions). No
// dashboard-specific logic lives here — every export stays a generic
// session/metric computation.

const { GOAL_PERIODS, CARDIO_SESSION_METRIC } = require("../constants/goalTypes");

const startOfWeek = (date = new Date()) => {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMon);
  d.setHours(0, 0, 0, 0);
  return d;
};

const startOfMonth = (date = new Date()) => {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getWorkoutVolume = (workout) =>
  (workout.workoutSets || []).reduce((sum, s) => sum + s.reps * s.weight, 0);

const sumVolume = (workouts) =>
  workouts.reduce((sum, w) => sum + getWorkoutVolume(w), 0);

// Heaviest single set weight across a set of workouts. Used for Strength
// PR goals both on creation (goalController.createGoal) and on full
// recompute after a delete (recalculateGoals.js).
const getMaxWeight = (workouts) =>
  workouts.reduce((max, w) => {
    const heaviest = (w.workoutSets || []).reduce(
      (m, s) => (Number(s.weight) > m ? Number(s.weight) : m),
      0
    );
    return heaviest > max ? heaviest : max;
  }, 0);

const getWorkoutTimestamp = (workout) =>
  new Date(workout.date || workout.createdAt).getTime();

const filterSince = (workouts, sinceDate) => {
  const cutoff = sinceDate.getTime();
  return workouts.filter((w) => getWorkoutTimestamp(w) >= cutoff);
};

const hasSessionId = (w) =>
  w.sessionId !== undefined && w.sessionId !== null && w.sessionId !== "";

// Groups workouts by sessionId. Workouts without a sessionId (legacy
// documents predating Phase 7) are excluded — they were never part of a
// trackable "session", matching prior behavior.
const groupBySessionId = (workouts) => {
  const map = new Map();
  workouts.forEach((w) => {
    if (!hasSessionId(w)) return;
    if (!map.has(w.sessionId)) map.set(w.sessionId, []);
    map.get(w.sessionId).push(w);
  });
  return map;
};

const countDistinctSessions = (workouts) => groupBySessionId(workouts).size;

// A session's timestamp is the latest workout `date` within it, not
// createdAt — createdAt reflects insertion order, not when the session
// happened, so grouping by sessionId first and taking the max `date`
// inside each group is what actually identifies the most recent session.
//
// Exported (Phase 9) so callers outside this module (dashboardController)
// can sort/rank session groups without reimplementing this logic.
const getSessionTimestamp = (sessionWorkouts) =>
  Math.max(...sessionWorkouts.map(getWorkoutTimestamp));

// Returns the array of Workout documents belonging to the single most
// recently completed session, or [] if the user has no session-tagged
// workouts yet. Groups once internally; callers should call this once
// and reuse the result rather than re-grouping.
const getLatestSessionWorkouts = (workouts) => {
  const sessions = groupBySessionId(workouts);
  if (sessions.size === 0) return [];

  let latestId = null;
  let latestTs = -Infinity;

  for (const [sessionId, sessionWorkouts] of sessions) {
    const ts = getSessionTimestamp(sessionWorkouts);
    if (ts > latestTs) {
      latestTs = ts;
      latestId = sessionId;
    }
  }

  return sessions.get(latestId);
};

// Number of strength exercises in a (already session-filtered) list of
// workouts — cardio entries are excluded, since a cardio activity isn't
// an "exercise" for the purposes of a Session Exercise Goal. Shared by
// getLatestSessionMetrics below and goalController.createGoal so both
// the recalculation pipeline and goal creation agree on the same count.
const getSessionExerciseCount = (sessionWorkouts) =>
  sessionWorkouts.filter((w) => w.entryType !== "cardio").length;

const getLatestSessionMetrics = (workouts) => {
  const sessionWorkouts = getLatestSessionWorkouts(workouts);
  return {
    exerciseCount: getSessionExerciseCount(sessionWorkouts),
    volume: sumVolume(sessionWorkouts),
    duration: sessionWorkouts[0]?.sessionDuration ?? 0,
  };
};

// Average volume across the most recently completed sessions (default 5).
// Used by the dashboard's Average Volume (Last 5 Sessions) card. Averages
// over however many sessions exist if fewer than `count` are available.
// Pure and generic — takes raw workouts, groups internally, no dashboard
// coupling — so it's reusable anywhere a "recent session average" is
// needed (e.g. future goal types).
//
// NOTE: this function intentionally still returns 0 for "no sessions at
// all" — volume has no ambiguous "0 vs no data" problem the way duration
// does (a session with 0 kg volume and a session that recorded no volume
// data are effectively the same thing for this metric). Left unchanged
// per Phase 9 audit scope.
const getAverageVolumeOfRecentSessions = (workouts, count = 5) => {
  const sessions = groupBySessionId(workouts);
  if (sessions.size === 0) return 0;

  const sortedGroups = Array.from(sessions.values()).sort(
    (a, b) => getSessionTimestamp(b) - getSessionTimestamp(a)
  );

  const recentGroups = sortedGroups.slice(0, count);
  const total = recentGroups.reduce(
    (sum, sessionWorkouts) => sum + sumVolume(sessionWorkouts),
    0
  );

  return total / recentGroups.length;
};

// Average session duration across the most recently completed sessions
// (default 5). Phase 9 Dashboard Refinement — same grouping/sorting
// pipeline as getAverageVolumeOfRecentSessions (groupBySessionId ->
// sort by getSessionTimestamp -> slice(count)), but the averaging step
// differs deliberately in two ways:
//
// 1. Legacy sessions with no recorded sessionDuration are EXCLUDED from
//    the average entirely rather than counted as 0 — averaging a 0 in
//    for a session that simply never recorded a duration would
//    misleadingly drag the reported average down.
//
// 2. BUG FIX (Phase 9 follow-up): this function must distinguish "no
//    session in range has a recorded duration" from "sessions have
//    durations and the real average is 0 or rounds down to 0" — both
//    are legitimate, different outcomes. Returning 0 for both (as the
//    prior version did) made it impossible for the frontend to tell
//    "no data" apart from "average is genuinely low", so a real,
//    computed low average was incorrectly displayed as "no data" ("—").
//    This function now returns `null` for the true "no data" case, and
//    returns the real numeric average (which may itself be 0) whenever
//    at least one recent session has a valid duration. Callers must
//    check `!= null`, not truthiness, to tell the two apart.
//
// Also defensively coerces each duration through Number() and drops any
// value that fails to parse — guards against a duration ever being
// persisted as a non-numeric type without changing behavior for
// correctly-typed data.
const getAverageSessionDurationOfRecentSessions = (workouts, count = 5) => {
  const sessions = groupBySessionId(workouts);
  if (sessions.size === 0) return null;

  const sortedGroups = Array.from(sessions.values()).sort(
    (a, b) => getSessionTimestamp(b) - getSessionTimestamp(a)
  );

  const recentGroups = sortedGroups.slice(0, count);

  const durations = recentGroups
    .map((sessionWorkouts) =>
      sessionWorkouts.find(
        (w) => w.sessionDuration !== undefined && w.sessionDuration !== null
      )
    )
    .filter((w) => w !== undefined)
    .map((w) => Number(w.sessionDuration))
    .filter((d) => !Number.isNaN(d));

  if (durations.length === 0) return null;

  const total = durations.reduce((sum, d) => sum + d, 0);
  return total / durations.length;
};

const computeCurrentStreak = (workouts) => {
  if (!workouts.length) return 0;

  const dateStrings = new Set(
    workouts.map((w) => {
      const d = new Date(w.date || w.createdAt);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })
  );

  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  let streak = 0;

  while (true) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
    if (!dateStrings.has(key)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
};

// Computes a Cardio Goal's `current` value for a given
// {activityType, metric, period}. `metric` is either a real
// cardio.data.* field (summed across matching cardio entries within the
// period) or the CARDIO_SESSION_METRIC ("sessions") pseudo-metric
// (count of distinct sessions containing at least one matching cardio
// entry within the period, via countDistinctSessions). Callers
// (goalController, updateGoals.js) only reach this after isAutoCardioGoal
// has confirmed activityType/metric/period are all valid, so — like
// every other function in this module — inputs are trusted, not
// re-validated here.
const computeCardioGoalMetric = (workouts, { activityType, metric, period }) => {
  const since = period === GOAL_PERIODS.MONTHLY ? startOfMonth() : startOfWeek();
  const periodWorkouts = filterSince(workouts, since);

  const matchingCardio = periodWorkouts.filter(
    (w) => w.entryType === "cardio" && w.cardio?.activityType === activityType
  );

  if (metric === CARDIO_SESSION_METRIC) {
    return countDistinctSessions(matchingCardio);
  }

  return matchingCardio.reduce(
    (sum, w) => sum + (Number(w.cardio?.data?.[metric]) || 0),
    0
  );
};

module.exports = {
  startOfWeek,
  startOfMonth,
  getWorkoutVolume,
  sumVolume,
  getMaxWeight,
  filterSince,
  groupBySessionId,
  countDistinctSessions,
  getSessionTimestamp,
  getLatestSessionWorkouts,
  getSessionExerciseCount,
  getLatestSessionMetrics,
  getAverageVolumeOfRecentSessions,
  getAverageSessionDurationOfRecentSessions,
  computeCurrentStreak,
  computeCardioGoalMetric,
};