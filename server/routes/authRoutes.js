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
} = require("../controllers/authController");

const { protect } = require("../middleware/authMiddleware");

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/google", googleLogin);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

router.get("/me", protect, getMe);
router.put("/profile", protect, updateProfile);
router.put("/change-password", protect, changePassword);
router.delete("/account", protect, deleteAccount);

module.exports = router;