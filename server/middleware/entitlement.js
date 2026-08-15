function isPremiumUser(user) {
  return !!user && user.premiumTier === "premium";
}

function requirePremium(req, res, next) {
  if (!isPremiumUser(req.user)) {
    return res.status(403).json({
      message: "This feature requires Repvyn Premium",
      code: "PREMIUM_REQUIRED",
    });
  }
  next();
}

module.exports = { isPremiumUser, requirePremium };
