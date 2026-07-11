const mongoose = require("mongoose");

// Types the backend auto-calculates from Workout data. Anything not in
// this list (Cardio Goal, Weight Goal) is MANUAL — the user sets `current`
// themselves via create/edit, since no backing data source exists for them.
const AUTO_TYPES = [
  "Strength PR",
  "Weekly Workout Sessions",
  "Monthly Workout Sessions",
  "Weekly Volume Goal",
  "Monthly Volume Goal",
  "Session Exercise Goal",
  "Session Volume Goal",
  "Session Duration Goal",
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

    exercise: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exercise",
      default: null,
    },

    deadline: {
      type: Date,
      default: null,
    },

    updateType: {
      type: String,
      enum: ["AUTO", "MANUAL"],
      default: "MANUAL",
    },

    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

goalSchema.pre("save", function () {
  this.updateType = AUTO_TYPES.includes(this.type)
    ? "AUTO"
    : "MANUAL";

  this.lastUpdated = new Date();
});

module.exports = mongoose.model("Goal", goalSchema);