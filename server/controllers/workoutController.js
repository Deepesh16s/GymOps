const Workout = require("../models/workout");

// Create Workout
exports.createWorkout = async (req, res) => {
  try {
    const { exercise, sets, reps, weight } = req.body;

    const workout = await Workout.create({
      user: req.user._id,
      exercise,
      sets,
      reps,
      weight,
    });

    res.status(201).json(workout);
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
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

    const updatedWorkout = await Workout.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    res.status(200).json(updatedWorkout);
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
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