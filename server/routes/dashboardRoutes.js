const express = require("express");
const router = express.Router();

const {
  getPersonalRecords,
  getCurrentStreak,
  getTopMuscle,
  getTopExercise,
  getCalendarWorkouts,
  getSessionSummary,
  getRecentSessions,
} = require("../controllers/dashboardController");

const { protect } = require("../middleware/authMiddleware");

router.get("/personal-records", protect, getPersonalRecords);
router.get("/current-streak", protect, getCurrentStreak);
router.get("/top-muscle", protect, getTopMuscle);
router.get("/top-exercise", protect, getTopExercise);
router.get("/calendar-workouts", protect, getCalendarWorkouts);

router.get("/session-summary", protect, getSessionSummary);
router.get("/recent-sessions", protect, getRecentSessions);

module.exports = router;
