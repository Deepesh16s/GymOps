const Goal = require("../models/Goal");
const Exercise = require("../models/Exercise");
const Workout = require("../models/workout");
const { GOAL_TYPES, MANUAL_GOAL_TYPES } = require("../constants/goalTypes");
const metrics = require("../utils/goalMetrics");
const { getLatestSessionWorkouts } = require("../utils/updateGoals");

exports.createGoal = async (req, res) => {
  try {
    const { title, type, target, unit, exercise, deadline } = req.body;

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
        current = sessionWorkouts.length;
      } else if (type === GOAL_TYPES.SESSION_VOLUME) {
        current = metrics.sumVolume(sessionWorkouts);
      } else {
        current = sessionWorkouts[0]?.sessionDuration ?? 0;
      }
    } else if (type === GOAL_TYPES.CURRENT_STREAK) {
      const allWorkouts = await Workout.find({ user: req.user._id }).select("date createdAt");
      current = metrics.computeCurrentStreak(allWorkouts);
    } else if (MANUAL_GOAL_TYPES.includes(type)) {
      // Cardio Goal / Weight Goal: no backing data source, user supplies
      // `current` directly.
      current =
        req.body.current !== undefined && req.body.current !== null && req.body.current !== ""
          ? Number(req.body.current)
          : 0;
    }

    const status = Number(current) >= Number(target) ? "Completed" : "In Progress";

    const goal = await Goal.create({
      user: req.user._id,
      title: title.trim(),
      type,
      target: Number(target),
      current,
      unit: unit.trim(),
      exercise: type === GOAL_TYPES.STRENGTH_PR ? exerciseDoc._id : null,
      deadline: deadline || null,
      status,
    });

    const populatedGoal = await goal.populate("exercise", "name muscleGroup");
    res.status(201).json(populatedGoal);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to create goal. Please try again." });
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

    const updates = { ...req.body };

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

    // Manual types (Cardio Goal / Weight Goal) are edited via this same
    // endpoint — `current` passes through untouched here, same as any
    // other field.
    const mergedCurrent = updates.current !== undefined ? Number(updates.current) : goal.current;
    const mergedTarget = updates.target !== undefined ? Number(updates.target) : goal.target;
    updates.status = mergedCurrent >= mergedTarget ? "Completed" : "In Progress";

    const updatedGoal = await Goal.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).populate("exercise", "name muscleGroup");

    res.status(200).json(updatedGoal);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to update goal. Please try again." });
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