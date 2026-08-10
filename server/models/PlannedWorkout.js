const mongoose = require("mongoose");

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

    workoutType: {
      type: String,
      required: true,
    },

    cardioActivityType: {
      type: String,
      default: null,
    },

    scheduledDate: {
      type: Date,
      required: true,
      index: true,
    },

    scheduledTime: {
      type: String,
      default: null,
    },

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

    recurrence: {
      type: {
        type: String,
        enum: ["none", "daily", "weekly", "customWeekdays", "monthly"],
        default: "none",
      },
      weekdays: {
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

    recurrenceGroupId: {
      type: String,
      default: null,
      index: true,
    },

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
