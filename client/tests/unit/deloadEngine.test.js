import { describe, it, expect } from "vitest";
import { getDeloadRecommendation } from "../../src/intelligence/deloadEngine";

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n) => new Date(Date.now() - n * DAY).toISOString().slice(0, 10);

function makeWorkout(id, daysBack, weight, reps = 8) {
  return {
    _id: id,
    date: daysAgo(daysBack),
    exercise: { name: "Bench Press", muscleGroup: "Chest" },
    workoutSets: [{ weight, reps }],
  };
}

describe("deloadEngine: getDeloadRecommendation", () => {
  it("is not recommended for an empty history", () => {
    const result = getDeloadRecommendation([]);
    expect(result.recommended).toBe(false);
    expect(result.reasons).toHaveLength(0);
  });

  it("always carries evidence fields, regardless of trigger state", () => {
    const result = getDeloadRecommendation([]);
    expect(result.evidenceStrength).toBeTruthy();
    expect(result.evidenceDisclaimer).toMatch(/heuristic/i);
    // Hedged, not an unqualified physiological claim.
    expect(result.evidenceDisclaimer).toMatch(/not a signal that your body physiologically needs/i);
  });

  it("does not recommend a deload from a single flat trend alone (needs 2+ signals)", () => {
    // 8 sparse, flat-weight sessions spread far apart keeps weekly volume/fatigue low,
    // so only the plateau signal should fire, not fatigue or volume-ratio.
    const workouts = Array.from({ length: 8 }, (_, i) => makeWorkout(`w${i}`, 200 - i * 14, 60, 5));
    const result = getDeloadRecommendation(workouts);
    expect(result.reasons.length).toBeLessThan(2);
    expect(result.recommended).toBe(false);
  });
});
