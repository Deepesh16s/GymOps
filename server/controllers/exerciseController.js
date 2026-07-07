const Exercise = require("../models/Exercise");

// ================= CREATE EXERCISE =================

exports.createExercise = async (req, res) => {
  try {
    const { name, muscleGroup } = req.body;

    if (!name || !muscleGroup) {
      return res.status(400).json({
        message: "Name and muscle group are required",
      });
    }

    // ── normalize: trim + lowercase, so "Bench Press", "bench press",
    // "BENCH PRESS", and "  Bench Press" are all treated as duplicates.
    // This mirrors Exercise.normalizedName exactly (kept in sync by the
    // model's pre("validate") hook), so we can query it directly. ──
    const normalizedName = name.trim().toLowerCase();

    if (!normalizedName) {
      return res.status(400).json({
        message: "Name and muscle group are required",
      });
    }

    // FIX: was `$or: [{ isDefault: true }, { createdBy: req.user._id }]`.
    // Since every user gets their OWN seeded copy of default exercises
    // at registration (isDefault: true, createdBy: thatUser._id), the
    // isDefault branch was matching EVERY user's default exercises, not
    // just the current user's — causing duplicate/cross-user exercise
    // documents to be treated as "existing" for everyone. createdBy
    // alone already covers a user's own defaults + custom exercises.
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

    // Defensive: if a race condition let two identical creates through
    // app-level checks, the unique index on Exercise.js will reject
    // the second one at the DB layer with a duplicate-key error.
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

// ================= GET EXERCISES =================

exports.getExercises = async (req, res) => {
  try {
    const { muscleGroup } = req.query;

    // FIX: same scoping fix as createExercise — only this user's own
    // exercises (defaults + custom), not every user's defaults.
    const filter = {
      createdBy: req.user._id,
    };

    if (muscleGroup) {
      filter.muscleGroup = muscleGroup;
    }

    const exercises = await Exercise.find(filter).sort({ name: 1 });

    // ── dedupe by normalizedName so the dropdown never shows the same
    // exercise twice, even if duplicates still exist in the database
    // from before this fix ──
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

// ================= UPDATE EXERCISE =================

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

    const updatedExercise = await Exercise.findByIdAndUpdate(
      req.params.id,
      req.body,
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

// ================= DELETE EXERCISE =================

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