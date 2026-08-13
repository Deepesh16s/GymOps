const mongoose = require("mongoose");

// Strictly 1-to-1. `participantLow`/`participantHigh` hold the same two
// ObjectIds as `participants` but in a deterministic (string-sorted) order,
// so the pair (A, B) and (B, A) always normalize to one row — the unique
// index below is what actually prevents duplicate conversations. Never key
// anything here off username: it is mutable and must never break an
// existing conversation.
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

// The actual duplicate-pair guarantee — same role as Follow/Block's unique
// compound indexes, just on a canonically-ordered pair instead of a
// directional one.
conversationSchema.index({ participantLow: 1, participantHigh: 1 }, { unique: true });
// Serves "list my conversations" (multikey on the array — not the unique
// index above, which only matches the pair as a whole).
conversationSchema.index({ participants: 1, lastMessageAt: -1 });

// Deterministic ordering helper — every creation/lookup path must go through
// this so the same pair always resolves to the same canonical row.
conversationSchema.statics.canonicalPair = function canonicalPair(idA, idB) {
  const a = String(idA);
  const b = String(idB);
  return a < b ? [idA, idB] : [idB, idA];
};

module.exports = mongoose.model("Conversation", conversationSchema);
