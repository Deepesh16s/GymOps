// Phase 13D, Part B — the "Delivery Manager" from the architecture
// diagram (Reminder Engine -> Notification Store -> Delivery Manager ->
// Notification Center -> Browser Push). This file NEVER generates a
// notification or decides its content — it only decides whether an
// ALREADY-CREATED Notification document (see notificationService.js,
// which calls deliverPushIfEligible right after creating/regenerating
// one) also gets sent as a browser push, and then sends it. Reminder
// generation, priority, confidence, dedup, and suppression are all
// untouched — this is purely an additional side effect layered on top.
const webpush = require("web-push");
const PushSubscription = require("../models/PushSubscription");
const PushPreferences = require("../models/PushPreferences");
const Notification = require("../models/Notification");

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_CONTACT_EMAIL || "no-reply@gymops.local"}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// Section 9 — "Only meaningful notifications become browser pushes."
// This is its OWN axis, deliberately separate from the in-app `priority`
// TYPE_PRIORITY already assigns (see constants/notificationTypes.js):
// achievements like personalRecord/goalCompleted are LOW in-app priority
// (13C's reasoning — celebratory, shouldn't crowd a priority-sorted
// list) but the phase's own examples explicitly list "Goal completed"
// and "New PR" as push-worthy. Push eligibility answers "is this worth
// interrupting the user for", which isn't the same question as "should
// this sort to the top of the in-app list".
const PUSH_ELIGIBLE_TYPES = new Set([
  "workoutOverdue",
  "workoutStartingSoon",
  "workoutToday",
  "workoutMissedYesterday",
  "recurringDueTomorrow",
  "streakProtection",
  "cardioStreakExpiring",
  "recoveryComplete",
  "goalCompleted",
  "goalExpiringToday",
  "plannerRescheduleWarning",
  "plannerOverlap",
  "plannerSeriesEndingSoon",
  "personalRecord",
]);

const MAX_PUSHES_PER_HOUR = 3;
const MAX_PUSHES_PER_DAY = 10;
const MS_PER_HOUR = 3600000;
const MS_PER_DAY = 86400000;

function isPushEligible(notification) {
  return PUSH_ELIGIBLE_TYPES.has(notification.type);
}

// Section 10 — quiet hours. `start`/`end` are "HH:mm" strings interpreted
// in the SERVER's local time (no per-user timezone field exists on User
// today — see PushPreferences.js's own header comment for this disclosed
// limitation). Handles the overnight-wraparound case (22:00 -> 07:00
// spans midnight) the same way any "is now within this window" check
// has to: if start > end, the window wraps, so "inside" means
// now >= start OR now < end, rather than the simpler same-day case.
function isWithinQuietHoursWindow(start, end) {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes === endMinutes) return false; // a zero-width window never applies
  if (startMinutes < endMinutes) return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

// Returns true when the push should be BLOCKED by quiet hours.
function isSuppressedByQuietHours(quietHours, notification) {
  if (!quietHours?.enabled) return false;
  if (!isWithinQuietHoursWindow(quietHours.start, quietHours.end)) return false;

  if (quietHours.mode === "allow") return false;
  if (quietHours.mode === "suppressAll") return true;
  if (quietHours.mode === "criticalOnly") return notification.priority !== "critical";
  return false;
}

// Section 13 — Queue & Throttling. Counts pushes already SENT (not
// notifications created) in the trailing hour/day for this user —
// reuses the `pushSentAt` field every prior send already stamps, no new
// counter table.
async function isThrottled(userId) {
  const now = Date.now();
  const [hourCount, dayCount] = await Promise.all([
    Notification.countDocuments({ user: userId, pushSentAt: { $gte: new Date(now - MS_PER_HOUR) } }),
    Notification.countDocuments({ user: userId, pushSentAt: { $gte: new Date(now - MS_PER_DAY) } }),
  ]);
  return hourCount >= MAX_PUSHES_PER_HOUR || dayCount >= MAX_PUSHES_PER_DAY;
}

// Section 11 — Deep Linking payload. Carries the SAME structured
// `action` (page/entityId/focus) 13C.1 already introduced for in-app
// navigation — the service worker's notificationclick handler reads
// this to build the destination URL, reusing the identical
// page/entityId/focus vocabulary (see client's NotificationCenter.jsx
// buildNavigationTarget for the in-app equivalent). Never a second
// deep-link scheme.
function buildPushPayload(notification) {
  return {
    notificationId: String(notification._id),
    title: notification.title,
    body: notification.subtitle || "",
    icon: notification.icon,
    navigationTarget: notification.navigationTarget,
    action: notification.action || null,
  };
}

const GONE_STATUS_CODES = new Set([404, 410]);

// The one entry point notificationService.js calls after creating or
// regenerating a Notification document. Fire-and-forget from the
// caller's perspective — every failure here is caught and logged, never
// thrown, so a push problem can never affect the notification-creation
// response (same discipline every other side effect in this codebase
// already follows).
async function deliverPushIfEligible(userId, notification) {
  if (!isPushEligible(notification)) return;

  const prefs = await PushPreferences.findOne({ user: userId });
  if (!prefs?.pushEnabled) return; // section 15 — no prefs row yet, or push explicitly off: in-app only, no error

  if (isSuppressedByQuietHours(prefs.quietHours, notification)) return;
  if (await isThrottled(userId)) return;

  const subscriptions = await PushSubscription.find({ user: userId });
  if (!subscriptions.length) return; // permission granted client-side but no active subscription (e.g. mid-flow) — nothing to send to yet

  const payload = JSON.stringify(buildPushPayload(notification));
  let sentToAny = false;

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
          payload
        );
        sentToAny = true;
      } catch (error) {
        if (GONE_STATUS_CODES.has(error.statusCode)) {
          // Section 7 — stale subscription hygiene: the browser has
          // unsubscribed or the push service has expired this endpoint.
          // Removing it here is the SAME "remove" operation
          // pushController.removeSubscription performs, just triggered
          // by delivery failure instead of a user action.
          await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});
        } else {
          console.error("Push delivery failed:", error.message || error);
        }
      }
    })
  );

  await Notification.updateOne(
    { _id: notification._id },
    sentToAny ? { pushSentAt: new Date() } : { pushFailedAt: new Date() }
  );
}

module.exports = {
  deliverPushIfEligible,
  isPushEligible,
  isWithinQuietHoursWindow,
  isSuppressedByQuietHours,
};
