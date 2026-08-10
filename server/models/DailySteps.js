const mongoose = require("mongoose");

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

dailyStepsSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("DailySteps", dailyStepsSchema);
