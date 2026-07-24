const mongoose = require("mongoose");

// One document per user per calendar day — a plain "set today's total"
// log, deliberately NOT a Workout entry. Steps are an all-day passive
// count (from a phone/watch), not something a user logs per session the
// way distance/duration are; see server/constants/cardioMetadata.js's
// note on the optional `steps` cardio.data field for the one place the
// two intentionally overlap (a Daily Steps goal merges both sources).
//
// `date` is a local "YYYY-MM-DD" string, not a Date — matches the
// pattern client/src/pages/Calendar.jsx already uses (getLocalDateKey)
// for day-bucketing, so "today" always means the user's own local day
// rather than being subject to UTC/server-timezone drift. The client is
// the one source of truth for what "today" is; this model just stores
// whatever key it's given.
const dailyStepsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    date: {
      type: String,
      required: true,
    },

    steps: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// One entry per user per day — "set today's total" is an upsert against
// this pair, never an append.
dailyStepsSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("DailySteps", dailyStepsSchema);
