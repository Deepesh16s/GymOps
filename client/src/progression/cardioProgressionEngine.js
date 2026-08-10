import {
  groupWorkoutsIntoSessions,
  getSessionStats,
  isCardioEntry,
} from "../utils/workoutUtils";
import { startOfWeek, startOfMonth } from "../utils/dateUtils";
import { filterWorkoutsByTimeRange } from "./progressionFilters";
import { describeTrend } from "./progressionEngine";

export const CARDIO_METRICS_REGISTRY = [
  {
    key: "distance",
    label: "Distance",
    shortLabel: "Distance",
    format: (v) => (v == null ? "—" : `${v} km`),
  },
  {
    key: "duration",
    label: "Duration",
    shortLabel: "Duration",
    format: (v) => (v == null ? "—" : `${v} min`),
  },
  {
    key: "pace",
    label: "Pace",
    shortLabel: "Pace",
    format: (v) => (v == null ? "—" : `${v} min/km`),
  },
  {
    key: "speed",
    label: "Speed",
    shortLabel: "Speed",
    format: (v) => (v == null ? "—" : `${v} km/h`),
  },
  {
    key: "calories",
    label: "Calories",
    shortLabel: "Calories",
    format: (v) => (v == null ? "—" : `${v} kcal`),
  },
];

export const CARDIO_DEFAULT_METRIC = "distance";

export function getCardioMetricDef(key) {
  return CARDIO_METRICS_REGISTRY.find((m) => m.key === key) || CARDIO_METRICS_REGISTRY[0];
}

function entryDate(w) {
  return new Date(w.date || w.createdAt);
}

export function deriveCardioMetrics(activityType, data = {}) {
  const result = { ...data };
  const distance = Number(data.distance);
  const duration = Number(data.duration);
  const hasDistance = typeof data.distance === "number" && data.distance > 0;
  const hasDuration = typeof data.duration === "number" && data.duration > 0;

  if (hasDistance && hasDuration) {
    if (result.pace === undefined || result.pace === null || result.pace === "") {
      result.pace = Math.round((duration / distance) * 100) / 100;
    }
    if (result.speed === undefined || result.speed === null || result.speed === "") {
      result.speed = Math.round((distance / (duration / 60)) * 100) / 100;
    }
  }

  return result;
}

export function filterWorkoutsByCardioActivity(workouts, activityType) {
  if (!activityType) return workouts.filter(isCardioEntry);
  return workouts.filter(
    (w) => isCardioEntry(w) && w.cardio?.activityType === activityType
  );
}

export function getAvailableCardioActivities(workouts) {
  const seen = new Set();
  const order = [];
  workouts.forEach((w) => {
    const activity = isCardioEntry(w) && w.cardio?.activityType;
    if (activity && !seen.has(activity)) {
      seen.add(activity);
      order.push(activity);
    }
  });
  return order;
}

export function buildCardioSessionSeries(workouts) {
  const cardioWorkouts = workouts.filter(isCardioEntry);
  if (!cardioWorkouts.length) return [];

  const sessions = groupWorkoutsIntoSessions(cardioWorkouts)
    .map((s) => ({ ...s, stats: getSessionStats(s) }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  let runningBestDistance = 0;

  return sessions.map((session) => {
    const entries = session.workouts.filter(isCardioEntry);
    const activityType = entries[0]?.cardio?.activityType || null;

    const totalDistance = entries.reduce(
      (sum, w) => sum + (Number(w.cardio?.data?.distance) || 0),
      0
    );
    const totalDuration = entries.reduce(
      (sum, w) => sum + (Number(w.cardio?.data?.duration) || 0),
      0
    );
    const totalCalories = entries.reduce(
      (sum, w) => sum + (Number(w.cardio?.data?.calories) || 0),
      0
    );

    const derived = deriveCardioMetrics(activityType, {
      distance: totalDistance || undefined,
      duration: totalDuration || undefined,
    });

    const isPR = totalDistance > 0 && totalDistance > runningBestDistance;
    if (totalDistance > runningBestDistance) runningBestDistance = totalDistance;

    return {
      key: session.key,
      sortDate: new Date(session.date),
      label: new Date(session.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      hasData: true,
      activityType,
      distance: totalDistance || null,
      duration: totalDuration || null,
      pace: derived.pace ?? null,
      speed: derived.speed ?? null,
      calories: totalCalories || null,
      isPR,
      session,
    };
  });
}

export function cardioPrHistory(workouts = []) {
  const sorted = workouts
    .filter(isCardioEntry)
    .sort((a, b) => entryDate(a) - entryDate(b));

  const bestByActivity = new Map();
  const events = [];

  sorted.forEach((w) => {
    const activityType = w.cardio?.activityType;
    if (!activityType) return;

    const data = deriveCardioMetrics(activityType, w.cardio?.data || {});
    const current = bestByActivity.get(activityType) || {
      distance: 0,
      duration: 0,
      calories: 0,
      pace: null,
    };

    const prTypes = [];
    const values = {};

    if (typeof data.distance === "number" && data.distance > current.distance) {
      prTypes.push("distance");
      values.distance = data.distance;
      current.distance = data.distance;
    }
    if (typeof data.duration === "number" && data.duration > current.duration) {
      prTypes.push("duration");
      values.duration = data.duration;
      current.duration = data.duration;
    }
    if (typeof data.calories === "number" && data.calories > current.calories) {
      prTypes.push("calories");
      values.calories = data.calories;
      current.calories = data.calories;
    }
    if (
      typeof data.pace === "number" &&
      data.pace > 0 &&
      (current.pace == null || data.pace < current.pace)
    ) {
      prTypes.push("pace");
      values.pace = data.pace;
      current.pace = data.pace;
    }

    bestByActivity.set(activityType, current);

    if (prTypes.length) {
      events.push({
        activityType,
        date: w.date || w.createdAt,
        workout: w,
        prTypes,
        values,
      });
    }
  });

  return events;
}

export function buildCardioPRIndex(workouts) {
  const events = cardioPrHistory(workouts);
  const byKey = new Map();
  events.forEach((ev) => {
    byKey.set(`${ev.activityType}|${new Date(ev.date).getTime()}`, ev);
  });
  return byKey;
}

function invertPaceTrend(trend) {
  if (!trend || trend.direction === "flat") return trend;
  return { direction: trend.direction === "up" ? "down" : "up", changePct: -trend.changePct };
}

export function getCardioActivityProgression(
  workouts,
  activityType,
  { rangeKey = "lifetime" } = {}
) {
  const rangeFiltered = filterWorkoutsByTimeRange(workouts, rangeKey);
  const actWorkouts = filterWorkoutsByCardioActivity(rangeFiltered, activityType);
  const series = buildCardioSessionSeries(actWorkouts);
  const prEvents = cardioPrHistory(actWorkouts);
  const bestEver = prEvents.length
    ? prEvents.reduce(
        (best, ev) => ({ ...best, ...ev.values }),
        { distance: 0, duration: 0, calories: 0, pace: null }
      )
    : null;

  const trainedPoints = series.filter((p) => p.hasData);
  const totalDistance = trainedPoints.reduce((s, p) => s + (p.distance || 0), 0);
  const totalDuration = trainedPoints.reduce((s, p) => s + (p.duration || 0), 0);

  return {
    series,
    stats: {
      firstLoggedDate: trainedPoints.length ? trainedPoints[0].sortDate : null,
      lastLoggedDate: trainedPoints.length
        ? trainedPoints[trainedPoints.length - 1].sortDate
        : null,
      totalSessions: trainedPoints.length,
      totalDistance: Math.round(totalDistance * 100) / 100,
      totalDuration: Math.round(totalDuration),
      bestEver,
    },
    trend: {
      distance: describeTrend(series, "distance"),
      duration: describeTrend(series, "duration"),
      pace: invertPaceTrend(describeTrend(series, "pace")),
    },
    prEvents,
  };
}

export function getCardioDistribution(workouts) {
  const byActivity = new Map();

  workouts.filter(isCardioEntry).forEach((w) => {
    const activityType = w.cardio?.activityType;
    if (!activityType) return;
    if (!byActivity.has(activityType)) {
      byActivity.set(activityType, {
        activityType,
        sessions: 0,
        distance: 0,
        duration: 0,
      });
    }
    const entry = byActivity.get(activityType);
    entry.sessions += 1;
    entry.distance += Number(w.cardio?.data?.distance) || 0;
    entry.duration += Number(w.cardio?.data?.duration) || 0;
  });

  const total = Array.from(byActivity.values()).reduce((s, e) => s + e.sessions, 0) || 1;

  return Array.from(byActivity.values())
    .map((e) => ({
      ...e,
      distance: Math.round(e.distance * 100) / 100,
      duration: Math.round(e.duration),
      pct: Math.round((e.sessions / total) * 100),
    }))
    .sort((a, b) => b.sessions - a.sessions);
}

export function getCardioVariantDistribution(workouts, activityType) {
  const matching = workouts.filter(
    (w) => isCardioEntry(w) && w.cardio?.activityType === activityType
  );
  const anyVariantLogged = matching.some((w) => w.cardio?.variant);
  if (!anyVariantLogged) return [];

  const byVariant = new Map();
  matching.forEach((w) => {
    const variant = w.cardio?.variant || "Unspecified";
    if (!byVariant.has(variant)) {
      byVariant.set(variant, { variant, sessions: 0, distance: 0, duration: 0 });
    }
    const entry = byVariant.get(variant);
    entry.sessions += 1;
    entry.distance += Number(w.cardio?.data?.distance) || 0;
    entry.duration += Number(w.cardio?.data?.duration) || 0;
  });

  const total = Array.from(byVariant.values()).reduce((s, e) => s + e.sessions, 0) || 1;

  return Array.from(byVariant.values())
    .map((e) => ({
      ...e,
      distance: Math.round(e.distance * 100) / 100,
      duration: Math.round(e.duration),
      pct: Math.round((e.sessions / total) * 100),
    }))
    .sort((a, b) => b.sessions - a.sessions);
}

export function getCardioOverview(workouts, { period = "week" } = {}) {
  const cardioWorkouts = workouts.filter(isCardioEntry);
  const since = period === "month" ? startOfMonth() : startOfWeek();
  const periodWorkouts = cardioWorkouts.filter((w) => entryDate(w) >= since);

  const periodDistance = periodWorkouts.reduce(
    (s, w) => s + (Number(w.cardio?.data?.distance) || 0),
    0
  );
  const periodDuration = periodWorkouts.reduce(
    (s, w) => s + (Number(w.cardio?.data?.duration) || 0),
    0
  );
  const periodSessionIds = new Set(
    periodWorkouts.map((w) => w.sessionId || `standalone:${w._id}`)
  );

  const activityCounts = new Map();
  cardioWorkouts.forEach((w) => {
    const t = w.cardio?.activityType;
    if (!t) return;
    activityCounts.set(t, (activityCounts.get(t) || 0) + 1);
  });
  let favoriteActivity = null;
  let maxCount = 0;
  activityCounts.forEach((count, activity) => {
    if (count > maxCount) {
      maxCount = count;
      favoriteActivity = activity;
    }
  });

  let longestActivity = null;
  let fastestPace = null;
  const paceValues = [];

  cardioWorkouts.forEach((w) => {
    const derived = deriveCardioMetrics(w.cardio?.activityType, w.cardio?.data || {});
    const duration = Number(w.cardio?.data?.duration) || 0;
    if (duration > 0 && (!longestActivity || duration > longestActivity.duration)) {
      longestActivity = {
        duration,
        activityType: w.cardio?.activityType,
        date: w.date || w.createdAt,
      };
    }
    if (typeof derived.pace === "number" && derived.pace > 0) {
      paceValues.push(derived.pace);
      if (!fastestPace || derived.pace < fastestPace.pace) {
        fastestPace = {
          pace: derived.pace,
          activityType: w.cardio?.activityType,
          date: w.date || w.createdAt,
        };
      }
    }
  });

  const avgPace = paceValues.length
    ? Math.round((paceValues.reduce((s, p) => s + p, 0) / paceValues.length) * 100) / 100
    : null;

  return {
    hasCardioData: cardioWorkouts.length > 0,
    periodDistance: Math.round(periodDistance * 100) / 100,
    periodDuration: Math.round(periodDuration),
    periodSessions: periodSessionIds.size,
    favoriteActivity,
    longestActivity,
    fastestPace,
    avgPace,
  };
}
