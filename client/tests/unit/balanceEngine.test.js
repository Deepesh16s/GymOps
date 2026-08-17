import { describe, it, expect } from "vitest";
import { getTrainingBalance, getUpperLowerSplit, getStrengthCardioSplit } from "../../src/intelligence/balanceEngine";

function makeWorkout(id, date, muscle, sets = [{ weight: 60, reps: 8 }]) {
  return {
    _id: id,
    date,
    exercise: { name: `${muscle} Exercise`, muscleGroup: muscle },
    workoutSets: sets,
  };
}

describe("balanceEngine: getTrainingBalance", () => {
  it("reports unavailable for an empty history", () => {
    const result = getTrainingBalance([]);
    expect(result.available).toBe(false);
  });

  it("carries evidence fields alongside confidence when data is available", () => {
    const workouts = [
      makeWorkout("1", "2026-01-01", "Chest"),
      makeWorkout("2", "2026-01-02", "Back"),
    ];
    const result = getTrainingBalance(workouts);
    expect(result.available).toBe(true);
    expect(result.evidenceStrength).toBeTruthy();
    expect(result.evidenceDisclaimer).toMatch(/heuristic/i);
  });

  it("classifies balanced vs. imbalanced by the same gap threshold as before", () => {
    const balanced = getTrainingBalance([
      makeWorkout("1", "2026-01-01", "Chest"),
      makeWorkout("2", "2026-01-02", "Back"),
      makeWorkout("3", "2026-01-03", "Quads"),
      makeWorkout("4", "2026-01-04", "Abs"),
    ]);
    expect(balanced.imbalance.balanced).toBe(true);

    const skewed = getTrainingBalance([
      makeWorkout("1", "2026-01-01", "Chest"),
      makeWorkout("2", "2026-01-02", "Chest"),
      makeWorkout("3", "2026-01-03", "Chest"),
      makeWorkout("4", "2026-01-04", "Chest"),
      makeWorkout("5", "2026-01-05", "Chest"),
      makeWorkout("6", "2026-01-06", "Chest"),
      makeWorkout("7", "2026-01-07", "Chest"),
      makeWorkout("8", "2026-01-08", "Chest"),
      makeWorkout("9", "2026-01-09", "Abs"),
    ]);
    expect(skewed.imbalance.balanced).toBe(false);
    expect(skewed.imbalance.dominant).toBe("Push");
  });
});

describe("balanceEngine: getUpperLowerSplit", () => {
  it("reports unavailable for an empty history", () => {
    expect(getUpperLowerSplit([]).available).toBe(false);
  });

  it("splits push/pull into upper and legs into lower", () => {
    const result = getUpperLowerSplit([
      makeWorkout("1", "2026-01-01", "Chest"),
      makeWorkout("2", "2026-01-02", "Quads"),
    ]);
    expect(result.available).toBe(true);
    expect(result.upperPct + result.lowerPct).toBe(100);
  });
});

describe("balanceEngine: getStrengthCardioSplit", () => {
  it("reports unavailable when there are no sessions", () => {
    expect(getStrengthCardioSplit([]).available).toBe(false);
  });
});
