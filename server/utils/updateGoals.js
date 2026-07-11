const Goal = require("../models/Goal");
const Workout = require("../models/workout");
const { GOAL_TYPES, GLOBAL_AUTO_GOAL_TYPES } = require("../constants/goalTypes");
const metrics = require("./goalMetrics");

const WORKOUT_FIELDS = "date createdAt sessionId sessionDuration workoutSets exercise";

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

module.exports = {
  updateGoalsForWorkout,
  updateGoalsForSession,
  recalculateGlobalAutoGoals,
  getLatestSessionWorkouts,
};