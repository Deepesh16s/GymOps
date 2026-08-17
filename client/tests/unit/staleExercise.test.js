import { describe, it, expect } from "vitest";
import { computeMuscleBreakdown, getSessionStats, groupWorkoutsIntoSessions } from "../../src/utils/workoutUtils";
import {
  filterWorkoutsByMuscle,
  filterWorkoutsByExercise,
  getAvailableMuscles,
  getAvailableExercises,
} from "../../src/progression/progressionFilters";
import { prHistory } from "../../src/utils/strengthUtils";
import { getMusclePlateaus, getExercisePlateau } from "../../src/intelligence/plateauEngine";
import { getTrainingBalance } from "../../src/intelligence/balanceEngine";
import { getMusclePriorities } from "../../src/intelligence/musclePriorityEngine";
import { getWeeklyGrade } from "../../src/intelligence/weeklyGradeEngine";
import { generateSessionIntelligence } from "../../src/trainingIntelligence/generateSessionIntelligence";

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n) => new Date(Date.now() - n * DAY).toISOString().slice(0, 10);

// A workout whose Exercise document has been deleted comes back from
// Mongoose's .populate("exercise") with exercise: null — deleteExercise only
// blocks deletion when a Goal references the exercise, not when workout
// history does, so this is a real, reachable state, not a hypothetical one.
function staleWorkout(id, daysBack, weight = 60, reps = 8) {
  return {
    _id: id,
    date: daysAgo(daysBack),
    exercise: null,
    workoutSets: [{ weight, reps }],
  };
}

function normalWorkout(id, daysBack, muscle, weight = 60, reps = 8) {
  return {
    _id: id,
    date: daysAgo(daysBack),
    exercise: { name: `${muscle} Exercise`, muscleGroup: muscle },
    workoutSets: [{ weight, reps }],
  };
}

describe("stale exercise reference (deleted Exercise document): no crash, no corrupted metrics", () => {
  const mixedHistory = [
    staleWorkout("stale1", 10),
    ...Array.from({ length: 8 }, (_, i) => normalWorkout(`n${i}`, 20 + i * 3, "Chest")),
  ];

  it("computeMuscleBreakdown: silently excludes the stale entry instead of throwing or counting it as a phantom muscle", () => {
    const breakdown = computeMuscleBreakdown(mixedHistory);
    expect(breakdown.every((b) => b.muscle)).toBe(true);
    expect(breakdown.find((b) => b.muscle == null)).toBeUndefined();
    // The 8 real Chest sets are still counted — only the stale entry is dropped.
    const chest = breakdown.find((b) => b.muscle === "Chest");
    expect(chest.sets).toBe(8);
  });

  it("getSessionStats / groupWorkoutsIntoSessions: does not throw when a session contains a stale entry", () => {
    expect(() => {
      const sessions = groupWorkoutsIntoSessions(mixedHistory);
      sessions.forEach((s) => getSessionStats(s));
    }).not.toThrow();
  });

  it("filterWorkoutsByMuscle / filterWorkoutsByExercise: the stale entry never matches any real filter", () => {
    expect(filterWorkoutsByMuscle(mixedHistory, "Chest")).toHaveLength(8);
    expect(filterWorkoutsByExercise(mixedHistory, "Chest Exercise")).toHaveLength(8);
  });

  it("getAvailableMuscles / getAvailableExercises: does not produce a null/undefined entry", () => {
    expect(getAvailableMuscles(mixedHistory)).toEqual(["Chest"]);
    expect(getAvailableExercises(mixedHistory)).toEqual(["Chest Exercise"]);
  });

  it("prHistory: does not throw and does not record a PR for the stale entry", () => {
    const events = prHistory(mixedHistory);
    expect(events.every((e) => e.exercise)).toBe(true);
  });

  it("plateauEngine: getMusclePlateaus and getExercisePlateau do not throw", () => {
    expect(() => getMusclePlateaus(mixedHistory, ["Chest"])).not.toThrow();
    expect(() => getExercisePlateau(mixedHistory, "Chest Exercise")).not.toThrow();
  });

  it("balanceEngine: getTrainingBalance does not throw and does not produce NaN", () => {
    const result = getTrainingBalance(mixedHistory);
    expect(result.available).toBe(true);
    expect(Number.isNaN(result.imbalance.gap)).toBe(false);
  });

  it("musclePriorityEngine: getMusclePriorities does not throw", () => {
    expect(() => getMusclePriorities(mixedHistory)).not.toThrow();
  });

  it("weeklyGradeEngine: getWeeklyGrade does not throw and does not produce NaN", () => {
    const result = getWeeklyGrade(mixedHistory);
    if (result.score != null) expect(Number.isNaN(result.score)).toBe(false);
  });

  it("generateSessionIntelligence: a session made entirely of stale entries reports unavailable, not a crash", () => {
    const staleSession = { date: daysAgo(1), workouts: [staleWorkout("s1", 1)], stats: { muscles: [] } };
    expect(() => generateSessionIntelligence(mixedHistory, staleSession)).not.toThrow();
    expect(generateSessionIntelligence(mixedHistory, staleSession).available).toBe(false);
  });

  it("a session mixing a stale entry with a real one still reports correctly on the real muscle", () => {
    const session = {
      date: daysAgo(1),
      workouts: [staleWorkout("s1", 1), normalWorkout("s2", 1, "Back", 100, 5)],
      stats: { muscles: ["Back"], volume: 500 },
    };
    const result = generateSessionIntelligence(mixedHistory, session);
    expect(result.available).toBe(true);
    expect(result.highestVolumeMuscle.muscle).toBe("Back");
  });
});
