const rateLimit = require("express-rate-limit");

const keyByUser = (req) => String(req.user._id);

const followActionLimiter = rateLimit({
  windowMs: Number(process.env.FOLLOW_ACTION_RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000,
  max: Number(process.env.FOLLOW_ACTION_RATE_LIMIT_MAX) || 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUser,
  message: { message: "Too many follow actions. Please try again later." },
});

const blockActionLimiter = rateLimit({
  windowMs: Number(process.env.BLOCK_ACTION_RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000,
  max: Number(process.env.BLOCK_ACTION_RATE_LIMIT_MAX) || 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUser,
  message: { message: "Too many block/unblock actions. Please try again later." },
});

module.exports = { followActionLimiter, blockActionLimiter };
