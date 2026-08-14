const rateLimit = require("express-rate-limit");

const keyByUser = (req) => String(req.user._id);

const physiquePostLimiter = rateLimit({
  windowMs: Number(process.env.PHYSIQUE_POST_RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000,
  max: Number(process.env.PHYSIQUE_POST_RATE_LIMIT_MAX) || 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUser,
  message: { message: "Too many posts. Please try again later." },
});

const physiqueLikeLimiter = rateLimit({
  windowMs: Number(process.env.PHYSIQUE_LIKE_RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000,
  max: Number(process.env.PHYSIQUE_LIKE_RATE_LIMIT_MAX) || 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUser,
  message: { message: "Too many likes. Please try again later." },
});

const physiqueCommentLimiter = rateLimit({
  windowMs: Number(process.env.PHYSIQUE_COMMENT_RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000,
  max: Number(process.env.PHYSIQUE_COMMENT_RATE_LIMIT_MAX) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUser,
  message: { message: "Too many comments. Please try again later." },
});

module.exports = { physiquePostLimiter, physiqueLikeLimiter, physiqueCommentLimiter };
