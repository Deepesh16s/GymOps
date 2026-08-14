const express = require("express");
const router = express.Router();

const { createReport } = require("../controllers/reportController");
const { protect } = require("../middleware/authMiddleware");
const { reportLimiter } = require("../middleware/reportRateLimiters");

router.post("/", protect, reportLimiter, createReport);

module.exports = router;
