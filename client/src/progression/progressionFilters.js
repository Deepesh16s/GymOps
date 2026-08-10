import { isCardioEntry } from "../utils/workoutUtils";

export const TIME_RANGE_OPTIONS = [
  { key: "7d", label: "Last 7 Days", shortLabel: "7D", days: 7 },
  { key: "30d", label: "Last 30 Days", shortLabel: "30D", days: 30 },
  { key: "90d", label: "Last 90 Days", shortLabel: "90D", days: 90 },
  { key: "6m", label: "Last 6 Months", shortLabel: "6M", days: 182 },
  { key: "1y", label: "Last 365 Days", shortLabel: "365D", days: 365 },
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

export function getAvailableExercises(workouts, muscle) {
  const seen = new Set();
  workouts.forEach((w) => {
    if (isCardioEntry(w) || !w.exercise?.name) return;
    if (muscle && muscle !== "All" && w.exercise.muscleGroup !== muscle) return;
    seen.add(w.exercise.name);
  });
  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}

export function pickBucketGranularity(startDate, endDate) {
  if (!startDate || !endDate) return "week";
  const days = (endDate - startDate) / 86400000;
  return days > 120 ? "month" : "week";
}
