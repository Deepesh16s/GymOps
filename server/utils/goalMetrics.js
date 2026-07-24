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

// Local-day key ("YYYY-MM-DD"), same convention client/src/pages/
// Calendar.jsx's getLocalDateKey uses — server-local time, consistent
// with startOfWeek/startOfMonth above already being local-time based.
const toDateKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const dateKeyToDate = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

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

// Sums (or counts, for the "sessions" pseudo-metric) a single cardio
// metric per local calendar day — the shared building block for all
// three DAILY_* periods below. `matchingCardio` is expected to already
// be filtered to one activityType.
const buildDailyCardioValueMap = (matchingCardio, metric) => {
  const map = new Map();
  matchingCardio.forEach((w) => {
    const key = toDateKey(w.date || w.createdAt);
    const value = metric === CARDIO_SESSION_METRIC ? 1 : Number(w.cardio?.data?.[metric]) || 0;
    map.set(key, (map.get(key) || 0) + value);
  });
  return map;
};

// Daily Steps goals (metric === "steps") merge two sources per product
// decision: the standalone daily-steps log (models/DailySteps.js — the
// primary path, since steps are a passive all-day count, not something
// logged per cardio session) PLUS any cardio entries that happened to
// carry their own optional steps value for that same day. Mutates and
// returns the same map for convenience at the call site.
const mergeDailyStepsLog = (dayValueMap, dailyStepsRecords) => {
  dailyStepsRecords.forEach(({ date, steps }) => {
    if (!date) return;
    dayValueMap.set(date, (dayValueMap.get(date) || 0) + (Number(steps) || 0));
  });
  return dayValueMap;
};

// Count of days from `sinceDate` through today (inclusive) whose daily
// total met `dailyTarget` — the "consistency" reading for DAILY_WEEKLY/
// DAILY_MONTHLY. Deliberately counts only days that have actually
// occurred (never future days in the window), so a goal created
// mid-week/month shows real progress (e.g. "3/7") rather than padding
// with days that haven't happened yet.
const computeDailyConsistencyCount = (dayValueMap, dailyTarget, sinceDate, now = new Date()) => {
  let count = 0;
  const cursor = new Date(sinceDate);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);

  while (cursor <= end) {
    if ((dayValueMap.get(toDateKey(cursor)) || 0) >= dailyTarget) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
};

// Longest all-time run of CONSECUTIVE calendar days meeting dailyTarget —
// DAILY_LIFETIME's "best streak ever" reading. Recomputed fresh from
// full history every call (no separate stored "best" needed): since
// past qualifying days never change, recomputing can only find a streak
// at least as long as any previous calculation, which is exactly what
// gives this the same non-regressing property MILESTONE goals have.
const computeBestDailyStreak = (dayValueMap, dailyTarget) => {
  const qualifyingDayKeys = [...dayValueMap.entries()]
    .filter(([, value]) => value >= dailyTarget)
    .map(([key]) => key)
    .sort();

  if (!qualifyingDayKeys.length) return 0;

  let best = 1;
  let current = 1;
  for (let i = 1; i < qualifyingDayKeys.length; i++) {
    const diffDays = Math.round(
      (dateKeyToDate(qualifyingDayKeys[i]) - dateKeyToDate(qualifyingDayKeys[i - 1])) /
        (24 * 60 * 60 * 1000)
    );
    current = diffDays === 1 ? current + 1 : 1;
    if (current > best) best = current;
  }
  return best;
};

// NEXT_SESSION's one-shot value: the metric from the EARLIEST matching
// cardio entry logged strictly after the goal's own createdAt (i.e. the
// literal next time this activity gets logged post-creation), or 0 if
// that hasn't happened yet. Deliberately does not use dailyStepsRecords
// even when metric is "steps" — a next-session goal is scoped to one
// logged workout, not a whole day's passive count.
const computeNextSessionMetric = (workouts, { activityType, metric, createdAt }) => {
  const cutoff = createdAt ? new Date(createdAt).getTime() : Infinity;

  const matching = workouts
    .filter((w) => w.entryType === "cardio" && w.cardio?.activityType === activityType)
    .filter((w) => getWorkoutTimestamp(w) > cutoff)
    .sort((a, b) => getWorkoutTimestamp(a) - getWorkoutTimestamp(b));

  if (!matching.length) return 0;
  if (metric === CARDIO_SESSION_METRIC) return 1;
  return Number(matching[0].cardio?.data?.[metric]) || 0;
};

// Computes a Cardio Goal's `current` value for a given
// {activityType, metric, period}. `metric` is either a real
// cardio.data.* field or the CARDIO_SESSION_METRIC ("sessions")
// pseudo-metric. Callers (goalController, updateGoals.js) only reach
// this after isAutoCardioGoal has confirmed activityType/metric/period
// are all valid, so — like every other function in this module — inputs
// are trusted, not re-validated here.
//
// Five aggregations depending on `period`:
// - "weekly"/"monthly": a resettable window — sum (or count distinct
//   sessions) across only the entries since that window started. Can
//   legitimately go up or down between recalculations.
// - "milestone" (Phase 12): a one-time, lifetime achievement ("First
//   5K") — takes the single best (max) matching entry across ALL of the
//   user's cardio history, never bounded to a window. Because it's a
//   running max over ever-growing history, it can only stay the same or
//   increase on subsequent recalculations — a milestone can't regress
//   once achieved.
// - "daily-weekly"/"daily-monthly": consistency — how many days in the
//   window (so far) hit `dailyTarget`. See computeDailyConsistencyCount.
// - "daily-lifetime": best-ever consecutive-day streak hitting
//   `dailyTarget`. See computeBestDailyStreak.
// - "next-session": one-shot value of the next matching session logged
//   after the goal was created. See computeNextSessionMetric.
const computeCardioGoalMetric = (
  workouts,
  { activityType, metric, period, dailyTarget = null, createdAt = null, dailyStepsRecords = [] }
) => {
  const matchingCardio = workouts.filter(
    (w) => w.entryType === "cardio" && w.cardio?.activityType === activityType
  );

  if (period === GOAL_PERIODS.NEXT_SESSION) {
    return computeNextSessionMetric(workouts, { activityType, metric, createdAt });
  }

  if (
    period === GOAL_PERIODS.DAILY_WEEKLY ||
    period === GOAL_PERIODS.DAILY_MONTHLY ||
    period === GOAL_PERIODS.DAILY_LIFETIME
  ) {
    const dayValueMap = buildDailyCardioValueMap(matchingCardio, metric);
    if (metric === "steps") mergeDailyStepsLog(dayValueMap, dailyStepsRecords);

    const target = Number(dailyTarget) || 0;

    if (period === GOAL_PERIODS.DAILY_LIFETIME) {
      return computeBestDailyStreak(dayValueMap, target);
    }

    const since = period === GOAL_PERIODS.DAILY_MONTHLY ? startOfMonth() : startOfWeek();
    return computeDailyConsistencyCount(dayValueMap, target, since);
  }

  if (period === GOAL_PERIODS.MILESTONE) {
    if (metric === CARDIO_SESSION_METRIC) {
      return countDistinctSessions(matchingCardio);
    }
    return matchingCardio.reduce(
      (max, w) => Math.max(max, Number(w.cardio?.data?.[metric]) || 0),
      0
    );
  }

  const since = period === GOAL_PERIODS.MONTHLY ? startOfMonth() : startOfWeek();
  const periodWorkouts = filterSince(matchingCardio, since);

  if (metric === CARDIO_SESSION_METRIC) {
    return countDistinctSessions(periodWorkouts);
  }

  return periodWorkouts.reduce(
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
  toDateKey,
};