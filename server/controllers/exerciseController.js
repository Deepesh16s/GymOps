const Exercise = require("../models/Exercise");

exports.createExercise = async (req, res) => {
  try {
    const { name, muscleGroup } = req.body;

    const exercise = await Exercise.create({
      name,
      muscleGroup,
      isDefault: false,
      createdBy: req.user._id,
    });

    res.status(201).json(exercise);

  } catch (error) {
    res.status(500).json({
      message: "Server Error",
    });
  }
};
exports.getExercises = async (req, res) => {
  try {
    const { muscleGroup } = req.query;

    let exercises;

    if (muscleGroup) {
      exercises = await Exercise.find({
        muscleGroup,
      });
    } else {
      exercises = await Exercise.find();
    }

    res.json(exercises);

  } catch (error) {
    res.status(500).json({
      message: "Server Error",
    });
  }
};