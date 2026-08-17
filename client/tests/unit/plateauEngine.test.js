import { describe, it, expect } from "vitest";
import { getExercisePlateau } from "../../src/intelligence/plateauEngine";

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n) => new Date(Date.now() - n * DAY).toISOString().slice(0, 10);

function makeSession(id, daysBack, weight, reps = 5) {
  return {
    _id: id,
    date: daysAgo(daysBack),
    exercise: { name: "Bench Press", muscleGroup: "Chest" },
    workoutSets: [{ weight, reps }],
  };
}

describe("plateauEngine: getExercisePlateau (unified with server thresholds)", () => {
  it("reports None with low confidence below the medium-confidence session floor (6)", () => {
    const workouts = Array.from({ length: 3 }, (_, i) => makeSession(`w${i}`, 20 - i * 5, 60));
    const result = getExercisePlateau(workouts, "Bench Press");
    expect(result.plateauLevel).toBe("None");
    expect(result.confidence).toBe("Low");
  });

  it("does not evaluate a plateau when the exercise hasn't been trained recently (28-day window)", () => {
    // 8 sessions, all more than 28 days ago.
    const workouts = Array.from({ length: 8 }, (_, i) => makeSession(`w${i}`, 60 + i * 7, 60));
    const result = getExercisePlateau(workouts, "Bench Press");
    expect(result.plateauLevel).toBe("None");
    expect(result.confidenceReason).toMatch(/hasn't been trained enough/i);
  });

  it("classifies 'Possible' for a flat trend with 6-9 sessions", () => {
    // 6 sessions, same weight throughout (flat), all within the last 28 days.
    const workouts = Array.from({ length: 6 }, (_, i) => makeSession(`w${i}`, 20 - i * 3, 60));
    const result = getExercisePlateau(workouts, "Bench Press");
    expect(result.oneRMTrend.direction).toBe("flat");
    expect(result.plateauLevel).toBe("Possible");
  });

  it("classifies 'Confirmed' for a flat, low-volatility trend at 10+ sessions", () => {
    const workouts = Array.from({ length: 10 }, (_, i) => makeSession(`w${i}`, 27 - i * 2, 60));
    const result = getExercisePlateau(workouts, "Bench Press");
    expect(result.oneRMTrend.direction).toBe("flat");
    expect(result.plateauLevel).toBe("Confirmed");
    expect(result.volatility.high).toBe(false);
  });

  it("downgrades Confirmed to Possible when recent performance is highly volatile", () => {
    // 10 sessions, weight swinging widely session to session but net-flat overall.
    const weights = [60, 75, 50, 80, 55, 78, 52, 76, 54, 60];
    const workouts = weights.map((w, i) => makeSession(`w${i}`, 27 - i * 2, w));
    const result = getExercisePlateau(workouts, "Bench Press");
    expect(result.volatility.high).toBe(true);
    expect(result.plateauLevel).not.toBe("Confirmed");
  });

  it("classifies None when the trend is genuinely improving", () => {
    const workouts = Array.from({ length: 10 }, (_, i) => makeSession(`w${i}`, 27 - i * 2, 60 + i * 5));
    const result = getExercisePlateau(workouts, "Bench Press");
    expect(result.oneRMTrend.direction).toBe("up");
    expect(result.plateauLevel).toBe("None");
  });
});
