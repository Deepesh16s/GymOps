const Notification = require("../models/Notification");
const { createNotificationsIfNew } = require("../utils/notificationService");

const MAX_LIST_LIMIT = 100;

// GET /api/notifications?limit=50 — never-dismissed, not-currently-
// snoozed, not-expired notifications, newest first. Dismissed ones are
// excluded entirely (not just hidden client-side) since "Clear read" is
// meant to actually free the list, not just toggle a filter.
//
// Phase 13C — expiry/snooze are both evaluated lazily HERE, on read, the
// same "no scheduler" pattern PlannedWorkout's flipOverdueToMissed
// already established: an expired reminder is auto-dismissed (it's
// genuinely done, not coming back), while a snoozed one is only filtered
// out of THIS query — it reappears on its own once snoozedUntil passes,
// no write needed to "un-snooze" it.
exports.getNotifications = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, MAX_LIST_LIMIT);
    const now = new Date();

    await Notification.updateMany(
      { user: req.user._id, dismissed: false, expiresAt: { $ne: null, $lt: now } },
      { dismissed: true, dismissedAt: now }
    );

    const activeFilter = {
      user: req.user._id,
      dismissed: false,
      $or: [{ snoozedUntil: null }, { snoozedUntil: { $lte: now } }],
    };

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(activeFilter).sort({ lastShownAt: -1 }).limit(limit),
      Notification.countDocuments({ ...activeFilter, read: false }),
    ]);

    res.status(200).json({ notifications, unreadCount });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to load notifications." });
  }
};

// PUT /api/notifications/:id/read
exports.markRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { read: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }
    res.status(200).json(notification);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to update notification." });
  }
};

// PUT /api/notifications/read-all
exports.markAllRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, read: false, dismissed: false },
      { read: true }
    );
    res.status(200).json({ message: "All notifications marked as read." });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to mark notifications as read." });
  }
};

// PUT /api/notifications/:id/dismiss — a single notification, e.g. its
// own "Dismiss" action button.
exports.dismiss = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { dismissed: true, dismissedAt: new Date() },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }
    res.status(200).json(notification);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to dismiss notification." });
  }
};

// PUT /api/notifications/:id/snooze — body: { until: "today" | "tomorrow" }.
// Section 11: snoozing is never a delete/dismiss — the reminder just
// stops appearing in getNotifications' active-list query until
// snoozedUntil passes, at which point it reappears on its own with no
// extra write (see getNotifications above).
const SNOOZE_END_OF_TODAY_HOURS = 23;
const SNOOZE_END_OF_TODAY_MINUTES = 59;

function computeSnoozeUntil(until) {
  const target = new Date();
  if (until === "tomorrow") target.setDate(target.getDate() + 1);
  else if (until !== "today") return null;
  target.setHours(SNOOZE_END_OF_TODAY_HOURS, SNOOZE_END_OF_TODAY_MINUTES, 59, 999);
  return target;
}

exports.snooze = async (req, res) => {
  try {
    const snoozedUntil = computeSnoozeUntil(req.body.until);
    if (!snoozedUntil) {
      return res.status(400).json({ message: "until must be 'today' or 'tomorrow'" });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { snoozedUntil },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }
    res.status(200).json(notification);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to snooze notification." });
  }
};

// PUT /api/notifications/clear-read — the panel's "Clear read" action:
// dismisses every already-read notification in one write, leaving
// unread ones untouched (dismissing an unread notification should only
// ever happen explicitly, one at a time, via dismiss above).
exports.clearRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, read: true, dismissed: false },
      { dismissed: true, dismissedAt: new Date() }
    );
    res.status(200).json({ message: "Read notifications cleared." });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to clear read notifications." });
  }
};

// POST /api/notifications/generate — the client-triggered half of
// notification generation (see utils/dashboardInsights.js on the
// frontend): the client already computes recovery-complete/weekly-
// volume-increased/neglected-muscle candidates from data it has loaded
// anyway (no server recomputation), and posts them here for the SAME
// dedup + persistence path every server-triggered notification goes
// through (utils/notificationService.js). The server still validates
// shape and scopes everything to req.user._id — a client can only ever
// create notifications for itself, and only through this one
// constrained shape (no arbitrary fields).
const ALLOWED_CATEGORIES = ["progress", "cardio", "reminders", "insights"];
const ALLOWED_PRIORITIES = ["low", "medium", "high", "critical"];
const ALLOWED_CONFIDENCE = ["low", "medium", "high"];

// Phase 13C.1 — Deep Links: only ever passes through plain strings for
// page/entityId/focus, same "client computes, server trusts nothing
// beyond shape" rule as every other field here.
function sanitizeAction(action) {
  if (!action || typeof action !== "object") return null;
  const { page, entityId, focus } = action;
  if (typeof page !== "string") return null;
  return {
    page,
    entityId: typeof entityId === "string" ? entityId : null,
    focus: typeof focus === "string" ? focus : null,
  };
}

// Phase 13C — a reminder's expiresAt/metadata ride along the same
// client-computes/server-persists shape every candidate here already
// used in 13A; the server still only ever accepts a Date-parseable
// string / plain object, never trusts anything else about them.
exports.generateFromClient = async (req, res) => {
  try {
    const candidates = Array.isArray(req.body.candidates) ? req.body.candidates : [];

    const payloads = candidates
      .filter(
        (c) =>
          c &&
          typeof c.type === "string" &&
          ALLOWED_CATEGORIES.includes(c.category) &&
          typeof c.icon === "string" &&
          typeof c.title === "string" &&
          typeof c.dedupeKey === "string"
      )
      .map((c) => {
        const parsedExpiresAt = c.expiresAt ? new Date(c.expiresAt) : null;
        return {
          type: c.type,
          category: c.category,
          priority: ALLOWED_PRIORITIES.includes(c.priority) ? c.priority : "medium",
          // Phase 13D, Part A.1 — optional; when absent,
          // notificationService.js's buildFields resolves it from
          // TYPE_CONFIDENCE by `type` (the same fallback pattern
          // `priority` already uses on the client's reminder engine).
          confidence: ALLOWED_CONFIDENCE.includes(c.confidence) ? c.confidence : undefined,
          icon: c.icon,
          title: c.title,
          subtitle: typeof c.subtitle === "string" ? c.subtitle : null,
          navigationTarget: typeof c.navigationTarget === "string" ? c.navigationTarget : null,
          action: sanitizeAction(c.action),
          dedupeKey: c.dedupeKey,
          expiresAt: parsedExpiresAt && !Number.isNaN(parsedExpiresAt.getTime()) ? parsedExpiresAt : null,
          metadata: c.metadata && typeof c.metadata === "object" ? c.metadata : null,
        };
      });

    const created = await createNotificationsIfNew(req.user._id, payloads);
    res.status(201).json({ created });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to generate notifications." });
  }
};
