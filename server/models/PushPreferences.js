const mongoose = require("mongoose");

// Phase 13D, Part B (sections 5 & 10) — the one small slice of
// notification preferences that MUST live server-side, because the
// SERVER (not the browser tab) decides whether to send a push. This is
// deliberately separate from reminders/reminderPreferences.js's
// category on/off toggles (workout/recovery/cardio/planner/achievement/
// goal/streak) — those stay exactly where they are (client-side
// localStorage, gating what the reminder engine GENERATES) since that
// decision only ever needs to happen in the browser tab that's already
// open. This model only ever gates DELIVERY of an already-generated,
// already-eligible notification — never a second preferences system,
// just the one setting surface that couldn't work as localStorage.
const pushPreferencesSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    // Master switch — true only once the user has both granted browser
    // permission AND the client has successfully registered a push
    // subscription (see pushController.js's register endpoint, which
    // sets this alongside creating the PushSubscription document).
    pushEnabled: {
      type: Boolean,
      default: false,
    },

    // Section 10 — quiet hours. Times are plain "HH:mm" 24h strings
    // interpreted in the SERVER's local time (same convention this app
    // already uses for snooze's end-of-day math in
    // notificationController.js) — there is no per-user timezone field
    // on the User model to do better than that today; see the delivery
    // manager's own header comment for this disclosed limitation.
    quietHours: {
      enabled: { type: Boolean, default: false },
      start: { type: String, default: "22:00" },
      end: { type: String, default: "07:00" },
      // "allow" (no restriction — window configured but inert),
      // "criticalOnly" (only critical-priority pushes get through),
      // "suppressAll" (no pushes at all during the window). A separate
      // top-level `enabled: false` is "Off" (section 10's 4th state) —
      // it's not folded into this enum so turning quiet hours off
      // doesn't lose whatever mode/window the user had configured.
      mode: {
        type: String,
        enum: ["allow", "criticalOnly", "suppressAll"],
        default: "suppressAll",
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PushPreferences", pushPreferencesSchema);
