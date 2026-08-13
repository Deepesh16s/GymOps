const mongoose = require("mongoose");

// One combined cursor per user covering the whole tracked record-type set —
// Health Connect's own Changes API accepts multiple record types per token,
// so there's no need to fragment this into one document per type.
const healthSyncStateSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    changesToken: {
      type: String,
      default: null,
    },

    lastSyncedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("HealthSyncState", healthSyncStateSchema);
