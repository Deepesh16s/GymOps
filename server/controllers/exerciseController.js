const Exercise = require("../models/Exercise");
const { MUSCLES } = require("../constants/muscles");

exports.createExercise = async (req, res) => {
  try {
    const { name, muscleGroup } = req.body;

    if (!name || !muscleGroup) {
      return res.status(400).json({
        message: "Name and muscle group are required",
      });
    }

    // Legacy "Legs" (and any other unrecognized value) is intentionally
    // rejected here — it's only ever accepted on already-existing
    // documents, never as a choice for newly created exercises.
    if (!MUSCLES.includes(muscleGroup)) {
      return res.status(400).json({
        message: "Invalid muscle group",
      });
    }

    const normalizedName = name.trim().toLowerCase();

    if (!normalizedName) {
      return res.status(400).json({
        message: "Name and muscle group are required",
      });
    }

    const exerciseExists = await Exercise.findOne({
      normalizedName,
      createdBy: req.user._id,
    });

    if (exerciseExists) {
      return res.status(400).json({
        message: "Exercise already exists",
      });
    }

    const exercise = await Exercise.create({
      name: name.trim(),
      muscleGroup,
      isDefault: false,
      createdBy: req.user._id,
    });

    res.status(201).json(exercise);
  } catch (error) {
    console.log(error);

    if (error.code === 11000) {
      return res.status(400).json({
        message: "Exercise already exists",
      });
    }

    res.status(500).json({
      message: error.message,
    });
  }
};

exports.getExercises = async (req, res) => {
  try {
    const { muscleGroup } = req.query;

    const filter = {
      createdBy: req.user._id,
    };

    if (muscleGroup) {
      filter.muscleGroup = muscleGroup;
    }

    const exercises = await Exercise.find(filter).sort({ name: 1 });

    const seen = new Set();
    const unique = [];

    exercises.forEach((ex) => {
      const key = ex.normalizedName || ex.name.trim().toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(ex);
      }
    });

    res.status(200).json(unique);
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

exports.updateExercise = async (req, res) => {
  try {
    const exercise = await Exercise.findById(req.params.id);

    if (!exercise) {
      return res.status(404).json({
        message: "Exercise not found",
      });
    }

    if (exercise.isDefault) {
      return res.status(403).json({
        message: "Default exercises cannot be edited",
      });
    }

    if (exercise.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "You can edit only your own exercises",
      });
    }

    // Only name/muscleGroup are editable here — previously the entire
    // req.body (including createdBy/isDefault) was passed straight into
    // findByIdAndUpdate, which let a request reassign an exercise's
    // ownership. Whitelisting closes that hole.
    const updates = {};
    if (req.body.name !== undefined) {
      updates.name = req.body.name.trim();
      // findByIdAndUpdate is a query-level operation, so the model's
      // pre("validate") hook (which derives normalizedName from name)
      // never runs here — it only fires on .save()/.create(). Without
      // this, normalizedName goes stale after a rename, causing false
      // "Exercise already exists" collisions against the renamed doc.
      updates.normalizedName = req.body.name.trim().toLowerCase();
    }
    if (req.body.muscleGroup !== undefined) {
      if (!MUSCLES.includes(req.body.muscleGroup)) {
        return res.status(400).json({
          message: "Invalid muscle group",
        });
      }
      updates.muscleGroup = req.body.muscleGroup;
    }

    const updatedExercise = await Exercise.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      message: "Exercise Updated Successfully",
      exercise: updatedExercise,
    });
  } catch (error) {
    console.log(error);

    if (error.code === 11000) {
      return res.status(400).json({
        message: "Exercise already exists",
      });
    }

    res.status(500).json({
      message: "Server Error",
    });
  }
};

exports.deleteExercise = async (req, res) => {
  try {
    const exercise = await Exercise.findById(req.params.id);

    if (!exercise) {
      return res.status(404).json({
        message: "Exercise not found",
      });
    }

    if (exercise.isDefault) {
      return res.status(403).json({
        message: "Default exercises cannot be deleted",
      });
    }

    if (exercise.createdBy.toString() !== req.user._id.toString()) {
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