const express = require("express");
const router = express.Router();

const {
  createExercise,
  getExercises,
} = require("../controllers/exerciseController");

const {
  protect,
} = require("../middleware/authMiddleware");

router.post("/", protect, createExercise);

router.get("/", protect, getExercises);

module.exports = router;
