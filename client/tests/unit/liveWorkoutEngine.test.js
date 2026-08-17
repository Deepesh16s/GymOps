import { describe, it, expect } from "vitest";
import { getNextSetSuggestion } from "../../src/progression/liveWorkoutEngine";

describe("liveWorkoutEngine: getNextSetSuggestion (within-session)", () => {
  it("does not suggest more weight from a single set — needs the performance repeated at least once this session", () => {
    const sessionSets = [{ weight: 60, reps: 8 }];
    const suggestion = getNextSetSuggestion(null, sessionSets);
    expect(suggestion.basis).toBe("reps");
    expect(suggestion.weight).toBe(60);
  });

  it("suggests more weight once the same performance has been repeated across two sets", () => {
    const sessionSets = [
      { weight: 60, reps: 8 },
      { weight: 60, reps: 8 },
    ];
    const suggestion = getNextSetSuggestion(null, sessionSets);
    expect(suggestion.basis).toBe("weight");
    expect(suggestion.weight).toBeGreaterThan(60);
  });

  it("scales the suggested increment with the working weight rather than a flat amount", () => {
    const lightSets = [
      { weight: 10, reps: 8 },
      { weight: 10, reps: 8 },
    ];
    const heavySets = [
      { weight: 150, reps: 8 },
      { weight: 150, reps: 8 },
    ];
    const lightSuggestion = getNextSetSuggestion(null, lightSets);
    const heavySuggestion = getNextSetSuggestion(null, heavySets);
    expect(heavySuggestion.weight - 150).toBeGreaterThan(lightSuggestion.weight - 10);
  });

  it("suggests a rep add, not a weight jump, when the second set falls short (under 3 reps)", () => {
    const sessionSets = [
      { weight: 60, reps: 8 },
      { weight: 60, reps: 2 },
    ];
    const suggestion = getNextSetSuggestion(null, sessionSets);
    expect(suggestion.basis).toBe("reps");
  });
});

describe("liveWorkoutEngine: getNextSetSuggestion (cross-session, no sets logged yet this session)", () => {
  it("returns null with no history at all", () => {
    expect(getNextSetSuggestion(null, [])).toBeNull();
    expect(getNextSetSuggestion({ lastSession: [] }, [])).toBeNull();
  });

  it("suggests more weight when the last two sessions both hit the same weight for 3+ reps", () => {
    const snapshot = {
      lastSession: [{ weight: 60, reps: 8 }],
      priorSession: [{ weight: 60, reps: 8 }],
    };
    const suggestion = getNextSetSuggestion(snapshot, []);
    expect(suggestion.basis).toBe("weight");
    expect(suggestion.weight).toBeGreaterThan(60);
  });
});
