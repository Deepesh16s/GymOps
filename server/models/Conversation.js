const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length === 2,
        message: "A conversation must have exactly two participants",
      },
    },
    participantLow: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    participantHigh: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lastMessageAt: {
      type: Date,
      default: null,
    },
    lastMessagePreview: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

conversationSchema.index({ participantLow: 1, participantHigh: 1 }, { unique: true });
conversationSchema.index({ participants: 1, lastMessageAt: -1 });

conversationSchema.statics.canonicalPair = function canonicalPair(idA, idB) {
  const a = String(idA);
  const b = String(idB);
  return a < b ? [idA, idB] : [idB, idA];
};

module.exports = mongoose.model("Conversation", conversationSchema);
