const express = require("express");
const router = express.Router();

const { getAdvancedProgression } = require("../controllers/progressionController");
const { protect } = require("../middleware/authMiddleware");
const { requirePremium } = require("../middleware/entitlement");

router.get("/advanced", protect, requirePremium, getAdvancedProgression);

module.exports = router;
