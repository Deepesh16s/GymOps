const express = require("express");
const router = express.Router();

const {
  createPost,
  listUserPosts,
  deletePost,
  likePost,
  unlikePost,
  reactToPost,
  removeReaction,
  listComments,
  createComment,
  deleteComment,
} = require("../controllers/physiqueController");
const { protect, optionalAuth } = require("../middleware/authMiddleware");
const {
  physiquePostLimiter,
  physiqueLikeLimiter,
  physiqueCommentLimiter,
  physiqueReactionLimiter,
} = require("../middleware/physiqueRateLimiters");
const uploadPhysiqueImageMiddleware = require("../middleware/uploadPhysiqueImage");
const validateObjectId = require("../middleware/validateObjectId");

router.post("/", protect, physiquePostLimiter, uploadPhysiqueImageMiddleware, createPost);
router.get("/:username", optionalAuth, listUserPosts);
router.delete("/:id", protect, validateObjectId(), deletePost);

router.post("/:id/like", protect, validateObjectId(), physiqueLikeLimiter, likePost);
router.delete("/:id/like", protect, validateObjectId(), unlikePost);

router.post("/:id/reactions", protect, validateObjectId(), physiqueReactionLimiter, reactToPost);
router.delete("/:id/reactions", protect, validateObjectId(), removeReaction);

router.get("/:id/comments", optionalAuth, validateObjectId(), listComments);
router.post("/:id/comments", protect, validateObjectId(), physiqueCommentLimiter, createComment);
router.delete("/comments/:commentId", protect, validateObjectId("commentId"), deleteComment);

module.exports = router;
