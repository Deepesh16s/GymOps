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

const fetchDailyStepsIfNeeded = async (userId, cardioGoals, options = {}) => {
  const needsSteps = (cardioGoals || []).some((g) => g.metric === "steps");
  if (!needsSteps) return [];
  return DailySteps.find({ user: userId }).session(options.session).select("date steps -_id").lean();
};

const WORKOUT_FIELDS =
  "date createdAt sessionId sessionDuration workoutSets exercise entryType cardio";

const buildStatus = (current, target) => (current >= target ? "Completed" : "In Progress");

const buildBulkStatusOp = (goalId, current, target) => ({
  updateOne: {
    filter: { _id: goalId },
    update: { $set: { current, status: buildStatus(current, target), lastUpdated: new Date() } },
  },
});

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

const recalculateGlobalAutoGoals = async (userId, options = {}) => {
  const [allWorkouts, autoGoals] = await Promise.all([
    Workout.find({ user: userId }).select(WORKOUT_FIELDS).session(options.session),
    Goal.find({ user: userId, type: { $in: GLOBAL_AUTO_GOAL_TYPES } }).session(options.session),
  ]);

  const streak = metrics.computeCurrentStreak(allWorkouts);
  const notificationPayloads = [];
  const streakPayload = detectStreakMilestonePayload(streak);
  if (streakPayload) notificationPayloads.push(streakPayload);

  if (!autoGoals.length) return notificationPayloads;

  const goalsByType = autoGoals.reduce((acc, g) => {
    (acc[g.type] = acc[g.type] || []).push(g);
    return acc;
  }, {});

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

  const dailyStepsRecords = await fetchDailyStepsIfNeeded(
    userId,
    goalsByType[GOAL_TYPES.CARDIO],
    options
  );

  const ops = [];

  Object.entries(goalsByType).forEach(([type, goals]) => {
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