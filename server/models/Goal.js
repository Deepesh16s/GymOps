const mongoose = require("mongoose");

/* The only goal types the app supports now. Anything in this list
   is calculated automatically from workout history; anything else
   (Weight, Cardio) is set/edited by the user. */
const AUTO_TYPES = [
  "Strength PR",
  "Weekly Workout",
  "Monthly Volume",
  "Current Streak",
];

const goalSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      required: true,
      trim: true,
    },

    target: {
      type: Number,
      required: true,
      min: 1,
    },

    current: {
      type: Number,
      default: 0,
      min: 0,
    },

    unit: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["In Progress", "Completed", "Behind"],
      default: "In Progress",
    },

    // FIX: was a free-typed String (had to exactly match an exercise
    // name via regex — fragile and silently broke on any mismatch).
    // Now a real reference to the Exercise document, same pattern
    // Workout.exercise already uses. Matching in updateGoals.js /
    // recalculateGoals.js is now a plain ObjectId comparison.
    exercise: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exercise",
      default: null,
    },

    deadline: {
      type: Date,
      default: null,
    },

    // Automatically decided based on goal type
    updateType: {
      type: String,
      enum: ["AUTO", "MANUAL"],
      default: "MANUAL",
    },

    // Last time current value changed
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// ❌ DO NOT USE next()
goalSchema.pre("save", function () {
  this.updateType = AUTO_TYPES.includes(this.type)
    ? "AUTO"
    : "MANUAL";

  this.lastUpdated = new Date();
});

module.exports = mongoose.model("Goal", goalSchema);