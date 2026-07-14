// Filtering/derivation layer for the Progression module. Operates on raw
// Workout documents (the same shape every page already fetches via
// services/workoutService.getWorkouts) — no network calls here, so
// switching any filter recomputes client-side only, per the "avoid
// unnecessary API requests" requirement.
import { isCardioEntry } from "../utils/workoutUtils";

export const TIME_RANGE_OPTIONS = [
  { key: "7d", label: "Last 7 Days", shortLabel: "7D", days: 7 },
  { key: "30d", label: "Last 30 Days", shortLabel: "30D", days: 30 },
  { key: "90d", label: "Last 90 Days", shortLabel: "90D", days: 90 },
  { key: "6m", label: "Last 6 Months", shortLabel: "6M", days: 182 },
  { key: "1y", label: "Last Year", shortLabel: "1Y", days: 365 },
  { key: "lifetime", label: "Lifetime", shortLabel: "All", days: null },
];

export const DEFAULT_TIME_RANGE = "lifetime";

export function resolveTimeRangeCutoff(rangeKey) {
  const opt = TIME_RANGE_OPTIONS.find((o) => o.key === rangeKey);
  if (!opt || opt.days == null) return null;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (opt.days - 1));
  return d;
}

export function filterWorkoutsByTimeRange(workouts, rangeKey) {
  const cutoff = resolveTimeRangeCutoff(rangeKey);
  if (!cutoff) return workouts;
  return workouts.filter((w) => new Date(w.date || w.createdAt) >= cutoff);
}

export function filterWorkoutsByMuscle(workouts, muscle) {
  if (!muscle || muscle === "All") return workouts;
  return workouts.filter(
    (w) => !isCardioEntry(w) && w.exercise?.muscleGroup === muscle
  );
}

export function filterWorkoutsByExercise(workouts, exerciseName) {
  if (!exerciseName) return workouts;
  return workouts.filter(
    (w) => !isCardioEntry(w) && w.exercise?.name === exerciseName
  );
}

// Muscles actually present in the user's own data, in first-seen order —
// drives the Muscle filter's dropdown. A muscle with zero logged sets
// simply won't appear here; nothing is force-listed or fabricated.
export function getAvailableMuscles(workouts) {
  const seen = new Set();
  const order = [];
  workouts.forEach((w) => {
    const muscle = !isCardioEntry(w) && w.exercise?.muscleGroup;
    if (muscle && !seen.has(muscle)) {
      seen.add(muscle);
      order.push(muscle);
    }
  });
  return order;
}

// Exercises present in the data, optionally narrowed to one muscle (so
// the Exercise filter can be scoped once a Muscle is already selected).
export function getAvailableExercises(workouts, muscle) {
  const seen = new Set();
  workouts.forEach((w) => {
    if (isCardioEntry(w) || !w.exercise?.name) return;
    if (muscle && muscle !== "All" && w.exercise.muscleGroup !== muscle) return;
    seen.add(w.exercise.name);
  });
  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}

// Weekly buckets stay readable up to ~4 months of range; beyond that a
// lifetime/year view collapses into monthly buckets so the chart doesn't
// render hundreds of cramped points.
export function pickBucketGranularity(startDate, endDate) {
  if (!startDate || !endDate) return "week";
  const days = (endDate - startDate) / 86400000;
  return days > 120 ? "month" : "week";
}
