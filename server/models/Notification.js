const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: {
      type: String,
      required: true,
    },

    category: {
      type: String,
      required: true,
      index: true,
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },

    confidence: {
      type: String,
      enum: ["low", "medium", "high"],
      default: null,
    },

    icon: {
      type: String,
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    subtitle: {
      type: String,
      default: null,
      trim: true,
    },

    navigationTarget: {
      type: String,
      default: null,
    },

    action: {
      page: { type: String, default: null },
      entityId: { type: String, default: null },
      focus: { type: String, default: null },
    },

    read: {
      type: Boolean,
      default: false,
    },

    dismissed: {
      type: Boolean,
      default: false,
    },

    dismissedAt: {
      type: Date,
      default: null,
    },

    lastShownAt: {
      type: Date,
      default: Date.now,
    },

    pushSentAt: { type: Date, default: null },
    pushClickedAt: { type: Date, default: null },
    pushFailedAt: { type: Date, default: null },

    snoozedUntil: {
      type: Date,
      default: null,
    },

    expiresAt: {
      type: Date,
      default: null,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    dedupeKey: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ user: 1, dedupeKey: 1 }, { unique: true });
notificationSchema.index({ user: 1, read: 1, dismissed: 1, lastShownAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
