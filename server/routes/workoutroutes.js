const express = require("express");
const router = express.Router();

const {
  createWorkout,
  createWorkoutSession,
  getWorkouts,
  updateWorkout,
  deleteWorkout,
} = require("../controllers/workoutController");

const {
  protect,
} = require("../middleware/authMiddleware");

router.post(
  "/",
  protect,
  createWorkout
);

router.post(
  "/session",
  protect,
  createWorkoutSession
);

router.get(
  "/",
  protect,
  getWorkouts
);

router.put(
  "/:id",
  protect,
  updateWorkout
);

router.delete(
  "/:id",
  protect,
  deleteWorkout
);

module.exports = router;