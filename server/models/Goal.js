const mongoose = require("mongoose");
const { AUTO_GOAL_TYPES, isAutoCardioGoal } = require("../constants/goalTypes");

const goalSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
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
      index: true,
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

    activityType: {
      type: String,
      default: null,
    },

    metric: {
      type: String,
      default: null,
    },

    period: {
      type: String,
      default: null,
    },

    dailyTarget: {
      type: Number,
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

    direction: {
      type: String,
      enum: ["gain", "loss", null],
      default: null,
    },

    startingValue: {
      type: Number,
      default: null,
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
  this.updateType =
    AUTO_GOAL_TYPES.includes(this.type) || isAutoCardioGoal(this)
      ? "AUTO"
      : "MANUAL";

  this.lastUpdated = new Date();
});

module.exports = mongoose.model("Goal", goalSchema);