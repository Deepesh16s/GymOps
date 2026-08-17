const { detectPlateau, buildExerciseSeries, getAdvancedProgressionAnalytics } = require("../../utils/progressionAnalytics");

const DAY_MS = 86400000;
const daysAgo = (n) => new Date(Date.now() - n * DAY_MS);

function makeSession(id, daysBack, weight, reps = 5) {
  return {
    _id: id,
    date: daysAgo(daysBack),
    exercise: { name: "Bench Press", muscleGroup: "Chest" },
    workoutSets: [{ weight, reps }],
  };
}

// A workout referencing a since-deleted Exercise document comes back from
// .populate("exercise") as exercise: null — deleteExercise only blocks
// deletion when a Goal references the exercise, not workout history, so
// this is a real, reachable state.
function staleSession(id, daysBack, weight = 60, reps = 5) {
  return {
    _id: id,
    date: daysAgo(daysBack),
    exercise: null,
    workoutSets: [{ weight, reps }],
  };
}

describe("progressionAnalytics.detectPlateau (unified with client thresholds)", () => {
  const now = new Date();

  it("reports insufficient_data below the minimum total-session floor (6)", () => {
    const workouts = Array.from({ length: 3 }, (_, i) => makeSession(`w${i}`, 20 - i * 5, 60));
    const series = buildExerciseSeries(workouts, "Bench Press");
    const result = detectPlateau(series, "Bench Press", now);
    expect(result.status).toBe("insufficient_data");
  });

  it("reports insufficient_recent_data when not trained within the 28-day window", () => {
    const workouts = Array.from({ length: 8 }, (_, i) => makeSession(`w${i}`, 60 + i * 7, 60));
    const series = buildExerciseSeries(workouts, "Bench Press");
    const result = detectPlateau(series, "Bench Press", now);
    expect(result.status).toBe("insufficient_recent_data");
  });

  it("classifies 'possible' for a flat trend with 6-9 sessions, using the same 5% flat band as the client", () => {
    const workouts = Array.from({ length: 6 }, (_, i) => makeSession(`w${i}`, 20 - i * 3, 60));
    const series = buildExerciseSeries(workouts, "Bench Press");
    const result = detectPlateau(series, "Bench Press", now);
    expect(result.trend.direction).toBe("flat");
    expect(result.status).toBe("possible");
  });

  it("classifies 'confirmed' for a flat, low-volatility trend at 10+ sessions", () => {
    const workouts = Array.from({ length: 10 }, (_, i) => makeSession(`w${i}`, 27 - i * 2, 60));
    const series = buildExerciseSeries(workouts, "Bench Press");
    const result = detectPlateau(series, "Bench Press", now);
    expect(result.trend.direction).toBe("flat");
    expect(result.status).toBe("confirmed");
    expect(result.volatility.high).toBe(false);
  });

  it("downgrades confirmed to possible under high volatility", () => {
    const weights = [60, 75, 50, 80, 55, 78, 52, 76, 54, 60];
    const workouts = weights.map((w, i) => makeSession(`w${i}`, 27 - i * 2, w));
    const series = buildExerciseSeries(workouts, "Bench Press");
    const result = detectPlateau(series, "Bench Press", now);
    expect(result.volatility.high).toBe(true);
    expect(result.status).not.toBe("confirmed");
  });

  it("does not flag a plateau on a genuinely improving trend", () => {
    const workouts = Array.from({ length: 10 }, (_, i) => makeSession(`w${i}`, 27 - i * 2, 60 + i * 5));
    const series = buildExerciseSeries(workouts, "Bench Press");
    const result = detectPlateau(series, "Bench Press", now);
    expect(result.trend.direction).toBe("up");
    expect(result.status).toBe("none");
  });
});

describe("progressionAnalytics: stale exercise reference (deleted Exercise document)", () => {
  const now = new Date();

  it("getAdvancedProgressionAnalytics does not throw when history includes a stale (null-exercise) entry", () => {
    const workouts = [
      staleSession("stale1", 5),
      ...Array.from({ length: 8 }, (_, i) => makeSession(`w${i}`, 20 - i * 2, 60)),
    ];
    expect(() => getAdvancedProgressionAnalytics(workouts, { now })).not.toThrow();
  });

  it("excludes the stale entry from strength-workout analysis rather than corrupting it", () => {
    const workouts = [
      staleSession("stale1", 5),
      ...Array.from({ length: 8 }, (_, i) => makeSession(`w${i}`, 20 - i * 2, 60)),
    ];
    const result = getAdvancedProgressionAnalytics(workouts, { now });
    // "Bench Press" from the real sessions is still analyzed; the stale
    // entry has no exercise name and so never becomes a tracked exercise.
    expect(result.plateau.some((p) => p.exercise === "Bench Press")).toBe(true);
    expect(result.plateau.some((p) => p.exercise == null)).toBe(false);
  });

  it("buildExerciseSeries silently skips a stale entry instead of throwing", () => {
    const workouts = [staleSession("stale1", 5), makeSession("w1", 5, 60)];
    expect(() => buildExerciseSeries(workouts, "Bench Press")).not.toThrow();
    const series = buildExerciseSeries(workouts, "Bench Press");
    expect(series).toHaveLength(1);
  });
});
