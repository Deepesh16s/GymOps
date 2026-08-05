// Dashboard's rule-based engines — no AI/LLM, every output is a plain
// if/then over data already fetched (muscleWorkouts, goals) via the
// SAME primitives the rest of the app already uses for PR detection,
// muscle breakdown, and goal math. Two distinct exports:
//   - getDashboardInsights: retrospective "how am I doing" cards
//     (Priority 4), distinct from Analytics' getInsights()
//     (progression/progressionInsights.js), which answers a
//     longer-horizon "what's my best/most-improved thing" question.
//   - getTodaysBrief (Phase 12.5): prescriptive "what should I do
//     today" rules — workout recommendation, goal/steps proximity,
//     streak protection.
// Nothing here re-derives what a PR, a muscle's last-trained date, or a
// goal's remaining amount means, and every entry in both lists is
// independently optional — omitted rather than guessed at when there
// isn't enough history behind it.
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

// Local calendar-day key ("YYYY-MM-DD"), same convention used elsewhere
// in this app (Calendar.jsx's getLocalDateKey, server startOfWeek/Day
// math) — local time, not UTC.
const dayKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Monday-start week key, matching the convention used elsewhere in this
// app (Calendar.jsx, server startOfWeek) for "which week is this".
const weekKey = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMon);
  return monday.getTime();
};

// Consecutive weeks, ending this week, with at least one logged session
// (strength or cardio) — a week-granularity sibling to
// workoutUtils.computeCurrentStreak's day-granularity streak.
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

// Most recent Strength PR, reusing strengthUtils.prHistory's exact
// chronological PR walk (same one Analytics/Calendar/WorkoutHistory use)
// — only omitted if there is none, or the most recent one is old enough
// that it no longer reads as "news" (>14 days).
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

// Shared by the Insights "Goal" card and Today's Focus's goal line —
// the nearest-to-complete still-in-progress goal, reusing
// goalAnalytics.getGoalAnalytics (the same per-goal math Goals.jsx
// itself is built on) rather than re-deriving "remaining"/"percent".
function pickNearestActiveGoal(goals) {
  const candidates = goals
    .filter((g) => g.status !== "Completed")
    .map((g) => ({ goal: g, analytics: getGoalAnalytics(g) }))
    .filter(({ analytics }) => analytics.remaining > 0)
    .sort((a, b) => b.analytics.percent - a.analytics.percent);

  return candidates[0] || null;
}

// This-month vs last-month strength volume — plain arithmetic over
// workoutUtils.getWorkoutVolume (the same per-workout volume figure
// every other volume total in this app is built from). No comparison is
// shown without a real last-month baseline to compare against.
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

// Retrospective/achievement cards — "how am I doing". Goal progress,
// steps, muscle recovery, and workout recommendations deliberately live
// in getTodaysBrief below instead (the prescriptive "what should I do
// today" section) rather than appearing in both places on the same
// page. Capped at 5 explicitly so this stays true if more insight types
// are added later — a notification-center-length list defeats the
// point of a quick "how am I doing" glance.
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

// Today's Focus — the prescriptive, "what should I actually do today"
// counterpart to the retrospective Insights above: nearest goal (as a
// current/target fraction, not a percentage — more legible for a
// "keep going" prompt), today's steps remaining against a Daily Steps
// goal, and the most-overdue muscle. Every item is independently
// optional; a brand-new account with no goals/history simply gets an
// empty array (Dashboard already hides the whole section when that
// happens, same "no extra complexity" pattern as everywhere else).
// Remaining-framed ("7.5 kg to go"), not a raw current/target fraction —
// a fraction reads as "here's today's number" under a "TODAY'S BRIEF"
// heading, but a goal's `current` is a lifetime-best/cumulative figure
// that may be days or weeks old. Remaining amount is the one honest
// thing this line can say something actionable about *today* (there's
// still X left to do), matching the steps line's phrasing below. The
// current/target fraction still appears as-is on the Goals page and the
// Priority 8 dashboard Goals widget — those aren't titled "Today's"
// anything, so a fraction doesn't carry the same false implication
// there.
function computeGoalFocusItem(goals) {
  const nearest = pickNearestActiveGoal(goals);
  if (!nearest) return null;
  const { goal, analytics } = nearest;

  // Phase 13D, Part A.4 — same two facts `detail` already reads
  // (remaining amount, deadline proximity), just itemized — the
  // "2 km remaining / Weekly goal ends tomorrow" shape from the phase's
  // own Cardio Reminder example, built from analytics fields that
  // already exist (getGoalAnalytics), nothing new computed.
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
    // Phase 14B.1 — the goal's own linked exercise's muscle group (when
    // one exists — server/controllers/goalController.js's getGoals
    // already populates `exercise: {name, muscleGroup}`), exposed raw so
    // a presentation layer can check whether THIS goal genuinely relates
    // to today's recommended muscle group before claiming it does —
    // never a fabricated "contributes toward" claim for an unrelated
    // goal. No goal-selection logic changes here.
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

// Phase 12.5 — the rule engine's headline output: "what should I train
// today". Groups muscles into Push/Pull/Legs (constants/muscles.js's
// MUSCLE_SPLIT_CATEGORY — the exact same grouping MuscleBodyMap's own
// Push/Pull/Legs/Core bar already uses) via computeMuscleBreakdown's
// per-muscle lastTrained, takes the most recent lastTrained WITHIN each
// category (training any one push muscle counts as training push that
// day), then compares categories against each other. Core is excluded —
// it isn't a "day" a user would dedicate a session to the way Push/Pull/
// Legs are, so recommending "Train Core today" wouldn't read as natural
// coaching advice the way the other three do.
//
// Requires at least two categories with real history to compare (a
// single logged category has nothing to be "more overdue" than), and
// requires the gap to reach 3+ days before recommending anything — a
// normal rest day between sessions shouldn't produce a recommendation.
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
  // Phase 13D, Part A.4 — Reminder Explanation: `explanation` is the
  // SAME two facts as `detail` above, just kept as separate bullets
  // instead of one joined string — nothing here is computed twice or
  // invented; it's a second, itemized read of mostOverdue/freshest.
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
    // Phase 14B.1 — the SAME mostOverdue/freshest values the title/detail
    // above are already built from, exposed raw (not just pre-formatted
    // into a string) so a presentation layer can build its own sentence
    // without re-deriving these numbers from a different source (e.g.
    // musclePriorityEngine's independently-computed per-muscle overdue
    // read, which groups by individual muscle rather than by category
    // and could legitimately disagree in both the name and the day
    // count). No decision logic changes here — same threshold, same
    // sort, same category selected.
    mostOverdueCategory: mostOverdue.category,
    mostOverdueDays: mostOverdue.daysAgo,
  };
}

// "Don't lose the streak you've already built" — distinct from
// workoutUtils.computeCurrentStreak, which anchors its walk at today
// and so reports 0 the instant today hasn't been logged YET, even mid-
// streak. This walks from yesterday when today's still open, so a real
// ongoing streak is recognized as still "alive, at risk" rather than
// already broken — and only nudges when there's actually something to
// protect (2+ days) and something to DO (today not yet logged).
//
// Exported (Phase 13C) so reminders/streakReminders.js can reuse this
// exact at-risk-streak walk instead of re-implementing it — same
// function backs both Today's Brief's streak line and the Notification
// Center's streak-protection reminder.
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

// Phase 13B — when a plan already exists for today, showing it takes
// priority over guessing at one: the user already told the app what
// they intend to train, so the muscle-gap recommendation below would
// just be a second, possibly-conflicting opinion. This never touches
// computeWorkoutRecommendation's own logic — it's a separate, cheaper
// check that runs first and short-circuits it (see getTodaysBrief).
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

// Today's Brief (Phase 12.5) — the prescriptive, "what should I
// actually do today" rule engine: workout recommendation, nearest goal
// (as a current/target fraction, not a percentage — more legible for a
// "keep going" prompt), today's steps remaining against a Daily Steps
// goal, and a streak-protection nudge. Every item is independently
// optional and reuses an existing engine (computeMuscleBreakdown,
// getGoalAnalytics) rather than re-deriving anything — a brand-new
// account with no goals/history simply gets an empty array (Dashboard
// hides the whole section when that happens).
//
// Phase 13B — todaysPlannedWorkout (if given) replaces the workout-
// recommendation slot rather than being added alongside it: once a plan
// exists for today, "Train Push today" from the gap-based recommender
// would just be a second, potentially contradicting suggestion.
//
// Phase 13C, section 14 — "Today's Brief continues using the highest-
// priority reminder": each item's `key` maps to the SAME priority tier
// the reminders/ engine uses for its equivalent notification type (see
// constants/notificationTypes.js's TYPE_PRIORITY), so the most urgent
// item always leads the list rather than a fixed insertion order.
const BRIEF_ITEM_PRIORITY_RANK = {
  streakNudge: 0, // matches streakProtection: critical
  plannedWorkout: 1, // matches workoutToday: high
  workoutRecommendation: 1,
  goalFocus: 2, // matches goalProgressReminder: medium
  stepsFocus: 2,
};

// Phase 13D, Part A.1 — Reminder Confidence: these items are never
// persisted Notifications (Today's Brief is computed fresh every render,
// not stored), so there's no server round-trip to resolve it from
// TYPE_CONFIDENCE — this is the client-only equivalent of that same map,
// for the same 5 keys, using the identical high/medium/low reasoning
// (exact plan/goal/steps data = high, the muscle-gap comparison
// recommendation = medium). Purely informational — see BriefListItem's
// header comment in dashboard.jsx for why this isn't rendered as new
// hero UI.
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
