// Phase 13A — the single place every notification gets created,
// regardless of which write path triggered it (workoutController.js's
// PR/session-stat checks, updateGoals.js's goal/streak recalculation,
// or a client-triggered dashboard-insight check). Centralizing this is
// what section 7's "avoid spam" / "centralize generation logic"
// requirement actually means in code: no controller ever constructs a
// Notification document by hand.
//
// PURE-ish module: only touches the Notification model, no other
// domain model. Callers pass in whatever they've already computed via
// existing engines (goalMetrics.js, cardio engines, etc.) — this file
// never recomputes a PR, a goal's progress, or a streak itself.
//
// Phase 13C.1 — Notification Deduplication Window: dedupeKey is now a
// STABLE identity ("which real-world thing is this"), not something
// that rolls over on a schedule to force regeneration. So a dismissed
// notification's document is REUSED (not re-inserted) the next time its
// dedupeKey recurs, gated by two rules:
//   1. If the new content is IDENTICAL to what was dismissed, respect a
//      cooldown window (default 24h) before showing it again — "dismiss
//      a recovery reminder, refresh immediately, it stays gone."
//   2. If the content has genuinely CHANGED (e.g. a goal's remaining
//      amount), the cooldown is bypassed — "only regenerate after
//      meaningful progress changed," not a blanket 24h mute.
// Comparing title+subtitle text is a deliberately generic definition of
// "meaningful change" that works for every reminder type without each
// generator having to hand-roll its own value-tracking.
const Notification = require("../models/Notification");
const { TYPE_CONFIDENCE } = require("../constants/notificationTypes");
const { deliverPushIfEligible } = require("./pushDeliveryManager");

// Phase 13D, Part B — fire-and-forget browser push, called right after a
// notification is actually created or regenerated (never on the "still
// active, no-op" path — see the two call sites below). A push failure
// must never affect the notification-creation response, same discipline
// every other side effect in this codebase already follows.
async function deliverPushSafely(userId, doc) {
  try {
    await deliverPushIfEligible(userId, doc);
  } catch (error) {
    console.error("Push delivery failed:", error);
  }
}

const MONGO_DUPLICATE_KEY_ERROR = 11000;
const DEFAULT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// Phase 13D, Part A.1 — Reminder Confidence resolved HERE, the one place
// every server-triggered notification is built, exactly mirroring how
// the client's reminders/reminderEngine.js resolves `priority` as a
// fallback layer rather than every individual detector in
// notificationTriggers.js having to stamp it by hand. A caller can still
// pass an explicit `confidence` (none currently do) to override the
// type-level default.
function buildFields(userId, payload) {
  return {
    user: userId,
    type: payload.type,
    category: payload.category,
    priority: payload.priority || "medium",
    confidence: payload.confidence || TYPE_CONFIDENCE[payload.type] || null,
    icon: payload.icon,
    title: payload.title,
    subtitle: payload.subtitle || null,
    navigationTarget: payload.navigationTarget || null,
    action: payload.action || null,
    dedupeKey: payload.dedupeKey,
    expiresAt: payload.expiresAt || null,
    metadata: payload.metadata || null,
  };
}

function contentUnchanged(existing, payload) {
  return existing.title === payload.title && (existing.subtitle || null) === (payload.subtitle || null);
}

// Returns the created/refreshed document, or null when nothing should
// be shown right now (still active, or dismissed and still cooling
// down). `options.cooldownMs` lets a caller shorten/lengthen the window
// per-notification if a type ever needs it; every current caller uses
// the default.
const createNotificationIfNew = async (userId, payload, options = {}) => {
  const cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  const fields = buildFields(userId, payload);

  const existing = await Notification.findOne(
    { user: userId, dedupeKey: payload.dedupeKey },
    null,
    { session: options.session }
  );

  if (!existing) {
    try {
      const [doc] = await Notification.create([fields], { session: options.session });
      await deliverPushSafely(userId, doc);
      return doc;
    } catch (error) {
      if (error.code === MONGO_DUPLICATE_KEY_ERROR) return null; // lost a create race — treat as already-exists
      throw error;
    }
  }

  if (!existing.dismissed) return null; // still active — never duplicate a live notification

  if (contentUnchanged(existing, payload)) {
    const dismissedAt = existing.dismissedAt || existing.updatedAt;
    const elapsed = Date.now() - new Date(dismissedAt).getTime();
    if (elapsed < cooldownMs) return null; // same content, still cooling down
  }

  // Content changed, or cooldown has elapsed — reuse the same document
  // (same _id, same dedupeKey identity) rather than trying to insert a
  // second one, which the unique index would reject anyway. Bumps
  // lastShownAt (NOT createdAt — Mongoose's timestamps plugin silently
  // ignores any manual createdAt override, confirmed by hand) so this
  // reappears at the top of "newest first" with a fresh relative time.
  Object.assign(existing, fields, {
    read: false,
    dismissed: false,
    dismissedAt: null,
    snoozedUntil: null,
    lastShownAt: new Date(),
  });
  await existing.save({ session: options.session });
  await deliverPushSafely(userId, existing);
  return existing;
};

// Phase 13D, Part A.3 — Smart Suppression. Reuses the EXACT SAME
// mechanism dismiss/clear-read/expiry already use (flip `dismissed` +
// stamp `dismissedAt`) — there is no second "suppress" concept, this is
// just that one dismiss operation applied by a query instead of an id,
// for the handful of moments an event makes an active reminder instantly
// stale (a workout gets logged, a muscle gets trained, a goal
// completes). Never touches anything already dismissed.
const suppressNotifications = async (userId, filter, options = {}) => {
  await Notification.updateMany(
    { user: userId, dismissed: false, ...filter },
    { dismissed: true, dismissedAt: new Date() },
    { session: options.session }
  );
};

// Batch variant — same idempotency guarantee per item, used by call
// sites that may have several candidate notifications from one write
// (e.g. a session finishing with 2 PRs at once). Failures for one
// candidate don't block the others.
//
// Phase 13D, Part A.3 — also suppresses the lingering progress/milestone
// reminder for any goal that just completed in this same batch (its
// dedupeKey — "goal:<id>" — is different from goalCompleted's own
// "goalCompleted:<id>", so without this the two would otherwise coexist:
// section 3's "Goal reminder -> Goal completed -> Replace with
// completion notification").
const createNotificationsIfNew = async (userId, payloads, options = {}) => {
  const created = [];
  for (const payload of payloads) {
    const doc = await createNotificationIfNew(userId, payload, options);
    if (doc) created.push(doc);

    if (payload.type === "goalCompleted" && payload.metadata?.goalId) {
      await suppressNotifications(
        userId,
        { dedupeKey: `goal:${payload.metadata.goalId}` },
        options
      );
    }
  }
  return created;
};

module.exports = {
  createNotificationIfNew,
  createNotificationsIfNew,
  suppressNotifications,
};
