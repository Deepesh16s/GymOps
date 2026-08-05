const express = require("express");
const router = express.Router();

const {
  registerSubscription,
  removeSubscription,
  getSubscriptions,
  getPreferences,
  updatePreferences,
  markPushClicked,
} = require("../controllers/pushController");

const { protect } = require("../middleware/authMiddleware");

// Phase 13D, Part B — Browser Push Delivery. Mounted at /api/push (see
// server.js). All behind the same `protect` middleware every other
// route file already uses — a push subscription/preference always
// belongs to the authenticated user, never passed in as a body field.
router.get("/subscriptions", protect, getSubscriptions);
router.post("/subscriptions", protect, registerSubscription);
router.delete("/subscriptions", protect, removeSubscription);

router.get("/preferences", protect, getPreferences);
router.put("/preferences", protect, updatePreferences);

router.put("/notifications/:id/clicked", protect, markPushClicked);

module.exports = router;
