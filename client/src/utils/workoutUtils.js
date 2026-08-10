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


export function isCardioEntry(workout) {
  return workout?.entryType === "cardio";
}

export function getCardioActivityName(workout) {
  return workout?.cardio?.activityType || "Cardio";
}

export function getCardioActivityLabel(workout) {
  const name = getCardioActivityName(workout);
  const variant = workout?.cardio?.variant;
  return variant ? `${name} · ${variant}` : name;
}

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
        startedAt: w.startedAt || null,
        endedAt: w.endedAt || null,
        timingMode: w.timingMode || "AUTO",
        sessionType: w.sessionType || null,
        customSessionType: w.customSessionType || null,
        workouts: [],
      });
      keyOrder.push(key);
    }

    const session = sessionMap.get(key);
    session.workouts.push(w);

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


  return keyOrder.map((key) => sessionMap.get(key));
}

export function getSessionStats(session) {
  let setCount = 0;
  let volume = 0;
  let exerciseCount = 0;
  let cardioCount = 0;
  let totalReps = 0;
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

export function buildSessionSummaries(workouts) {
  return groupWorkoutsIntoSessions(workouts).map((session) => ({
    ...session,
    stats: getSessionStats(session),
  }));
}


export function buildPRIndex(workouts) {
  const events = prHistory(workouts);
  const byKey = new Map();
  events.forEach((ev) => {
    byKey.set(`${ev.exercise}|${new Date(ev.date).getTime()}`, ev);
  });
  return byKey;
}

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

export function filterSessionsBySessionType(sessions, sessionType) {
  if (!sessionType || sessionType === "All") return sessions;
  return sessions.filter((s) => s.sessionType === sessionType);
}


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
      bestExercise: rankedExercises[0]?.[0] || null,
      exercises: rankedExercises.map(([name]) => name),
    };
  });
}

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