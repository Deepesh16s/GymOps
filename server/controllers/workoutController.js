const Workout = require("../models/workout");
const {
  updateGoalsForWorkout,
  updateGoalsForSession,
} = require("../utils/updateGoals");
const recalculateGoalsForExercise = require("../utils/recalculateGoals");
const {
  validateWorkoutPayload,
  validateWorkoutSets,
  validateSessionMeta,
} = require("../utils/validateWorkoutPayload");

exports.createWorkout = async (req, res) => {
  try {
    const { exercise, workoutSets, sessionId, sessionDuration } = req.body;

    validateWorkoutPayload({ workoutSets, sessionId, sessionDuration });

    const cleanSets = workoutSets.map((s) => ({
      weight: Number(s.weight),
      reps: Number(s.reps),
    }));

    const workout = await Workout.create({
      user: req.user._id,
      exercise,
      workoutSets: cleanSets,
      sessionId: sessionId.trim(),
      sessionDuration: Number(sessionDuration),
    });

    await updateGoalsForWorkout(req.user._id, exercise, cleanSets);

    res.status(201).json(workout);
  } catch (error) {
    console.log(error);

    res.status(error.status || 500).json({
      message: error.status ? error.message : "Server Error",
    });
  }
};

exports.createWorkoutSession = async (req, res) => {
  try {
    const { sessionId, sessionDuration, exercises } = req.body;

    validateSessionMeta(sessionId, sessionDuration);

    if (!Array.isArray(exercises) || exercises.length === 0) {
      const err = new Error("exercises must be a non-empty array");
      err.status = 400;
      throw err;
    }

    exercises.forEach((entry, i) => {
      if (!entry || !entry.exercise) {
        const err = new Error(`Exercise ${i + 1} is missing an exercise id`);
        err.status = 400;
        throw err;
      }

      validateWorkoutSets(entry.workoutSets);
    });

    const cleanExercises = exercises.map((entry) => ({
      exercise: entry.exercise,
      workoutSets: entry.workoutSets.map((s) => ({
        weight: Number(s.weight),
        reps: Number(s.reps),
      })),
    }));

    const trimmedSessionId = sessionId.trim();
    const numericSessionDuration = Number(sessionDuration);

    const docs = cleanExercises.map((entry) => ({
      user: req.user._id,
      exercise: entry.exercise,
      workoutSets: entry.workoutSets,
      sessionId: trimmedSessionId,
      sessionDuration: numericSessionDuration,
    }));

    const createdWorkouts = await Workout.insertMany(docs, {
      ordered: true,
    });

    let goalRecalculationFailed = false;

    try {
      await updateGoalsForSession(req.user._id, cleanExercises);
    } catch (goalError) {
      console.error("Goal recalculation failed:", goalError);
      goalRecalculationFailed = true;
    }

    if (goalRecalculationFailed) {
      return res.status(201).json({
        message:
          "Workout session saved successfully, but goal recalculation failed. Please refresh your Goals or recalculate them later.",
        workouts: createdWorkouts,
        goalRecalculationFailed: true,
      });
    }

    return res.status(201).json({
      message: "Workout session saved successfully.",
      workouts: createdWorkouts,
      goalRecalculationFailed: false,
    });
  } catch (error) {
    console.log(error);

    res.status(error.status || 500).json({
      message: error.status ? error.message : "Server Error",
    });
  }
};

exports.getWorkouts = async (req, res) => {
  try {
    const { page = 1, limit = 10, start, end } = req.query;

    let query = {
      user: req.user._id,
    };

    if (start && end) {
      query.createdAt = {
        $gte: new Date(start),
        $lte: new Date(end),
      };
    }

    const workouts = await Workout.find(query)
      .populate("exercise")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json(workouts);
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

exports.searchWorkouts = async (req, res) => {
  try {
    const { exercise } = req.query;

    const workouts = await Workout.find({
      user: req.user._id,
    }).populate("exercise");

    const filtered = workouts.filter((workout) =>
      workout.exercise.name.toLowerCase().includes(exercise.toLowerCase())
    );

    res.status(200).json(filtered);
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

exports.filterByMuscle = async (req, res) => {
  try {
    const { muscle } = req.query;

    const workouts = await Workout.find({
      user: req.user._id,
    }).populate("exercise");

    const filtered = workouts.filter(
      (workout) => workout.exercise.muscleGroup === muscle
    );

    res.status(200).json(filtered);
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

exports.updateWorkout = async (req, res) => {
  try {
    const workout = await Workout.findById(req.params.id);

    if (!workout) {
      return res.status(404).json({
        message: "Workout not found",
      });
    }

    if (workout.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({
        message: "Not authorized",
      });
    }

    if (req.body.workoutSets !== undefined) {
      validateWorkoutSets(req.body.workoutSets);

      req.body.workoutSets = req.body.workoutSets.map((s) => ({
        weight: Number(s.weight),
        reps: Number(s.reps),
      }));
    }

    const updatedWorkout = await Workout.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (
      req.body.workoutSets !== undefined ||
      req.body.exercise !== undefined
    ) {
      await updateGoalsForWorkout(
        req.user._id,
        updatedWorkout.exercise,
        updatedWorkout.workoutSets
      );
    }

    res.status(200).json(updatedWorkout);
  } catch (error) {
    console.log(error);

    res.status(error.status || 500).json({
      message: error.status ? error.message : "Server Error",
    });
  }
};

exports.deleteWorkout = async (req, res) => {
  try {
    const workout = await Workout.findById(req.params.id);

    if (!workout) {
      return res.status(404).json({
        message: "Workout not found",
      });
    }

    if (workout.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({
        message: "Not authorized",
      });
    }

    await workout.deleteOne();

    await recalculateGoalsForExercise(req.user._id, workout.exercise);

    res.status(200).json({
      message: "Workout deleted successfully",
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};