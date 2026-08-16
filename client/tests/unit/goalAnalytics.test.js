import { describe, it, expect } from "vitest";
import { getGoalAnalytics, getProgressPercent, getRemaining } from "../../src/utils/goalAnalytics";

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n) => new Date(Date.now() - n * DAY);
const daysFromNow = (n) => new Date(Date.now() + n * DAY);

function makeGoal(overrides = {}) {
  return {
    type: "Weight Goal",
    unit: "kg",
    createdAt: daysAgo(10),
    deadline: null,
    current: 0,
    target: 0,
    direction: null,
    startingValue: null,
    ...overrides,
  };
}

describe("goalAnalytics: generic (non-weight) goals — unchanged legacy behavior", () => {
  it("100% and Completed once current reaches target", () => {
    const goal = makeGoal({ type: "Weekly Volume Goal", current: 500, target: 500, direction: null });
    const a = getGoalAnalytics(goal);
    expect(a.health).toBe("Completed");
    expect(a.percent).toBe(100);
  });

  it("plain percent = current/target with no direction stored", () => {
    expect(getProgressPercent(40, 100)).toBe(40);
    expect(getRemaining(40, 100)).toBe(60);
  });
});

describe("goalAnalytics: Weight Goal — gain direction", () => {
  it("is not completed while below target", () => {
    const goal = makeGoal({ current: 70, target: 90, direction: "gain", startingValue: 70 });
    const a = getGoalAnalytics(goal);
    expect(a.health).not.toBe("Completed");
    expect(a.remaining).toBe(20);
  });

  it("is completed once current reaches or exceeds target", () => {
    const goal = makeGoal({ current: 90, target: 90, direction: "gain", startingValue: 70 });
    expect(getGoalAnalytics(goal).health).toBe("Completed");

    const overshot = makeGoal({ current: 95, target: 90, direction: "gain", startingValue: 70 });
    expect(getGoalAnalytics(overshot).health).toBe("Completed");
  });
});

describe("goalAnalytics: Weight Goal — loss direction (the bug this closes)", () => {
  it("a fresh loss goal (current still equals starting weight) is NOT completed", () => {
    const goal = makeGoal({ current: 85, target: 80, direction: "loss", startingValue: 85 });
    const a = getGoalAnalytics(goal);
    expect(a.health).not.toBe("Completed");
    expect(a.percent).toBe(0);
    expect(a.remaining).toBe(5);
  });

  it("partial progress toward a loss goal reads as a partial percentage, not overshoot", () => {
    const goal = makeGoal({ current: 82.5, target: 80, direction: "loss", startingValue: 85 });
    const a = getGoalAnalytics(goal);
    expect(a.percent).toBe(50);
    expect(a.remaining).toBe(2.5);
    expect(a.health).not.toBe("Completed");
  });

  it("is completed once current drops to the target", () => {
    const goal = makeGoal({ current: 80, target: 80, direction: "loss", startingValue: 85 });
    expect(getGoalAnalytics(goal).health).toBe("Completed");
  });

  it("is completed once the target is overshot (lost even more than asked)", () => {
    const goal = makeGoal({ current: 77, target: 80, direction: "loss", startingValue: 85 });
    const a = getGoalAnalytics(goal);
    expect(a.health).toBe("Completed");
    expect(a.percent).toBe(100);
    expect(a.remaining).toBe(0);
  });

  it("clamps percent at 0 if weight moved the wrong way (gained instead of lost)", () => {
    const goal = makeGoal({ current: 87, target: 80, direction: "loss", startingValue: 85 });
    const a = getGoalAnalytics(goal);
    expect(a.percent).toBe(0);
    expect(a.health).not.toBe("Completed");
  });

  it("falls back to legacy (non-normalized) behavior if startingValue is missing", () => {
    const goal = makeGoal({ current: 85, target: 80, direction: "loss", startingValue: null });
    const a = getGoalAnalytics(goal);
    expect(a.health).toBe("Completed");
  });
});

describe("goalAnalytics: pace and projection respect direction", () => {
  it("computes a sane required-per-day pace for a loss goal with a deadline", () => {
    const goal = makeGoal({
      current: 82.5,
      target: 80,
      direction: "loss",
      startingValue: 85,
      createdAt: daysAgo(10),
      deadline: daysFromNow(5),
    });
    const a = getGoalAnalytics(goal);
    expect(a.averageRequiredPerDay).toBeCloseTo(0.5, 5);
  });

  it("projects a completion date for a loss goal that is actively losing weight", () => {
    const goal = makeGoal({
      current: 82.5,
      target: 80,
      direction: "loss",
      startingValue: 85,
      createdAt: daysAgo(10),
      deadline: null,
    });
    const a = getGoalAnalytics(goal);
    expect(a.projectedCompletionDate).not.toBeNull();
  });

  it("returns no projection when there is no downward movement yet", () => {
    const goal = makeGoal({ current: 85, target: 80, direction: "loss", startingValue: 85, createdAt: daysAgo(10) });
    expect(getGoalAnalytics(goal).projectedCompletionDate).toBeNull();
  });
});

describe("goalAnalytics: insufficient data / status transitions", () => {
  it("reports Insufficient Data immediately after creation with a deadline", () => {
    const goal = makeGoal({
      current: 84.9,
      target: 80,
      direction: "loss",
      startingValue: 85,
      createdAt: daysAgo(0),
      deadline: daysFromNow(30),
    });
    expect(getGoalAnalytics(goal).health).toBe("Insufficient Data");
  });

  it("has no health read without a deadline (only Completed is possible)", () => {
    const inProgress = makeGoal({ current: 83, target: 80, direction: "loss", startingValue: 85, deadline: null });
    expect(getGoalAnalytics(inProgress).health).toBeNull();

    const done = makeGoal({ current: 80, target: 80, direction: "loss", startingValue: 85, deadline: null });
    expect(getGoalAnalytics(done).health).toBe("Completed");
  });

  it("transitions Behind -> On Track -> Ahead as a loss goal catches up to pace", () => {
    const base = { target: 80, direction: "loss", startingValue: 90, createdAt: daysAgo(10), deadline: daysFromNow(10) };
    const behind = makeGoal({ ...base, current: 89 });
    const onTrack = makeGoal({ ...base, current: 85 });
    const ahead = makeGoal({ ...base, current: 81 });

    expect(getGoalAnalytics(behind).health).toBe("Behind");
    expect(getGoalAnalytics(onTrack).health).toBe("On Track");
    expect(getGoalAnalytics(ahead).health).toBe("Ahead");
  });
});
