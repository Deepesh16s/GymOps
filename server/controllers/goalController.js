const Goal = require("../models/Goal");
const Exercise = require("../models/Exercise");
const Workout = require("../models/workout");
const { getLatestSessionWorkouts } = require("../utils/updateGoals");

const MANUAL_TYPES = ["Cardio Goal", "Weight Goal"];

const startOfWeek = () => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMon);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const startOfMonth = () => {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
};

const workoutVolume = (w) =>
  (w.workoutSets || []).reduce((sum, s) => sum + s.reps * s.weight, 0);

const computeCurrentStreak = (workouts) => {
  if (!workouts.length) return 0;

  const dateStrings = new Set(
    workouts.map((w) => {
      const d = new Date(w.date || w.createdAt);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })
  );

  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  let streak = 0;

  while (true) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
    if (!dateStrings.has(key)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
};

exports.createGoal = async (req, res) => {
  try {
    const { title, type, target, unit, exercise, deadline } = req.body;

    if (
      !title ||
      !type ||
      target === undefined ||
      target === null ||
      !unit
    ) {
      return res.status(400).json({
        message: "All required fields must be provided",
      });
    }

    let exerciseDoc = null;

    if (type === "Strength PR") {
      if (!exercise) {
        return res.status(400).json({
          message: "Please select an exercise for a Strength PR goal",
        });
      }

      exerciseDoc = await Exercise.findOne({
        _id: exercise,
        createdBy: req.user._id,
      });

      if (!exerciseDoc) {
        return res.status(400).json({
          message: "Selected exercise was not found",
        });
      }
    }

    let current = 0;

    if (type === "Strength PR" && exerciseDoc) {
      const workouts = await Workout.find({
        user: req.user._id,
        exercise: exerciseDoc._id,
      });

      let maxWeight = 0;
      workouts.forEach((workout) => {
        (workout.workoutSets || []).forEach((set) => {
          const weight = Number(set.weight) || 0;
          if (weight > maxWeight) maxWeight = weight;
        });
      });

      current = maxWeight;
    } else if (type === "Weekly Workout Sessions") {
      const monday = startOfWeek();
      const weekWorkouts = await Workout.find({
        user: req.user._id,
        date: { $gte: monday },
        sessionId: { $exists: true, $nin: [null, ""] },
      }).select("sessionId");

      current = new Set(weekWorkouts.map((w) => w.sessionId)).size;
    } else if (type === "Monthly Workout Sessions") {
      const firstOfMonth = startOfMonth();
      const monthWorkouts = await Workout.find({
        user: req.user._id,
        date: { $gte: firstOfMonth },
        sessionId: { $exists: true, $nin: [null, ""] },
      }).select("sessionId");

      current = new Set(monthWorkouts.map((w) => w.sessionId)).size;
    } else if (type === "Weekly Volume Goal") {
      const monday = startOfWeek();
      const weekWorkouts = await Workout.find({
        user: req.user._id,
        date: { $gte: monday },
      });

      current = weekWorkouts.reduce((sum, w) => sum + workoutVolume(w), 0);
    } else if (type === "Monthly Volume Goal") {
      const firstOfMonth = startOfMonth();
      const monthWorkouts = await Workout.find({
        user: req.user._id,
        date: { $gte: firstOfMonth },
      });

      current = monthWorkouts.reduce((sum, w) => sum + workoutVolume(w), 0);
    } else if (
      type === "Session Exercise Goal" ||
      type === "Session Volume Goal" ||
      type === "Session Duration Goal"
    ) {
      // All three read the MOST RECENTLY FINISHED session, per product
      // decision — not a lifetime best.
      const sessionWorkouts = await getLatestSessionWorkouts(req.user._id);

      if (type === "Session Exercise Goal") {
        current = sessionWorkouts.length;
      } else if (type === "Session Volume Goal") {
        current = sessionWorkouts.reduce((sum, w) => sum + workoutVolume(w), 0);
      } else {
        current = sessionWorkouts[0]?.sessionDuration ?? 0;
      }
    } else if (type === "Current Streak") {
      const allWorkouts = await Workout.find({ user: req.user._id }).select(
        "date createdAt"
      );

      current = computeCurrentStreak(allWorkouts);
    } else if (MANUAL_TYPES.includes(type)) {
      // Cardio Goal / Weight Goal: no backing data source exists, so the
      // user supplies (and later edits) `current` directly.
      current =
        req.body.current !== undefined &&
        req.body.current !== null &&
        req.body.current !== ""
          ? Number(req.body.current)
          : 0;
    }

    const status =
      Number(current) >= Number(target) ? "Completed" : "In Progress";

    const goal = await Goal.create({
      user: req.user._id,
      title: title.trim(),
      type,
      target: Number(target),
      current,
      unit: unit.trim(),
      exercise: type === "Strength PR" ? exerciseDoc._id : null,
      deadline: deadline || null,
      status,
    });

    const populatedGoal = await goal.populate("exercise", "name muscleGroup");

    res.status(201).json(populatedGoal);
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

exports.getGoals = async (req, res) => {
  try {
    const goals = await Goal.find({
      user: req.user._id,
    })
      .populate("exercise", "name muscleGroup")
      .sort({ createdAt: -1 });

    res.status(200).json(goals);
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

exports.updateGoal = async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id);

    if (!goal) {
      return res.status(404).json({
        message: "Goal not found",
      });
    }

    if (goal.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({
        message: "Not authorized",
      });
    }

    const updates = { ...req.body };

    const willBeStrengthPR =
      updates.type === "Strength PR" ||
      (updates.type === undefined && goal.type === "Strength PR");

    if (willBeStrengthPR) {
      const exerciseId =
        updates.exercise !== undefined ? updates.exercise : goal.exercise;

      if (!exerciseId) {
        return res.status(400).json({
          message: "Please select an exercise for a Strength PR goal",
        });
      }

      const exerciseDoc = await Exercise.findOne({
        _id: exerciseId,
        createdBy: req.user._id,
      });

      if (!exerciseDoc) {
        return res.status(400).json({
          message: "Selected exercise was not found",
        });
      }

      updates.exercise = exerciseDoc._id;
    }

    // Manual types (Cardio Goal / Weight Goal) are edited via this same
    // endpoint — `current` passes through untouched here, same as it
    // always has for any other field.
    const mergedCurrent =
      updates.current !== undefined ? Number(updates.current) : goal.current;
    const mergedTarget =
      updates.target !== undefined ? Number(updates.target) : goal.target;

    updates.status =
      mergedCurrent >= mergedTarget ? "Completed" : "In Progress";

    const updatedGoal = await Goal.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate("exercise", "name muscleGroup");

    res.status(200).json(updatedGoal);
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

exports.deleteGoal = async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id);

    if (!goal) {
      return res.status(404).json({
        message: "Goal not found",
      });
    }

    if (goal.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({
        message: "Not authorized",
      });
    }

    await Goal.findByIdAndDelete(req.params.id);

    res.status(200).json({
      message: "Goal deleted successfully",
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};