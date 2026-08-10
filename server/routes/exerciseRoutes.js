const express = require("express");
const router = express.Router();

const {
  createExercise,
  getExercises,
  updateExercise,
  deleteExercise,
} = require("../controllers/exerciseController");
const {
  protect,
} = require("../middleware/authMiddleware");
const validateObjectId = require("../middleware/validateObjectId");

router.post("/", protect, createExercise);

router.get("/", protect, getExercises);
router.put(
  "/:id",
  protect,
  validateObjectId(),
  updateExercise
);

router.delete(
  "/:id",
  protect,
  validateObjectId(),
  deleteExercise
);

module.exports = router;
