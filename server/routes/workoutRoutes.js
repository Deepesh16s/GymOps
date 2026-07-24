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

// Declared above the single-workout "/:id" route. Not strictly required
// since "/session/:sessionId" has two segments and can't collide with the
// single-segment "/:id", but keeping the more specific route first matches
// existing convention and avoids any ambiguity.
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
  deleteWorkout
);

module.exports = router;