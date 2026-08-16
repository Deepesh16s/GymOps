const Subscription = require("../models/Subscription");

async function isPremiumUser(user) {
  if (!user || user.premiumTier !== "premium") return false;

  const subscription = await Subscription.findOne({ user: user._id }).select("status currentPeriodEnd");
  if (!subscription) return true;

  if (subscription.status === "canceled" || subscription.status === "expired") return false;
  if (subscription.currentPeriodEnd && subscription.currentPeriodEnd.getTime() < Date.now()) return false;

  return true;
}

async function requirePremium(req, res, next) {
  const entitled = await isPremiumUser(req.user);
  if (!entitled) {
    return res.status(403).json({
      message: "This feature requires Repvyn Premium",
      code: "PREMIUM_REQUIRED",
    });
  }
  next();
}

module.exports = { isPremiumUser, requirePremium };
