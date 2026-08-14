const mongoose = require("mongoose");

const MAX_MESSAGE_LENGTH = 2000;

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

messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ conversation: 1, readAt: 1 });

messageSchema.statics.MAX_MESSAGE_LENGTH = MAX_MESSAGE_LENGTH;

module.exports = mongoose.model("Message", messageSchema);
