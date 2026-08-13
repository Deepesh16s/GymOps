const mongoose = require("mongoose");

// References User._id only, never username — username is mutable and must
// never be a foreign key. Changing a username never requires touching this
// collection.
const followSchema = new mongoose.Schema(
  {
    follower: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    following: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Prevents duplicate relationships and serves "who does X follow" lookups.
followSchema.index({ follower: 1, following: 1 }, { unique: true });
// Serves "who follows X" (followers list) — the compound index above can't
// efficiently serve a query filtered by `following` alone.
followSchema.index({ following: 1 });

module.exports = mongoose.model("Follow", followSchema);
