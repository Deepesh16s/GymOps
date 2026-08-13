const mongoose = require("mongoose");

const healthConnectionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    platform: {
      type: String,
      enum: ["android"],
      default: "android",
    },

    connected: {
      type: Boolean,
      default: true,
    },

    connectedAt: {
      type: Date,
      default: Date.now,
    },

    disconnectedAt: {
      type: Date,
      default: null,
    },

    // Record types the companion app reported as granted at connect time.
    // Informational only — the source of truth for "can we currently read X"
    // always lives on-device in Health Connect, not here.
    grantedRecordTypes: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("HealthConnection", healthConnectionSchema);
