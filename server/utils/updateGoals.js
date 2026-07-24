const Goal = require("../models/Goal");
const Workout = require("../models/workout");
const DailySteps = require("../models/DailySteps");
const {
  GOAL_TYPES,
  GLOBAL_AUTO_GOAL_TYPES,
  isAutoCardioGoal,
} = require("../constants/goalTypes");
const metrics = require("./goalMetrics");
const {
  detectGoalNotificationPayloads,
  detectStreakMilestonePayload,
} = require("./notificationTriggers");
const { createNotificationsIfNew } = require("./notificationService");

// Only Daily Steps goals (metric === "steps") need the daily-steps log —
// fetched lazily (one extra query, only when at least one such goal
// exists) rather than unconditionally alongside every recalculation, so
// users with no steps-based goal never pay for a query with nothing to
// use it for.
const fetchDailyStepsIfNeeded = async (userId, cardioGoals, options = {}) => {
  const needsSteps = (cardioGoals || []).some((g) => g.metric === "steps");
  if (!needsSteps) return [];
  return DailySteps.find({ user: userId }).session(options.session).select("date steps -_id").lean();
};

// Phase 8B: entryType + cardio added so every consumer of this fetch
// (recalculateGlobalAutoGoals, getLatestSessionWorkouts,
// computeCardioGoalCurrent) has what it needs to distinguish strength
// from cardio entries and read cardio metric values. Adding fields to
// the projection doesn't affect any existing strength-only computation
// (volume, PR, session exercise count) — they simply ignore fields they
// don't use.
const WORKOUT_FIELDS =
  "date createdAt sessionId sessionDuration workoutSets exercise entryType cardio";

const buildStatus = (current, target) => (current >= target ? "Completed" : "In Progress");

const buildBulkStatusOp = (goalId, current, target) => ({
  updateOne: {
    filter: { _id: goalId },
    update: { $set: { current, status: buildStatus(current, target), lastUpdated: new Date() } },
  },
});

// Merges multiple exercises' sets into one "highest weight per exercise"
// map, so a whole session's worth of PR candidates can be resolved with a
// single query instead of one per exercise.
const buildWeightsByExercise = (exercises) => {
  const map = new Map();
  exercises.forEach(({ exercise, workoutSets }) => {
    if (!Array.isArray(workoutSets) || !workoutSets.length) return;
    const maxWeight = Math.max(...workoutSets.map((s) => s.weight));
    const key = String(exercise);
    const existing = map.get(key);
    if (existing === undefined || maxWeight > existing) map.set(key, maxWeight);
  });
  return map;
};

// Incrementally bumps Strength PR goals — only raises `current`, never
// lowers it (a full recompute after deletes lives in recalculateGoals.js).
// ONE Goal.find() + ONE Goal.bulkWrite() covers every exercise passed in,
// whether that's one exercise (single workout) or a whole session.
//
// `options.session` threads a Mongo ClientSession through, for the
// transactional session-batch path — a no-op when omitted.
// Returns the notification payloads (Phase 13A) for any Strength PR
// goal that just crossed a completion/progress threshold — callers
// decide whether/how to persist them (see updateGoalsForWorkout/
// updateGoalsForSession below), keeping this function's own job
// (recompute + bulkWrite) unchanged.
const applyStrengthPrUpdates = async (userId, weightsByExercise, options = {}) => {
  const exerciseIds = [...weightsByExercise.keys()];
  if (!exerciseIds.length) return [];

  const prGoals = await Goal.find({
    user: userId,
    type: GOAL_TYPES.STRENGTH_PR,
    exercise: { $in: exerciseIds },
  }).session(options.session);

  if (!prGoals.length) return [];

  const ops = [];
  const notificationPayloads = [];
  prGoals.forEach((goal) => {
    const maxWeight = weightsByExercise.get(String(goal.exercise));
    if (maxWeight === undefined || maxWeight <= goal.current) return;
    ops.push(buildBulkStatusOp(goal._id, maxWeight, goal.target));
    notificationPayloads.push(...detectGoalNotificationPayloads(goal, maxWeight, goal.target));
  });

  if (ops.length) {
    await Goal.bulkWrite(ops, { session: options.session });
  }

  return notificationPayloads;
};

// ONE Workout.find() + ONE Goal.find(); every metric below is derived in
// memory from those two arrays, then persisted with ONE Goal.bulkWrite().
//
// Deliberately does NOT catch its own errors. Callers decide: the
// fire-and-forget paths (updateGoalsForWorkout, recalculateGoalsForExercise)
// wrap this in try/catch and log; the transactional session path
// (updateGoalsForSession) lets errors bubble up so the transaction aborts.
const recalculateGlobalAutoGoals = async (userId, options = {}) => {
  const [allWorkouts, autoGoals] = await Promise.all([
    Workout.find({ user: userId }).select(WORKOUT_FIELDS).session(options.session),
    Goal.find({ user: userId, type: { $in: GLOBAL_AUTO_GOAL_TYPES } }).session(options.session),
  ]);

  // Streak-milestone detection runs regardless of whether the user has
  // any goals configured at all — a 7/14/30/60/100-day streak is a
  // real-world achievement independent of any Goal document, so it
  // can't live behind the `!autoGoals.length` early return below.
  const streak = metrics.computeCurrentStreak(allWorkouts);
  const notificationPayloads = [];
  const streakPayload = detectStreakMilestonePayload(streak);
  if (streakPayload) notificationPayloads.push(streakPayload);

  if (!autoGoals.length) return notificationPayloads;

  const goalsByType = autoGoals.reduce((acc, g) => {
    (acc[g.type] = acc[g.type] || []).push(g);
    return acc;
  }, {});

  // Computed once each from the single allWorkouts fetch, then reused
  // across every goal of the matching type below.
  const weekWorkouts = metrics.filterSince(allWorkouts, metrics.startOfWeek());
  const monthWorkouts = metrics.filterSince(allWorkouts, metrics.startOfMonth());
  const sessionMetrics = metrics.getLatestSessionMetrics(allWorkouts);

  const valueByType = {
    [GOAL_TYPES.WEEKLY_WORKOUT_SESSIONS]: metrics.countDistinctSessions(weekWorkouts),
    [GOAL_TYPES.MONTHLY_WORKOUT_SESSIONS]: metrics.countDistinctSessions(monthWorkouts),
    [GOAL_TYPES.WEEKLY_VOLUME]: metrics.sumVolume(weekWorkouts),
    [GOAL_TYPES.MONTHLY_VOLUME]: metrics.sumVolume(monthWorkouts),
    [GOAL_TYPES.SESSION_EXERCISE]: sessionMetrics.exerciseCount,
    [GOAL_TYPES.SESSION_VOLUME]: sessionMetrics.volume,
    [GOAL_TYPES.SESSION_DURATION]: sessionMetrics.duration,
    [GOAL_TYPES.CURRENT_STREAK]: streak,
  };

  // Fetched once (lazily — see fetchDailyStepsIfNeeded) and reused across
  // every Daily Steps goal below, rather than one query per goal.
  const dailyStepsRecords = await fetchDailyStepsIfNeeded(
    userId,
    goalsByType[GOAL_TYPES.CARDIO],
    options
  );

  const ops = [];

  Object.entries(goalsByType).forEach(([type, goals]) => {
    // Phase 8B: Cardio Goal has no single shared value the way every
    // other auto type does — each goal carries its own
    // activityType/metric/period, so it's computed per goal instance
    // instead of once per type, reusing the same allWorkouts array
    // already fetched above (no extra Workout query). Legacy Cardio
    // Goals without a full configuration are fetched here (they're in
    // GLOBAL_AUTO_GOAL_TYPES, so the query above includes them) but
    // deliberately skipped — isAutoCardioGoal is the single place that
    // decides which Cardio Goals are automatic; an unconfigured one is
    // left exactly as the user last set it.
    if (type === GOAL_TYPES.CARDIO) {
      goals.forEach((goal) => {
        if (!isAutoCardioGoal(goal)) return;
        const value = metrics.computeCardioGoalMetric(allWorkouts, {
          activityType: goal.activityType,
          metric: goal.metric,
          period: goal.period,
          dailyTarget: goal.dailyTarget,
          createdAt: goal.createdAt,
          dailyStepsRecords,
        });
        ops.push(buildBulkStatusOp(goal._id, value, goal.target));
        notificationPayloads.push(...detectGoalNotificationPayloads(goal, value, goal.target));
      });
      return;
    }

    const value = valueByType[type];
    if (value === undefined) return;
    goals.forEach((goal) => {
      ops.push(buildBulkStatusOp(goal._id, value, goal.target));
      notificationPayloads.push(...detectGoalNotificationPayloads(goal, value, goal.target));
    });
  });

  if (ops.length) {
    await Goal.bulkWrite(ops, { session: options.session });
  }

  return notificationPayloads;
};

// Single-workout path — used by createWorkout (legacy single POST) and
// updateWorkout. Behavior is UNCHANGED: a goal recalculation failure is
// logged but never fails the workout save.
const updateGoalsForWorkout = async (userId, exerciseId, workoutSets) => {
  try {
    let notificationPayloads = [];
    if (Array.isArray(workoutSets) && workoutSets.length && exerciseId) {
      const maxWeight = Math.max(...workoutSets.map((s) => s.weight));
      notificationPayloads = notificationPayloads.concat(
        await applyStrengthPrUpdates(userId, new Map([[String(exerciseId), maxWeight]]))
      );
    }
    notificationPayloads = notificationPayloads.concat(
      await recalculateGlobalAutoGoals(userId)
    );

    if (notificationPayloads.length) {
      await createNotificationsIfNew(userId, notificationPayloads);
    }
  } catch (error) {
    console.log(error);
  }
};

// Session-batch path — used by createWorkoutSession, always inside a Mongo
// transaction. Unlike updateGoalsForWorkout, this does NOT swallow errors:
// a failure here must propagate so the transaction rolls back and no
// workouts are left partially saved. Returns the combined notification
// payloads (Phase 13A) rather than persisting them itself — the caller
// (workoutController.js) persists them together with its own
// workout-level candidates (PR/highest-volume/...), in its own
// non-transactional try/catch, after this function's writes are known
// to have succeeded.
const updateGoalsForSession = async (userId, exercises, options = {}) => {
  const weightsByExercise = buildWeightsByExercise(exercises);
  const prNotifications = await applyStrengthPrUpdates(userId, weightsByExercise, options);
  const autoGoalNotifications = await recalculateGlobalAutoGoals(userId, options);
  return [...prNotifications, ...autoGoalNotifications];
};

const getLatestSessionWorkouts = async (userId) => {
  const workouts = await Workout.find({ user: userId }).select(WORKOUT_FIELDS);
  return metrics.getLatestSessionWorkouts(workouts);
};

// Phase 8B: shared by goalController's createGoal (initial `current` for
// a new automatic Cardio Goal) and updateGoal (immediate recompute when
// activityType/metric/period is edited) — both call sites use the exact
// same WORKOUT_FIELDS projection and the exact same
// metrics.computeCardioGoalMetric used by the global recalculation pass
// above, so there is only one cardio-metric code path in the whole app,
// and no separate cardio update pipeline.
const computeCardioGoalCurrent = async (
  userId,
  { activityType, metric, period, dailyTarget = null, createdAt = null },
  options = {}
) => {
  const workouts = await Workout.find({ user: userId })
    .select(WORKOUT_FIELDS)
    .session(options.session);

  const dailyStepsRecords = await fetchDailyStepsIfNeeded(userId, [{ metric }], options);

  return metrics.computeCardioGoalMetric(workouts, {
    activityType,
    metric,
    period,
    dailyTarget,
    // NEXT_SESSION with no createdAt (a brand-new goal, not yet saved)
    // must count nothing as "next" — defaulting to "now" means no
    // pre-existing workout can ever match, which is exactly the correct
    // starting `current` (0) for a goal that was just created.
    createdAt: createdAt || new Date(),
    dailyStepsRecords,
  });
};

module.exports = {
  updateGoalsForWorkout,
  updateGoalsForSession,
  recalculateGlobalAutoGoals,
  getLatestSessionWorkouts,
  computeCardioGoalCurrent,
};