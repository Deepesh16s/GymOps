const Goal = require("../models/Goal");
const Workout = require("../models/workout");
const {
  GOAL_TYPES,
  GLOBAL_AUTO_GOAL_TYPES,
  isAutoCardioGoal,
} = require("../constants/goalTypes");
const metrics = require("./goalMetrics");

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
const applyStrengthPrUpdates = async (userId, weightsByExercise, options = {}) => {
  const exerciseIds = [...weightsByExercise.keys()];
  if (!exerciseIds.length) return;

  const prGoals = await Goal.find({
    user: userId,
    type: GOAL_TYPES.STRENGTH_PR,
    exercise: { $in: exerciseIds },
  }).session(options.session);

  if (!prGoals.length) return;

  const ops = [];
  prGoals.forEach((goal) => {
    const maxWeight = weightsByExercise.get(String(goal.exercise));
    if (maxWeight === undefined || maxWeight <= goal.current) return;
    ops.push(buildBulkStatusOp(goal._id, maxWeight, goal.target));
  });

  if (ops.length) {
    await Goal.bulkWrite(ops, { session: options.session });
  }
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

  if (!autoGoals.length) return;

  const goalsByType = autoGoals.reduce((acc, g) => {
    (acc[g.type] = acc[g.type] || []).push(g);
    return acc;
  }, {});

  // Computed once each from the single allWorkouts fetch, then reused
  // across every goal of the matching type below.
  const weekWorkouts = metrics.filterSince(allWorkouts, metrics.startOfWeek());
  const monthWorkouts = metrics.filterSince(allWorkouts, metrics.startOfMonth());
  const sessionMetrics = metrics.getLatestSessionMetrics(allWorkouts);
  const streak = metrics.computeCurrentStreak(allWorkouts);

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
        });
        ops.push(buildBulkStatusOp(goal._id, value, goal.target));
      });
      return;
    }

    const value = valueByType[type];
    if (value === undefined) return;
    goals.forEach((goal) => ops.push(buildBulkStatusOp(goal._id, value, goal.target)));
  });

  if (ops.length) {
    await Goal.bulkWrite(ops, { session: options.session });
  }
};

// Single-workout path — used by createWorkout (legacy single POST) and
// updateWorkout. Behavior is UNCHANGED: a goal recalculation failure is
// logged but never fails the workout save.
const updateGoalsForWorkout = async (userId, exerciseId, workoutSets) => {
  try {
    if (Array.isArray(workoutSets) && workoutSets.length && exerciseId) {
      const maxWeight = Math.max(...workoutSets.map((s) => s.weight));
      await applyStrengthPrUpdates(userId, new Map([[String(exerciseId), maxWeight]]));
    }
    await recalculateGlobalAutoGoals(userId);
  } catch (error) {
    console.log(error);
  }
};

// Session-batch path — used by createWorkoutSession, always inside a Mongo
// transaction. Unlike updateGoalsForWorkout, this does NOT swallow errors:
// a failure here must propagate so the transaction rolls back and no
// workouts are left partially saved.
const updateGoalsForSession = async (userId, exercises, options = {}) => {
  const weightsByExercise = buildWeightsByExercise(exercises);
  await applyStrengthPrUpdates(userId, weightsByExercise, options);
  await recalculateGlobalAutoGoals(userId, options);
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
  { activityType, metric, period },
  options = {}
) => {
  const workouts = await Workout.find({ user: userId })
    .select(WORKOUT_FIELDS)
    .session(options.session);

  return metrics.computeCardioGoalMetric(workouts, { activityType, metric, period });
};

module.exports = {
  updateGoalsForWorkout,
  updateGoalsForSession,
  recalculateGlobalAutoGoals,
  getLatestSessionWorkouts,
  computeCardioGoalCurrent,
};