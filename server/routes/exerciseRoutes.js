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

router.post("/", protect, createExercise);

router.get("/", protect, getExercises);
router.put(
  "/:id",
  protect,
  updateExercise
);

router.delete(
  "/:id",
  protect,
  deleteExercise
);

module.exports = router;
