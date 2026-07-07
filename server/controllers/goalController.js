const Goal = require("../models/Goal");
const Exercise = require("../models/Exercise");
const Workout = require("../models/workout");

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
    } else if (type === "Weekly Workout") {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(today);
      monday.setDate(today.getDate() + diffToMon);
      monday.setHours(0, 0, 0, 0);

      const workoutCount = await Workout.countDocuments({
        user: req.user._id,
        date: { $gte: monday },
      });

      current = workoutCount;
    } else if (type === "Monthly Volume") {
      const firstOfMonth = new Date();
      firstOfMonth.setDate(1);
      firstOfMonth.setHours(0, 0, 0, 0);

      const monthWorkouts = await Workout.find({
        user: req.user._id,
        date: { $gte: firstOfMonth },
      });

      let monthlyVolume = 0;
      monthWorkouts.forEach((workout) => {
        (workout.workoutSets || []).forEach((set) => {
          const weight = Number(set.weight) || 0;
          const reps = Number(set.reps) || 0;
          monthlyVolume += weight * reps;
        });
      });

      current = monthlyVolume;
    } else if (type === "Current Streak") {
      const allWorkouts = await Workout.find({ user: req.user._id }).select(
        "date createdAt"
      );

      if (allWorkouts.length) {
        const dateStrings = new Set(
          allWorkouts.map((w) => {
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

        current = streak;
      } else {
        current = 0;
      }
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