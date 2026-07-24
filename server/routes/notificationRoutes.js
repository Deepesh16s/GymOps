const express = require("express");
const router = express.Router();

const {
  getNotifications,
  markRead,
  markAllRead,
  dismiss,
  clearRead,
  generateFromClient,
  snooze,
} = require("../controllers/notificationController");

const { protect } = require("../middleware/authMiddleware");

router.get("/", protect, getNotifications);
router.post("/generate", protect, generateFromClient);
router.put("/read-all", protect, markAllRead);
router.put("/clear-read", protect, clearRead);
router.put("/:id/read", protect, markRead);
router.put("/:id/dismiss", protect, dismiss);
router.put("/:id/snooze", protect, snooze);

module.exports = router;
