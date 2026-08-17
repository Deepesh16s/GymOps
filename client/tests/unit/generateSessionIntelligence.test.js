import { describe, it, expect } from "vitest";
import { generateSessionIntelligence } from "../../src/trainingIntelligence/generateSessionIntelligence";

function makeWorkout(id, date, muscle, weight, reps) {
  return {
    _id: id,
    date,
    exercise: { name: `${muscle} Exercise`, muscleGroup: muscle },
    workoutSets: [{ weight, reps }],
  };
}

describe("generateSessionIntelligence", () => {
  it("reports unavailable when the session has no strength muscles", () => {
    const result = generateSessionIntelligence([], { stats: { muscles: [] }, workouts: [] });
    expect(result.available).toBe(false);
  });

  it("ranks the session's muscles by volume, not by any fatigue calculation", () => {
    const sessionWorkouts = [
      makeWorkout("1", "2026-01-05", "Chest", 100, 10), // 1000 kg
      makeWorkout("2", "2026-01-05", "Back", 50, 5), // 250 kg
    ];
    const session = {
      date: "2026-01-05",
      workouts: sessionWorkouts,
      stats: { muscles: ["Chest", "Back"], volume: 1250 },
    };
    const result = generateSessionIntelligence(sessionWorkouts, session);
    expect(result.available).toBe(true);
    expect(result.highestVolumeMuscle.muscle).toBe("Chest");
    expect(result.highestVolumeMuscle.volume).toBe(1000);
    // The old field name implied a fatigue model; confirm it's gone, not just renamed-and-duplicated.
    expect(result).not.toHaveProperty("highestFatigueContributor");
  });

  it("computes this session's share of its calendar week's total volume", () => {
    const sessionWorkouts = [makeWorkout("1", "2026-01-05", "Chest", 100, 10)];
    const weekWorkouts = [
      ...sessionWorkouts,
      makeWorkout("2", "2026-01-06", "Back", 100, 10),
    ];
    const session = {
      date: "2026-01-05",
      workouts: sessionWorkouts,
      stats: { muscles: ["Chest"], volume: 1000 },
    };
    const result = generateSessionIntelligence(weekWorkouts, session);
    expect(result.weeklyVolumeContributionPct).toBe(50);
  });
});
