const mongoose = require("mongoose");

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