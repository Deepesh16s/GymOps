import { describe, it, expect } from "vitest";
import {
  estimate1RM,
  calculateVolume,
  bestSet,
  calculateWorkingWeightAverage,
  calculateRelativeIntensity,
  prHistory,
  suggestedLoadIncrement,
} from "../../src/utils/strengthUtils";

describe("suggestedLoadIncrement (ACSM 2-10%-of-load guidance, replaces a flat kg jump)", () => {
  it("scales with the current weight instead of using a fixed amount", () => {
    expect(suggestedLoadIncrement(20)).toBeLessThan(suggestedLoadIncrement(200));
  });

  it("stays within roughly the 2-10% ACSM range for a typical working weight", () => {
    const weight = 100;
    const increment = suggestedLoadIncrement(weight);
    expect(increment).toBeGreaterThanOrEqual(weight * 0.02);
    expect(increment).toBeLessThanOrEqual(weight * 0.1);
  });

  it("clamps to a practical 0.5kg minimum for very light loads", () => {
    expect(suggestedLoadIncrement(5)).toBe(0.5);
  });

  it("falls back to a sane default for missing/zero weight", () => {
    expect(suggestedLoadIncrement(0)).toBe(2.5);
    expect(suggestedLoadIncrement(null)).toBe(2.5);
  });
});

describe("estimate1RM (Epley formula)", () => {
  it("returns the weight itself for a single rep", () => {
    expect(estimate1RM(100, 1)).toBe(100);
  });

  it("estimates above the working weight for higher rep counts", () => {
    expect(estimate1RM(100, 8)).toBe(Math.round(100 * (1 + 8 / 30)));
  });

  it("returns 0 for non-positive weight or reps", () => {
    expect(estimate1RM(0, 8)).toBe(0);
    expect(estimate1RM(100, 0)).toBe(0);
    expect(estimate1RM(-10, 8)).toBe(0);
  });
});

describe("calculateVolume", () => {
  it("sums reps * weight across sets", () => {
    expect(calculateVolume([{ weight: 100, reps: 5 }, { weight: 80, reps: 10 }])).toBe(500 + 800);
  });
  it("returns 0 for an empty/missing set list", () => {
    expect(calculateVolume([])).toBe(0);
    expect(calculateVolume()).toBe(0);
  });
});

describe("bestSet", () => {
  it("picks the heaviest set", () => {
    const sets = [{ weight: 60, reps: 10 }, { weight: 80, reps: 5 }, { weight: 70, reps: 8 }];
    expect(bestSet(sets)).toEqual({ weight: 80, reps: 5 });
  });
  it("breaks a weight tie by higher reps", () => {
    const sets = [{ weight: 80, reps: 5 }, { weight: 80, reps: 8 }];
    expect(bestSet(sets)).toEqual({ weight: 80, reps: 8 });
  });
  it("returns null for an empty list", () => {
    expect(bestSet([])).toBeNull();
  });
});

describe("calculateWorkingWeightAverage", () => {
  it("averages the weight across sets", () => {
    expect(calculateWorkingWeightAverage([{ weight: 60 }, { weight: 80 }])).toBe(70);
  });
  it("returns 0 for no sets", () => {
    expect(calculateWorkingWeightAverage([])).toBe(0);
  });
});

describe("calculateRelativeIntensity", () => {
  it("expresses weight as a percentage of 1RM", () => {
    expect(calculateRelativeIntensity(80, 100)).toBe(80);
  });
  it("returns null when there is no 1RM to compare against", () => {
    expect(calculateRelativeIntensity(80, 0)).toBeNull();
  });
});

describe("prHistory", () => {
  it("only records a new PR event when weight strictly increases for that exercise", () => {
    const workouts = [
      { date: "2026-01-01", exercise: { name: "Bench Press", muscleGroup: "Chest" }, workoutSets: [{ weight: 60, reps: 8 }] },
      { date: "2026-01-08", exercise: { name: "Bench Press", muscleGroup: "Chest" }, workoutSets: [{ weight: 55, reps: 10 }] },
      { date: "2026-01-15", exercise: { name: "Bench Press", muscleGroup: "Chest" }, workoutSets: [{ weight: 70, reps: 5 }] },
    ];
    const events = prHistory(workouts);
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.weight)).toEqual([60, 70]);
  });

  it("ignores cardio entries", () => {
    const workouts = [{ date: "2026-01-01", entryType: "cardio", exercise: { name: "Run" } }];
    expect(prHistory(workouts)).toHaveLength(0);
  });

  it("tracks PRs independently per exercise", () => {
    const workouts = [
      { date: "2026-01-01", exercise: { name: "Squat", muscleGroup: "Quads" }, workoutSets: [{ weight: 100, reps: 5 }] },
      { date: "2026-01-02", exercise: { name: "Deadlift", muscleGroup: "Back" }, workoutSets: [{ weight: 140, reps: 3 }] },
    ];
    const events = prHistory(workouts);
    expect(events.map((e) => e.exercise).sort()).toEqual(["Deadlift", "Squat"]);
  });
});
