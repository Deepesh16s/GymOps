const express = require("express");
const router = express.Router();

const {
  createWorkout,
  getWorkouts,
} = require("../controllers/workoutcontrollers");

const { protect } = require("../middleware/authMiddleware");

// Create workout
router.post("/", protect, createWorkout);

// Get all workouts of logged-in user
router.get("/", protect, getWorkouts);

module.exports = router;