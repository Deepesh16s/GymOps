// The Progression Engine — the single place raw workout history is turned
// into time-bucketed progression datasets. Every consumer (Progression
// page today; Dashboard/Analytics/Goals/AI Coach as they migrate) calls
// into this instead of re-deriving trends itself. Pure functions only: no
// fetching, no React state — callers own the raw `workouts` array (from
// services/workoutService.getWorkouts) and memoize as needed.
import {
  buildSessionSummaries,
  groupWorkoutsIntoSessions,
  getSessionStats,
  getSetCount,
  getWorkoutVolume,
  isCardioEntry,
} from "../utils/workoutUtils";
import {
  estimate1RM,
  bestSet,
  calculateWorkingWeightAverage,
  movingAverage,
  prHistory,
} from "../utils/strengthUtils";
import {
  filterWorkoutsByExercise,
  filterWorkoutsByMuscle,
  filterWorkoutsByTimeRange,
  pickBucketGranularity,
} from "./progressionFilters";

function entryDate(w) {
  return new Date(w.date || w.createdAt);
}

function bucketKeyFor(date, granularity) {
  const d = new Date(date);
  if (granularity === "month") {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  const day = d.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(monday.getDate() + diffToMon);
  // Local Y-M-D (not toISOString, which converts to UTC and would shift
  // the key a day earlier for any timezone ahead of UTC).
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(
    monday.getDate()
  ).padStart(2, "0")}`;
}

function bucketLabel(key, granularity) {
  if (granularity === "month") {
    const [y, m] = key.split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
  }
  // Parse the "YYYY-MM-DD" key with explicit local components — passing
  // it straight to `new Date(key)` would parse as UTC midnight and could
  // display a day early in timezones ahead of UTC.
  const [y, m, d] = key.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  // Weekly buckets start on Monday (see bucketKeyFor) — the label shows
  // the full Mon-Sun span rather than just the start date, so a reader
  // doesn't have to guess whether "Jun 15" means one day or a whole week.
  const end = new Date(y, m - 1, d + 6);
  const fmt = (date) => date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

// Every bucket key (+label) from `start` to `end` at the given
// granularity, in order — including periods with zero logged workouts.
// This is what lets the chart draw an honest gap instead of jumping
// straight from one real data point to the next.
function enumerateBucketKeys(start, end, granularity) {
  const firstKey = bucketKeyFor(start, granularity);
  const [fy, fm, fd] = firstKey.split("-").map(Number);
  const cursor =
    granularity === "month" ? new Date(fy, fm - 1, 1) : new Date(fy, fm - 1, fd);

  const endKey = bucketKeyFor(end, granularity);
  const keys = [];

  // Guard against runaway loops on malformed dates — comfortably covers
  // 30+ years of weekly buckets or centuries of monthly ones.
  for (let i = 0; i < 2000; i++) {
    const key = bucketKeyFor(cursor, granularity);
    keys.push({ key, label: bucketLabel(key, granularity) });
    if (key === endKey) break;
    if (granularity === "month") cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setDate(cursor.getDate() + 7);
  }

  return keys;
}

// Core bucketed time series: one point per week (or month, for long
// ranges — see pickBucketGranularity) from the first workout in `workouts`
// to the last, carrying every chartable metric so the Filter Bar can
// switch metrics without recomputing buckets.
export function buildProgressionSeries(workouts, { granularity } = {}) {
  const strengthWorkouts = workouts.filter((w) => !isCardioEntry(w));
  if (!strengthWorkouts.length) return [];

  const sorted = [...strengthWorkouts].sort((a, b) => entryDate(a) - entryDate(b));
  const start = entryDate(sorted[0]);
  const end = entryDate(sorted[sorted.length - 1]);
  const gran = granularity || pickBucketGranularity(start, end);

  const buckets = new Map();
  const ensureBucket = (key) => {
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        label: bucketLabel(key, gran),
        volume: 0,
        sets: 0,
        weightSamples: [],
        bestEst1RM: 0,
        prCount: 0,
        prWeight: null,
        sessionIds: new Set(),
        durations: [],
      });
    }
    return buckets.get(key);
  };

  sorted.forEach((w) => {
    const b = ensureBucket(bucketKeyFor(entryDate(w), gran));
    b.volume += getWorkoutVolume(w);
    b.sets += getSetCount(w);
    (w.workoutSets || []).forEach((s) => b.weightSamples.push(s.weight));
    const best = bestSet(w.workoutSets || []);
    if (best) {
      const est = estimate1RM(best.weight, best.reps);
      if (est > b.bestEst1RM) b.bestEst1RM = est;
    }
    b.sessionIds.add(w.sessionId || `standalone:${w._id}`);
  });

  // Session duration is session-level, not workout-level, and only some
  // sessions have one recorded — attach via the shared session grouping
  // rather than re-deriving "what counts as a session" here.
  buildSessionSummaries(workouts).forEach((s) => {
    if (s.stats.exerciseCount === 0 || s.sessionDuration == null) return;
    const key = bucketKeyFor(s.date, gran);
    if (buckets.has(key)) buckets.get(key).durations.push(s.sessionDuration);
  });

  prHistory(workouts).forEach((ev) => {
    const key = bucketKeyFor(ev.date, gran);
    if (!buckets.has(key)) return;
    const b = buckets.get(key);
    b.prCount += 1;
    // A single bucket can contain more than one new-record event (e.g.
    // progressively heavier warm-up-to-top sets logged in one session);
    // the chart plots the highest one actually achieved that period.
    b.prWeight = b.prWeight == null ? ev.weight : Math.max(b.prWeight, ev.weight);
  });

  // Walk every period from the first workout to the last — including
  // ones with nothing logged — so the chart can render an honest gap
  // ("No workout logged") instead of silently skipping straight from one
  // real data point to the next and implying continuous progress.
  //
  // recordWeight is the running "current record" (the Timeline's own
  // ECG-style metric): it holds flat across every trained period until a
  // new PR raises it, and only breaks (null) for a period with no
  // workout logged at all — a PR you already hold doesn't lapse just
  // because you skipped a week, unlike a period-specific metric such as
  // volume or working weight.
  let runningBest = null;
  return enumerateBucketKeys(start, end, gran).map(({ key, label }) => {
    const b = buckets.get(key);
    if (!b) {
      return {
        key,
        label,
        hasData: false,
        volume: null,
        sets: null,
        frequency: null,
        workingWeight: null,
        estOneRM: null,
        prCount: null,
        prWeight: null,
        recordWeight: null,
        sessionDuration: null,
        avgVolumePerSession: null,
      };
    }
    if (b.prWeight != null) runningBest = runningBest == null ? b.prWeight : Math.max(runningBest, b.prWeight);
    return {
      key: b.key,
      label: b.label,
      hasData: true,
      volume: Math.round(b.volume),
      sets: b.sets,
      frequency: b.sessionIds.size,
      prWeight: b.prWeight,
      recordWeight: runningBest,
      workingWeight: b.weightSamples.length
        ? Math.round(calculateWorkingWeightAverage(b.weightSamples.map((weight) => ({ weight }))) * 10) / 10
        : 0,
      estOneRM: b.bestEst1RM,
      prCount: b.prCount,
      sessionDuration: b.durations.length
        ? Math.round(b.durations.reduce((s, d) => s + d, 0) / b.durations.length)
        : null,
      // Total volume that period divided by how many sessions actually
      // trained it — fixes the "more workouts = bigger number even at
      // the same effort per session" distortion a raw volume trend has
      // (2 sessions x 500kg reads identically to 4 sessions x 500kg
      // here, where plain volume would show the second as "double").
      avgVolumePerSession: b.sessionIds.size > 0 ? Math.round(b.volume / b.sessionIds.size) : null,
    };
  });
}

// A dedicated series for the Timeline chart — buildProgressionSeries'
// weekly/monthly buckets are the right resolution for continuous metrics
// like volume, but wrong for discrete PR events: two records set three
// days apart can land in the same week bucket and silently collapse into
// a single point, hiding the earlier one entirely. Here every real record
// gets its own point at its exact date; only genuine no-training periods
// (reusing buildProgressionSeries' hasData signal) collapse to a single
// gap marker, so an ECG-style break still shows for real inactivity
// without sacrificing same-week PR detail.
export function buildRecordTimeline(workouts) {
  const strengthWorkouts = workouts.filter((w) => !isCardioEntry(w));
  if (!strengthWorkouts.length) return [];

  const sorted = [...strengthWorkouts].sort((a, b) => entryDate(a) - entryDate(b));
  const start = entryDate(sorted[0]);
  const end = entryDate(sorted[sorted.length - 1]);
  const gran = pickBucketGranularity(start, end);

  const coarse = buildProgressionSeries(workouts, { granularity: gran });
  const gapPoints = coarse
    .filter((p) => !p.hasData)
    .map((p) => {
      const parts = p.key.split("-").map(Number);
      const sortDate =
        gran === "month" ? new Date(parts[0], parts[1] - 1, 1) : new Date(parts[0], parts[1] - 1, parts[2]);
      return { sortDate, label: p.label, hasData: false, recordWeight: null };
    });

  let runningBest = null;
  // Tracked separately from `runningBest` (the cross-exercise max this
  // timeline plots) — an event here is a new PR for its OWN exercise, not
  // necessarily a new overall max (e.g. a Bicep Curl PR while Squat still
  // holds the heaviest lift ever), so the delta shown must be "how much
  // did THIS exercise improve", not "vs the heaviest lift overall".
  const bestByExercise = new Map();
  const eventPoints = prHistory(strengthWorkouts).map((ev) => {
    const previousBest = bestByExercise.has(ev.exercise) ? bestByExercise.get(ev.exercise) : null;
    const delta = previousBest == null ? null : Math.round((ev.weight - previousBest) * 10) / 10;
    bestByExercise.set(ev.exercise, ev.weight);
    runningBest = runningBest == null ? ev.weight : Math.max(runningBest, ev.weight);
    return {
      sortDate: new Date(ev.date),
      label: new Date(ev.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      hasData: true,
      recordWeight: runningBest,
      exercise: ev.exercise,
      weight: ev.weight,
      reps: ev.reps,
      delta,
    };
  });

  return [...gapPoints, ...eventPoints].sort((a, b) => a.sortDate - b.sortDate);
}

// One point PER SESSION for a single exercise's Timeline chart — never
// per-set (see buildExerciseSetTimeline's retirement: with hundreds of
// sets over years the chart becomes unreadable and, worse, several
// consecutive points sharing the same day label made recharts'
// hover-matching resolve to the wrong point). Every metric a session
// contributed is precomputed here so the chart can switch what it
// plots without recomputing sessions. `workouts` is expected to already
// be scoped to one exercise (Progression.jsx does this via
// filterWorkoutsByExercise before calling in). isPR reuses the same ">"
// comparison prHistory itself uses, walked per-session so "record"
// means the same thing here as everywhere else in the app. Reuses
// groupWorkoutsIntoSessions (not a re-derivation of "what counts as a
// session") and bestSet/estimate1RM/calculateWorkingWeightAverage (not a
// re-derivation of those either).
export function buildExerciseSessionSeries(workouts) {
  const strengthWorkouts = workouts.filter((w) => !isCardioEntry(w));
  if (!strengthWorkouts.length) return [];

  const sessions = groupWorkoutsIntoSessions(strengthWorkouts)
    .map((s) => ({ ...s, stats: getSessionStats(s) }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  let runningBest = 0;

  return sessions.map((session) => {
    const sessionSets = session.workouts.flatMap((w) => w.workoutSets || []);
    const best = bestSet(sessionSets);
    const isPR = !!best && best.weight > runningBest;
    if (best && best.weight > runningBest) runningBest = best.weight;

    return {
      key: session.key,
      sortDate: new Date(session.date),
      label: new Date(session.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      hasData: true,
      volume: Math.round(session.stats.volume),
      sets: session.stats.setCount,
      totalReps: sessionSets.reduce((sum, s) => sum + s.reps, 0),
      workingWeight: calculateWorkingWeightAverage(sessionSets),
      estOneRM: best ? estimate1RM(best.weight, best.reps) : null,
      bestSetWeight: best ? best.weight : null,
      bestSet: best,
      sessionDuration: session.sessionDuration,
      isPR,
      session,
    };
  });
}

// Compares the first half of a series' average for `key` against the
// second half — the basis for "improving / plateaued / declining" copy.
// Returns null when there isn't enough data for the comparison to be
// meaningful (fewer than 4 points), rather than a misleading trend.
export function describeTrend(series, key) {
  const points = series.filter((p) => p[key] != null);
  if (points.length < 4) return null;

  const mid = Math.floor(points.length / 2);
  const firstHalf = points.slice(0, mid);
  const secondHalf = points.slice(mid);
  const avg = (arr) => arr.reduce((s, p) => s + p[key], 0) / arr.length;
  const a = avg(firstHalf);
  const b = avg(secondHalf);

  if (a === 0 && b === 0) return { direction: "flat", changePct: 0 };
  const changePct = a === 0 ? 100 : Math.round(((b - a) / a) * 100);
  const direction = changePct > 5 ? "up" : changePct < -5 ? "down" : "flat";
  return { direction, changePct };
}

// "vs last month"-style comparison — the trailing `windowSize` buckets'
// average for `key` against the `windowSize` buckets immediately before
// them. Deliberately distinct from describeTrend (whole-history first-
// half vs second-half): this answers "how does my most recent stretch
// compare to the one right before it", which is what a plain-language
// "vs last month" verdict actually means. Same {direction, changePct}
// shape as describeTrend, so it's a drop-in for TrendBadge. Returns null
// when there isn't a full two windows' worth of trained buckets yet.
export function compareRecentPeriods(series, key, windowSize = 4) {
  const points = series.filter((p) => p[key] != null);
  if (points.length < windowSize * 2) return null;

  const recent = points.slice(-windowSize);
  const previous = points.slice(-windowSize * 2, -windowSize);
  const avg = (arr) => arr.reduce((s, p) => s + p[key], 0) / arr.length;
  const a = avg(previous);
  const b = avg(recent);

  if (a === 0 && b === 0) return { direction: "flat", changePct: 0 };
  const changePct = a === 0 ? 100 : Math.round(((b - a) / a) * 100);
  const direction = changePct > 5 ? "up" : changePct < -5 ? "down" : "flat";
  return { direction, changePct };
}

// Session-count based comparison — as opposed to compareRecentPeriods'
// calendar-bucket comparison (which needs enough distinct trained WEEKS),
// this splits a chronological list of per-session values into first-half
// vs second-half and compares averages. It unlocks with far fewer total
// sessions than a weekly comparison would need, since it doesn't care how
// those sessions are spread across calendar time — a lifter who trains
// 7 times in a single busy fortnight sees a trend just as readily as one
// who trains 7 times over 2 months.
export function compareSessionHalves(values, minCount = 7) {
  const points = values.filter((v) => v != null);
  if (points.length < minCount) return null;

  const mid = Math.floor(points.length / 2);
  const firstHalf = points.slice(0, mid);
  const secondHalf = points.slice(mid);
  const avg = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const a = avg(firstHalf);
  const b = avg(secondHalf);

  if (a === 0 && b === 0) return { direction: "flat", changePct: 0 };
  const changePct = a === 0 ? 100 : Math.round(((b - a) / a) * 100);
  const direction = changePct > 5 ? "up" : changePct < -5 ? "down" : "flat";
  return { direction, changePct };
}

// % of weeks in [startDate, endDate] that contained at least one strength
// session. Returns null (hide gracefully) when the range is too short
// (<2 weeks) for a percentage to mean anything.
export function getConsistency(sessions, startDate, endDate) {
  if (!startDate || !endDate) return null;
  const totalWeeks = Math.max(1, Math.ceil((endDate - startDate) / (7 * 86400000)));
  if (totalWeeks < 2) return null;

  const weeksTrained = new Set();
  sessions.forEach((s) => {
    const weekIdx = Math.floor((new Date(s.date) - startDate) / (7 * 86400000));
    weeksTrained.add(weekIdx);
  });

  return {
    percent: Math.round((weeksTrained.size / totalWeeks) * 100),
    weeksTrained: weeksTrained.size,
    totalWeeks,
  };
}

// Per-exercise sets/volume breakdown within an already muscle-filtered
// workout list — powers "Training Distribution" and "Best Exercise".
export function getExerciseDistribution(workouts) {
  const byExercise = new Map();
  workouts.forEach((w) => {
    if (isCardioEntry(w) || !w.exercise?.name) return;
    const name = w.exercise.name;
    if (!byExercise.has(name)) {
      byExercise.set(name, { exercise: name, sets: 0, volume: 0 });
    }
    const e = byExercise.get(name);
    e.sets += getSetCount(w);
    e.volume += getWorkoutVolume(w);
  });

  const total = Array.from(byExercise.values()).reduce((s, e) => s + e.sets, 0) || 1;
  return Array.from(byExercise.values())
    .map((e) => ({ ...e, volume: Math.round(e.volume), pct: Math.round((e.sets / total) * 100) }))
    .sort((a, b) => b.sets - a.sets);
}

function latestDateOf(workouts) {
  if (!workouts.length) return null;
  return new Date(Math.max(...workouts.map((w) => entryDate(w).getTime())));
}

function earliestDateOf(workouts) {
  if (!workouts.length) return null;
  return new Date(Math.min(...workouts.map((w) => entryDate(w).getTime())));
}

// Default landing dataset: the user's complete training history, no
// muscle/exercise pre-selected. Answers "how has my training evolved,
// where did I improve, where did it plateau".
export function getOverallProgression(workouts, { rangeKey = "lifetime" } = {}) {
  const filtered = filterWorkoutsByTimeRange(workouts, rangeKey);
  const strengthWorkouts = filtered.filter((w) => !isCardioEntry(w));
  const series = buildProgressionSeries(filtered);
  const sessions = buildSessionSummaries(filtered).filter((s) => s.stats.exerciseCount > 0);

  return {
    series,
    hasSessionDuration: series.some((p) => p.sessionDuration != null),
    summary: {
      firstWorkoutDate: earliestDateOf(strengthWorkouts),
      latestWorkoutDate: latestDateOf(strengthWorkouts),
      totalVolume: Math.round(strengthWorkouts.reduce((s, w) => s + getWorkoutVolume(w), 0)),
      totalSets: strengthWorkouts.reduce((s, w) => s + getSetCount(w), 0),
      totalSessions: sessions.length,
    },
    trend: {
      volume: describeTrend(series, "volume"),
      estOneRM: describeTrend(series, "estOneRM"),
      frequency: describeTrend(series, "frequency"),
    },
  };
}

export function getMuscleProgression(workouts, muscle, { rangeKey = "lifetime" } = {}) {
  const rangeFiltered = filterWorkoutsByTimeRange(workouts, rangeKey);
  const muscleWorkouts = filterWorkoutsByMuscle(rangeFiltered, muscle);
  const series = buildProgressionSeries(muscleWorkouts);
  const sessions = buildSessionSummaries(muscleWorkouts).filter((s) => s.stats.exerciseCount > 0);
  const exerciseDistribution = getExerciseDistribution(muscleWorkouts);
  const prTimeline = prHistory(muscleWorkouts);

  const start = earliestDateOf(muscleWorkouts);
  const end = latestDateOf(muscleWorkouts);
  const totalVolume = series.reduce((s, p) => s + p.volume, 0);
  const avgWeeklyVolume = series.length ? Math.round(totalVolume / series.length) : 0;

  return {
    series,
    hasSessionDuration: series.some((p) => p.sessionDuration != null),
    stats: {
      firstTrainedDate: start,
      lastTrained: end,
      totalSessions: sessions.length,
      bestExercise: exerciseDistribution[0]?.exercise || null,
      avgWeeklyVolume,
    },
    trend: {
      volume: describeTrend(series, "volume"),
      sets: describeTrend(series, "sets"),
      frequency: describeTrend(series, "frequency"),
      avgVolumePerSession: describeTrend(series, "avgVolumePerSession"),
    },
    exerciseDistribution,
    prTimeline,
    consistency: getConsistency(sessions, start, end),
  };
}

export function getExerciseProgression(workouts, exerciseName, { rangeKey = "lifetime" } = {}) {
  const rangeFiltered = filterWorkoutsByTimeRange(workouts, rangeKey);
  const exWorkouts = filterWorkoutsByExercise(rangeFiltered, exerciseName);
  const series = buildProgressionSeries(exWorkouts);
  const sessions = buildSessionSummaries(exWorkouts).filter((s) => s.stats.exerciseCount > 0);
  const prTimeline = prHistory(exWorkouts);
  const currentBest = prTimeline[prTimeline.length - 1] || null;

  const trainedPoints = series.filter((p) => p.hasData);
  const avgWorkingWeight = trainedPoints.length
    ? Math.round(
        (trainedPoints.reduce((s, p) => s + p.workingWeight, 0) / trainedPoints.length) * 10
      ) / 10
    : null;

  return {
    series,
    hasSessionDuration: series.some((p) => p.sessionDuration != null),
    stats: {
      firstLoggedDate: earliestDateOf(exWorkouts),
      lastLoggedDate: latestDateOf(exWorkouts),
      totalSessions: sessions.length,
      bestSet: currentBest,
      totalVolume: Math.round(exWorkouts.reduce((s, w) => s + getWorkoutVolume(w), 0)),
      avgWorkingWeight,
    },
    trend: {
      workingWeight: describeTrend(series, "workingWeight"),
      estOneRM: describeTrend(series, "estOneRM"),
      volume: describeTrend(series, "volume"),
    },
    prTimeline,
  };
}

// "Projected Milestone" — extrapolates a metric's recent trend (ordinary
// least-squares over the series' trained points) to estimate when it will
// cross the next round-number target above its current value. Bucket
// index is used as the regression's x-axis rather than calendar date
// since buildProgressionSeries' buckets are evenly spaced within one
// call (all weekly, or all monthly) — same assumption describeTrend
// already leans on. This is a plain linear projection of a noisy trend,
// not a guarantee: callers must always present it as an estimate (e.g.
// "Projected", never "Will"), the same honesty bar estimate1RM's
// "Estimated" label already sets for this app. Returns null whenever
// there isn't enough history, the trend isn't actually improving, or the
// projection doesn't resolve to a real future point.
export function projectMilestone(series, metricKey, { roundTo = 5 } = {}) {
  const points = series
    .map((p, i) => ({ i, value: p[metricKey] }))
    .filter((p) => p.value != null && p.value > 0);

  if (points.length < 4) return null;

  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.i, 0);
  const sumY = points.reduce((s, p) => s + p.value, 0);
  const sumXY = points.reduce((s, p) => s + p.i * p.value, 0);
  const sumXX = points.reduce((s, p) => s + p.i * p.i, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  if (slope <= 0) return null; // flat or declining — nothing honest to project

  const last = points[points.length - 1];
  const target = Math.ceil((last.value + 0.01) / roundTo) * roundTo;
  const targetIndex = (target - intercept) / slope;
  const bucketsAhead = targetIndex - last.i;
  if (!Number.isFinite(bucketsAhead) || bucketsAhead <= 0) return null;

  // Bucket key format ("YYYY-MM-DD" vs "YYYY-MM") is how every other
  // consumer of this series (e.g. the chart subtitle) already tells
  // weekly from monthly buckets — reused here rather than threading
  // granularity through as a separate parameter.
  const isMonthly = series[0]?.key?.length === 7;
  const daysPerBucket = isMonthly ? 30 : 7;
  const daysAhead = Math.round(bucketsAhead * daysPerBucket);
  // Cap the horizon at 2 years out — beyond that a linear projection off
  // a handful of noisy training-log points is just noise wearing a date.
  if (daysAhead > 730) return null;

  const projectedDate = new Date();
  projectedDate.setDate(projectedDate.getDate() + daysAhead);

  return {
    target,
    currentValue: last.value,
    projectedDate,
    daysAhead,
  };
}

export { movingAverage };
