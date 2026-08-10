import { prHistory } from "./strengthUtils";
import { computeMuscleBreakdown, getWorkoutVolume, isCardioEntry } from "./workoutUtils";
import { getGoalAnalytics } from "./goalAnalytics";
import { MUSCLE_SPLIT_CATEGORY } from "../constants/muscles";

const MS_PER_DAY = 86400000;

const formatDaysAgo = (days) => {
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
};

const dayKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const weekKey = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMon);
  return monday.getTime();
};

function computeConsecutiveTrainedWeeks(workouts) {
  if (!workouts.length) return 0;
  const trainedWeeks = new Set(workouts.map((w) => weekKey(w.date || w.createdAt)));

  let cursorKey = weekKey(new Date());
  let weeks = 0;
  while (trainedWeeks.has(cursorKey)) {
    weeks += 1;
    cursorKey -= 7 * MS_PER_DAY;
  }
  return weeks;
}

function computeRecentPRInsight(workouts) {
  const events = prHistory(workouts);
  if (!events.length) return null;

  const latest = events[events.length - 1];
  const daysAgo = Math.floor((Date.now() - new Date(latest.date).getTime()) / MS_PER_DAY);
  if (daysAgo > 14) return null;

  const sameExercise = events.filter((e) => e.exercise === latest.exercise);
  const previous = sameExercise.length > 1 ? sameExercise[sameExercise.length - 2] : null;
  const delta = previous ? Math.round((latest.weight - previous.weight) * 10) / 10 : null;

  return {
    key: "recentPR",
    tone: "success",
    title: `New ${latest.exercise} PR`,
    detail: delta != null ? `${formatDaysAgo(daysAgo)} · +${delta} kg` : formatDaysAgo(daysAgo),
  };
}

function computeWeeklyStreakInsight(workouts) {
  const weeks = computeConsecutiveTrainedWeeks(workouts);
  if (weeks < 2) return null;
  return {
    key: "weeklyStreak",
    tone: "streak",
    title: "Consistency",
    detail: `You've trained ${weeks} weeks in a row`,
  };
}

function pickNearestActiveGoal(goals) {
  const candidates = goals
    .filter((g) => g.status !== "Completed")
    .map((g) => ({ goal: g, analytics: getGoalAnalytics(g) }))
    .filter(({ analytics }) => analytics.remaining > 0)
    .sort((a, b) => b.analytics.percent - a.analytics.percent);

  return candidates[0] || null;
}

function computeVolumeTrendInsight(workouts) {
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  let thisMonthVolume = 0;
  let lastMonthVolume = 0;
  workouts.forEach((w) => {
    if (isCardioEntry(w)) return;
    const d = new Date(w.date || w.createdAt);
    if (d >= startOfThisMonth) thisMonthVolume += getWorkoutVolume(w);
    else if (d >= startOfLastMonth && d < startOfThisMonth) lastMonthVolume += getWorkoutVolume(w);
  });

  if (lastMonthVolume <= 0) return null;
  const changePct = Math.round(((thisMonthVolume - lastMonthVolume) / lastMonthVolume) * 100);
  if (changePct === 0) return null;

  return {
    key: "volumeTrend",
    tone: changePct > 0 ? "success" : "warning",
    title: "Volume Trend",
    detail: `Volume ${changePct > 0 ? "+" : ""}${changePct}% this month`,
  };
}

const MAX_INSIGHTS = 5;

export function getDashboardInsights(workouts) {
  return [
    computeRecentPRInsight(workouts),
    computeWeeklyStreakInsight(workouts),
    computeVolumeTrendInsight(workouts),
  ]
    .filter(Boolean)
    .slice(0, MAX_INSIGHTS);
}

function computeGoalFocusItem(goals) {
  const nearest = pickNearestActiveGoal(goals);
  if (!nearest) return null;
  const { goal, analytics } = nearest;

  const explanation = [`${analytics.remaining.toLocaleString()} ${goal.unit} remaining`];
  if (analytics.hasDeadline && analytics.daysRemaining != null && analytics.daysRemaining <= 1) {
    explanation.push(
      analytics.daysRemaining === 0 ? `${goal.title} goal ends today` : `${goal.title} goal ends tomorrow`
    );
  }

  return {
    key: "goalFocus",
    tone: "goal",
    title: goal.title,
    detail: `${analytics.remaining.toLocaleString()} ${goal.unit} to go`,
    explanation,
    muscleGroup: goal.exercise?.muscleGroup || null,
  };
}

function computeStepsFocusItem(todaySteps, dailyGoalTarget) {
  if (!dailyGoalTarget || dailyGoalTarget <= 0) return null;
  const remaining = Math.max(0, dailyGoalTarget - (todaySteps || 0));
  if (remaining <= 0) return null;

  return {
    key: "stepsFocus",
    tone: "steps",
    title: "Steps",
    detail: `${remaining.toLocaleString()} steps remaining`,
  };
}

function computeWorkoutRecommendation(workouts) {
  const breakdown = computeMuscleBreakdown(workouts);
  const lastTrainedByCategory = {};

  breakdown.forEach((entry) => {
    if (!entry.lastTrained) return;
    const category = MUSCLE_SPLIT_CATEGORY[entry.muscle];
    if (!category || category === "Core") return;
    const existing = lastTrainedByCategory[category];
    if (!existing || entry.lastTrained > existing) {
      lastTrainedByCategory[category] = entry.lastTrained;
    }
  });

  const withGaps = Object.entries(lastTrainedByCategory).map(([category, lastTrained]) => ({
    category,
    daysAgo: Math.floor((Date.now() - lastTrained.getTime()) / MS_PER_DAY),
  }));

  if (withGaps.length < 2) return null;

  withGaps.sort((a, b) => b.daysAgo - a.daysAgo);
  const mostOverdue = withGaps[0];
  const freshest = withGaps[withGaps.length - 1];

  if (mostOverdue.daysAgo < 3) return null;

  const detailParts = [];
  const explanation = [];
  if (freshest.category !== mostOverdue.category && freshest.daysAgo <= 1) {
    detailParts.push(`${freshest.category} fully recovered`);
    explanation.push(`${freshest.category} fully recovered`);
  }
  detailParts.push(`${mostOverdue.category} overdue by ${mostOverdue.daysAgo} days`);
  explanation.push(`Last trained ${mostOverdue.daysAgo} days ago`);

  return {
    key: "workoutRecommendation",
    tone: "recommend",
    title: `Train ${mostOverdue.category} today`,
    detail: detailParts.join(" · "),
    explanation,
    mostOverdueCategory: mostOverdue.category,
    mostOverdueDays: mostOverdue.daysAgo,
  };
}

export function computeStreakNudge(workouts) {
  if (!workouts.length) return null;
  const trainedDays = new Set(workouts.map((w) => dayKey(w.date || w.createdAt)));

  const trainedToday = trainedDays.has(dayKey(new Date()));
  if (trainedToday) return null;

  const cursor = new Date();
  cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (trainedDays.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  if (streak < 2) return null;

  return {
    key: "streakNudge",
    tone: "streak",
    title: `${streak}-day streak`,
    detail: "Keep it alive — train today",
  };
}

function computePlannedWorkoutItem(plannedWorkout) {
  if (!plannedWorkout) return null;

  const detailParts = [];
  if (plannedWorkout.workoutType !== "Cardio") {
    const exerciseCount = (plannedWorkout.exercises || []).length;
    if (exerciseCount > 0) {
      detailParts.push(`${exerciseCount} exercise${exerciseCount === 1 ? "" : "s"}`);
    }
  }
  if (plannedWorkout.estimatedDuration) {
    detailParts.push(`Est. ${plannedWorkout.estimatedDuration} min`);
  }

  return {
    key: "plannedWorkout",
    tone: "recommend",
    title: `Today's Planned Workout: ${plannedWorkout.title}`,
    detail: detailParts.join(" · ") || "Ready to start",
    plannedWorkoutId: plannedWorkout._id,
  };
}

const BRIEF_ITEM_PRIORITY_RANK = {
  streakNudge: 0,
  plannedWorkout: 1,
  workoutRecommendation: 1,
  goalFocus: 2,
  stepsFocus: 2,
};

const BRIEF_ITEM_CONFIDENCE = {
  plannedWorkout: "high",
  goalFocus: "high",
  stepsFocus: "high",
  streakNudge: "high",
  workoutRecommendation: "medium",
};

export function getTodaysBrief(
  workouts,
  goals,
  { todaySteps, dailyGoalTarget, todaysPlannedWorkout } = {}
) {
  const items = [
    computePlannedWorkoutItem(todaysPlannedWorkout) || computeWorkoutRecommendation(workouts),
    computeGoalFocusItem(goals),
    computeStepsFocusItem(todaySteps, dailyGoalTarget),
    computeStreakNudge(workouts),
  ]
    .filter(Boolean)
    .map((item) => ({ ...item, confidence: BRIEF_ITEM_CONFIDENCE[item.key] || null }));

  return items.sort(
    (a, b) => (BRIEF_ITEM_PRIORITY_RANK[a.key] ?? 3) - (BRIEF_ITEM_PRIORITY_RANK[b.key] ?? 3)
  );
}
