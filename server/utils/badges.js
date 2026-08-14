const Workout = require("../models/workout");
const Badge = require("../models/Badge");
const { countAllSessions, getLongestStreak, dateKey } = require("./workoutSessions");
const { prHistory } = require("./strengthMetrics");
const {
  BADGE_CATALOG,
  MONTH_NAMES,
  MONTH_COLORS,
  MONTHLY_CONSISTENCY_THRESHOLD,
  MONTHLY_BADGE_TIER,
} = require("../constants/badges");
const { createNotificationIfNew } = require("./notificationService");
const { recordActivity } = require("./activityFeed");
const { NOTIFICATION_TYPES } = require("../constants/notificationTypes");

const CATALOG_BY_ID = new Map(BADGE_CATALOG.map((b) => [b.id, b]));
const MONTHLY_ID_PATTERN = /^monthly_(\d{4})_(\d{2})$/;

function describeBadge(badgeId) {
  const staticDef = CATALOG_BY_ID.get(badgeId);
  if (staticDef) return staticDef;

  const match = badgeId.match(MONTHLY_ID_PATTERN);
  if (match) {
    const [, year, month] = match;
    const monthIndex = Number(month) - 1;
    const monthName = MONTH_NAMES[monthIndex];
    return {
      id: badgeId,
      name: `${monthName} ${year} Consistency`,
      description: `Trained ${MONTHLY_CONSISTENCY_THRESHOLD}+ days in ${monthName} ${year}`,
      category: "consistency",
      type: "monthly",
      threshold: MONTHLY_CONSISTENCY_THRESHOLD,
      tier: MONTHLY_BADGE_TIER,
      color: MONTH_COLORS[monthIndex],
    };
  }

  return null;
}

function badgeQualifies(badge, { sessionCount, longestStreak, totalDays, prCount }) {
  if (badge.type === "sessions") return sessionCount >= badge.threshold;
  if (badge.type === "streak") return longestStreak >= badge.threshold;
  if (badge.type === "totalDays") return totalDays >= badge.threshold;
  if (badge.type === "prCount") return prCount >= badge.threshold;
  return false;
}

async function awardBadge(userId, badgeId) {
  try {
    const doc = await Badge.create({ user: userId, badgeId });
    return { ...describeBadge(badgeId), earnedAt: doc.earnedAt };
  } catch (error) {
    if (error.code === 11000 || error.code === "E11000") return null;
    throw error;
  }
}

function evaluateMonthlyBadgeIds(trainedDateKeys, alreadyEarned) {
  const countsByMonth = new Map();
  for (const key of trainedDateKeys) {
    const monthKey = key.slice(0, 7);
    countsByMonth.set(monthKey, (countsByMonth.get(monthKey) || 0) + 1);
  }

  const badgeIds = [];
  for (const [monthKey, count] of countsByMonth) {
    if (count < MONTHLY_CONSISTENCY_THRESHOLD) continue;
    const badgeId = `monthly_${monthKey.replace("-", "_")}`;
    if (!alreadyEarned.has(badgeId)) badgeIds.push(badgeId);
  }
  return badgeIds;
}

async function evaluateBadges(userId) {
  const alreadyEarned = new Set(
    (await Badge.find({ user: userId }).select("badgeId")).map((b) => b.badgeId)
  );

  const remaining = BADGE_CATALOG.filter((b) => !alreadyEarned.has(b.id));

  const workouts = await Workout.find({ user: userId })
    .select("sessionId _id date entryType workoutSets exercise")
    .populate("exercise", "name muscleGroup");

  const sessionCount = countAllSessions(workouts);
  const trainedDateKeys = new Set(workouts.map((w) => dateKey(w.date)));
  const longestStreak = getLongestStreak(trainedDateKeys);
  const totalDays = trainedDateKeys.size;
  const prCount = prHistory(workouts).length;

  const context = { sessionCount, longestStreak, totalDays, prCount };
  const newlyEarned = [];

  for (const badge of remaining) {
    if (!badgeQualifies(badge, context)) continue;
    const awarded = await awardBadge(userId, badge.id);
    if (awarded) newlyEarned.push(awarded);
  }

  const monthlyBadgeIds = evaluateMonthlyBadgeIds(trainedDateKeys, alreadyEarned);
  for (const badgeId of monthlyBadgeIds) {
    const awarded = await awardBadge(userId, badgeId);
    if (awarded) newlyEarned.push(awarded);
  }

  for (const badge of newlyEarned) {
    await createNotificationIfNew(userId, {
      type: NOTIFICATION_TYPES.BADGE_EARNED,
      category: "social",
      icon: "Award",
      title: `Badge earned: ${badge.name}`,
      subtitle: badge.description,
      dedupeKey: `badge:${badge.id}`,
    });
    await recordActivity(userId, {
      type: "badgeEarned",
      title: `Earned the ${badge.name} badge`,
      subtitle: badge.description,
      metadata: { badgeId: badge.id },
    });
  }

  return newlyEarned;
}

module.exports = { evaluateBadges, describeBadge };
