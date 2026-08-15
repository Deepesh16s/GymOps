const mongoose = require("mongoose");
const { REACTION_TARGET_TYPES, REACTION_TYPES } = require("../constants/reactionTypes");

const reactionSchema = new mongoose.Schema(
  {
    targetType: {
      type: String,
      enum: REACTION_TARGET_TYPES,
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: REACTION_TYPES,
      required: true,
    },
  },
  { timestamps: true }
);

reactionSchema.index({ targetType: 1, targetId: 1, user: 1 }, { unique: true });
reactionSchema.index({ targetType: 1, targetId: 1 });
reactionSchema.index({ user: 1 });

module.exports = mongoose.model("Reaction", reactionSchema);
