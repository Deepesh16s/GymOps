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
exports.getWorkouts = async (req, res) => {
  try {
    const workouts = await Workout.find({
      user: req.user._id,
    }).populate("exercise");

    res.status(200).json(workouts);
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};