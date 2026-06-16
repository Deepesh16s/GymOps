const Exercise = require("../models/Exercise");

// Create Exercise
exports.createExercise = async (req, res) => {
  try {
    const { name, muscleGroup } = req.body;

    const exercise = await Exercise.create({
      name,
      muscleGroup,
      isDefault: false,
      createdBy: req.user._id,
    });

    res.status(201).json({
      message: "Exercise Created Successfully",
      exercise,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

// Get All Exercises or Filter by Muscle Group
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

    res.status(200).json(exercises);
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

// Update Exercise
exports.updateExercise = async (req, res) => {
  try {
    const exercise = await Exercise.findById(req.params.id);

    if (!exercise) {
      return res.status(404).json({
        message: "Exercise not found",
      });
    }

    // Default exercises cannot be edited
    if (exercise.isDefault) {
      return res.status(403).json({
        message: "Default exercises cannot be edited",
      });
    }

    // Only creator can edit
    if (
      exercise.createdBy.toString() !==
      req.user._id.toString()
    ) {
      return res.status(403).json({
        message: "You can edit only your own exercises",
      });
    }

    const updatedExercise =
      await Exercise.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
          new: true,
          runValidators: true,
        }
      );

    res.status(200).json({
      message: "Exercise Updated Successfully",
      exercise: updatedExercise,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

// Delete Exercise
exports.deleteExercise = async (req, res) => {
  try {
    const exercise = await Exercise.findById(
      req.params.id
    );

    if (!exercise) {
      return res.status(404).json({
        message: "Exercise not found",
      });
    }

    // Default exercises cannot be deleted
    if (exercise.isDefault) {
      return res.status(403).json({
        message: "Default exercises cannot be deleted",
      });
    }

    // Only creator can delete
    if (
      exercise.createdBy.toString() !==
      req.user._id.toString()
    ) {
      return res.status(403).json({
        message: "You can delete only your own exercises",
      });
    }

    await exercise.deleteOne();

    res.status(200).json({
      message: "Exercise Deleted Successfully",
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};