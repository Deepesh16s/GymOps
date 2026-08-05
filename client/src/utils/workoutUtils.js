import { OTHER_SESSION_TYPE } from "../constants/sessionTypes";
import { CARDIO_METRICS } from "../constants/cardioMetadata";
import { dateKey } from "./dateUtils";
import { prHistory, bestSet } from "./strengthUtils";
import {
  DATE_RANGE_ALL,
  DATE_RANGE_TODAY,
  DATE_RANGE_LAST_7_DAYS,
  DATE_RANGE_LAST_30_DAYS,
  DATE_RANGE_THIS_MONTH,
  DATE_RANGE_THIS_YEAR,
  DATE_RANGE_CUSTOM,
} from "../constants/dateRanges";
import {
  DURATION_RANGE_ALL,
  DURATION_RANGE_UNDER_30,
  DURATION_RANGE_30_TO_60,
  DURATION_RANGE_60_TO_90,
  DURATION_RANGE_OVER_90,
} from "../constants/durationRanges";

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

// Phase 12 — activity name plus its optional variant refinement (e.g.
// "Running · Treadmill Run"), the single shared label every cardio
// display (CardioEntryCard, Workout Log, Session Timeline) reads from
// instead of each re-deriving its own "does this have a variant" check.
// Falls back to just the activity name when no variant was logged —
// every existing consumer of getCardioActivityName keeps working
// unchanged whether or not this is adopted alongside it.
export function getCardioActivityLabel(workout) {
  const name = getCardioActivityName(workout);
  const variant = workout?.cardio?.variant;
  return variant ? `${name} · ${variant}` : name;
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

// Phase 12 — one compact "headline" string for a cardio PR event (built
// by cardioProgressionEngine.cardioPrHistory: {prTypes, values, ...}),
// same distance-first priority order getPrimaryCardioMetric already
// uses for a session's primary metric — the single formatting rule
// SessionCard/SessionTimeline/PersonalRecordRow all reuse instead of
// each re-deriving "which number to show" for a cardio record.
export function formatCardioPrLabel(pr) {
  if (!pr) return "";
  for (const key of CARDIO_METRIC_PRIORITY) {
    if (pr.prTypes?.includes(key) && pr.values?.[key] != null) {
      const metric = CARDIO_METRICS[key];
      return `${pr.values[key]}${metric?.unit ? ` ${metric.unit}` : ""}`;
    }
  }
  return "";
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
        // Workout Session Editing & Time Tracking — same "session-level
        // metadata duplicated on every document" pattern as
        // sessionDuration/sessionType above. Legacy workouts (and any
        // session whose timing was never explicitly set) simply don't
        // have these fields, so all three stay null/"AUTO".
        startedAt: w.startedAt || null,
        endedAt: w.endedAt || null,
        timingMode: w.timingMode || "AUTO",
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

    if (session.startedAt == null && w.startedAt != null) {
      session.startedAt = w.startedAt;
    }

    if (session.endedAt == null && w.endedAt != null) {
      session.endedAt = w.endedAt;
    }

    if (session.timingMode === "AUTO" && w.timingMode === "MANUAL") {
      session.timingMode = w.timingMode;
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
  let totalReps = 0;
  // Only ever a sum of calories the user actually logged on a cardio
  // entry (CARDIO_METRICS.calories is optional, never required) — never
  // an invented/estimated figure, since there's no body-weight field
  // anywhere in this app to drive a MET-based formula for strength sets.
  let calories = 0;
  const muscles = new Set();

  session.workouts.forEach((w) => {
    if (isCardioEntry(w)) {
      cardioCount += 1;
      const loggedCalories = w.cardio?.data?.calories;
      if (typeof loggedCalories === "number" && loggedCalories > 0) {
        calories += loggedCalories;
      }
      return;
    }

    exerciseCount += 1;
    setCount += getSetCount(w);
    volume += getWorkoutVolume(w);
    totalReps += (w.workoutSets || []).reduce((sum, s) => sum + s.reps, 0);
    if (w.exercise?.muscleGroup) muscles.add(w.exercise.muscleGroup);
  });

  return {
    exerciseCount,
    cardioCount,
    setCount,
    volume,
    totalReps,
    calories,
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

/* ------------------------------------------------------------------ */
/* Session-level PR badges (Workout History 2.0)                       */
/*                                                                      */
/* Reuses strengthUtils.prHistory — the exact same "record broken"      */
/* event stream Analytics' PR Timeline/Current Records/Recent Records   */
/* are built from — instead of re-deriving PR detection here. A PR      */
/* event's `date` is the literal `date` field of the workout document    */
/* that set it, so matching on exercise name + exact timestamp reliably */
/* maps each event back to the session it belongs to.                   */
/* ------------------------------------------------------------------ */

export function buildPRIndex(workouts) {
  const events = prHistory(workouts);
  const byKey = new Map();
  events.forEach((ev) => {
    byKey.set(`${ev.exercise}|${new Date(ev.date).getTime()}`, ev);
  });
  return byKey;
}

// Attaches a `prs` array (possibly empty) to every session — every
// prHistory event whose exercise+timestamp matches one of that session's
// own workouts. A session with prs.length > 0 gets the PR badge.
//
// Phase 12: `cardioPrIndex` is an optional third parameter — a Map built
// by cardioProgressionEngine.buildCardioPRIndex, keyed the same way
// (`${activityType}|${timestamp}`) as `prIndex` is keyed by
// `${exercise}|${timestamp}`. When a caller doesn't pass it (or passes
// nothing), the cardio branch below is unchanged from before this phase
// — a bare early `return` — so strength-only behavior is byte-identical
// either way. Matched cardio events are tagged `isCardio: true` so they
// share the same `session.prs` array (and therefore the same
// `hasPR`/`prCount` badge logic) as strength PRs, distinguished only at
// render time (SessionCard/SessionTimeline/PersonalRecordRow each get a
// small `if (record.isCardio)` branch — see those files).
export function attachSessionPRs(sessions, prIndex, cardioPrIndex) {
  return sessions.map((session) => {
    const prs = [];
    session.workouts.forEach((w) => {
      if (isCardioEntry(w)) {
        if (!cardioPrIndex) return;
        const activityType = w.cardio?.activityType;
        if (!activityType) return;
        const ev = cardioPrIndex.get(`${activityType}|${new Date(w.date).getTime()}`);
        if (ev) prs.push({ ...ev, isCardio: true });
        return;
      }
      const name = w.exercise?.name;
      if (!name) return;
      const ev = prIndex.get(`${name}|${new Date(w.date).getTime()}`);
      if (ev) prs.push(ev);
    });
    return { ...session, prs };
  });
}

// Session-level "quality" signal — a genuinely derivable superlative
// (not an invented score): the single session (or tied sessions) with
// the highest total strength volume, and the single session(s) with the
// longest duration. Computed once over every session currently in view
// so "your best session" doesn't shift depending on which filters are
// active later at render time — callers should pass the FULL session
// list here, not just the currently-filtered/visible one.
export function getSessionRecordKeys(sessions) {
  let maxVolume = 0;
  let maxDuration = 0;

  sessions.forEach((s) => {
    if (s.stats.volume > maxVolume) maxVolume = s.stats.volume;
    if (s.sessionDuration != null && s.sessionDuration > maxDuration) {
      maxDuration = s.sessionDuration;
    }
  });

  const highestVolumeKeys = new Set(
    maxVolume > 0
      ? sessions.filter((s) => s.stats.volume === maxVolume).map((s) => s.key)
      : []
  );
  const longestDurationKeys = new Set(
    maxDuration > 0
      ? sessions
          .filter((s) => s.sessionDuration === maxDuration)
          .map((s) => s.key)
      : []
  );

  return { highestVolumeKeys, longestDurationKeys };
}

/* ------------------------------------------------------------------ */
/* Session Timeline & Workout Journey (Phase 10B)                       */
/*                                                                      */
/* Everything below reuses prHistory/getSessionRecordKeys rather than    */
/* re-deriving PR or duration logic — this file stays the single place  */
/* that owns those computations.                                        */
/* ------------------------------------------------------------------ */

// Cross-references the SAME prHistory event stream attachSessionPRs
// already consumed (no re-detection) to find, for each PR a session
// already has attached, the record it replaced — lets the timeline show
// "Previous best: 27.5kg x12" next to the new one. Takes the full
// `workouts` array (not just one session's) because the prior record
// usually lives in an earlier session.
//
// Phase 12: `cardioEvents` is an optional third parameter — the raw
// array from cardioProgressionEngine.cardioPrHistory(workouts) (not a
// Map; this function needs the chronological list to find each event's
// predecessor, same as it already does for `events` above). Omitting it
// leaves every existing line below untouched, so strength-only behavior
// is unchanged. Cardio keys are prefixed ("cardio:...") purely so they
// can safely share `previousByEventKey` with the unprefixed strength
// keys without ever colliding, even in the unlikely case an activity
// name and an exercise name were ever identical strings.
export function attachPreviousBestToPRs(sessions, workouts, cardioEvents = []) {
  const events = prHistory(workouts);
  const lastByExercise = new Map();
  const previousByEventKey = new Map();

  events.forEach((ev) => {
    const key = `${ev.exercise}|${new Date(ev.date).getTime()}`;
    const prev = lastByExercise.get(ev.exercise) || null;
    if (prev) previousByEventKey.set(key, prev);
    lastByExercise.set(ev.exercise, ev);
  });

  const lastByActivity = new Map();
  cardioEvents.forEach((ev) => {
    const key = `cardio:${ev.activityType}|${new Date(ev.date).getTime()}`;
    const prev = lastByActivity.get(ev.activityType) || null;
    if (prev) previousByEventKey.set(key, prev);
    lastByActivity.set(ev.activityType, ev);
  });

  return sessions.map((session) => {
    if (!session.prs?.length) return session;
    const prs = session.prs.map((pr) => {
      const key = pr.isCardio
        ? `cardio:${pr.activityType}|${new Date(pr.date).getTime()}`
        : `${pr.exercise}|${new Date(pr.date).getTime()}`;
      return { ...pr, previousBest: previousByEventKey.get(key) || null };
    });
    return { ...session, prs };
  });
}

// Extends getSessionRecordKeys' existing superlative pattern with a few
// more genuinely derivable milestones. Highest Volume / Longest Workout
// are intentionally NOT repeated here — they already render as header
// badges (Phase 10A), so re-showing them inside the timeline would just
// be duplicate presentation of the same fact. Computed once over the
// FULL session list for the same reason as getSessionRecordKeys: a
// milestone shouldn't flicker depending on which filters are active.
export function getSessionMilestones(sessions) {
  const milestones = new Map();

  const add = (key, label) => {
    if (!milestones.has(key)) milestones.set(key, []);
    milestones.get(key).push(label);
  };

  const timed = sessions.filter((s) => s.sessionDuration != null && s.sessionDuration > 0);
  if (timed.length) {
    const minDuration = Math.min(...timed.map((s) => s.sessionDuration));
    timed
      .filter((s) => s.sessionDuration === minDuration)
      .forEach((s) => add(s.key, "Fastest Workout"));
  }

  const withExercises = sessions.filter((s) => s.stats.exerciseCount > 0);
  if (withExercises.length) {
    const maxExercises = Math.max(...withExercises.map((s) => s.stats.exerciseCount));
    withExercises
      .filter((s) => s.stats.exerciseCount === maxExercises)
      .forEach((s) => add(s.key, "Highest Exercise Count"));
  }

  // First workout logged in each calendar month present in the history.
  const firstOfMonth = new Map();
  sessions.forEach((s) => {
    const d = new Date(s.date);
    const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
    const current = firstOfMonth.get(monthKey);
    if (!current || new Date(s.date) < new Date(current.date)) {
      firstOfMonth.set(monthKey, s);
    }
  });
  firstOfMonth.forEach((s) => add(s.key, "First Workout of the Month"));

  // First workout after a 10+ day gap since the previous one.
  const BREAK_THRESHOLD_DAYS = 10;
  const chronological = [...sessions].sort((a, b) => new Date(a.date) - new Date(b.date));
  for (let i = 1; i < chronological.length; i++) {
    const gapDays =
      (new Date(chronological[i].date) - new Date(chronological[i - 1].date)) /
      (1000 * 60 * 60 * 24);
    if (gapDays >= BREAK_THRESHOLD_DAYS) {
      add(chronological[i].key, "First Workout After a Break");
    }
  }

  return milestones;
}

// Builds the ordered "story" of a session: Workout Started -> each
// exercise in the exact order it was performed (groupWorkoutsIntoSessions
// already preserves this — nothing is re-sorted here) -> Workout
// Finished. Individual exercises have no per-entry timestamp in the data
// model (every workout in a session is written in one batch), so a
// mid-session time is never fabricated as if it were precisely recorded
// — instead, when the session has real startedAt/endedAt, each entry's
// moment is interpolated evenly across that real span and only ever
// surfaced as a relative delta ("4 min later"), never as a fake precise
// clock reading. When timing is missing entirely (imported/legacy
// sessions), the story still renders — just without time deltas.
export function buildSessionTimeline(session) {
  const hasRealTiming = !!(session.startedAt && session.endedAt);
  const startMs = hasRealTiming ? new Date(session.startedAt).getTime() : null;
  const endMs = hasRealTiming ? new Date(session.endedAt).getTime() : null;
  const totalSpanMs = hasRealTiming ? endMs - startMs : null;
  const entries = session.workouts || [];
  const n = entries.length;

  const interpolatedTime = (i) => {
    if (!hasRealTiming || n === 0) return null;
    if (n === 1) return startMs + totalSpanMs / 2;
    return startMs + (totalSpanMs * i) / (n - 1);
  };

  const events = [];

  if (session.startedAt) {
    events.push({ type: "workout-started", time: new Date(session.startedAt) });
  }

  entries.forEach((w, i) => {
    const isCardio = isCardioEntry(w);
    // Phase 12: cardio entries now look up their own PR the same way
    // strength entries always have — matched on activityType instead of
    // exercise name, against the same session.prs array (see
    // attachSessionPRs, which already tags cardio entries isCardio: true).
    const pr = isCardio
      ? session.prs?.find((p) => p.isCardio && p.activityType === w.cardio?.activityType) || null
      : session.prs?.find((p) => !p.isCardio && p.exercise === w.exercise?.name) || null;
    const t = interpolatedTime(i);

    events.push({
      type: "exercise",
      workout: w,
      isCardio,
      pr,
      best: !isCardio ? bestSet(w.workoutSets) : null,
      time: t != null ? new Date(t) : null,
    });
  });

  if (session.endedAt) {
    events.push({
      type: "workout-finished",
      time: new Date(session.endedAt),
      sessionDuration: session.sessionDuration,
      volume: session.stats?.volume,
    });
  }

  let lastKnownTime = null;
  return events.map((ev, i) => {
    let relativeLabel = null;
    if (ev.time && lastKnownTime) {
      const deltaMin = Math.round((ev.time.getTime() - lastKnownTime.getTime()) / 60000);
      if (deltaMin > 0) relativeLabel = `+${deltaMin} min`;
    }
    if (ev.time) lastKnownTime = ev.time;
    return { ...ev, relativeLabel, index: i };
  });
}

/* ------------------------------------------------------------------ */
/* Session Summary aggregate (Workout History 2.0)                     */
/*                                                                      */
/* Every figure here is a plain average/max/count over sessions already */
/* in view — nothing is estimated or invented. Reuses                   */
/* computeMuscleBreakdown for "most trained muscle" instead of tallying */
/* muscles a second time.                                               */
/* ------------------------------------------------------------------ */

export function computeHistorySummary(sessions) {
  const totalWorkouts = sessions.length;
  const prCount = sessions.reduce((sum, s) => sum + (s.prs?.length || 0), 0);

  if (totalWorkouts === 0) {
    return {
      totalWorkouts: 0,
      avgDuration: null,
      avgVolume: null,
      avgExercises: null,
      avgSets: null,
      longestWorkout: null,
      mostTrainedMuscle: null,
      prCount: 0,
    };
  }

  const durations = sessions
    .map((s) => s.sessionDuration)
    .filter((d) => d != null && d > 0);
  const strengthSessions = sessions.filter((s) => s.stats.exerciseCount > 0);

  const average = (arr) =>
    arr.length ? arr.reduce((sum, n) => sum + n, 0) / arr.length : null;

  const avgDuration = durations.length ? Math.round(average(durations)) : null;

  const avgVolume = strengthSessions.length
    ? Math.round(average(strengthSessions.map((s) => s.stats.volume)))
    : null;

  const avgExercises = strengthSessions.length
    ? Math.round(average(strengthSessions.map((s) => s.stats.exerciseCount)) * 10) / 10
    : null;

  const avgSets = strengthSessions.length
    ? Math.round(average(strengthSessions.map((s) => s.stats.setCount)) * 10) / 10
    : null;

  const longestWorkout = durations.length
    ? sessions.reduce((best, s) => {
        if (s.sessionDuration == null) return best;
        return !best || s.sessionDuration > best.sessionDuration ? s : best;
      }, null)
    : null;

  const allWorkouts = sessions.flatMap((s) => s.workouts);
  const muscleBreakdown = computeMuscleBreakdown(allWorkouts);
  const mostTrainedMuscle = muscleBreakdown.length
    ? [...muscleBreakdown].sort((a, b) => b.sets - a.sets)[0]
    : null;

  return {
    totalWorkouts,
    avgDuration,
    avgVolume,
    avgExercises,
    avgSets,
    longestWorkout,
    mostTrainedMuscle,
    prCount,
  };
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

// Matches a session's own title ("Push Session", a custom "Other" name)
// in addition to the existing per-workout exercise/cardio-activity match,
// so one search box covers both "Search by workout title" and "Search by
// exercise" instead of needing two separate inputs.
export function filterSessionsBySearch(sessions, term) {
  const lower = term?.trim().toLowerCase();
  if (!lower) return sessions;

  return sessions.filter((s) => {
    if (getSessionTypeLabel(s).toLowerCase().includes(lower)) return true;
    return s.workouts.some((w) =>
      isCardioEntry(w)
        ? getCardioActivityName(w).toLowerCase().includes(lower)
        : matchesSearch(w, term)
    );
  });
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

// Half-open [min, max) minute bounds per duration bucket — "Under 30"
// is [0, 30), "Over 90" is [90, Infinity). A session with no recorded
// duration at all never matches any bucket (there's nothing honest to
// compare), same treatment as the date-range filter's "All" fallback.
function resolveDurationRangeBounds(rangeKey) {
  switch (rangeKey) {
    case DURATION_RANGE_UNDER_30:
      return { min: 0, max: 30 };
    case DURATION_RANGE_30_TO_60:
      return { min: 30, max: 60 };
    case DURATION_RANGE_60_TO_90:
      return { min: 60, max: 90 };
    case DURATION_RANGE_OVER_90:
      return { min: 90, max: Infinity };
    case DURATION_RANGE_ALL:
    default:
      return null;
  }
}

export function filterSessionsByDuration(sessions, rangeKey) {
  const bounds = resolveDurationRangeBounds(rangeKey);
  if (!bounds) return sessions;
  return sessions.filter(
    (s) =>
      s.sessionDuration != null &&
      s.sessionDuration >= bounds.min &&
      s.sessionDuration < bounds.max
  );
}

// `prs` is attached by attachSessionPRs — sessions built without that
// step (there are none left in this codebase, but defensively) simply
// never match rather than throwing.
export function filterSessionsByPROnly(sessions, onlyPR) {
  if (!onlyPR) return sessions;
  return sessions.filter((s) => (s.prs?.length || 0) > 0);
}

export function filterSessionsByFavorites(sessions, onlyFavorites, favoriteKeys) {
  if (!onlyFavorites) return sessions;
  return sessions.filter((s) => favoriteKeys.has(s.key));
}

export function sortSessions(sessions, order = "newest") {
  const sorted = [...sessions];

  switch (order) {
    case "oldest":
      sorted.sort((a, b) => new Date(a.date) - new Date(b.date));
      break;
    case "volume":
      sorted.sort((a, b) => (b.stats?.volume || 0) - (a.stats?.volume || 0));
      break;
    case "duration":
      sorted.sort((a, b) => (b.sessionDuration || 0) - (a.sessionDuration || 0));
      break;
    case "newest":
    default:
      sorted.sort((a, b) => new Date(b.date) - new Date(a.date));
      break;
  }

  return sorted;
}

export function formatSessionDate(date) {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

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
        firstTrained: null,
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
    // Phase 14B.1 follow-up — tracked alongside lastTrained (same per-
    // muscle walk, no second pass over workouts) so callers wanting "how
    // many weeks of history" for a muscle (recoveryEngine's confidence
    // reason) don't need to re-scan workouts themselves.
    if (!entry.firstTrained || workoutDate < entry.firstTrained) {
      entry.firstTrained = workoutDate;
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
      firstTrained: entry.firstTrained,
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

// Consecutive-day training streak ending today — mirrors the backend's
// current-streak definition (server/utils/goalMetrics.js
// computeCurrentStreak, backing GET /dashboard/current-streak) exactly,
// so Analytics can show the same figure computed client-side from the
// workouts it already fetched instead of firing a second request.
export function computeCurrentStreak(workouts) {
  if (!workouts.length) return 0;

  const trainedDays = new Set(workouts.map((w) => dateKey(w.date || w.createdAt)));

  const cursor = new Date();
  let streak = 0;
  while (trainedDays.has(dateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

// e.g. "Pull Session", "Powerlifting Session" (for a custom "Other" name),
// or "Session" for legacy sessions that predate Session Types entirely.
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