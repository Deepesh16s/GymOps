// Single source of truth for every metric goalController.js and
// updateGoals.js/recalculateGoals.js need to derive from Workout data.
// PURE MODULE: no Workout, Goal, mongoose, or controller imports — only
// receives arrays and returns computed values, so callers fetch once and
// reuse this everywhere.
//
// Phase 9: also reused by dashboardController.js for session-summary
// aggregates (totalSessions, sessionsLogged, lastSession, average volume
// of recent sessions, average duration of recent sessions). No
// dashboard-specific logic lives here — every export stays a generic
// session/metric computation.

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

const getLatestSessionMetrics = (workouts) => {
  const sessionWorkouts = getLatestSessionWorkouts(workouts);
  return {
    exerciseCount: sessionWorkouts.length,
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
// (default 5). Phase 9 Dashboard Refinement — mirrors
// getAverageVolumeOfRecentSessions exactly: same grouping, same recency
// ordering, just averaging sessionDuration instead of volume. Sessions
// with no recorded duration (legacy documents) contribute 0, matching
// how zero-volume sessions are already handled above.
const getAverageSessionDurationOfRecentSessions = (workouts, count = 5) => {
  const sessions = groupBySessionId(workouts);
  if (sessions.size === 0) return 0;

  const sortedGroups = Array.from(sessions.values()).sort(
    (a, b) => getSessionTimestamp(b) - getSessionTimestamp(a)
  );

  const recentGroups = sortedGroups.slice(0, count);

  const durations = recentGroups.map((sessionWorkouts) => {
    const withDuration = sessionWorkouts.find(
      (w) => w.sessionDuration !== undefined && w.sessionDuration !== null
    );
    return withDuration ? withDuration.sessionDuration : 0;
  });

  const total = durations.reduce((sum, d) => sum + d, 0);
  return total / recentGroups.length;
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
  getLatestSessionMetrics,
  getAverageVolumeOfRecentSessions,
  getAverageSessionDurationOfRecentSessions,
  computeCurrentStreak,
};