const mongoose = require("mongoose");

// References User._id only, never username — same rule as Follow.
const blockSchema = new mongoose.Schema(
  {
    blocker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    blocked: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

blockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });
// Serves "has X blocked me" checks from the blocked side.
blockSchema.index({ blocked: 1 });

module.exports = mongoose.model("Block", blockSchema);
