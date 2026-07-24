const mongoose = require("mongoose");

// Phase 13A — Smart Notification Center. One document per meaningful
// event (PR, goal completion, streak milestone, ...), never a generic
// "activity log" entry — see server/utils/notificationService.js's
// createNotificationIfNew for the dedup rule that keeps this true.
//
// `type`/`category`/`icon`/`navigationTarget` are plain strings, not
// enums enforced at the schema level — mirrors Workout's
// customSessionType/cardio.activityType precedent: the allowed-values
// list lives in constants/notificationTypes.js (validated there, not
// here), so adding a new notification type later is a constants-file
// change, not a migration.
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

    // Phase 13C — "critical" added for reminders the user must not miss
    // (overdue workout, streak ending today, goal expiring today).
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },

    // Phase 13D, Part A.1 — Reminder Confidence: how certain the
    // underlying rule is, NOT how urgent it is (that's `priority`).
    // Informational only, purely derived from which rule produced this
    // notification (see constants/notificationTypes.js's TYPE_CONFIDENCE)
    // — never fabricated per-instance. Null is valid: a handful of types
    // (e.g. achievements, which are simple factual comparisons) don't
    // carry enough ambiguity for a confidence label to mean anything.
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

    // Where the notification's action button (if any) navigates to —
    // a client-side route path, e.g. "/progression?exercise=Bench%20Press".
    // Null for notifications with nothing to deep-link to. Kept alongside
    // `action` below (13C.1) as the literal, ready-to-navigate path — the
    // client never has to reconstruct a URL from `action` itself, just
    // read `navigationTarget` as before; `action` is what the DESTINATION
    // page reads to know what to focus once it arrives.
    navigationTarget: {
      type: String,
      default: null,
    },

    // Phase 13C.1 — Deep Links: structured "what to do on arrival",
    // distinct from navigationTarget's "where to go". `page` mirrors
    // navigationTarget's base path, `entityId` is whatever the
    // destination page needs to find the right thing (a sessionId, a
    // goalId, a calendar date key), and `focus` names the behavior
    // ("expandSession" / "scrollToGoal" / "date"). Null (the whole
    // subdocument, or just `focus`) for notifications with nothing
    // specific to focus on arrival (e.g. Weekly Volume Increased just
    // opens Analytics with nothing to point at).
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

    // Phase 13C.1 — when `dismissed` last flipped true (by the user's
    // own dismiss/clear-read action, OR by expiry's auto-dismiss — see
    // getNotifications). This is what the regeneration cooldown in
    // notificationService.js measures from; it is NOT the same as
    // `updatedAt`, which also changes on unrelated updates (read, snooze).
    dismissedAt: {
      type: Date,
      default: null,
    },

    // Phase 13C.1 — what "newest first" actually sorts/displays by.
    // Mongoose's `timestamps: true` plugin silently protects `createdAt`
    // from any manual override (confirmed: both `.save()` and
    // `findOneAndUpdate` ignore an explicit createdAt in the update), so
    // a regenerated reminder (same document, reused after a cooldown —
    // see notificationService.js) needs its OWN "when did this become
    // relevant again" field to bubble back to the top of the list and
    // show a fresh "Just now" instead of its original creation time.
    lastShownAt: {
      type: Date,
      default: Date.now,
    },

    // Phase 13D, Part B (section 14) — lightweight push delivery
    // analytics, stamped directly on the notification that WAS (or
    // wasn't) delivered as a push, rather than a separate analytics
    // collection — there's no per-notification history to track beyond
    // "did this get pushed, clicked, or fail," so one row per
    // notification is all "lightweight" needs to mean here. `Delivered`/
    // `Expired`/`Permission denied` are read off pushSentAt/expiresAt/
    // PushPreferences.pushEnabled directly rather than each needing
    // their own stored flag.
    pushSentAt: { type: Date, default: null },
    pushClickedAt: { type: Date, default: null },
    pushFailedAt: { type: Date, default: null },

    // Phase 13C — snooze system (section 11): "Snooze today"/"Snooze
    // tomorrow" set this to end-of-today/end-of-tomorrow rather than
    // deleting or dismissing the notification — getNotifications below
    // simply excludes anything still snoozed, and it reappears in the
    // list on its own once this timestamp passes (no scheduler needed,
    // same lazy-eval-on-read pattern as PlannedWorkout's flipOverdueToMissed).
    snoozedUntil: {
      type: Date,
      default: null,
    },

    // Phase 13C — notification expiry (section 12): a workout reminder
    // should stop showing once its window has passed even if the user
    // never dismissed it (e.g. "starts in 1 hour" is meaningless after
    // the hour passes). Null means "never expires" (achievements persist
    // indefinitely, per section 12). Checked lazily at read time in
    // getNotifications, not by a background job.
    expiresAt: {
      type: Date,
      default: null,
    },

    // Phase 13C — free-form context a reminder's action needs but that
    // doesn't belong in the generic fields above (e.g. plannedWorkoutId
    // for "Mark complete", muscle names for a grouped recovery reminder,
    // severity for a neglect reminder). Never interpreted by the server
    // beyond passthrough — same "client computes, server persists" split
    // as the rest of this notification pipeline.
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // The identity key for "this logical reminder" — e.g. "streak:60",
    // "goal:64f...", "recovery:chest", "planner:64f...". Unique per user
    // via the compound index below, NOT globally unique (two different
    // users can each reach a "60-day streak" independently).
    //
    // Phase 13C.1 — deliberately STABLE (no date/week baked in for most
    // types) rather than rolling over on a schedule: identity ("which
    // real-world thing is this about") and regeneration TIMING ("when is
    // it OK to show this again after a dismiss") are now two separate
    // concerns. See notificationService.js's createNotificationIfNew for
    // how a dismissed document with the same dedupeKey is reused
    // (cooldown-gated) rather than a fresh insert being attempted.
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
