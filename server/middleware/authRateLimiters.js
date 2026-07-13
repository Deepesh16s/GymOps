const rateLimit = require("express-rate-limit");

// Configurable via environment variables so limits can be tuned per
// deployment without a code change; sensible defaults apply when unset
// or malformed.
const loginRegisterLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});

// Separate, stricter-by-default limiter for forgot-password since each
// request triggers an outbound email.
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
