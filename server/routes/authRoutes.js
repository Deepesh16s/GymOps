const express = require("express");
const router = express.Router();

const {
  registerUser,
  loginUser,
  googleLogin,
  getMe,
  updateProfile,
  changePassword,
  deleteAccount,
  forgotPassword,
  resetPassword,
  checkUsernameAvailable,
  updateUsername,
  dismissUsernamePrompt,
} = require("../controllers/authController");

const { protect } = require("../middleware/authMiddleware");
const {
  loginRegisterLimiter,
  forgotPasswordLimiter,
  usernameCheckLimiter,
} = require("../middleware/authRateLimiters");

router.post("/register", loginRegisterLimiter, registerUser);
router.post("/login", loginRegisterLimiter, loginUser);
router.post("/google", googleLogin);
router.post("/forgot-password", forgotPasswordLimiter, forgotPassword);
router.post("/reset-password/:token", resetPassword);

router.get("/me", protect, getMe);
router.put("/profile", protect, updateProfile);
router.put("/change-password", protect, changePassword);
router.delete("/account", protect, deleteAccount);

// Unauthenticated on purpose — must work during registration, before a
// token exists.
router.get("/username-available", usernameCheckLimiter, checkUsernameAvailable);
router.put("/username", protect, updateUsername);
router.put("/username-prompt-dismissed", protect, dismissUsernamePrompt);

module.exports = router;