const express = require("express");
const router = express.Router();

const {
  createWorkout,
  createWorkoutSession,
  getWorkouts,
  updateWorkout,
  updateWorkoutSessionTiming,
  deleteWorkout,
  deleteWorkoutSession,
} = require("../controllers/workoutController");

const {
  protect,
} = require("../middleware/authMiddleware");
const validateObjectId = require("../middleware/validateObjectId");

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
  validateObjectId(),
  updateWorkout
);

router.delete(
  "/session/:sessionId",
  protect,
  deleteWorkoutSession
);

router.put(
  "/session/:sessionId/timing",
  protect,
  updateWorkoutSessionTiming
);

router.delete(
  "/:id",
  protect,
  validateObjectId(),
  deleteWorkout
);

module.exports = router;