const mongoose = require("mongoose");

// Phase 13D, Part B (section 7) — one document per browser/device push
// subscription. `endpoint` is globally unique (it's the browser's own
// push-service URL, not something scoped per user) — see
// controllers/pushController.js's register handler for why registration
// is an upsert-by-endpoint rather than a strict create: the same browser
// re-subscribing (or a different account logging into the same browser)
// updates the SAME document instead of erroring or leaving a stale
// duplicate, which is what actually makes "multiple browsers, multiple
// devices" (section 7) work — each physical browser has exactly one row
// here regardless of how many times it (re)registers.
const pushSubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    endpoint: {
      type: String,
      required: true,
      unique: true,
    },

    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },

    // Coarse device/browser label (from the request's User-Agent at
    // registration time) — purely descriptive, shown if the user ever
    // wants to see/manage which devices are subscribed. Never parsed or
    // relied on for any decision.
    userAgent: {
      type: String,
      default: null,
    },

    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PushSubscription", pushSubscriptionSchema);
