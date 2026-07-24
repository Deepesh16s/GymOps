// Phase 13A — detects the workout-write-time notification events (PR,
// highest-volume session, longest-workout session, new-longest-run),
// each by comparing this write against the user's PRIOR history via the
// SAME primitives goalMetrics.js/updateGoals.js already use
// (getMaxWeight, groupBySessionId, sumVolume) — nothing here
// re-implements what a PR or a session's volume means. Returns ready-to-
// persist payload objects; workoutController.js is responsible for
// actually calling notificationService.createNotificationsIfNew with
// them (kept separate so detection stays a pure query+compare step).
const Workout = require("../models/workout");
const Exercise = require("../models/Exercise");
const metrics = require("./goalMetrics");
const {
  NOTIFICATION_TYPES,
  NOTIFICATION_CATEGORIES,
  TYPE_PRIORITY,
  STREAK_MILESTONES,
  GOAL_PROGRESS_THRESHOLDS,
} = require("../constants/notificationTypes");

// Phase 13C — a gap this long between two consecutive sessions counts as
// "a break" worth celebrating a return from (distinct from a missed
// single day, which isn't remarkable on its own).
const BREAK_THRESHOLD_DAYS = 10;
const { GOAL_TYPES } = require("../constants/goalTypes");

// Phase 13C.1, Deep Links example: "PR notification -> Workout History ->
// expand that session automatically" — sessionId is already available to
// every caller here (it's the write that triggered detection), so the
// destination is the exact session this PR was set in, not a generic
// Progression filter.
async function detectStrengthPRs(userId, { sessionId, strengthEntries }) {
  if (!strengthEntries.length) return [];

  const exerciseIds = [...new Set(strengthEntries.map((e) => String(e.exercise)))];

  const [priorWorkouts, exerciseDocs] = await Promise.all([
    Workout.find({
      user: userId,
      exercise: { $in: exerciseIds },
      sessionId: { $ne: sessionId },
    }).select("exercise workoutSets"),
    Exercise.find({ _id: { $in: exerciseIds } }).select("name"),
  ]);

  const exerciseNameById = new Map(exerciseDocs.map((e) => [String(e._id), e.name]));

  const priorByExercise = new Map();
  priorWorkouts.forEach((w) => {
    const key = String(w.exercise);
    if (!priorByExercise.has(key)) priorByExercise.set(key, []);
    priorByExercise.get(key).push(w);
  });

  // An exercise can appear in more than one entry within the same
  // session (rare, but possible) — merge to this session's own best set
  // per exercise before comparing against prior history.
  const sessionBestByExercise = new Map();
  strengthEntries.forEach((entry) => {
    const key = String(entry.exercise);
    const best = (entry.workoutSets || []).reduce(
      (m, s) => (!m || s.weight > m.weight ? s : m),
      null
    );
    if (!best) return;
    const existing = sessionBestByExercise.get(key);
    if (!existing || best.weight > existing.weight) sessionBestByExercise.set(key, best);
  });

  const payloads = [];
  sessionBestByExercise.forEach((best, exerciseId) => {
    const priorMax = metrics.getMaxWeight(priorByExercise.get(exerciseId) || []);
    if (best.weight <= priorMax) return;

    const exerciseName = exerciseNameById.get(exerciseId) || "Exercise";
    payloads.push({
      type: NOTIFICATION_TYPES.PERSONAL_RECORD,
      category: NOTIFICATION_CATEGORIES.PROGRESS,
      priority: TYPE_PRIORITY[NOTIFICATION_TYPES.PERSONAL_RECORD],
      icon: "Trophy",
      title: `New ${exerciseName} PR`,
      subtitle: `${best.weight} kg × ${best.reps}`,
      navigationTarget: `/workouts?expandSession=${sessionId}`,
      action: { page: "/workouts", entityId: sessionId, focus: "expandSession" },
      dedupeKey: `pr:${exerciseId}:${best.weight}:${best.reps}`,
    });
  });

  return payloads;
}

async function detectSessionMilestones(userId, { sessionId, sessionVolume, sessionDuration }) {
  const priorWorkouts = await Workout.find({
    user: userId,
    sessionId: { $ne: sessionId },
  }).select("sessionId sessionDuration workoutSets");

  const bySession = metrics.groupBySessionId(priorWorkouts);
  let priorMaxVolume = 0;
  let priorMaxDuration = 0;
  bySession.forEach((sessionWorkouts) => {
    const vol = metrics.sumVolume(sessionWorkouts);
    if (vol > priorMaxVolume) priorMaxVolume = vol;
    const dur = Number(sessionWorkouts[0]?.sessionDuration) || 0;
    if (dur > priorMaxDuration) priorMaxDuration = dur;
  });

  const payloads = [];

  if (sessionVolume > 0 && sessionVolume > priorMaxVolume) {
    payloads.push({
      type: NOTIFICATION_TYPES.HIGHEST_VOLUME,
      category: NOTIFICATION_CATEGORIES.PROGRESS,
      priority: TYPE_PRIORITY[NOTIFICATION_TYPES.HIGHEST_VOLUME],
      icon: "Flame",
      title: "Highest Volume Session",
      subtitle: `${Math.round(sessionVolume).toLocaleString()} kg — a new all-time high`,
      navigationTarget: "/analytics",
      action: { page: "/analytics", entityId: null, focus: null },
      dedupeKey: `highestVolume:${sessionId}`,
    });
  }

  if (sessionDuration > 0 && sessionDuration > priorMaxDuration) {
    payloads.push({
      type: NOTIFICATION_TYPES.LONGEST_WORKOUT,
      category: NOTIFICATION_CATEGORIES.PROGRESS,
      priority: TYPE_PRIORITY[NOTIFICATION_TYPES.LONGEST_WORKOUT],
      icon: "Timer",
      title: "Longest Workout",
      subtitle: `${sessionDuration} min — a new all-time high`,
      navigationTarget: `/workouts?expandSession=${sessionId}`,
      action: { page: "/workouts", entityId: sessionId, focus: "expandSession" },
      dedupeKey: `longestWorkout:${sessionId}`,
    });
  }

  return payloads;
}

async function detectCardioMilestones(userId, { sessionId, cardioEntries }) {
  if (!cardioEntries.length) return [];

  const activityTypes = [...new Set(cardioEntries.map((e) => e.cardio.activityType))];

  const priorCardio = await Workout.find({
    user: userId,
    entryType: "cardio",
    "cardio.activityType": { $in: activityTypes },
    sessionId: { $ne: sessionId },
  }).select("cardio");

  const priorMaxDistanceByActivity = new Map();
  priorCardio.forEach((w) => {
    const activityType = w.cardio?.activityType;
    const distance = Number(w.cardio?.data?.distance) || 0;
    if (!activityType || !distance) return;
    const existing = priorMaxDistanceByActivity.get(activityType) || 0;
    if (distance > existing) priorMaxDistanceByActivity.set(activityType, distance);
  });

  const sessionMaxByActivity = new Map();
  cardioEntries.forEach((entry) => {
    const activityType = entry.cardio.activityType;
    const distance = Number(entry.cardio.data?.distance) || 0;
    if (!distance) return;
    const existing = sessionMaxByActivity.get(activityType) || 0;
    if (distance > existing) sessionMaxByActivity.set(activityType, distance);
  });

  const payloads = [];
  sessionMaxByActivity.forEach((distance, activityType) => {
    const priorMax = priorMaxDistanceByActivity.get(activityType) || 0;
    if (distance <= priorMax) return;

    payloads.push({
      type: NOTIFICATION_TYPES.NEW_LONGEST_RUN,
      category: NOTIFICATION_CATEGORIES.CARDIO,
      priority: TYPE_PRIORITY[NOTIFICATION_TYPES.NEW_LONGEST_RUN],
      icon: "Footprints",
      title: `New Longest ${activityType}`,
      subtitle: `${distance} km`,
      navigationTarget: "/progression?viewMode=cardio",
      action: { page: "/progression", entityId: activityType, focus: null },
      dedupeKey: `longestCardio:${activityType}:${distance}`,
    });
  });

  return payloads;
}

// Phase 13C, section 8 — "First workout after break": the gap between
// this session's date and the immediately-prior session (across ALL
// entry types, not just this one exercise/activity) exceeds
// BREAK_THRESHOLD_DAYS. dedupeKey includes this session's own id, so
// returning from a SECOND break later still celebrates that one too
// (not a once-ever notification).
async function detectFirstWorkoutAfterBreak(userId, { sessionId, sessionDate }) {
  const priorWorkouts = await Workout.find({
    user: userId,
    sessionId: { $ne: sessionId },
  })
    .select("date createdAt")
    .sort({ date: -1, createdAt: -1 })
    .limit(1);

  if (!priorWorkouts.length) return null;

  const priorDate = new Date(priorWorkouts[0].date || priorWorkouts[0].createdAt);
  const thisDate = new Date(sessionDate);
  const daysSince = Math.floor((thisDate.getTime() - priorDate.getTime()) / 86400000);
  if (daysSince < BREAK_THRESHOLD_DAYS) return null;

  return {
    type: NOTIFICATION_TYPES.FIRST_WORKOUT_AFTER_BREAK,
    category: NOTIFICATION_CATEGORIES.PROGRESS,
    priority: TYPE_PRIORITY[NOTIFICATION_TYPES.FIRST_WORKOUT_AFTER_BREAK],
    icon: "Sparkles",
    title: "Welcome Back",
    subtitle: `First workout after ${daysSince} days off`,
    navigationTarget: "/dashboard",
    action: { page: "/dashboard", entityId: null, focus: null },
    dedupeKey: `firstWorkoutAfterBreak:${sessionId}`,
  };
}

// Single entry point workoutController.js calls after a session is
// saved — runs every detector and returns one combined, ready-to-
// persist payload list.
async function detectWorkoutSessionNotifications(
  userId,
  { sessionId, strengthEntries, cardioEntries, sessionDuration, sessionDate }
) {
  const sessionVolume = strengthEntries.reduce(
    (sum, entry) =>
      sum + (entry.workoutSets || []).reduce((s, set) => s + set.weight * set.reps, 0),
    0
  );

  const [prPayloads, milestonePayloads, cardioPayloads, breakPayload] = await Promise.all([
    detectStrengthPRs(userId, { sessionId, strengthEntries }),
    detectSessionMilestones(userId, { sessionId, sessionVolume, sessionDuration }),
    detectCardioMilestones(userId, { sessionId, cardioEntries }),
    detectFirstWorkoutAfterBreak(userId, { sessionId, sessionDate: sessionDate || new Date() }),
  ]);

  return [...prPayloads, ...milestonePayloads, ...cardioPayloads, breakPayload].filter(Boolean);
}

// Goal completion (crossing 100%) or an 80%/90% progress checkpoint —
// called from updateGoals.js with the goal's PRE-update state (`goal`)
// and the newly recomputed `newCurrent`, so old-vs-new percent can
// actually be compared (a bulkWrite alone has no "before" to diff
// against). Completion supersedes a same-recalculation threshold
// notification for the same goal — hitting 100% is the bigger moment,
// not "90% AND 100%" as two separate pings.
function detectGoalNotificationPayloads(goal, newCurrent, target) {
  if (goal.status === "Completed") return [];

  const isCardio = goal.type === GOAL_TYPES.CARDIO;
  const category = isCardio ? NOTIFICATION_CATEGORIES.CARDIO : NOTIFICATION_CATEGORIES.PROGRESS;

  if (target > 0 && newCurrent >= target) {
    return [
      {
        type: NOTIFICATION_TYPES.GOAL_COMPLETED,
        category,
        priority: TYPE_PRIORITY[NOTIFICATION_TYPES.GOAL_COMPLETED],
        icon: "PartyPopper",
        title: `Goal Completed: ${goal.title}`,
        subtitle: `${Math.round(newCurrent).toLocaleString()} / ${target.toLocaleString()} ${goal.unit}`,
        navigationTarget: "/goals",
        action: { page: "/goals", entityId: String(goal._id), focus: "scrollToGoal" },
        dedupeKey: `goalCompleted:${goal._id}`,
        // Phase 13D, Part A.3 — read by notificationService.js's
        // createNotificationsIfNew to suppress this goal's lingering
        // "goal:<id>" progress/milestone reminder, if any.
        metadata: { goalId: String(goal._id) },
      },
    ];
  }

  if (target <= 0) return [];

  const oldPercent = Math.min(100, Math.round((goal.current / target) * 100));
  const newPercent = Math.min(100, Math.round((newCurrent / target) * 100));

  const payloads = [];
  GOAL_PROGRESS_THRESHOLDS.forEach((threshold) => {
    if (oldPercent < threshold && newPercent >= threshold) {
      payloads.push({
        type: NOTIFICATION_TYPES.GOAL_THRESHOLD,
        category: isCardio ? NOTIFICATION_CATEGORIES.CARDIO : NOTIFICATION_CATEGORIES.REMINDERS,
        priority: TYPE_PRIORITY[NOTIFICATION_TYPES.GOAL_THRESHOLD],
        icon: "Target",
        title: `${goal.title} — ${threshold}%`,
        subtitle: `${Math.round(target - newCurrent).toLocaleString()} ${goal.unit} to go`,
        navigationTarget: "/goals",
        action: { page: "/goals", entityId: String(goal._id), focus: "scrollToGoal" },
        dedupeKey: `goalThreshold:${goal._id}:${threshold}`,
      });
    }
  });

  return payloads;
}

// A day-streak crossing one of the fixed celebration lengths (7/14/30/
// 60/100 — see constants/notificationTypes.js). dedupeKey is keyed only
// by the milestone value (not a date), so it fires exactly once ever
// per milestone regardless of how many times recalculation re-runs that
// day.
function detectStreakMilestonePayload(streak) {
  if (!STREAK_MILESTONES.includes(streak)) return null;

  return {
    type: NOTIFICATION_TYPES.STREAK_MILESTONE,
    category: NOTIFICATION_CATEGORIES.PROGRESS,
    priority: TYPE_PRIORITY[NOTIFICATION_TYPES.STREAK_MILESTONE],
    icon: "Flame",
    title: `${streak}-Day Streak`,
    subtitle: "Keep the momentum going",
    navigationTarget: "/dashboard",
    action: { page: "/dashboard", entityId: null, focus: null },
    dedupeKey: `streakMilestone:${streak}`,
  };
}

module.exports = {
  detectWorkoutSessionNotifications,
  detectGoalNotificationPayloads,
  detectStreakMilestonePayload,
};
