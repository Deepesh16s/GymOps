const Goal = require("../models/Goal");
const Exercise = require("../models/Exercise");
const Workout = require("../models/workout");
const {
  GOAL_TYPES,
  MANUAL_GOAL_TYPES,
  GOAL_PERIODS,
  CARDIO_GOAL_METRICS,
} = require("../constants/goalTypes");
const { CARDIO_ACTIVITY_TYPES } = require("../constants/cardioMetadata");
const metrics = require("../utils/goalMetrics");
const {
  getLatestSessionWorkouts,
  computeCardioGoalCurrent,
} = require("../utils/updateGoals");

// Phase 8B: validates a Cardio Goal's activityType/metric/period. Shared
// by createGoal and updateGoal so the validation rule lives in exactly
// one place. Only called when the caller believes the goal SHOULD be
// automatic (i.e. at least one of the three fields was supplied) —
// omitting all three is legitimate (legacy manual behavior) and never
// reaches this function.
const validateCardioGoalConfig = ({ activityType, metric, period }) => {
  // Reject a partial configuration up front with one clear message,
  // rather than letting whichever field happens to be missing surface
  // its own field-specific error first — an automatic Cardio Goal is
  // all-or-nothing, so "you're missing one of three" should read as one
  // rule, not three separate checks that happen to fail in sequence.
  if (!activityType || !metric || !period) {
    const err = new Error(
      "Cardio Goal requires activityType, metric, and period together."
    );
    err.status = 400;
    throw err;
  }

  if (!CARDIO_ACTIVITY_TYPES.includes(activityType)) {
    const err = new Error(
      `activityType must be one of: ${CARDIO_ACTIVITY_TYPES.join(", ")}`
    );
    err.status = 400;
    throw err;
  }

  if (!CARDIO_GOAL_METRICS.includes(metric)) {
    const err = new Error(
      `metric must be one of: ${CARDIO_GOAL_METRICS.join(", ")}`
    );
    err.status = 400;
    throw err;
  }

  if (!Object.values(GOAL_PERIODS).includes(period)) {
    const err = new Error(
      `period must be one of: ${Object.values(GOAL_PERIODS).join(", ")}`
    );
    err.status = 400;
    throw err;
  }
};

// Shared by createGoal and updateGoal so "current >= target ? Completed
// : In Progress" exists in exactly one place instead of twice.
const buildGoalStatus = (current, target) =>
  Number(current) >= Number(target) ? "Completed" : "In Progress";

// Fields a client is allowed to change via updateGoal. Deliberately
// excludes `user`, `status`, `updateType`, `lastUpdated`, and any other
// schema field — updateGoal used to spread the entire req.body into
// findByIdAndUpdate, which let a request overwrite `user` and reassign
// a goal to a different account. Whitelisting closes that hole.
const ALLOWED_GOAL_UPDATE_FIELDS = [
  "title",
  "type",
  "target",
  "unit",
  "exercise",
  "deadline",
  "activityType",
  "metric",
  "period",
  "current",
];

exports.createGoal = async (req, res) => {
  try {
    const {
      title,
      type,
      target,
      unit,
      exercise,
      deadline,
      activityType,
      metric,
      period,
    } = req.body;

    if (!title || !type || target === undefined || target === null || !unit) {
      return res.status(400).json({ message: "All required fields must be provided" });
    }

    let exerciseDoc = null;

    if (type === GOAL_TYPES.STRENGTH_PR) {
      if (!exercise) {
        return res.status(400).json({ message: "Please select an exercise for a Strength PR goal" });
      }
      exerciseDoc = await Exercise.findOne({ _id: exercise, createdBy: req.user._id });
      if (!exerciseDoc) {
        return res.status(400).json({ message: "Selected exercise was not found" });
      }
    }

    let current = 0;
    let goalActivityType = null;
    let goalMetric = null;
    let goalPeriod = null;

    if (type === GOAL_TYPES.STRENGTH_PR && exerciseDoc) {
      const workouts = await Workout.find({ user: req.user._id, exercise: exerciseDoc._id }).select("workoutSets");
      current = metrics.getMaxWeight(workouts);
    } else if (type === GOAL_TYPES.WEEKLY_WORKOUT_SESSIONS) {
      const weekWorkouts = await Workout.find({
        user: req.user._id,
        date: { $gte: metrics.startOfWeek() },
      }).select("sessionId");
      current = metrics.countDistinctSessions(weekWorkouts);
    } else if (type === GOAL_TYPES.MONTHLY_WORKOUT_SESSIONS) {
      const monthWorkouts = await Workout.find({
        user: req.user._id,
        date: { $gte: metrics.startOfMonth() },
      }).select("sessionId");
      current = metrics.countDistinctSessions(monthWorkouts);
    } else if (type === GOAL_TYPES.WEEKLY_VOLUME) {
      const weekWorkouts = await Workout.find({
        user: req.user._id,
        date: { $gte: metrics.startOfWeek() },
      }).select("workoutSets");
      current = metrics.sumVolume(weekWorkouts);
    } else if (type === GOAL_TYPES.MONTHLY_VOLUME) {
      const monthWorkouts = await Workout.find({
        user: req.user._id,
        date: { $gte: metrics.startOfMonth() },
      }).select("workoutSets");
      current = metrics.sumVolume(monthWorkouts);
    } else if (
      type === GOAL_TYPES.SESSION_EXERCISE ||
      type === GOAL_TYPES.SESSION_VOLUME ||
      type === GOAL_TYPES.SESSION_DURATION
    ) {
      // All three read the MOST RECENTLY FINISHED session, per product
      // decision — not a lifetime best.
      const sessionWorkouts = await getLatestSessionWorkouts(req.user._id);

      if (type === GOAL_TYPES.SESSION_EXERCISE) {
        // Goes through getSessionExerciseCount (the same helper
        // updateGoals.js's global recalculation uses via
        // getLatestSessionMetrics) instead of raw sessionWorkouts.length,
        // so cardio entries in a mixed session are not counted as
        // "exercises" — one shared computation, not two.
        current = metrics.getSessionExerciseCount(sessionWorkouts);
      } else if (type === GOAL_TYPES.SESSION_VOLUME) {
        current = metrics.sumVolume(sessionWorkouts);
      } else {
        current = sessionWorkouts[0]?.sessionDuration ?? 0;
      }
    } else if (type === GOAL_TYPES.CURRENT_STREAK) {
      const allWorkouts = await Workout.find({ user: req.user._id }).select("date createdAt");
      current = metrics.computeCurrentStreak(allWorkouts);
    } else if (type === GOAL_TYPES.CARDIO) {
      // Phase 8B: a Cardio Goal is automatic only when a full
      // configuration is supplied. Providing none of the three fields is
      // still valid and produces the same manual goal Cardio Goals have
      // always been — current comes from req.body.current, exactly like
      // Weight Goal below. This is what keeps the API backward
      // compatible for any existing client still posting the old shape.
      const hasAnyCardioConfig =
        activityType !== undefined || metric !== undefined || period !== undefined;

      if (hasAnyCardioConfig) {
        validateCardioGoalConfig({ activityType, metric, period });
        goalActivityType = activityType;
        goalMetric = metric;
        goalPeriod = period;
        current = await computeCardioGoalCurrent(req.user._id, {
          activityType,
          metric,
          period,
        });
      } else {
        current =
          req.body.current !== undefined && req.body.current !== null && req.body.current !== ""
            ? Number(req.body.current)
            : 0;
      }
    } else if (MANUAL_GOAL_TYPES.includes(type)) {
      // Weight Goal — Cardio Goal is fully handled above, so this branch
      // is effectively Weight-Goal-only now, but kept generic in case
      // another manual type is added later.
      current =
        req.body.current !== undefined && req.body.current !== null && req.body.current !== ""
          ? Number(req.body.current)
          : 0;
    }

    const status = buildGoalStatus(current, target);

    const goal = await Goal.create({
      user: req.user._id,
      title: title.trim(),
      type,
      target: Number(target),
      current,
      unit: unit.trim(),
      exercise: type === GOAL_TYPES.STRENGTH_PR ? exerciseDoc._id : null,
      activityType: goalActivityType,
      metric: goalMetric,
      period: goalPeriod,
      deadline: deadline || null,
      status,
    });

    const populatedGoal = await goal.populate("exercise", "name muscleGroup");
    res.status(201).json(populatedGoal);
  } catch (error) {
    console.log(error);
    res.status(error.status || 500).json({
      message: error.status ? error.message : "Failed to create goal. Please try again.",
    });
  }
};

exports.getGoals = async (req, res) => {
  try {
    const goals = await Goal.find({ user: req.user._id })
      .populate("exercise", "name muscleGroup")
      .sort({ createdAt: -1 });
    res.status(200).json(goals);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to load goals." });
  }
};

exports.updateGoal = async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id);
    if (!goal) return res.status(404).json({ message: "Goal not found" });
    if (goal.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const updates = {};
    ALLOWED_GOAL_UPDATE_FIELDS.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const willBeStrengthPR =
      updates.type === GOAL_TYPES.STRENGTH_PR ||
      (updates.type === undefined && goal.type === GOAL_TYPES.STRENGTH_PR);

    if (willBeStrengthPR) {
      const exerciseId = updates.exercise !== undefined ? updates.exercise : goal.exercise;
      if (!exerciseId) {
        return res.status(400).json({ message: "Please select an exercise for a Strength PR goal" });
      }
      const exerciseDoc = await Exercise.findOne({ _id: exerciseId, createdBy: req.user._id });
      if (!exerciseDoc) {
        return res.status(400).json({ message: "Selected exercise was not found" });
      }
      updates.exercise = exerciseDoc._id;
    }

    // Phase 8B: mirrors willBeStrengthPR above — determines whether the
    // resulting goal (after this update is applied) will be a Cardio
    // Goal, regardless of whether `type` itself is part of this request.
    const willBeCardio =
      updates.type === GOAL_TYPES.CARDIO ||
      (updates.type === undefined && goal.type === GOAL_TYPES.CARDIO);

    if (willBeCardio) {
      // Merge incoming updates over the existing goal's config so a
      // partial edit (e.g. only changing `period`) is validated and
      // recomputed against the FULL resulting configuration, not just
      // the changed field in isolation.
      const mergedActivityType =
        updates.activityType !== undefined ? updates.activityType : goal.activityType;
      const mergedMetric =
        updates.metric !== undefined ? updates.metric : goal.metric;
      const mergedPeriod =
        updates.period !== undefined ? updates.period : goal.period;

      const hasAnyCardioConfig =
        mergedActivityType !== null || mergedMetric !== null || mergedPeriod !== null;

      if (hasAnyCardioConfig) {
        validateCardioGoalConfig({
          activityType: mergedActivityType,
          metric: mergedMetric,
          period: mergedPeriod,
        });

        updates.activityType = mergedActivityType;
        updates.metric = mergedMetric;
        updates.period = mergedPeriod;

        // Recompute immediately whenever the configuration actually
        // changed (or a previously-unconfigured manual Cardio Goal just
        // became configured), rather than waiting for the next workout
        // save — same computeCardioGoalCurrent the global recalculation
        // pass is built on, called once here instead of duplicated.
        const configChanged =
          mergedActivityType !== goal.activityType ||
          mergedMetric !== goal.metric ||
          mergedPeriod !== goal.period;

        if (configChanged) {
          updates.current = await computeCardioGoalCurrent(req.user._id, {
            activityType: mergedActivityType,
            metric: mergedMetric,
            period: mergedPeriod,
          });
        }
      }
      // else: still an unconfigured (legacy manual) Cardio Goal —
      // updates.current, if provided in this request, passes through
      // untouched below, exactly like Weight Goal always has.
    }

    // Manual types (Cardio Goal when unconfigured / Weight Goal) are
    // edited via this same endpoint — `current` passes through untouched
    // here, same as any other field, unless the Cardio Goal branch above
    // already overwrote it with a fresh auto-computed value.
    const mergedCurrent = updates.current !== undefined ? Number(updates.current) : goal.current;
    const mergedTarget = updates.target !== undefined ? Number(updates.target) : goal.target;
    updates.status = buildGoalStatus(mergedCurrent, mergedTarget);

    const updatedGoal = await Goal.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).populate("exercise", "name muscleGroup");

    res.status(200).json(updatedGoal);
  } catch (error) {
    console.log(error);
    res.status(error.status || 500).json({
      message: error.status ? error.message : "Failed to update goal. Please try again.",
    });
  }
};

exports.deleteGoal = async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id);
    if (!goal) return res.status(404).json({ message: "Goal not found" });
    if (goal.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: "Not authorized" });
    }
    await Goal.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Goal deleted successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to delete goal. Please try again." });
  }
};