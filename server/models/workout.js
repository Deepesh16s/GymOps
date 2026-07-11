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

const workoutSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
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

    // Session metadata (Phase 7). Not schema-required so legacy documents
    // and any partial updates on them continue to validate cleanly.
    // Presence is enforced at the controller level for new workouts
    // created via a Finish Workout action — see workoutController.createWorkout.
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

    // Session Type metadata (Phase 8). Session-level metadata, identical
    // across every workout document belonging to the same sessionId —
    // mirrors how sessionId/sessionDuration are broadcast to the whole
    // group. Not schema-required so legacy documents without these
    // fields continue to validate and load exactly as before.
    sessionType: {
      type: String,
      enum: SESSION_TYPES,
      default: null,
    },

    // Only meaningful when sessionType === "Other". Enforced at the
    // controller/validation level, not here, so this field stays
    // optional at the schema level like sessionType above.
    customSessionType: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

workoutSchema.index({ user: 1, exercise: 1 });

module.exports = mongoose.model("Workout", workoutSchema);