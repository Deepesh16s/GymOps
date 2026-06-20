const Workout = require("../models/workout");
const updateGoalsForWorkout = require("../utils/updateGoals");
const recalculateGoalsForExercise = require("../utils/recalculateGoals");

/* small helper — keeps createWorkout/updateWorkout from duplicating
   the same checks. Throws a plain Error with a .status attached
   so the route handlers can just catch and respond. */
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
      isNaN(Number(s.weight)) ||
      isNaN(Number(s.reps))
    ) {
      const err = new Error(`Set ${i + 1} needs a valid weight and reps`);
      err.status = 400;
      throw err;
    }
  });
};

// Create Workout
exports.createWorkout = async (req, res) => {
  try {
    const { exercise, workoutSets } = req.body;

    validateWorkoutSets(workoutSets);

    // normalize to numbers in case the client sent strings
    const cleanSets = workoutSets.map((s) => ({
      weight: Number(s.weight),
      reps: Number(s.reps),
    }));

    const workout = await Workout.create({
      user: req.user._id,
      exercise,
      workoutSets: cleanSets,
    });

    // ── NEW: auto-update any goals tied to this exercise ──
    await updateGoalsForWorkout(req.user._id, exercise, cleanSets);

    res.status(201).json(workout);
  } catch (error) {
    console.log(error);

    res.status(error.status || 500).json({
      message: error.status ? error.message : "Server Error",
    });
  }
};

// Get All Workouts of Logged In User
exports.getWorkouts = async (
  req,
  res
) => {
  try {
    const {
      page = 1,
      limit = 10,
      start,
      end,
    } = req.query;

    let query = {
      user: req.user._id,
    };

    if (start && end) {
      query.createdAt = {
        $gte: new Date(start),
        $lte: new Date(end),
      };
    }

    const workouts =
      await Workout.find(query)
        .populate("exercise")
        .sort({
          createdAt: -1,
        })
        .skip(
          (page - 1) * limit
        )
        .limit(Number(limit));

    res.status(200).json(
      workouts
    );
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message:
        "Server Error",
    });
  }
};
// Search Workouts
exports.searchWorkouts = async (
  req,
  res
) => {
  try {
    const { exercise } =
      req.query;

    const workouts =
      await Workout.find({
        user: req.user._id,
      }).populate("exercise");

    const filtered =
      workouts.filter(
        (workout) =>
          workout.exercise.name
            .toLowerCase()
            .includes(
              exercise.toLowerCase()
            )
      );

    res.status(200).json(
      filtered
    );
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message:
        "Server Error",
    });
  }
};
// Filter By Muscle
exports.filterByMuscle = async (
  req,
  res
) => {
  try {
    const { muscle } =
      req.query;

    const workouts =
      await Workout.find({
        user: req.user._id,
      }).populate("exercise");

    const filtered =
      workouts.filter(
        (workout) =>
          workout.exercise.muscleGroup ===
          muscle
      );

    res.status(200).json(
      filtered
    );
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message:
        "Server Error",
    });
  }
};

// Update Workout
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

    // only validate workoutSets if the caller is actually changing them —
    // partial updates (e.g. just swapping exercise) shouldn't require it
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

    // ── NEW: if the sets or the exercise itself changed, the PR may
    // have moved — let goals react to it the same way creation does ──
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

// Delete Workout
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

    // ── NEW: weight that was the PR may have just been deleted —
    // recompute this exercise's goals from what's left ──
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