const mongoose = require("mongoose");

// Phase 13B — a planned/scheduled workout. Deliberately its OWN model,
// never mixed with Workout: a plan is an intention ("Push day, ~65 min,
// 7 exercises") with no logged sets/reps/weight, while a Workout is a
// completed record of what actually happened. Blending the two would
// make every strength/volume/PR computation across the app (goalMetrics,
// progressionEngine, dashboardInsights, ...) have to defensively check
// "is this real or just planned" — see workoutConversion.js for the one
// place a completed PlannedWorkout links to the real Workout session it
// produced (via completedSessionId), which is as close as the two
// domains ever get.
const plannedWorkoutSchema = new mongoose.Schema(
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

    // Reuses the same Session Type vocabulary Workout/StartWorkoutModal
    // already use (Push/Pull/Legs/.../Cardio/Other) — a planned workout
    // schedules the same "kind of day" a completed session already has,
    // not a separate taxonomy.
    workoutType: {
      type: String,
      required: true,
    },

    // Only meaningful when workoutType === "Cardio" — which cardio
    // activity this planned session is for (Running/Cycling/...). Optional
    // even then; a plan can just say "Cardio" with no specific activity
    // chosen yet.
    cardioActivityType: {
      type: String,
      default: null,
    },

    // Midnight-normalized calendar day this workout is scheduled for —
    // same "date-only, bucket client-side" convention
    // dashboard/calendar-workouts already uses for completed Workouts.
    scheduledDate: {
      type: Date,
      required: true,
      index: true,
    },

    // "HH:mm", optional — a plan doesn't have to commit to a specific
    // time of day.
    scheduledTime: {
      type: String,
      default: null,
    },

    // Which exercises this plan intends to cover — optional (a plan can
    // just be "Push Day" with nothing itemized yet), and deliberately
    // NOT workoutSets: a plan has no weight/reps, only an exercise and
    // optionally how many sets are intended.
    exercises: {
      type: [
        {
          exercise: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Exercise",
            required: true,
          },
          targetSets: {
            type: Number,
            default: null,
          },
          notes: {
            type: String,
            default: null,
            trim: true,
          },
        },
      ],
      default: [],
      _id: false,
    },

    estimatedDuration: {
      type: Number,
      default: null,
    },

    notes: {
      type: String,
      default: null,
      trim: true,
    },

    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
    },

    // Recurrence is a plain descriptor stored on every generated
    // instance (not a separate "rule" collection) — see
    // utils/plannedWorkoutRecurrence.js for how instances sharing a
    // recurrenceGroupId are generated/edited/cancelled together.
    // type "none" means this single instance has no recurrence at all.
    recurrence: {
      type: {
        type: String,
        enum: ["none", "daily", "weekly", "customWeekdays", "monthly"],
        default: "none",
      },
      weekdays: {
        // 0 (Sun) - 6 (Sat); meaningful for "weekly" (one day) and
        // "customWeekdays" (several).
        type: [Number],
        default: [],
      },
      interval: {
        type: Number,
        default: 1,
      },
      endDate: {
        type: Date,
        default: null,
      },
    },

    // Shared by every concrete instance generated from the same
    // recurring schedule — null for a genuinely one-off plan. This is
    // what "edit future workouts" / "edit entire series" key off.
    recurrenceGroupId: {
      type: String,
      default: null,
      index: true,
    },

    // Set once this plan's session is actually logged — the sessionId
    // shared across every Workout document that session produced (a
    // session has no single Workout _id of its own, so this points at
    // Workout.sessionId, not a Workout document). Null until completion.
    completedSessionId: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: ["Planned", "Completed", "Missed", "Cancelled"],
      default: "Planned",
      index: true,
    },

    // Incremented on every /reschedule call — Planner Analytics' "Rescheduled"
    // count is a real, tracked figure rather than inferred from date drift.
    rescheduleCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

plannedWorkoutSchema.index({ user: 1, scheduledDate: 1 });

module.exports = mongoose.model("PlannedWorkout", plannedWorkoutSchema);
