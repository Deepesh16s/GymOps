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

router.post("/", protect, createPlannedWorkout);
router.get("/", protect, getPlannedWorkouts);
router.put("/:id", protect, updatePlannedWorkout);
router.put("/:id/reschedule", protect, reschedulePlannedWorkout);
router.put("/:id/complete", protect, markPlannedWorkoutComplete);
router.post("/:id/duplicate", protect, duplicatePlannedWorkout);
router.put("/:id/cancel", protect, cancelPlannedWorkout);
router.delete("/:id", protect, deletePlannedWorkout);

module.exports = router;
