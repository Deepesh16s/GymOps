const express = require("express");
const router = express.Router();

const {
  registerSubscription,
  removeSubscription,
  getPreferences,
  updatePreferences,
  markPushClicked,
} = require("../controllers/pushController");

const { protect } = require("../middleware/authMiddleware");
const validateObjectId = require("../middleware/validateObjectId");

router.post("/subscriptions", protect, registerSubscription);
router.delete("/subscriptions", protect, removeSubscription);

router.get("/preferences", protect, getPreferences);
router.put("/preferences", protect, updatePreferences);

router.put("/notifications/:id/clicked", protect, validateObjectId(), markPushClicked);

module.exports = router;
