const rateLimit = require("express-rate-limit");

const loginRegisterLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});

const forgotPasswordLimiter = rateLimit({
  windowMs:
    Number(process.env.AUTH_FORGOT_PASSWORD_RATE_LIMIT_WINDOW_MS) ||
    15 * 60 * 1000,
  max: Number(process.env.AUTH_FORGOT_PASSWORD_RATE_LIMIT_MAX) || 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});

module.exports = { loginRegisterLimiter, forgotPasswordLimiter };
