const mongoose = require("mongoose");

const MAX_MESSAGE_LENGTH = 2000;

// Text-only for this phase — no attachments/images/voice. `sender` is an
// ObjectId ref, always derived server-side from the authenticated request,
// never trusted from the client body. `readAt` is per-message (set only on
// messages the reader did not send) rather than a conversation-level cursor,
// so read receipts stay accurate per message without a second model.
const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Not `required` at the schema level even though a message is never
    // created with an empty body — the controller enforces that on create.
    // Soft-deleting a message clears body to "", which `required: true`
    // would reject on save.
    body: {
      type: String,
      trim: true,
      maxlength: MAX_MESSAGE_LENGTH,
      default: "",
    },
    readAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Paginated history fetch, newest-first.
messageSchema.index({ conversation: 1, createdAt: -1 });
// Unread-count aggregation and bulk mark-as-read.
messageSchema.index({ conversation: 1, readAt: 1 });

messageSchema.statics.MAX_MESSAGE_LENGTH = MAX_MESSAGE_LENGTH;

module.exports = mongoose.model("Message", messageSchema);
