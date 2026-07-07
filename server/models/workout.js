const mongoose = require("mongoose");

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
  { _id: false }
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