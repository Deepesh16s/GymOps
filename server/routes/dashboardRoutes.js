const express = require("express");
const router = express.Router();

const {
  getTotalWorkouts,
  getTotalVolume,
  getTotalExercises,
  getRecentWorkouts,
  getMuscleDistribution,
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
  getSessionSummary,
  getRecentSessions,
} = require("../controllers/dashboardController");

const { protect } = require("../middleware/authMiddleware");

router.get("/total-workouts", protect, getTotalWorkouts);
router.get("/total-volume", protect, getTotalVolume);
router.get("/total-exercises", protect, getTotalExercises);

router.get("/recent-workouts", protect, getRecentWorkouts);
router.get("/muscle-distribution", protect, getMuscleDistribution);
router.get("/monthly-workouts", protect, getMonthlyWorkouts);

router.get("/favorite-exercise", protect, getFavoriteExercise);
router.get("/last-workout", protect, getLastWorkout);
router.get("/average-volume", protect, getAverageVolume);
router.get("/personal-records", protect, getPersonalRecords);
router.get("/current-streak", protect, getCurrentStreak);

router.get("/weekly-workouts", protect, getWeeklyWorkouts);
router.get("/top-muscle", protect, getTopMuscle);
router.get("/top-exercise", protect, getTopExercise);
router.get("/calendar-workouts", protect, getCalendarWorkouts);

// Phase 9 — session-centric dashboard endpoints (additive, existing
// routes above are unchanged).
router.get("/session-summary", protect, getSessionSummary);
router.get("/recent-sessions", protect, getRecentSessions);

module.exports = router;