const mongoose = require("mongoose");

/* Each entry is one set performed for the exercise.
   No "set number" field — order in the array IS the set order. */
const workoutSetSchema = new mongoose.Schema(
  {
    weight: {
      type: Number,
      required: true,
    },

    reps: {
      type: Number,
      required: true,
    },
  },
  { _id: false } // sub-docs don't need their own id for our use case
);

const workoutSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    exercise: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exercise",
      required: true,
    },

    // replaces old sets / reps / weight trio
    workoutSets: {
      type: [workoutSetSchema],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "workoutSets must contain at least one set",
      },
    },

    date: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Workout", workoutSchema);