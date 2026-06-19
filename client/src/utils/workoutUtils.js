/* Shared workout math — single source of truth so Dashboard,
   Workout History, and Analytics never disagree on what
   "volume" or "heaviest set" means. */

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

/* "60kg×8, 65kg×6, 65kg×5" */
export function formatSetBreakdown(workout) {
  return (workout.workoutSets || [])
    .map((s) => `${s.weight}kg×${s.reps}`)
    .join(", ");
}

/* Case-insensitive partial match on exercise name —
   used by Workout History's search box */
export function filterBySearch(workouts, term) {
  if (!term) return workouts;
  const lower = term.toLowerCase();
  return workouts.filter((w) => w.exercise?.name?.toLowerCase().includes(lower));
}

/* "All" or falsy = no filter — used by Workout History's muscle dropdown */
export function filterByMuscle(workouts, muscle) {
  if (!muscle || muscle === "All") return workouts;
  return workouts.filter((w) => w.exercise?.muscleGroup === muscle);
}

/* Sort by date, newest-first by default */
export function sortWorkouts(workouts, order = "newest") {
  const sorted = [...workouts].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );
  return order === "newest" ? sorted.reverse() : sorted;
}