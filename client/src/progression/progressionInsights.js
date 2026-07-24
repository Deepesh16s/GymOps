// Insight generation — every insight here is derived strictly from data
// already computed by progressionEngine/strengthUtils. When there isn't
// enough history for a particular insight to be meaningful, it is omitted
// with a plain-language reason instead of guessed at.
import { buildSessionSummaries } from "../utils/workoutUtils";
import { MUSCLE_SPLIT_CATEGORY } from "../constants/muscles";
import { getAvailableMuscles, getAvailableExercises } from "./progressionFilters";
import { getMuscleProgression, getExerciseProgression } from "./progressionEngine";

const MIN_SESSIONS_FOR_INSIGHTS = 6;
const MIN_MUSCLE_BUCKETS = 4;

function computeMostImprovedMuscle(workouts, muscles) {
  let best = null;
  muscles.forEach((muscle) => {
    const progression = getMuscleProgression(workouts, muscle);
    if (progression.series.length < MIN_MUSCLE_BUCKETS) return;
    const trend = progression.trend.volume;
    if (!trend || trend.direction !== "up") return;
    if (!best || trend.changePct > best.changePct) {
      best = { muscle, changePct: trend.changePct };
    }
  });

  if (!best) {
    return {
      key: "mostImprovedMuscle",
      label: "Most Improved Muscle",
      available: false,
      reason: "Not enough weekly training history yet for any single muscle group to show a clear volume trend.",
    };
  }

  return {
    key: "mostImprovedMuscle",
    label: "Most Improved Muscle",
    available: true,
    value: best.muscle,
    // Exposed alongside `detail`'s prose so callers that need to rank or
    // compare insights by magnitude (e.g. picking a "biggest win" to
    // feature) don't have to parse the percentage back out of the string.
    changePct: best.changePct,
    detail: `Training volume up ${best.changePct}% comparing the first half of its history to the second.`,
  };
}

function computeFastestImprovingExercise(workouts) {
  const exercises = getAvailableExercises(workouts).slice(0, 25); // bound cost on very large libraries
  let best = null;
  exercises.forEach((exercise) => {
    const progression = getExerciseProgression(workouts, exercise);
    if (progression.series.length < MIN_MUSCLE_BUCKETS) return;
    const trend = progression.trend.estOneRM;
    if (!trend || trend.direction !== "up") return;
    if (!best || trend.changePct > best.changePct) {
      best = { exercise, changePct: trend.changePct };
    }
  });

  if (!best) {
    return {
      key: "fastestImprovingExercise",
      label: "Fastest Improving Exercise",
      available: false,
      reason: "No exercise has enough logged history yet (at least a few weeks, on separate sessions) to measure an estimated-1RM trend.",
    };
  }

  return {
    key: "fastestImprovingExercise",
    label: "Fastest Improving Exercise",
    available: true,
    value: best.exercise,
    changePct: best.changePct,
    detail: `Estimated 1RM up ${best.changePct}% over its logged history.`,
  };
}

function computeHighestConsistency(workouts, muscles) {
  let best = null;
  muscles.forEach((muscle) => {
    const progression = getMuscleProgression(workouts, muscle);
    if (!progression.consistency) return;
    if (!best || progression.consistency.percent > best.percent) {
      best = { muscle, ...progression.consistency };
    }
  });

  if (!best) {
    return {
      key: "highestConsistency",
      label: "Highest Consistency",
      available: false,
      reason: "Needs at least two weeks of history for a muscle group to calculate a consistency percentage.",
    };
  }

  return {
    key: "highestConsistency",
    label: "Highest Consistency",
    available: true,
    value: best.muscle,
    detail: `Trained in ${best.weeksTrained} of the last ${best.totalWeeks} weeks (${best.percent}%).`,
  };
}

function computeTrainingImbalance(workouts, muscles) {
  if (muscles.length < 2) {
    return {
      key: "trainingImbalance",
      label: "Training Imbalance",
      available: false,
      reason: "Log sets across at least two muscle groups to compare training balance.",
    };
  }

  const totals = { Push: 0, Pull: 0, Legs: 0, Core: 0 };
  muscles.forEach((muscle) => {
    const category = MUSCLE_SPLIT_CATEGORY[muscle];
    if (!category) return;
    const progression = getMuscleProgression(workouts, muscle);
    totals[category] += progression.stats.avgWeeklyVolume * (progression.series.length || 0);
  });

  const grandTotal = Object.values(totals).reduce((s, v) => s + v, 0);
  if (grandTotal === 0) {
    return {
      key: "trainingImbalance",
      label: "Training Imbalance",
      available: false,
      reason: "Not enough logged volume yet to compare Push/Pull/Legs/Core balance.",
    };
  }

  const entries = Object.entries(totals).map(([cat, v]) => ({ cat, pct: (v / grandTotal) * 100 }));
  entries.sort((a, b) => b.pct - a.pct);
  const most = entries[0];
  const least = entries[entries.length - 1];

  const gap = most.pct - least.pct;

  if (gap < 15) {
    return {
      key: "trainingImbalance",
      label: "Training Imbalance",
      available: true,
      value: "Well balanced",
      balanced: true,
      gap: Math.round(gap),
      detail: `Push/Pull/Legs/Core volume is evenly spread (${most.cat} ${Math.round(most.pct)}% vs ${least.cat} ${Math.round(least.pct)}%).`,
    };
  }

  return {
    key: "trainingImbalance",
    label: "Training Imbalance",
    available: true,
    value: `${most.cat} is dominant`,
    // Not "balanced" and how wide the gap is — lets a caller (e.g.
    // Analytics' "Attention" callout) decide whether this insight is
    // worth surfacing as a warning without re-parsing `detail`'s prose.
    balanced: false,
    gap: Math.round(gap),
    least: least.cat,
    leastPct: Math.round(least.pct),
    detail: `${most.cat} makes up ${Math.round(most.pct)}% of training volume, while ${least.cat} is only ${Math.round(least.pct)}%.`,
  };
}

// Longest run of consecutive CALENDAR DAYS containing at least one
// strength session — day granularity to match the "day streak" the
// Dashboard/Hero already show (workoutUtils.computeCurrentStreak, which
// is the same definition scoped to the run ending today). This is that
// same day-based streak's best-ever length, not just its current one.
function computeLongestStreak(sessions) {
  if (sessions.length < 2) {
    return {
      key: "longestStreak",
      label: "Longest Streak",
      available: false,
      reason: "Log a few more sessions across different days to calculate a streak.",
    };
  }

  const dayIndices = Array.from(
    new Set(
      sessions.map((s) => {
        const d = new Date(s.date);
        return Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400000);
      })
    )
  ).sort((a, b) => a - b);

  let longest = 1;
  let current = 1;
  for (let i = 1; i < dayIndices.length; i++) {
    if (dayIndices[i] === dayIndices[i - 1] + 1) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  return {
    key: "longestStreak",
    label: "Longest Streak",
    available: true,
    value: `${longest} day${longest === 1 ? "" : "s"}`,
    detail: `Your longest run of consecutive days with at least one logged session.`,
  };
}

function computeMostActivePeriod(sessions) {
  if (sessions.length < 4) {
    return {
      key: "mostActivePeriod",
      label: "Most Active Period",
      available: false,
      reason: "Log a few more sessions to identify your most active training period.",
    };
  }

  const byMonth = new Map();
  sessions.forEach((s) => {
    const d = new Date(s.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    byMonth.set(key, (byMonth.get(key) || 0) + 1);
  });

  let bestKey = null;
  let bestCount = 0;
  byMonth.forEach((count, key) => {
    if (count > bestCount) {
      bestCount = count;
      bestKey = key;
    }
  });

  const [year, month] = bestKey.split("-").map(Number);
  const label = new Date(year, month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return {
    key: "mostActivePeriod",
    label: "Most Active Period",
    available: true,
    value: label,
    detail: `${bestCount} session${bestCount === 1 ? "" : "s"} logged that month — your highest on record.`,
  };
}

export function getInsights(workouts) {
  const sessions = buildSessionSummaries(workouts).filter((s) => s.stats.exerciseCount > 0);

  if (sessions.length < MIN_SESSIONS_FOR_INSIGHTS) {
    return {
      available: false,
      reason: `Log at least ${MIN_SESSIONS_FOR_INSIGHTS} sessions to unlock insights — you have ${sessions.length} so far.`,
      insights: [],
    };
  }

  const muscles = getAvailableMuscles(workouts);

  return {
    available: true,
    insights: [
      computeMostImprovedMuscle(workouts, muscles),
      computeFastestImprovingExercise(workouts),
      computeHighestConsistency(workouts, muscles),
      computeTrainingImbalance(workouts, muscles),
      computeLongestStreak(sessions),
      computeMostActivePeriod(sessions),
    ],
  };
}
