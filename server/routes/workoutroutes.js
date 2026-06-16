const express = require("express");
const router = express.Router();

const {
  createWorkout,
  getWorkouts,
  updateWorkout,
  deleteWorkout,
  searchWorkouts,
  filterByMuscle,
} = require("../controllers/workoutController");

const { protect } = require("../middleware/authMiddleware");

// Create & Get Workouts
router.post("/", protect, createWorkout);
router.get("/", protect, getWorkouts);

// Search Workouts
router.get("/search", protect, searchWorkouts);

// Filter Workouts
router.get("/filter", protect, filterByMuscle);

// Update Workout
router.put("/:id", protect, updateWorkout);

// Delete Workout
router.delete("/:id", protect, deleteWorkout);

module.exports = router;