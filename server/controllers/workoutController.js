const Workout = require("../models/workout");
const { updateGoalsForWorkout } = require("../utils/updateGoals");
const recalculateGoalsForExercise = require("../utils/recalculateGoals");

const validateWorkoutSets = (workoutSets) => {
  if (!Array.isArray(workoutSets) || workoutSets.length === 0) {
    const err = new Error("workoutSets must be a non-empty array");
    err.status = 400;
    throw err;
  }

  workoutSets.forEach((s, i) => {
    if (
      s.weight === undefined ||
      s.reps === undefined ||
      s.weight === null ||
      s.reps === null ||
      s.weight === "" ||
      s.reps === "" ||
      isNaN(Number(s.weight)) ||
      isNaN(Number(s.reps))
    ) {
      const err = new Error(`Set ${i + 1} needs a valid weight and reps`);
      err.status = 400;
      throw err;
    }

    const weight = Number(s.weight);
    const reps = Number(s.reps);

    if (weight < 0) {
      const err = new Error(`Set ${i + 1}: weight cannot be negative`);
      err.status = 400;
      throw err;
    }

    if (reps < 1) {
      const err = new Error(`Set ${i + 1}: reps must be at least 1`);
      err.status = 400;
      throw err;
    }

    if (!Number.isInteger(reps)) {
      const err = new Error(`Set ${i + 1}: reps must be a whole number`);
      err.status = 400;
      throw err;
    }
  });
};

// Session metadata validation (Phase 7). Every POST /workouts belonging to
// a Finish Workout action must include these — see useWorkoutSession.js.
const validateSessionMeta = (sessionId, sessionDuration) => {
  if (!sessionId || typeof sessionId !== "string" || !sessionId.trim()) {
    const err = new Error("sessionId is required");
    err.status = 400;
    throw err;
  }

  if (
    sessionDuration === undefined ||
    sessionDuration === null ||
    sessionDuration === "" ||
    isNaN(Number(sessionDuration)) ||
    Number(sessionDuration) < 0
  ) {
    const err = new Error("sessionDuration must be a valid number >= 0");
    err.status = 400;
    throw err;
  }
};

exports.createWorkout = async (req, res) => {
  try {
    const { exercise, workoutSets, sessionId, sessionDuration } = req.body;

    validateWorkoutSets(workoutSets);
    validateSessionMeta(sessionId, sessionDuration);

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
      { new: true, runValidators: true }
    );

    if (req.body.workoutSets !== undefined || req.body.exercise !== undefined) {
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