const rateLimit = require("express-rate-limit");

const keyByUser = (req) => String(req.user._id);

const reportLimiter = rateLimit({
  windowMs: Number(process.env.REPORT_RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000,
  max: Number(process.env.REPORT_RATE_LIMIT_MAX) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUser,
  message: { message: "Too many reports. Please try again later." },
});

module.exports = { reportLimiter };
