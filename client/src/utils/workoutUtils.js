import { OTHER_SESSION_TYPE } from "../constants/sessionTypes";
import { CARDIO_METRICS } from "../constants/cardioMetadata";
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

/* ------------------------------------------------------------------ */
/* Cardio rendering helpers (Phase 8A.1)                                */
/*                                                                      */
/* Single source of truth for turning a cardio Workout document into    */
/* display strings. Every page (Workout History, Calendar, Dashboard)   */
/* consumes these instead of re-deriving cardio display logic itself.   */
/* Entirely metadata-driven via CARDIO_METRICS — no hardcoded labels,    */
/* units, or per-activity branching here.                               */
/* ------------------------------------------------------------------ */

export function isCardioEntry(workout) {
  return workout?.entryType === "cardio";
}

export function getCardioActivityName(workout) {
  return workout?.cardio?.activityType || "Cardio";
}

// Returns every metric actually present on workout.cardio.data, in
// CARDIO_METRICS' declared order, as {key, label, unit, value, text}.
// Only present metrics are included — never a placeholder for a missing
// one. This is the single list every page's cardio rendering (Workout
// History rows, Calendar rows, Dashboard's meta line) is built from.
export function formatCardioSummary(workout) {
  const data = workout?.cardio?.data || {};

  return Object.keys(CARDIO_METRICS)
    .filter(
      (key) => data[key] !== undefined && data[key] !== null && data[key] !== ""
    )
    .map((key) => {
      const metric = CARDIO_METRICS[key];
      const value = data[key];
      return {
        key,
        label: metric?.label || key,
        unit: metric?.unit || "",
        value,
        text: `${value}${metric?.unit ? ` ${metric.unit}` : ""}`,
      };
    });
}

// Priority order for picking the single most relevant metric where only
// one fits (Dashboard's Recent Workouts row). Distance-based metrics are
// most identifying for cardio, falling back through duration/calories
// and the rest. Returns null only when no metrics are present at all.
const CARDIO_METRIC_PRIORITY = [
  "distance",
  "duration",
  "calories",
  "speed",
  "pace",
  "heartRate",
  "incline",
  "cadence",
  "resistance",
];

export function getPrimaryCardioMetric(workout) {
  const summary = formatCardioSummary(workout);
  if (!summary.length) return null;

  for (const key of CARDIO_METRIC_PRIORITY) {
    const found = summary.find((m) => m.key === key);
    if (found) return found.text;
  }

  return summary[0].text;
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

// Phase 8A.1: exerciseCount/cardioCount are now split so callers can
// distinguish "how many strength exercises" from "how many cardio
// entries" — needed for formatSessionEntryCountLabel below and for
// hiding Sets/Volume stats on cardio-only sessions. setCount/volume/
// muscles keep their prior meaning (strength-derived; cardio entries
// have no workoutSets or exercise.muscleGroup to contribute).
export function getSessionStats(session) {
  let setCount = 0;
  let volume = 0;
  let exerciseCount = 0;
  let cardioCount = 0;
  const muscles = new Set();

  session.workouts.forEach((w) => {
    if (isCardioEntry(w)) {
      cardioCount += 1;
      return;
    }

    exerciseCount += 1;
    setCount += getSetCount(w);
    volume += getWorkoutVolume(w);
    if (w.exercise?.muscleGroup) muscles.add(w.exercise.muscleGroup);
  });

  return {
    exerciseCount,
    cardioCount,
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

// Turns {exerciseCount, cardioCount} into the label every session card
// shows for entry counts, e.g. "2 Exercises • 1 Cardio", "2 Cardio", or
// "3 Exercises" for a strength-only session (unchanged wording from
// before this phase). The single place this string is built — Workout
// History and Calendar both consume it rather than each writing their
// own conditional.
export function formatSessionEntryCountLabel({ exerciseCount, cardioCount }) {
  const parts = [];

  if (exerciseCount > 0) {
    parts.push(`${exerciseCount} Exercise${exerciseCount !== 1 ? "s" : ""}`);
  }

  if (cardioCount > 0) {
    parts.push(`${cardioCount} Cardio`);
  }

  if (parts.length === 0) {
    return "0 Exercises";
  }

  return parts.join(" • ");
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
/* ------------------------------------------------------------------ */
/* Muscle breakdown (Muscle Body Map enhancement)                      */
/*                                                                      */
/* Single shared computation so the Dashboard's muscle map and any     */
/* other consumer (e.g. Analytics) derive "sets/volume/last trained    */
/* per muscle" the same way, instead of each recomputing it themselves */
/* — the exact divergence bug already fixed once between Dashboard and */
/* Analytics for the plain sets-distribution case. Pure: takes raw     */
/* Workout documents + an optional cutoff Date, returns real numbers    */
/* derived only from logged sets — nothing here is estimated or        */
/* invented.                                                            */
/* ------------------------------------------------------------------ */

export function computeMuscleBreakdown(workouts, sinceDate) {
  const relevant = sinceDate
    ? workouts.filter((w) => {
        const d = new Date(w.date || w.createdAt);
        return d >= sinceDate;
      })
    : workouts;

  const byMuscle = new Map();

  relevant.forEach((w) => {
    if (isCardioEntry(w)) return;
    const muscle = w.exercise?.muscleGroup;
    if (!muscle) return;

    if (!byMuscle.has(muscle)) {
      byMuscle.set(muscle, {
        muscle,
        sets: 0,
        volume: 0,
        lastTrained: null,
        sessionIds: new Set(),
        exerciseSets: new Map(),
      });
    }

    const entry = byMuscle.get(muscle);
    entry.sets += getSetCount(w);
    entry.volume += getWorkoutVolume(w);

    const workoutDate = new Date(w.date || w.createdAt);
    if (!entry.lastTrained || workoutDate > entry.lastTrained) {
      entry.lastTrained = workoutDate;
    }

    if (w.sessionId) entry.sessionIds.add(w.sessionId);

    const exerciseName = w.exercise?.name;
    if (exerciseName) {
      entry.exerciseSets.set(
        exerciseName,
        (entry.exerciseSets.get(exerciseName) || 0) + getSetCount(w)
      );
    }
  });

  return Array.from(byMuscle.values()).map((entry) => {
    const rankedExercises = [...entry.exerciseSets.entries()].sort(
      (a, b) => b[1] - a[1]
    );

    return {
      muscle: entry.muscle,
      sets: entry.sets,
      volume: entry.volume,
      lastTrained: entry.lastTrained,
      sessionCount: entry.sessionIds.size,
      // Most-logged-sets exercise for this muscle in the window.
      bestExercise: rankedExercises[0]?.[0] || null,
      // Every exercise that contributed to this muscle in the window —
      // lets a consumer cross-reference against personal-records data
      // (a different, already-fetched source) to find whichever of
      // these has the highest recorded PR, without this utility having
      // to know anything about goals/PRs itself.
      exercises: rankedExercises.map(([name]) => name),
    };
  });
}

// Push/Pull/Legs/Core is a standard training-split categorization (the
// same one Guide.jsx already explains to users), applied here to real
// logged set counts — not a new invented grouping.
export const MUSCLE_SPLIT_CATEGORY = {
  Chest: "Push",
  Shoulders: "Push",
  Triceps: "Push",
  Back: "Pull",
  Biceps: "Pull",
  Forearms: "Pull",
  Legs: "Legs",
  Quads: "Legs",
  Glutes: "Legs",
  Calves: "Legs",
  Hamstrings: "Legs",
  Abs: "Core",
};

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