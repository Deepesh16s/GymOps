const express = require("express");
const router = express.Router();

const {
  createGoal,
  getGoals,
  updateGoal,
  deleteGoal,
} = require("../controllers/goalController");

const {
  protect,
} = require("../middleware/authMiddleware");
const validateObjectId = require("../middleware/validateObjectId");

router.post("/", protect, createGoal);
router.get("/", protect, getGoals);
router.put("/:id", protect, validateObjectId(), updateGoal);
router.delete("/:id", protect, validateObjectId(), deleteGoal);

module.exports = router;