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

    // Phase 8B — Cardio Goal configuration. Only meaningful when
    // type === GOAL_TYPES.CARDIO. All three are optional/nullable so
    // legacy Cardio Goals (created before Phase 8B, or created/edited
    // without picking an activity/metric/period) continue to load and
    // behave exactly as before — see isAutoCardioGoal in
    // constants/goalTypes.js, the single place that decides whether a
    // given Cardio Goal is treated as automatic. No enum constraint at
    // the schema level here, mirroring customSessionType on the Workout
    // model: validation of these values happens in goalController.js,
    // not at the schema level.
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

goalSchema.pre("save", function (next) {
  // Phase 8B: updateType can no longer be derived from `type` alone for
  // Cardio Goal — isAutoCardioGoal checks this document's own
  // activityType/metric/period to decide. Every other type is unchanged,
  // still driven purely by AUTO_GOAL_TYPES membership.
  this.updateType =
    AUTO_GOAL_TYPES.includes(this.type) || isAutoCardioGoal(this)
      ? "AUTO"
      : "MANUAL";

  this.lastUpdated = new Date();

  next();
});

module.exports = mongoose.model("Goal", goalSchema);