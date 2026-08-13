const rateLimit = require("express-rate-limit");

// Keyed by authenticated user, not IP — every route this runs on sits behind
// `protect`, so `req.user` is always set. Basic spam protection, not a full
// moderation system (see Phase S3 scope notes).
const byUser = (req) => String(req.user._id);

const sendMessageLimiter = rateLimit({
  windowMs: Number(process.env.CHAT_SEND_RATE_LIMIT_WINDOW_MS) || 5 * 60 * 1000,
  max: Number(process.env.CHAT_SEND_RATE_LIMIT_MAX) || 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: byUser,
  message: { message: "You're sending messages too quickly. Please slow down." },
});

const createConversationLimiter = rateLimit({
  windowMs: Number(process.env.CHAT_CREATE_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.CHAT_CREATE_RATE_LIMIT_MAX) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: byUser,
  message: { message: "Too many new conversations. Please try again later." },
});

module.exports = { sendMessageLimiter, createConversationLimiter };
