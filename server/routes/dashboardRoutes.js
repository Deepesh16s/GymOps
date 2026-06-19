const express = require("express");
const router = express.Router();

const {
  getTotalWorkouts,
  getTotalVolume,
  getTotalExercises,
  getRecentWorkouts,
  getMuscleDistribution,
  getWeeklyVolume,
  getMonthlyWorkouts,
  getFavoriteExercise,
  getLastWorkout,
  getAverageVolume,
  getPersonalRecords,
  getCurrentStreak,
  getWeeklyWorkouts,
  getTopMuscle,
  getTopExercise,
  getCalendarWorkouts,
} = require(
  "../controllers/dashboardController"
);

const { protect } = require("../middleware/authMiddleware");

// Dashboard Cards
router.get("/total-workouts", protect, getTotalWorkouts);
router.get("/total-volume", protect, getTotalVolume);
router.get("/total-exercises", protect, getTotalExercises);

// Analytics
router.get("/recent-workouts", protect, getRecentWorkouts);
router.get(
  "/muscle-distribution",
  protect,
  getMuscleDistribution
);
router.get("/weekly-volume", protect, getWeeklyVolume);
router.get(
  "/monthly-workouts",
  protect,
  getMonthlyWorkouts
);

// Advanced Analytics
router.get(
  "/favorite-exercise",
  protect,
  getFavoriteExercise
);
router.get("/last-workout", protect, getLastWorkout);
router.get(
  "/average-volume",
  protect,
  getAverageVolume
);
router.get(
  "/personal-records",
  protect,
  getPersonalRecords
);
router.get(
  "/current-streak",
  protect,
  getCurrentStreak
);

// Day 4 Analytics
router.get(
  "/weekly-workouts",
  protect,
  getWeeklyWorkouts
);
router.get("/top-muscle", protect, getTopMuscle);
router.get("/top-exercise", protect, getTopExercise);

module.exports = router;
router.get(
  "/calendar-workouts",
  protect,
  getCalendarWorkouts
);