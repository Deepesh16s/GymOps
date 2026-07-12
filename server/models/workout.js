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

// Cardio metric fields (Phase 8A). Every metric is optional — validation
// for WHICH metrics are required per activityType lives entirely in
// server/utils/validateWorkoutPayload.js, driven by
// server/constants/cardioMetadata.js. This subdocument just stores
// whatever was validated; it applies no requiredness of its own.
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
  },
  { _id: false }
);

const cardioSchema = new mongoose.Schema(
  {
    activityType: {
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

    // Phase 8A: distinguishes what kind of entry this Workout document
    // represents. Defaults to "strength" so every pre-Phase-8A document
    // (which has no entryType field at all) is read identically to
    // before — no migration required. This does NOT introduce a nested
    // entries structure; one Workout document still equals one session
    // entry, exactly as before. Multiple documents sharing a sessionId
    // still form one workout session.
    entryType: {
      type: String,
      enum: ["strength", "cardio"],
      default: "strength",
    },

    // Required for strength entries, absent/irrelevant for cardio
    // entries. Conditioned on entryType rather than removed, so
    // existing strength documents (entryType defaults to "strength")
    // keep exactly the same validation behavior as before.
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

    // Present only for entryType: "cardio" entries. Left undefined for
    // strength entries so existing documents/queries are unaffected.
    cardio: {
      type: cardioSchema,
      default: undefined,
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