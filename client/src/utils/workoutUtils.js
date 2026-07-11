import { OTHER_SESSION_TYPE } from "../constants/sessionTypes";
import {
  DATE_RANGE_ALL,
  DATE_RANGE_TODAY,
  DATE_RANGE_LAST_7_DAYS,
  DATE_RANGE_LAST_30_DAYS,
  DATE_RANGE_THIS_MONTH,
  DATE_RANGE_THIS_YEAR,
  DATE_RANGE_CUSTOM,
} from "../constants/dateRanges";

export function getWorkoutVolume(workout) {
  return (workout.workoutSets || []).reduce(
    (sum, s) => sum + s.reps * s.weight,
    0
  );
}

export function getHeaviestSet(workout) {
  return (workout.workoutSets || []).reduce(
    (max, s) => (s.weight > max ? s.weight : max),
    0
  );
}

export function getSetCount(workout) {
  return (workout.workoutSets || []).length;
}

export function formatSetBreakdown(workout) {
  return (workout.workoutSets || [])
    .map((s) => `${s.weight}kg×${s.reps}`)
    .join(", ");
}

function matchesSearch(workout, term) {
  if (!term) return true;
  const lower = term.toLowerCase();
  return workout.exercise?.name?.toLowerCase().includes(lower) ?? false;
}

function matchesMuscle(workout, muscle) {
  if (!muscle || muscle === "All") return true;
  return workout.exercise?.muscleGroup === muscle;
}

export function filterBySearch(workouts, term) {
  if (!term) return workouts;
  return workouts.filter((w) => matchesSearch(w, term));
}

export function filterByMuscle(workouts, muscle) {
  if (!muscle || muscle === "All") return workouts;
  return workouts.filter((w) => matchesMuscle(w, muscle));
}

export function sortWorkouts(workouts, order = "newest") {
  const sorted = [...workouts].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );
  return order === "newest" ? sorted.reverse() : sorted;
}

/* ------------------------------------------------------------------ */
/* Session grouping (Workout History redesign)                         */
/*                                                                      */
/* Workout History renders ONE CARD = ONE WORKOUT SESSION. Workouts     */
/* sharing the same sessionId belong to one session. Workouts without   */
/* a sessionId (legacy documents) each become their own standalone      */
/* session, exactly as before. Grouping happens entirely on the         */
/* frontend — the API and controllers are untouched.                    */
/* ------------------------------------------------------------------ */

export function groupWorkoutsIntoSessions(workouts) {
  const sessionMap = new Map();
  const keyOrder = [];

  workouts.forEach((w) => {
    const key = w.sessionId ? `session:${w.sessionId}` : `standalone:${w._id}`;

    if (!sessionMap.has(key)) {
      sessionMap.set(key, {
        key,
        sessionId: w.sessionId || null,
        date: w.date,
        sessionDuration:
          w.sessionDuration !== undefined && w.sessionDuration !== null
            ? w.sessionDuration
            : null,
        // Session Type is session-level metadata — every workout in the
        // group was written with the same values (see
        // workoutController.createWorkoutSession), so it's safe to take
        // it from whichever workout initializes this group. Legacy
        // workouts simply don't have these fields, so both stay null.
        sessionType: w.sessionType || null,
        customSessionType: w.customSessionType || null,
        workouts: [],
      });
      keyOrder.push(key);
    }

    const session = sessionMap.get(key);
    session.workouts.push(w);

    // Use the EARLIEST workout timestamp in the session as the session
    // date. A session represents when it started — using the latest
    // timestamp could push a late-night workout into the next calendar
    // day, which misrepresents the workout day.
    if (new Date(w.date) < new Date(session.date)) {
      session.date = w.date;
    }

    if (session.sessionDuration == null && w.sessionDuration != null) {
      session.sessionDuration = w.sessionDuration;
    }

    if (session.sessionType == null && w.sessionType != null) {
      session.sessionType = w.sessionType;
      session.customSessionType = w.customSessionType || null;
    }
  });

  // Workouts are intentionally left in the order returned by the API
  // (MongoDB insertion order), so the expanded session view shows
  // exercises exactly in the order the user performed them. No sorting
  // is applied here.

  return keyOrder.map((key) => sessionMap.get(key));
}

export function getSessionStats(session) {
  let setCount = 0;
  let volume = 0;
  const muscles = new Set();

  session.workouts.forEach((w) => {
    setCount += getSetCount(w);
    volume += getWorkoutVolume(w);
    if (w.exercise?.muscleGroup) muscles.add(w.exercise.muscleGroup);
  });

  return {
    exerciseCount: session.workouts.length,
    setCount,
    volume,
    muscles: Array.from(muscles),
  };
}

// Groups + attaches stats in one pass so callers only need one memoized
// call to get everything a session card needs to render.
export function buildSessionSummaries(workouts) {
  return groupWorkoutsIntoSessions(workouts).map((session) => ({
    ...session,
    stats: getSessionStats(session),
  }));
}

export function filterSessionsBySearch(sessions, term) {
  if (!term) return sessions;
  return sessions.filter((s) => s.workouts.some((w) => matchesSearch(w, term)));
}

export function filterSessionsByMuscle(sessions, muscle) {
  if (!muscle || muscle === "All") return sessions;
  return sessions.filter((s) =>
    s.workouts.some((w) => matchesMuscle(w, muscle))
  );
}

// Filtering happens at the session level (not per-workout), matching the
// one-card-per-session model — a session either matches the selected
// type or its whole card is hidden.
export function filterSessionsBySessionType(sessions, sessionType) {
  if (!sessionType || sessionType === "All") return sessions;
  return sessions.filter((s) => s.sessionType === sessionType);
}

/* ------------------------------------------------------------------ */
/* Date Range filter (Workout History polish)                          */
/*                                                                      */
/* Filtering happens at the SESSION level, same as Muscle and Session   */
/* Type above — a session is visible if its `session.date` (the same    */
/* earliest-workout date already computed by groupWorkoutsIntoSessions) */
/* falls inside the selected range. No new date field is introduced;    */
/* this reuses the exact date each card already displays.               */
/* ------------------------------------------------------------------ */

// Local calendar-day boundaries (not UTC) so "Today" matches what the
// user actually sees on their clock, consistent with formatSessionDate's
// use of the browser's locale/timezone via toLocaleDateString.
function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

// Resolves a DATE_RANGE_* key (plus optional custom bounds) into a
// concrete [start, end] window. Returns null for "All" (no filtering) or
// an incomplete Custom Range (both dates required before filtering
// applies, so the card list doesn't collapse to nothing while the user
// is still mid-pick).
function resolveDateRangeWindow(rangeKey, customStart, customEnd) {
  const now = new Date();

  switch (rangeKey) {
    case DATE_RANGE_TODAY:
      return { start: startOfDay(now), end: endOfDay(now) };

    case DATE_RANGE_LAST_7_DAYS: {
      const start = startOfDay(now);
      start.setDate(start.getDate() - 6);
      return { start, end: endOfDay(now) };
    }

    case DATE_RANGE_LAST_30_DAYS: {
      const start = startOfDay(now);
      start.setDate(start.getDate() - 29);
      return { start, end: endOfDay(now) };
    }

    case DATE_RANGE_THIS_MONTH: {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: startOfDay(start), end: endOfDay(now) };
    }

    case DATE_RANGE_THIS_YEAR: {
      const start = new Date(now.getFullYear(), 0, 1);
      return { start: startOfDay(start), end: endOfDay(now) };
    }

    case DATE_RANGE_CUSTOM:
      if (!customStart || !customEnd) return null;
      return { start: startOfDay(customStart), end: endOfDay(customEnd) };

    case DATE_RANGE_ALL:
    default:
      return null;
  }
}

export function filterSessionsByDateRange(
  sessions,
  rangeKey,
  customStart,
  customEnd
) {
  const window = resolveDateRangeWindow(rangeKey, customStart, customEnd);
  if (!window) return sessions;

  return sessions.filter((s) => {
    const sessionDate = new Date(s.date);
    return sessionDate >= window.start && sessionDate <= window.end;
  });
}

export function sortSessions(sessions, order = "newest") {
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );
  return order === "newest" ? sorted.reverse() : sorted;
}

export function formatSessionDate(date) {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

// Session card label, e.g. "Pull Session", "Powerlifting Session" (for
// a custom "Other" name), or "Session" for legacy sessions that predate
// Session Types entirely.
export function getSessionTypeLabel(session) {
  const { sessionType, customSessionType } = session;

  if (!sessionType) {
    return "Session";
  }

  if (sessionType === OTHER_SESSION_TYPE) {
    return customSessionType ? `${customSessionType} Session` : "Session";
  }

  return `${sessionType} Session`;
}