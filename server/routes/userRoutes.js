const express = require("express");
const router = express.Router();

const {
  searchUsers,
  getPublicProfile,
  getFollowers,
  getFollowing,
  followUser,
  unfollowUser,
  blockUser,
  unblockUser,
} = require("../controllers/userController");

const { protect, optionalAuth } = require("../middleware/authMiddleware");
const { usernameCheckLimiter } = require("../middleware/authRateLimiters");

// Public reads — viewing a profile/search/followers doesn't require auth.
// All four use optionalAuth so an identified viewer additionally gets their
// own follow/block relationship to each returned profile in the response.
router.get("/search", usernameCheckLimiter, optionalAuth, searchUsers);
router.get("/:username", optionalAuth, getPublicProfile);
router.get("/:username/followers", optionalAuth, getFollowers);
router.get("/:username/following", optionalAuth, getFollowing);

// Writes — require the acting user to be authenticated.
router.post("/:username/follow", protect, followUser);
router.delete("/:username/follow", protect, unfollowUser);
router.post("/:username/block", protect, blockUser);
router.delete("/:username/block", protect, unblockUser);

module.exports = router;
