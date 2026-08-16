const mongoose = require("mongoose");
const { SESSION_TYPES } = require("../constants/sessionTypes");

const workoutSetSchema = new mongoose.Schema(
  {
    weight: {
      type: Number,
      required: true,
      min: [0, "Weight cannot be negative"],
    },

    reps: {
      type: Number,
      required: true,
      min: [1, "Reps must be at least 1"],
    },
  },
  { _id: false }
);

const cardioDataSchema = new mongoose.Schema(
  {
    duration: { type: Number, default: null },
    distance: { type: Number, default: null },
    speed: { type: Number, default: null },
    pace: { type: Number, default: null },
    incline: { type: Number, default: null },
    calories: { type: Number, default: null },
    cadence: { type: Number, default: null },
    resistance: { type: Number, default: null },
    heartRate: { type: Number, default: null },
    steps: { type: Number, default: null },
  },
  { _id: false }
);

const cardioSchema = new mongoose.Schema(
  {
    activityType: {
      type: String,
      default: null,
    },
    variant: {
      type: String,
      default: null,
    },
    data: {
      type: cardioDataSchema,
      default: () => ({}),
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
      index: true,
    },

    entryType: {
      type: String,
      enum: ["strength", "cardio"],
      default: "strength",
    },

    exercise: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exercise",
      required: function () {
        return this.entryType !== "cardio";
      },
    },

    workoutSets: {
      type: [workoutSetSchema],
      required: function () {
        return this.entryType !== "cardio";
      },
      validate: {
        validator: function (arr) {
          if (this.entryType === "cardio") return true;
          return Array.isArray(arr) && arr.length > 0;
        },
        message: "workoutSets must contain at least one set",
      },
    },

    cardio: {
      type: cardioSchema,
      default: undefined,
    },

    date: {
      type: Date,
      default: Date.now,
    },

    sessionId: {
      type: String,
      default: null,
      index: true,
    },

    sessionDuration: {
      type: Number,
      default: null,
      min: [0, "Session duration cannot be negative"],
    },

    startedAt: {
      type: Date,
      default: null,
    },

    endedAt: {
      type: Date,
      default: null,
    },

    timingMode: {
      type: String,
      enum: ["AUTO", "MANUAL"],
      default: "AUTO",
    },

    sessionType: {
      type: String,
      enum: SESSION_TYPES,
      default: null,
    },

    customSessionType: {
      type: String,
      default: null,
    },

    note: {
      type: String,
      default: null,
    },

    sessionNote: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

workoutSchema.index({ user: 1, exercise: 1 });

workoutSchema.index({ user: 1, createdAt: -1 });

workoutSchema.index({ user: 1, date: -1 });

module.exports = mongoose.model("Workout", workoutSchema);