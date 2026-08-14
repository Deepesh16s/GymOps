const express = require("express");
const router = express.Router();

const { getFeed } = require("../controllers/activityController");
const { protect } = require("../middleware/authMiddleware");

router.get("/", protect, getFeed);

module.exports = router;
