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

export function filterBySearch(workouts, term) {
  if (!term) return workouts;
  const lower = term.toLowerCase();
  return workouts.filter((w) => w.exercise?.name?.toLowerCase().includes(lower));
}

export function filterByMuscle(workouts, muscle) {
  if (!muscle || muscle === "All") return workouts;
  return workouts.filter((w) => w.exercise?.muscleGroup === muscle);
}

export function sortWorkouts(workouts, order = "newest") {
  const sorted = [...workouts].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );
  return order === "newest" ? sorted.reverse() : sorted;
}