const express = require("express");
const router = express.Router();

const {
  searchUsers,
  getPublicProfile,
  getHeatmap,
  getHeatmapDay,
  getSessions,
  getPRs,
  getActivity,
  getFollowers,
  getFollowing,
  followUser,
  unfollowUser,
  getFollowRequests,
  acceptFollowRequest,
  declineFollowRequest,
  blockUser,
  unblockUser,
} = require("../controllers/userController");

const { protect, optionalAuth } = require("../middleware/authMiddleware");
const { usernameCheckLimiter } = require("../middleware/authRateLimiters");
const { followActionLimiter, blockActionLimiter } = require("../middleware/socialRateLimiters");

router.get("/search", usernameCheckLimiter, optionalAuth, searchUsers);

router.get("/follow-requests", protect, getFollowRequests);

router.get("/:username", optionalAuth, getPublicProfile);
router.get("/:username/heatmap", optionalAuth, getHeatmap);
router.get("/:username/heatmap/:date", optionalAuth, getHeatmapDay);
router.get("/:username/sessions", optionalAuth, getSessions);
router.get("/:username/prs", optionalAuth, getPRs);
router.get("/:username/activity", optionalAuth, getActivity);
router.get("/:username/followers", optionalAuth, getFollowers);
router.get("/:username/following", optionalAuth, getFollowing);

router.post("/:username/follow", protect, followActionLimiter, followUser);
router.delete("/:username/follow", protect, followActionLimiter, unfollowUser);
router.post("/:username/accept-follow-request", protect, followActionLimiter, acceptFollowRequest);
router.post("/:username/decline-follow-request", protect, followActionLimiter, declineFollowRequest);
router.post("/:username/block", protect, blockActionLimiter, blockUser);
router.delete("/:username/block", protect, blockActionLimiter, unblockUser);

module.exports = router;
