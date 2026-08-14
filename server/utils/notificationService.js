const Notification = require("../models/Notification");
const { TYPE_CONFIDENCE, NOTIFICATION_TYPES } = require("../constants/notificationTypes");
const { deliverPushIfEligible } = require("./pushDeliveryManager");
const { recordActivity } = require("./activityFeed");

const ACTIVITY_ELIGIBLE_TYPES = new Set([
  NOTIFICATION_TYPES.PERSONAL_RECORD,
  NOTIFICATION_TYPES.STREAK_MILESTONE,
]);

async function recordActivitySafely(userId, doc) {
  try {
    await recordActivity(userId, {
      type: doc.type,
      title: doc.title,
      subtitle: doc.subtitle,
      metadata: doc.metadata,
    });
  } catch (error) {
    console.error("Activity recording failed:", error);
  }
}

async function deliverPushSafely(userId, doc) {
  try {
    await deliverPushIfEligible(userId, doc);
  } catch (error) {
    console.error("Push delivery failed:", error);
  }
}

const MONGO_DUPLICATE_KEY_ERROR = 11000;
const DEFAULT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

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
      if (ACTIVITY_ELIGIBLE_TYPES.has(doc.type)) await recordActivitySafely(userId, doc);
      return doc;
    } catch (error) {
      if (error.code === MONGO_DUPLICATE_KEY_ERROR) return null;
      throw error;
    }
  }

  if (!existing.dismissed) return null;

  if (contentUnchanged(existing, payload)) {
    const dismissedAt = existing.dismissedAt || existing.updatedAt;
    const elapsed = Date.now() - new Date(dismissedAt).getTime();
    if (elapsed < cooldownMs) return null;
  }

  Object.assign(existing, fields, {
    read: false,
    dismissed: false,
    dismissedAt: null,
    snoozedUntil: null,
    lastShownAt: new Date(),
  });
  await existing.save({ session: options.session });
  await deliverPushSafely(userId, existing);
  if (ACTIVITY_ELIGIBLE_TYPES.has(existing.type)) await recordActivitySafely(userId, existing);
  return existing;
};

const suppressNotifications = async (userId, filter, options = {}) => {
  await Notification.updateMany(
    { user: userId, dismissed: false, ...filter },
    { dismissed: true, dismissedAt: new Date() },
    { session: options.session }
  );
};

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
