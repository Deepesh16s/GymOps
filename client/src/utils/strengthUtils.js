
export function estimate1RM(weight, reps) {
  if (!weight || !reps || weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return Math.round(weight);
  return Math.round(weight * (1 + reps / 30));
}

export function calculateVolume(workoutSets = []) {
  return workoutSets.reduce((sum, s) => sum + s.reps * s.weight, 0);
}

export function bestSet(workoutSets = []) {
  if (!workoutSets.length) return null;
  return workoutSets.reduce((best, s) => {
    if (!best) return s;
    if (s.weight > best.weight) return s;
    if (s.weight === best.weight && s.reps > best.reps) return s;
    return best;
  }, null);
}

export function calculateWorkingWeightAverage(workoutSets = []) {
  if (!workoutSets.length) return 0;
  const total = workoutSets.reduce((sum, s) => sum + s.weight, 0);
  return total / workoutSets.length;
}

export function calculateRelativeIntensity(weight, oneRepMax) {
  if (!oneRepMax) return null;
  return Math.round((weight / oneRepMax) * 100);
}

export function movingAverage(series, key, window = 4) {
  return series.map((point, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = series
      .slice(start, i + 1)
      .filter((p) => p[key] != null);
    if (!slice.length) return { ...point, [`${key}Ma`]: null };
    const avg = slice.reduce((s, p) => s + p[key], 0) / slice.length;
    return { ...point, [`${key}Ma`]: avg };
  });
}

export function prHistory(workouts = []) {
  const sorted = [...workouts]
    .filter((w) => w?.entryType !== "cardio")
    .sort(
      (a, b) => new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt)
    );

  const bestByExercise = new Map();
  const events = [];

  sorted.forEach((w) => {
    const name = w.exercise?.name;
    if (!name) return;
    const set = bestSet(w.workoutSets || []);
    if (!set) return;

    const current = bestByExercise.get(name);
    if (!current || set.weight > current.weight) {
      bestByExercise.set(name, set);
      events.push({
        exercise: name,
        muscle: w.exercise?.muscleGroup || null,
        weight: set.weight,
        reps: set.reps,
        estOneRM: estimate1RM(set.weight, set.reps),
        date: w.date || w.createdAt,
      });
    }
  });

  return events;
}
