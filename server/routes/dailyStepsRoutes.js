const express = require("express");
const router = express.Router();

const { getDailySteps, setDailySteps } = require("../controllers/dailyStepsController");
const { protect } = require("../middleware/authMiddleware");

router.get("/", protect, getDailySteps);
router.put("/", protect, setDailySteps);

module.exports = router;
