const express = require("express");
const router = express.Router();

const {
  createPlannedWorkout,
  getPlannedWorkouts,
  updatePlannedWorkout,
  reschedulePlannedWorkout,
  markPlannedWorkoutComplete,
  duplicatePlannedWorkout,
  cancelPlannedWorkout,
  deletePlannedWorkout,
} = require("../controllers/plannedWorkoutController");

const { protect } = require("../middleware/authMiddleware");
const validateObjectId = require("../middleware/validateObjectId");

router.post("/", protect, createPlannedWorkout);
router.get("/", protect, getPlannedWorkouts);
router.put("/:id", protect, validateObjectId(), updatePlannedWorkout);
router.put("/:id/reschedule", protect, validateObjectId(), reschedulePlannedWorkout);
router.put("/:id/complete", protect, validateObjectId(), markPlannedWorkoutComplete);
router.post("/:id/duplicate", protect, validateObjectId(), duplicatePlannedWorkout);
router.put("/:id/cancel", protect, validateObjectId(), cancelPlannedWorkout);
router.delete("/:id", protect, validateObjectId(), deletePlannedWorkout);

module.exports = router;
