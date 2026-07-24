const PushSubscription = require("../models/PushSubscription");
const PushPreferences = require("../models/PushPreferences");
const Notification = require("../models/Notification");

// Phase 13D, Part B (section 7) — Push Subscription CRUD. Register is
// an upsert BY ENDPOINT (not a strict create) — see PushSubscription's
// own header comment for why: the same browser re-subscribing, or a
// different account logging into an already-subscribed browser, should
// update the one existing row for that browser, not create a duplicate
// or error.
exports.registerSubscription = async (req, res) => {
  try {
    const { endpoint, keys } = req.body.subscription || req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ message: "Invalid push subscription." });
    }

    const subscription = await PushSubscription.findOneAndUpdate(
      { endpoint },
      {
        user: req.user._id,
        endpoint,
        keys: { p256dh: keys.p256dh, auth: keys.auth },
        userAgent: req.headers["user-agent"] || null,
        lastSeenAt: new Date(),
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // Section 5 — registering a subscription IS the client's proof that
    // permission was granted; flip the master switch on automatically so
    // a user doesn't have to find a separate "enable push" toggle after
    // already saying yes to the browser's own permission prompt.
    await PushPreferences.findOneAndUpdate(
      { user: req.user._id },
      { $setOnInsert: { user: req.user._id }, pushEnabled: true },
      { upsert: true }
    );

    res.status(201).json(subscription);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to register push subscription." });
  }
};

// DELETE /api/push/subscriptions — body: { endpoint }. Removing one
// browser's subscription only ever affects that browser (section 7:
// "multiple browsers, multiple devices" are independent rows) — it does
// NOT touch pushEnabled, since other devices may still be subscribed.
exports.removeSubscription = async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ message: "endpoint is required." });
    }
    await PushSubscription.deleteOne({ endpoint, user: req.user._id });
    res.status(200).json({ message: "Push subscription removed." });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to remove push subscription." });
  }
};

exports.getSubscriptions = async (req, res) => {
  try {
    const subscriptions = await PushSubscription.find({ user: req.user._id })
      .select("endpoint userAgent lastSeenAt createdAt")
      .sort({ lastSeenAt: -1 });
    res.status(200).json(subscriptions);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to load push subscriptions." });
  }
};

// GET/PUT /api/push/preferences — section 5 (permission state is
// derived client-side from the Notification API, not stored here) and
// section 10 (quiet hours). getOrDefault never fails just because a user
// has never touched push settings — same "sensible default, no forced
// setup step" pattern reminders/reminderPreferences.js already uses.
exports.getPreferences = async (req, res) => {
  try {
    const prefs =
      (await PushPreferences.findOne({ user: req.user._id })) ||
      new PushPreferences({ user: req.user._id });
    res.status(200).json(prefs);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to load push preferences." });
  }
};

exports.updatePreferences = async (req, res) => {
  try {
    const { pushEnabled, quietHours } = req.body;
    const update = {};
    if (typeof pushEnabled === "boolean") update.pushEnabled = pushEnabled;
    if (quietHours && typeof quietHours === "object") {
      if (typeof quietHours.enabled === "boolean") update["quietHours.enabled"] = quietHours.enabled;
      if (typeof quietHours.start === "string") update["quietHours.start"] = quietHours.start;
      if (typeof quietHours.end === "string") update["quietHours.end"] = quietHours.end;
      if (["allow", "criticalOnly", "suppressAll"].includes(quietHours.mode)) {
        update["quietHours.mode"] = quietHours.mode;
      }
    }

    const prefs = await PushPreferences.findOneAndUpdate(
      { user: req.user._id },
      { $set: update, $setOnInsert: { user: req.user._id } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.status(200).json(prefs);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to update push preferences." });
  }
};

// PUT /api/push/notifications/:id/clicked — section 14 delivery
// analytics + section 12 multi-device sync: the service worker's
// notificationclick handler calls this so every other open tab/device
// (polling/instant-event, same as the rest of the Notification Center)
// sees the click, not just the one that received the push.
exports.markPushClicked = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { pushClickedAt: new Date(), read: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }
    res.status(200).json(notification);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to record push click." });
  }
};
