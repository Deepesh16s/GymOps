// Generic strength-training math primitives — deliberately independent of
// any page (Dashboard/Analytics/Progression/Goals/AI Coach all consume
// these the same way). Nothing here knows about sessions, muscle groups,
// or filters; that domain logic lives in `progression/`. Keep this file
// pure (no fetching, no React) so every consumer gets identical numbers.

// Epley formula — the estimated-1RM formula most consumer fitness apps
// (Hevy/Strong/etc.) use. No 1RM value is ever persisted anywhere in this
// app; every "Estimated 1RM" figure is computed on the fly from a real
// logged {weight, reps} set and must be labeled "Estimated" wherever shown.
export function estimate1RM(weight, reps) {
  if (!weight || !reps || weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return Math.round(weight);
  return Math.round(weight * (1 + reps / 30));
}

// Sum of reps*weight across a raw sets array. workoutUtils.getWorkoutVolume
// does the same reduction scoped to a single Workout document — this is
// the same math for callers that only have a bare sets array (e.g. a
// muscle- or exercise-filtered subset built up bucket by bucket).
export function calculateVolume(workoutSets = []) {
  return workoutSets.reduce((sum, s) => sum + s.reps * s.weight, 0);
}

// Heaviest set in a collection, ties broken by higher reps. Returns the
// full {weight, reps} set (not just the weight number, unlike
// workoutUtils.getHeaviestSet) so callers can also derive an estimated 1RM
// from it.
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

// %1RM a given set was performed at — useful for intensity-flavored views.
// Returns null (not 0) when there's no 1RM to divide by, since 0% would
// misleadingly read as "no intensity" rather than "not computable".
export function calculateRelativeIntensity(weight, oneRepMax) {
  if (!oneRepMax) return null;
  return Math.round((weight / oneRepMax) * 100);
}

// Trailing simple moving average over `series[*][key]`, added as a new
// `${key}Ma` field per point. Points with a null/undefined value for `key`
// are skipped from the window rather than treated as 0, so a metric with
// gaps (e.g. sessionDuration) doesn't get dragged toward zero.
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

// Chronological "record broken" events across a set of workouts — walks
// history in date order and emits one event every time an exercise's
// heaviest-ever set increases. This is genuine PR *history*; the existing
// dashboard/Analytics "personal records" are just the current snapshot of
// the same underlying data (heaviest set ever, per exercise), so this
// builds on top of the same real numbers rather than inventing new ones.
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
